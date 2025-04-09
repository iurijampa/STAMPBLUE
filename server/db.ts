import { drizzle } from "drizzle-orm/postgres-js";
import postgres from 'postgres';
import * as schema from "@shared/schema";

// Cliente SQL com postgres-js (mais robusto e compatível)
const connectionString = process.env.DATABASE_URL!;
export const sql = postgres(connectionString, { max: 10, idle_timeout: 20 });
export const db = drizzle(sql, { schema });

// Cache de consultas preparadas para melhorar performance
const queryCache = new Map<string, any>();

// Função auxiliar para criar um cliente de pool de conexões com cache
export async function withPool<T>(callback: () => Promise<T>): Promise<T> {
  try {
    return await callback();
  } catch (error) {
    console.error("Erro na operação do banco:", error);
    throw error;
  }
}

// MODO DE EMERGÊNCIA: Função para consultas otimizadas com cache muito maior
export async function cachedQuery<T>(key: string, query: () => Promise<T>, ttlMs = 60000): Promise<T> {
  const cached = queryCache.get(key);
  
  // Se temos cache válido, use-o - agora com 60 segundos de duração (6x mais que antes)
  if (cached && cached.timestamp > Date.now() - ttlMs) {
    console.log(`MODO RÁPIDO: Usando cache para ${key} (${Math.floor((Date.now() - cached.timestamp)/1000)}s de ${ttlMs/1000}s)`);
    return cached.data;
  }
  
  // Caso contrário, execute a consulta e armazene o resultado
  console.log(`MODO RÁPIDO: Cache expirado para ${key}, buscando dados novos`);
  try {
    const result = await query();
    queryCache.set(key, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    // MODO DE EMERGÊNCIA: Se a consulta falhar e tivermos dados em cache, use-os mesmo expirados
    if (cached) {
      console.log(`MODO RÁPIDO: Erro ao buscar dados novos, usando cache expirado para ${key}`);
      return cached.data;
    }
    throw error;
  }
}

// Função para limpar o cache por prefixo/padrão
export function clearCacheByPattern(pattern: string): number {
  let count = 0;
  for (const key of queryCache.keys()) {
    if (key.includes(pattern)) {
      queryCache.delete(key);
      count++;
    }
  }
  return count;
}

// Função para limpar todo o cache
export function clearAllCache(): number {
  const size = queryCache.size;
  queryCache.clear();
  return size;
}