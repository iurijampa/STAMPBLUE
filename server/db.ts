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

// Função para consultas otimizadas com cache
export async function cachedQuery<T>(key: string, query: () => Promise<T>, ttlMs = 10000): Promise<T> {
  const cached = queryCache.get(key);
  
  // Se temos cache válido, use-o
  if (cached && cached.timestamp > Date.now() - ttlMs) {
    return cached.data;
  }
  
  // Caso contrário, execute a consulta e armazene o resultado
  const result = await query();
  queryCache.set(key, { data: result, timestamp: Date.now() });
  return result;
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