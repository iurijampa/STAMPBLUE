import { drizzle } from "drizzle-orm/postgres-js";
import postgres from 'postgres';
import * as schema from "@shared/schema";

// Cliente SQL com postgres-js (mais robusto e compatível)
const connectionString = process.env.DATABASE_URL!;
export const sql = postgres(connectionString, { max: 10, idle_timeout: 20 });
export const db = drizzle(sql, { schema });

// Cache de consultas preparadas para melhorar performance
const queryCache = new Map<string, { data: any, timestamp: number }>();

// Cache persistente pré-computado - super otimizado para atividades pendentes por departamento
export const CACHE_PERSISTENTE_POR_DEPT = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL_DEPT_ACTIVITIES = 30 * 1000; // 30 segundos

// Função auxiliar para criar um cliente de pool de conexões com cache
export async function withPool<T>(callback: () => Promise<T>): Promise<T> {
  try {
    return await callback();
  } catch (error) {
    console.error("Erro na operação do banco:", error);
    throw error;
  }
}

// MODO DE EMERGÊNCIA: Função para consultas otimizadas com cache multi-camada e verificação de integridade
export async function cachedQuery<T>(key: string, query: () => Promise<T>, ttlMs = 60000): Promise<T> {
  const cached = queryCache.get(key);
  
  // VERIFICAÇÃO DE INTEGRIDADE: Validar se os dados em cache são íntegros antes de retorná-los
  function isValidCachedData(data: any): boolean {
    // Se for um array, verificar se tem a estrutura esperada
    if (Array.isArray(data)) {
      // Array vazio é válido
      if (data.length === 0) return true;
      
      // Para arrays não vazios, verificar se o primeiro item tem propriedades básicas
      // que indicam que é um objeto válido
      const firstItem = data[0];
      return firstItem !== null && 
             typeof firstItem === 'object' && 
             ('id' in firstItem || 'title' in firstItem);
    }
    
    // Para objetos, verificar se não é nulo e tem pelo menos uma propriedade
    if (data !== null && typeof data === 'object') {
      return Object.keys(data).length > 0;
    }
    
    // Para outros tipos de dados (string, number, etc), considerar válido se não for undefined
    return data !== undefined;
  }
  
  // Se temos cache válido, verificar sua integridade antes de usar
  if (cached && cached.timestamp > Date.now() - ttlMs) {
    if (isValidCachedData(cached.data)) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`MODO RÁPIDO: Usando cache para ${key} (${Math.floor((Date.now() - cached.timestamp)/1000)}s de ${ttlMs/1000}s)`);
      }
      return cached.data;
    } else {
      console.warn(`INTEGRIDADE: Cache corrompido detectado para ${key}, buscando dados novos`);
      // Se os dados estiverem corrompidos, não usar o cache
    }
  }
  
  // Caso contrário, execute a consulta e armazene o resultado com verificação
  if (process.env.NODE_ENV !== 'production') {
    console.log(`MODO RÁPIDO: Cache expirado para ${key}, buscando dados novos`);
  }
  
  try {
    const result = await query();
    
    // VERIFICAÇÃO DE INTEGRIDADE: Validar o resultado antes de armazenar no cache
    if (isValidCachedData(result)) {
      queryCache.set(key, { 
        data: result, 
        timestamp: Date.now()
      });
    } else {
      console.error(`INTEGRIDADE: Resultado da consulta inválido para ${key}, não armazenado em cache`);
    }
    
    return result;
  } catch (error) {
    // MECANISMO DE RECUPERAÇÃO: Se a consulta falhar e tivermos dados em cache, usar mesmo expirados
    if (cached && isValidCachedData(cached.data)) {
      console.log(`MODO RÁPIDO: Erro ao buscar dados novos, usando cache expirado para ${key}`);
      return cached.data;
    }
    
    // Registrar erro detalhado para depuração
    console.error(`ERRO DB: Falha na consulta ${key}:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Função para limpar o cache por prefixo/padrão com verificação de segurança
export function clearCacheByPattern(pattern: string): number {
  // Verificação de segurança: impedir limpeza de padrões muito genéricos
  if (!pattern || pattern.length < 3) {
    console.warn(`CACHE: Tentativa de limpeza com padrão inseguro: '${pattern}'`);
    return 0;
  }
  
  let count = 0;
  try {
    // Coletar chaves em um array primeiro para evitar modificação durante iteração
    const keysToDelete = Array.from(queryCache.keys())
      .filter(key => key.includes(pattern));
    
    // Remover chaves em uma segunda passagem
    for (const key of keysToDelete) {
      queryCache.delete(key);
      count++;
    }
    
    if (count > 0 && process.env.NODE_ENV !== 'production') {
      console.log(`CACHE: Removidas ${count} entradas com padrão '${pattern}'`);
    }
  } catch (error) {
    console.error(`CACHE: Erro ao limpar cache com padrão '${pattern}':`, 
      error instanceof Error ? error.message : String(error));
  }
  
  return count;
}

// Função para limpar todo o cache com verificação de integridade
export function clearAllCache(): number {
  try {
    const size = queryCache.size;
    queryCache.clear();
    
    if (size > 0 && process.env.NODE_ENV !== 'production') {
      console.log(`CACHE: Limpeza completa de ${size} entradas realizada com sucesso`);
    }
    
    return size;
  } catch (error) {
    console.error('CACHE: Erro ao limpar cache completo:', 
      error instanceof Error ? error.message : String(error));
    
    // Recriação segura do cache em caso de corrupção
    try {
      const oldSize = queryCache.size;
      const tempCache = new Map();
      
      // Tentar migrar dados válidos
      for (const [key, value] of queryCache.entries()) {
        if (value && typeof value === 'object') {
          tempCache.set(key, value);
        }
      }
      
      // Recriar o cache completamente
      (globalThis as any).queryCache = tempCache;
      
      console.warn(`CACHE: Cache recriado após erro. Antes: ${oldSize}, Depois: ${tempCache.size}`);
      return oldSize;
    } catch (recoveryError) {
      // Último recurso: recriar o cache do zero
      (globalThis as any).queryCache = new Map();
      console.error('CACHE: Falha na recuperação, cache recriado vazio');
      return 0;
    }
  }
}

// Adiciona uma nova função para verificar e otimizar a integridade do cache
export function checkCacheIntegrity(): { totalItems: number, corrupted: number, repaired: number } {
  const result = {
    totalItems: queryCache.size,
    corrupted: 0,
    repaired: 0
  };
  
  try {
    // Verificar cada item do cache 
    for (const [key, item] of queryCache.entries()) {
      // Verificar se o item tem a estrutura esperada
      if (!item || typeof item !== 'object' || !('data' in item) || !('timestamp' in item)) {
        result.corrupted++;
        
        // Remover entradas corrompidas
        queryCache.delete(key);
        continue;
      }
      
      // Verificar a validade dos dados (não null/undefined)
      if (item.data === null || item.data === undefined) {
        result.corrupted++;
        queryCache.delete(key);
        continue;
      }
      
      // Verificar se o timestamp é um número válido
      if (typeof item.timestamp !== 'number' || isNaN(item.timestamp)) {
        // Tentar repará-lo definindo o timestamp atual
        item.timestamp = Date.now();
        result.repaired++;
      }
    }
    
    if (result.corrupted > 0 || result.repaired > 0) {
      console.log(`CACHE-INTEGRITY: Verificação concluída. Total: ${result.totalItems}, Corrompidos: ${result.corrupted}, Reparados: ${result.repaired}`);
    }
    
    return result;
  } catch (error) {
    console.error('CACHE-INTEGRITY: Erro durante verificação:', 
      error instanceof Error ? error.message : String(error));
    return result;
  }
}

// Executar verificação de integridade a cada 5 minutos
setInterval(checkCacheIntegrity, 300000);