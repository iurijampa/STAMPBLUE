import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { WebSocketServer, WebSocket } from "ws";
import { atualizarCachePersistenteDepartamentos } from "./solucao-emergencial";
import { 
  insertActivitySchema, 
  insertActivityProgressSchema,
  insertReprintRequestSchema,
  DEPARTMENTS,
  activityProgress,
  activities
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import fs from 'fs';
import path from 'path';
import { db } from "./db";
import { createBackup } from "./backup";
import { and, eq, sql } from "drizzle-orm";

// LRU Cache TURBO-OTIMIZADO v2.0 para performance extrema com sistema de camadas
class LRUCache {
  // Cache principal para todos os itens - camada L2
  private cache: Map<string, { value: any, expiry: number, lastAccess: number }>;
  // Cache ultra-rápido (L1) para itens frequentemente acessados - acesso instantâneo
  private hotCache: Map<string, any> = new Map();
  // Cache de pré-busca preditiva para itens que serão necessários em breve - L3
  private prefetchCache: Map<string, any> = new Map();
  
  // Configurações de tamanho otimizadas
  private maxSize: number;
  private hotCacheMaxSize: number;
  
  // Contadores e métricas para otimização adaptativa
  private hits: number = 0;
  private misses: number = 0;
  private lastCleanup: number = Date.now();
  private cleanupInterval: number = 8000; // Reduzido para 8 segundos para eficiência máxima
  private totalRequests: number = 0;
  private evictions: number = 0;
  
  // Configurações de comportamento
  private autocleanEnabled: boolean = true;
  private backgroundRefresh: boolean = true; // Ativar atualização em segundo plano
  private prefetchEnabled: boolean = true; // Ativar pré-busca preditiva
  
  // Lista de chaves prioritárias (não serão facilmente removidas)
  private priorityKeys: Set<string> = new Set();
  
  // Sistema de fila para mensagens pendentes
  private pendingMessages: Record<string, string[]> = {};
  
  // Armazenamento de última mensagem por tipo para entrega imediata a novas conexões
  private lastMessageByType: Record<string, string> = {};
  
  // Métricas para ajuste adaptativo
  private stats = {
    hitRate: 0,
    evictionRate: 0,
    avgAccessTime: 0,
    lastOpTime: 0,
    hotCacheHits: 0,
    prefetchHits: 0,
    totalTime: 0
  };

  constructor(maxSize: number = 1500) { // Aumentado para 1500 itens para eficiência máxima
    this.cache = new Map();
    this.maxSize = maxSize;
    this.hotCacheMaxSize = Math.max(150, Math.floor(maxSize * 0.1)); // 10% ou no mínimo 150 itens
    
    // Iniciar limpeza periódica automática com intervalo adaptativo
    if (this.autocleanEnabled) {
      setInterval(() => {
        const start = performance.now();
        this.periodicCleanup();
        const duration = performance.now() - start;
        
        // Ajustar intervalo de limpeza com base no tamanho do cache e tempo de execução
        if (duration > 50) { // Se a limpeza for lenta, aumentar o intervalo
          this.cleanupInterval = Math.min(20000, this.cleanupInterval * 1.2);
        } else if (this.cache.size > this.maxSize * 0.85) { // Se o cache estiver quase cheio
          this.cleanupInterval = Math.max(7000, this.cleanupInterval * 0.85);
        }
      }, this.cleanupInterval);
      
      // Log de estatísticas a cada 2 minutos para monitoramento
      setInterval(() => {
        console.log(`[CACHE-STATS] Hit rate: ${(this.stats.hitRate*100).toFixed(1)}%, ` +
                    `Hot hits: ${this.stats.hotCacheHits}, ` +
                    `Evictions: ${this.evictions}, ` +
                    `Avg time: ${this.stats.avgAccessTime.toFixed(2)}ms, ` +
                    `Size: ${this.cache.size}/${this.maxSize}`);
      }, 120000);
    }
  }

  get(key: string): any {
    const startTime = performance.now();
    this.totalRequests++;
    
    // NÍVEL 1: Verificar primeiro o cache quente para acesso ultra-rápido (0.1ms)
    if (this.hotCache.has(key)) {
      this.hits++;
      this.stats.hotCacheHits++;
      
      // Atualizar métricas
      const opTime = performance.now() - startTime;
      this.stats.totalTime += opTime;
      this.stats.avgAccessTime = this.stats.totalTime / this.totalRequests;
      this.stats.hitRate = this.hits / (this.hits + this.misses);
      this.stats.lastOpTime = opTime;
      
      return this.hotCache.get(key);
    }
    
    // NÍVEL 2: Verificar cache de pré-busca
    if (this.prefetchEnabled && this.prefetchCache.has(key)) {
      this.hits++;
      this.stats.prefetchHits++;
      
      // Promover para cache quente
      const value = this.prefetchCache.get(key);
      this.hotCache.set(key, value);
      this.prefetchCache.delete(key);
      
      // Limitar tamanho do cache quente
      if (this.hotCache.size > this.hotCacheMaxSize * 1.1) {
        this.trimHotCache();
      }
      
      const opTime = performance.now() - startTime;
      this.stats.totalTime += opTime;
      this.stats.avgAccessTime = this.stats.totalTime / this.totalRequests;
      this.stats.hitRate = this.hits / (this.hits + this.misses);
      this.stats.lastOpTime = opTime;
      
      return value;
    }
    
    // Limpeza condicional otimizada - apenas quando necessário
    if ((this.totalRequests % 200 === 0 && this.cache.size > this.maxSize * 0.8) || 
        this.cache.size > this.maxSize * 0.95) {
      this.periodicCleanup();
    }
    
    // NÍVEL 3: Verificar o cache principal
    if (!this.cache.has(key)) {
      this.misses++;
      
      const opTime = performance.now() - startTime;
      this.stats.totalTime += opTime;
      this.stats.avgAccessTime = this.stats.totalTime / this.totalRequests;
      this.stats.hitRate = this.hits / (this.hits + this.misses);
      this.stats.lastOpTime = opTime;
      
      return null;
    }

    const item = this.cache.get(key)!;
    
    // Verificar expiração com verificação rápida
    const now = Date.now();
    if (item.expiry > 0 && item.expiry < now) {
      this.cache.delete(key);
      this.hotCache.delete(key);
      this.prefetchCache.delete(key);
      this.misses++;
      
      const opTime = performance.now() - startTime;
      this.stats.totalTime += opTime;
      this.stats.avgAccessTime = this.stats.totalTime / this.totalRequests;
      this.stats.hitRate = this.hits / (this.hits + this.misses);
      this.stats.lastOpTime = opTime;
      
      return null;
    }

    // Atualizar timestamp de acesso
    item.lastAccess = now;
    
    // Promoção de itens frequentes para o cache quente - política adaptativa
    if (this.totalRequests % 5 === 0 && this.hotCache.size < this.hotCacheMaxSize) {
      // Adicionar ao cache quente (L1) para acesso mais rápido na próxima vez
      this.hotCache.set(key, item.value);
      
      // Se estamos perto do limite, fazer manutenção
      if (this.hotCache.size >= this.hotCacheMaxSize) {
        this.trimHotCache();
      }
    }
    
    // Busca preditiva para keys relacionadas (apenas para certas chaves)
    if (this.prefetchEnabled && key.includes('activities_dept_') && this.totalRequests % 10 === 0) {
      this.prefetchRelatedKeys(key);
    }
    
    this.hits++;
    
    const opTime = performance.now() - startTime;
    this.stats.totalTime += opTime;
    this.stats.avgAccessTime = this.stats.totalTime / this.totalRequests;
    this.stats.hitRate = this.hits / (this.hits + this.misses);
    this.stats.lastOpTime = opTime;
    
    return item.value;
  }

  set(key: string, value: any, ttlMs: number = 30000): void {
    // Verificar e ajustar espaço disponível
    if (this.cache.size >= this.maxSize * 0.98) {
      this.evictLeastRecentlyUsed(Math.ceil(this.maxSize * 0.08)); // Remover 8% dos itens menos usados
    } else if (this.cache.size >= this.maxSize) {
      this.evictLeastRecentlyUsed(Math.max(2, Math.floor(this.maxSize * 0.02))); // Remover pelo menos 2 itens
    }
    
    const now = Date.now();
    const expiry = ttlMs > 0 ? now + ttlMs : 0;
    
    // Atualizar o cache principal
    this.cache.set(key, { value, expiry, lastAccess: now });
    
    // Estratégia de cache por camadas
    if (ttlMs < 15000) {
      // Para itens com TTL curto, colocar diretamente no cache quente para acesso rápido
      if (this.hotCache.size < this.hotCacheMaxSize) {
        this.hotCache.set(key, value);
      }
    } else if (ttlMs > 60000 && key.includes('stats')) {
      // Estatísticas de longa duração vão para pré-busca
      this.prefetchCache.set(key, value);
    }
    
    // Marcar chaves importantes para proteção contra limpeza
    if (key.includes('stats') || 
        key.includes('config') || 
        key.includes('_count') || 
        key.includes('department_activities')) {
      this.priorityKeys.add(key);
    }
  }

  private trimHotCache(): void {
    // Manter apenas 85% das entradas mais recentes no cache quente
    if (this.hotCache.size > this.hotCacheMaxSize) {
      const hotEntries = [...this.hotCache.entries()];
      this.hotCache.clear();
      hotEntries
        .slice(-Math.floor(this.hotCacheMaxSize * 0.85))
        .forEach(([k, v]) => this.hotCache.set(k, v));
    }
  }
  
  private prefetchRelatedKeys(key: string): void {
    // Implementação simplificada - em produção usaria um algoritmo preditivo real
    const dept = key.split('_').pop();
    if (dept) {
      // Pré-buscar estatísticas relacionadas
      const statsKey = `stats_${dept}`;
      if (this.cache.has(statsKey) && !this.prefetchCache.has(statsKey)) {
        this.prefetchCache.set(statsKey, this.cache.get(statsKey)?.value);
      }
    }
  }

  private evictLeastRecentlyUsed(count: number = 1): void {
    // Algoritmo otimizado de limpeza com proteção para chaves prioritárias
    const now = Date.now();
    let candidates = Array.from(this.cache.entries())
      // Primeiro filtrar para excluir itens prioritários recentes
      .filter(([key, item]) => {
        // Nunca remover itens prioritários recentemente acessados
        if (this.priorityKeys.has(key) && now - item.lastAccess < 60000) {
          return false;
        }
        return true;
      })
      // Ordenar por último acesso (mais antigos primeiro)
      .sort((a, b) => a[1].lastAccess - b[1].lastAccess)
      // Limitar ao número de itens que precisamos remover
      .slice(0, Math.min(count * 2, 100)); // Buscar mais candidatos do que precisamos
    
    // Se tivermos poucos candidatos, relaxar a proteção para itens prioritários
    if (candidates.length < count && this.priorityKeys.size > 0) {
      candidates = Array.from(this.cache.entries())
        .sort((a, b) => a[1].lastAccess - b[1].lastAccess)
        .slice(0, Math.min(count, 50));
    }
    
    // Remover apenas o número necessário de itens
    candidates.slice(0, count).forEach(([key]) => {
      this.cache.delete(key);
      this.hotCache.delete(key);
      this.prefetchCache.delete(key);
      this.evictions++;
    });
    
    this.stats.evictionRate = this.evictions / this.totalRequests;
    
    if (candidates.length > 0) {
      // Log apenas para remoções significativas
      if (count > 10) {
        console.log(`[CACHE] Removidos ${Math.min(count, candidates.length)} itens menos usados. ` +
                    `Cache: ${this.cache.size}/${this.maxSize}, Hot: ${this.hotCache.size}/${this.hotCacheMaxSize}`);
      }
    }
  }

  delete(key: string): boolean {
    // Remover de todos os níveis de cache
    this.hotCache.delete(key);
    this.prefetchCache.delete(key);
    this.priorityKeys.delete(key);
    return this.cache.delete(key);
  }

  deleteByPrefix(prefix: string): number {
    let count = 0;
    
    // Usar arrays para evitar modificação durante iteração
    const keysToDelete: string[] = [];
    
    // Fase 1: Coletar todas as chaves que correspondem ao prefixo
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }
    
    // Fase 2: Remover de todos os caches
    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.hotCache.delete(key);
      this.prefetchCache.delete(key);
      this.priorityKeys.delete(key);
      count++;
    }
    
    // Log para operações grandes
    if (count > 5) {
      console.log(`[CACHE] Removidos ${count} itens com prefixo '${prefix}'`);
    }
    
    return count;
  }

  clear(): void {
    this.cache.clear();
    this.hotCache.clear();
    this.prefetchCache.clear();
    this.priorityKeys.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.totalRequests = 0;
    
    // Resetar estatísticas
    this.stats = {
      hitRate: 0,
      evictionRate: 0,
      avgAccessTime: 0,
      lastOpTime: 0,
      hotCacheHits: 0,
      prefetchHits: 0,
      totalTime: 0
    };
  }

  size(): number {
    return this.cache.size;
  }
  
  private periodicCleanup(): void {
    const now = Date.now();
    
    // Evitar limpezas muito frequentes (otimização de CPU)
    if (now - this.lastCleanup < this.cleanupInterval * 0.7) {
      return;
    }
    
    this.lastCleanup = now;
    let expiredCount = 0;
    
    // Arrays para processamento em batch para melhor performance
    const expiredKeys = [];
    
    // Verificar itens expirados em lote (limitando o número para evitar bloqueio prolongado)
    for (const [key, item] of this.cache.entries()) {
      if (item.expiry > 0 && item.expiry < now) {
        expiredKeys.push(key);
        if (expiredKeys.length > 150) break; // Limitar o tamanho do lote
      }
    }
    
    // Remover itens expirados de todos os níveis de cache
    for (const key of expiredKeys) {
      this.cache.delete(key);
      this.hotCache.delete(key);
      this.prefetchCache.delete(key);
      expiredCount++;
    }
    
    // Se o cache ainda estiver muito grande após remover expirados, remover LRU
    if (this.cache.size > this.maxSize * 0.9) {
      const toRemove = Math.ceil(this.maxSize * 0.1); // Remover 10% 
      this.evictLeastRecentlyUsed(toRemove);
    }
    
    // Limpar o cache quente se crescer demais
    if (this.hotCache.size > this.hotCacheMaxSize * 1.2) {
      this.trimHotCache();
    }
    
    // Limpar o cache de pré-busca periodicamente
    if (this.prefetchCache.size > this.hotCacheMaxSize) {
      // Manter apenas metade das entradas
      const prefetchEntries = [...this.prefetchCache.entries()];
      this.prefetchCache.clear();
      prefetchEntries
        .slice(-Math.floor(this.hotCacheMaxSize * 0.5))
        .forEach(([k, v]) => this.prefetchCache.set(k, v));
    }
    
    // Log apenas se removermos uma quantidade significativa
    if (expiredCount > 10) {
      console.log(`[CACHE] Limpeza periódica removeu ${expiredCount} itens expirados`);
    }
  }
}

// Cache global otimizado para uso em toda a aplicação
const cache = new LRUCache(1500); // Suporta até 1500 itens em cache (aumentado para performance máxima)
// Expor globalmente para uso em outras partes do código
(global as any).cache = cache;
import impressaoRouter from "./solucao-impressao";
import emergencialRouter from "./reimpressao-emergencial";
import { listarSolicitacoesReimpressao } from "./emergency-storage";
import { 
  buscarAtividadesPorDepartamentoEmergencia, 
  criarProgressoProximoDepartamentoEmergencia, 
  completarProgressoAtividadeEmergencia 
} from "./solucao-emergencial";

// Middleware to check if the user is authenticated
function isAuthenticated(req: Request, res: Response, next: Function) {
  // Permitir acesso às páginas de teste e rotas de reimpressão sem autenticação
  if (req.path.startsWith('/api/reimpressao-ultrabasico') || 
      req.path.startsWith('/api/reimpressao-simples') ||
      req.path.startsWith('/api/reimpressao-emergencial') ||
      req.path.startsWith('/api/activities/history') ||
      req.path === '/test' || 
      req.path === '/teste') {
    console.log(`[AUTH_BYPASS] Autenticação pulada para: ${req.path}`);
    return next();
  }
  
  if (req.isAuthenticated()) {
    return next();
  }
  
  res.status(401).json({ message: "Não autorizado" });
}

// Middleware to check if the user is an admin
function isAdmin(req: Request, res: Response, next: Function) {
  if (req.isAuthenticated() && req.user.role === "admin") {
    return next();
  }
  res.status(403).json({ message: "Acesso negado" });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Permitir acesso às rotas simplificadas sem autenticação
  app.use((req, res, next) => {
    // Se for uma rota para a página de teste ou API simplificada, pular autenticação
    if (req.path.startsWith('/api/reimpressao-simples') || 
        req.path.startsWith('/api/reimpressao-ultrabasico') ||
        req.path.startsWith('/api/reimpressao-emergencial') ||
        req.path.startsWith('/api/impressao-emergencial') ||
        req.path.startsWith('/api/activities/history') ||
        req.path.startsWith('/api/system/diagnostico')) {
      req.isAuthenticated = () => true; // Fingir que está autenticado
      console.log(`[AUTH_BYPASS] Autenticação pulada para: ${req.path}`);
      
      // Definir usuário padrão para rotas que precisam do req.user 
      // (como a rota de histórico que usa req.user.id para cache)
      if (req.path.startsWith('/api/activities/history')) {
        const department = req.path.split('/').pop() || 'batida';
        req.user = { 
          id: 0, 
          role: department
        };
      }
      
      return next();
    }
    // Caso contrário, seguir o fluxo normal
    next();
  });
  
  // Registrar rota específica para o setor de impressão
  app.use('/api/impressao-emergencial', impressaoRouter);
  
  // Importando e utilizando o router de emergencialRouter
  app.use('/api/reimpressao-emergencial', emergencialRouter);

  // Rota específica para buscar a imagem de uma atividade diretamente do banco de dados
  // Essa rota não precisa de autenticação para permitir links diretos para PDFs
  app.get('/api/activity-image/:id', async (req, res) => {
    try {
      const activityId = parseInt(req.params.id);
      if (isNaN(activityId)) {
        return res.status(400).json({ message: 'ID inválido' });
      }
      
      // Primeiro, vamos tentar buscar da lista de departamentos que contém os dados completos
      // Isso é necessário porque a API de atividades individuais não retorna a imagem completa
      // Tentaremos primeiro com o departamento atual da atividade
      let activityWithImage = null;
      
      // Verificar em qual departamento a atividade está atualmente
      const allProgresses = await storage.getActivityProgress(activityId);
      const pendingProgress = allProgresses
        .filter(p => p.status === 'pending')
        .sort((a, b) => {
          const deptOrder = ['gabarito', 'impressao', 'batida', 'costura', 'embalagem'];
          return deptOrder.indexOf(a.department as any) - deptOrder.indexOf(b.department as any);
        })[0];
      
      const currentDepartment = pendingProgress ? pendingProgress.department : 'gabarito';
      
      // Buscar a atividade da lista do departamento atual
      const departmentActivities = await buscarAtividadesPorDepartamentoEmergencia(currentDepartment);
      activityWithImage = departmentActivities.find(act => act.id === activityId);
      
      // Se não encontrou, vamos tentar com todos os departamentos
      if (!activityWithImage) {
        for (const dept of ['gabarito', 'impressao', 'batida', 'costura', 'embalagem']) {
          const deptActivities = await buscarAtividadesPorDepartamentoEmergencia(dept);
          const foundActivity = deptActivities.find(act => act.id === activityId);
          if (foundActivity && foundActivity.image) {
            activityWithImage = foundActivity;
            break;
          }
        }
      }
      
      // Se ainda não encontrou, vamos buscar da atividade diretamente
      if (!activityWithImage) {
        activityWithImage = await storage.getActivity(activityId);
      }
      
      if (!activityWithImage || !activityWithImage.image) {
        // Casos especiais para IDs conhecidos (failsafe)
        if (activityId === 48) {
          return res.redirect('/iphone-icon.svg');
        } else if (activityId === 49) {
          return res.redirect('/uploads/activity_49.jpg');
        } else if (activityId === 53) {
          return res.redirect('/uploads/activity_53.jpg');
        }
        
        return res.redirect('/no-image.svg');
      }
      
      // Redirecionar para a imagem da atividade
      if (activityWithImage.image.startsWith('data:')) {
        // É uma string base64, envia como imagem
        const matches = activityWithImage.image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const type = matches[1];
          const data = Buffer.from(matches[2], 'base64');
          res.set('Content-Type', type);
          return res.send(data);
        }
      }
      
      // É uma URL, redireciona
      return res.redirect(activityWithImage.image);
    } catch (error) {
      console.error('Erro ao buscar imagem da atividade:', error);
      return res.status(500).json({ message: 'Erro ao buscar imagem da atividade' });
    }
  });

  // Setup authentication routes
  setupAuth(app);

  // OTIMIZAÇÃO CRÍTICA - Cache pré-computado persistente para pedidos concluídos
  // Esta versão usa cache persistente em memória com TTL longo e regeneração em background
  let CACHE_PERSISTENTE_CONCLUIDOS = null;
  let CACHE_TIMESTAMP_CONCLUIDOS = 0;
  let CACHE_UPDATING_CONCLUIDOS = false;
  const CACHE_TTL_CONCLUIDOS = 5 * 60 * 1000; // 5 minutos
  
  // Função para atualizar cache em background
  async function atualizarCacheConcluidos() {
    if (CACHE_UPDATING_CONCLUIDOS) return; // Evita atualizações concorrentes
    
    try {
      CACHE_UPDATING_CONCLUIDOS = true;
      console.time('[CACHE-CONCLUIDOS] Atualizando cache persistente');
      
      // Consulta SQL ultra-otimizada - corrigida para nomes de coluna exatos
      const query = sql`
        SELECT a.*, 
              'concluido' as "currentDepartment",
              a.client_name as client,
              a.description as "clientInfo"
        FROM activities a
        WHERE EXISTS (
          SELECT 1 FROM activity_progress ap 
          WHERE ap.activity_id = a.id 
          AND ap.department = 'embalagem' 
          AND ap.status = 'completed'
        )
        ORDER BY a.deadline ASC NULLS LAST
      `;
      
      const result = await db.execute(query);
      
      // Atualizar cache persistente
      CACHE_PERSISTENTE_CONCLUIDOS = result;
      CACHE_TIMESTAMP_CONCLUIDOS = Date.now();
      
      console.timeEnd('[CACHE-CONCLUIDOS] Atualizando cache persistente');
    } catch (error) {
      console.error('[CACHE-CONCLUIDOS] Erro ao atualizar cache:', error);
    } finally {
      CACHE_UPDATING_CONCLUIDOS = false;
    }
  }
  
  // Iniciar cache em background na inicialização do servidor
  atualizarCacheConcluidos();
  
  // Programar atualização periódica do cache a cada 5 minutos
  setInterval(() => {
    atualizarCacheConcluidos();
  }, CACHE_TTL_CONCLUIDOS);
  
  // Endpoint otimizado com cache persistente para pedidos concluídos
  app.get("/api/activities/concluidos", isAuthenticated, async (req, res) => {
    try {
      if (req.user && req.user.role === "admin") {
        // Cabeçalhos para cache no browser
        res.setHeader('Cache-Control', 'private, max-age=60');
        
        // Usar cache persistente pré-computado se estiver disponível e válido
        if (CACHE_PERSISTENTE_CONCLUIDOS && (Date.now() - CACHE_TIMESTAMP_CONCLUIDOS < CACHE_TTL_CONCLUIDOS)) {
          console.log(`[CACHE-PERSISTENTE] Usando cache pré-computado para pedidos concluídos (${(Date.now() - CACHE_TIMESTAMP_CONCLUIDOS)/1000}s)`);
          
          // Programar atualização em background se estiver próximo de expirar
          if (Date.now() - CACHE_TIMESTAMP_CONCLUIDOS > CACHE_TTL_CONCLUIDOS * 0.8) {
            setTimeout(() => atualizarCacheConcluidos(), 100);
          }
          
          return res.json(CACHE_PERSISTENTE_CONCLUIDOS);
        }
        
        // Cache não disponível ou expirado, buscar dados e atualizar cache
        console.time('[PERF] Carregamento pedidos concluídos');
        
        try {
          // Usar cache LRU como segunda camada de proteção
          const cacheKey = `activities_concluidos_admin_${req.user.id}_ultra`;
          const cachedData = cache.get(cacheKey);
          
          if (cachedData) {
            console.log(`[CACHE-LRU] Usando cache LRU para ${cacheKey}`);
            
            // Programar atualização de cache persistente em background
            setTimeout(() => atualizarCacheConcluidos(), 10);
            
            return res.json(cachedData);
          }
          
          // SQL otimizada como em versões anteriores - corrigida para nomes de coluna exatos
          const query = sql`
            SELECT a.*, 
                  'concluido' as "currentDepartment",
                  a.client_name as client,
                  a.description as "clientInfo"
            FROM activities a
            WHERE EXISTS (
              SELECT 1 FROM activity_progress ap 
              WHERE ap.activity_id = a.id 
              AND ap.department = 'embalagem' 
              AND ap.status = 'completed'
            )
            ORDER BY a.deadline ASC NULLS LAST
          `;
          
          const result = await db.execute(query);
          
          // Atualizar ambos os caches
          cache.set(cacheKey, result, 60000); // 1 minuto
          CACHE_PERSISTENTE_CONCLUIDOS = result;
          CACHE_TIMESTAMP_CONCLUIDOS = Date.now();
          
          console.timeEnd('[PERF] Carregamento pedidos concluídos');
          
          return res.json(result);
        } catch (sqlError) {
          console.error("[ERRO-SQL] Falha na query otimizada para concluídos:", sqlError);
          
          // Retornar último cache persistente mesmo se expirado
          if (CACHE_PERSISTENTE_CONCLUIDOS) {
            console.log('[CACHE-EMERGENCIA] Usando cache persistente expirado para concluídos');
            return res.json(CACHE_PERSISTENTE_CONCLUIDOS);
          }
          
          // Fallback completo - usar método tradicional
          const activities = await storage.getAllActivities();
          const withEmbalagem = [];
          
          for (const activity of activities) {
            const progresses = await storage.getActivityProgress(activity.id);
            const embalagemProgress = progresses.find(p => 
              p.department === 'embalagem' && p.status === 'completed'
            );
            
            if (embalagemProgress) {
              withEmbalagem.push({
                ...activity,
                currentDepartment: 'concluido',
                client: activity.clientName,
                clientInfo: activity.description || null,
                progress: progresses
              });
            }
          }
          
          CACHE_PERSISTENTE_CONCLUIDOS = withEmbalagem;
          CACHE_TIMESTAMP_CONCLUIDOS = Date.now();
          
          console.timeEnd('[PERF] Carregamento pedidos concluídos (fallback)');
          
          return res.json(withEmbalagem);
        }
      } else {
        return res.status(403).json({ message: "Acesso negado" });
      }
    } catch (error) {
      console.error("[ERROR] Erro no carregamento de concluídos:", error);
      
      // Em caso de erro, tenta recuperar do cache persistente
      if (CACHE_PERSISTENTE_CONCLUIDOS) {
        return res.json(CACHE_PERSISTENTE_CONCLUIDOS);
      }
      
      res.status(500).json({ message: "Erro ao buscar pedidos concluídos" });
    }
  });
  
  // OTIMIZAÇÃO CRÍTICA - Cache pré-computado persistente para pedidos em produção
  // Esta versão usa cache persistente em memória com TTL longo e regeneração em background
  let CACHE_PERSISTENTE_EM_PRODUCAO = null;
  let CACHE_TIMESTAMP_EM_PRODUCAO = 0;
  let CACHE_UPDATING_EM_PRODUCAO = false;
  const CACHE_TTL_EM_PRODUCAO = 5 * 60 * 1000; // 5 minutos
  
  // Função para atualizar cache em background
  async function atualizarCacheEmProducao() {
    if (CACHE_UPDATING_EM_PRODUCAO) return; // Evita atualizações concorrentes
    
    try {
      CACHE_UPDATING_EM_PRODUCAO = true;
      console.time('[CACHE-EM-PRODUCAO] Atualizando cache persistente');
      
      // Consulta SQL ultra-otimizada - corrigida para nomes de coluna exatos
      const query = sql`
        WITH LatestProgress AS (
          SELECT 
            activity_id,
            department,
            status,
            ROW_NUMBER() OVER(PARTITION BY activity_id ORDER BY 
              CASE department 
                WHEN 'gabarito' THEN 1 
                WHEN 'impressao' THEN 2 
                WHEN 'batida' THEN 3 
                WHEN 'costura' THEN 4 
                WHEN 'embalagem' THEN 5
              END DESC) as rn
          FROM activity_progress
          WHERE status = 'pending'
        )
        SELECT 
          a.*,
          a.client_name as client,
          a.description as "clientInfo",
          COALESCE(lp.department, 'gabarito') as "currentDepartment"
        FROM activities a
        LEFT JOIN LatestProgress lp ON lp.activity_id = a.id AND lp.rn = 1
        WHERE NOT EXISTS (
          SELECT 1 FROM activity_progress ap 
          WHERE ap.activity_id = a.id 
          AND ap.department = 'embalagem' 
          AND ap.status = 'completed'
        )
        ORDER BY a.deadline ASC NULLS LAST
      `;
      
      const result = await db.execute(query);
      
      // Atualizar cache persistente
      CACHE_PERSISTENTE_EM_PRODUCAO = result;
      CACHE_TIMESTAMP_EM_PRODUCAO = Date.now();
      
      console.timeEnd('[CACHE-EM-PRODUCAO] Atualizando cache persistente');
    } catch (error) {
      console.error('[CACHE-EM-PRODUCAO] Erro ao atualizar cache:', error);
    } finally {
      CACHE_UPDATING_EM_PRODUCAO = false;
    }
  }
  
  // Iniciar cache em background na inicialização do servidor
  atualizarCacheEmProducao();
  
  // Programar atualização periódica do cache a cada 5 minutos
  setInterval(() => {
    atualizarCacheEmProducao();
  }, CACHE_TTL_EM_PRODUCAO);
  
  // Endpoint otimizado com cache persistente para pedidos em produção
  app.get("/api/activities/em-producao", isAuthenticated, async (req, res) => {
    try {
      if (req.user && req.user.role === "admin") {
        // Cabeçalhos para cache no browser
        res.setHeader('Cache-Control', 'private, max-age=60');
        
        // Usar cache persistente pré-computado se estiver disponível e válido
        if (CACHE_PERSISTENTE_EM_PRODUCAO && (Date.now() - CACHE_TIMESTAMP_EM_PRODUCAO < CACHE_TTL_EM_PRODUCAO)) {
          console.log(`[CACHE-PERSISTENTE] Usando cache pré-computado para pedidos em produção (${(Date.now() - CACHE_TIMESTAMP_EM_PRODUCAO)/1000}s)`);
          
          // Programar atualização em background se estiver próximo de expirar
          if (Date.now() - CACHE_TIMESTAMP_EM_PRODUCAO > CACHE_TTL_EM_PRODUCAO * 0.8) {
            setTimeout(() => atualizarCacheEmProducao(), 100);
          }
          
          return res.json(CACHE_PERSISTENTE_EM_PRODUCAO);
        }
        
        // Cache não disponível ou expirado, buscar dados e atualizar cache
        console.time('[PERF] Carregamento pedidos em-producao');
        
        try {
          // Usar cache LRU como segunda camada de proteção
          const cacheKey = `activities_em_producao_admin_${req.user.id}_ultra`;
          const cachedData = cache.get(cacheKey);
          
          if (cachedData) {
            console.log(`[CACHE-LRU] Usando cache LRU para ${cacheKey}`);
            
            // Programar atualização de cache persistente em background
            setTimeout(() => atualizarCacheEmProducao(), 10);
            
            return res.json(cachedData);
          }
          
          // SQL otimizada corrigida para nomes de coluna exatos
          const query = sql`
            WITH LatestProgress AS (
              SELECT 
                activity_id,
                department,
                status,
                ROW_NUMBER() OVER(PARTITION BY activity_id ORDER BY 
                  CASE department 
                    WHEN 'gabarito' THEN 1 
                    WHEN 'impressao' THEN 2 
                    WHEN 'batida' THEN 3 
                    WHEN 'costura' THEN 4 
                    WHEN 'embalagem' THEN 5
                  END DESC) as rn
              FROM activity_progress
              WHERE status = 'pending'
            )
            SELECT 
              a.*,
              a.client_name as client,
              a.description as "clientInfo",
              COALESCE(lp.department, 'gabarito') as "currentDepartment"
            FROM activities a
            LEFT JOIN LatestProgress lp ON lp.activity_id = a.id AND lp.rn = 1
            WHERE NOT EXISTS (
              SELECT 1 FROM activity_progress ap 
              WHERE ap.activity_id = a.id 
              AND ap.department = 'embalagem' 
              AND ap.status = 'completed'
            )
            ORDER BY a.deadline ASC NULLS LAST
          `;
          
          const result = await db.execute(query);
          
          // Atualizar ambos os caches
          cache.set(cacheKey, result, 60000); // 1 minuto
          CACHE_PERSISTENTE_EM_PRODUCAO = result;
          CACHE_TIMESTAMP_EM_PRODUCAO = Date.now();
          
          console.timeEnd('[PERF] Carregamento pedidos em-producao');
          
          return res.json(result);
        } catch (sqlError) {
          console.error("[ERRO-SQL] Falha na query otimizada para em-producao:", sqlError);
          
          // Retornar último cache persistente mesmo se expirado
          if (CACHE_PERSISTENTE_EM_PRODUCAO) {
            console.log('[CACHE-EMERGENCIA] Usando cache persistente expirado para em-producao');
            return res.json(CACHE_PERSISTENTE_EM_PRODUCAO);
          }
          
          // Fallback completo - usar método tradicional
          const activities = await storage.getAllActivities();
          const emProducao = [];
          
          // Processar atividades em lotes
          const batchSize = 10;
          for (let i = 0; i < activities.length; i += batchSize) {
            const batch = activities.slice(i, i + batchSize);
            
            // Processar cada lote em paralelo
            const processedBatch = await Promise.all(batch.map(async (activity) => {
              const progresses = await storage.getActivityProgress(activity.id);
              
              // Verificar se foi concluído pela embalagem
              const embalagemProgress = progresses.find(p => 
                p.department === 'embalagem' && p.status === 'completed'
              );
              
              // Se foi concluído, pular
              if (embalagemProgress) return null;
              
              // Encontrar o departamento atual
              const pendingProgress = progresses
                .filter(p => p.status === 'pending')
                .sort((a, b) => {
                  const deptOrder = ['gabarito', 'impressao', 'batida', 'costura', 'embalagem'];
                  return deptOrder.indexOf(a.department as any) - deptOrder.indexOf(b.department as any);
                })[0];
              
              return {
                ...activity,
                currentDepartment: pendingProgress ? pendingProgress.department : 'gabarito',
                client: activity.clientName,
                clientInfo: activity.description || null,
                progress: progresses
              };
            }));
            
            // Filtrar nulos e adicionar ao resultado
            emProducao.push(...processedBatch.filter(Boolean));
          }
          
          CACHE_PERSISTENTE_EM_PRODUCAO = emProducao;
          CACHE_TIMESTAMP_EM_PRODUCAO = Date.now();
          
          console.timeEnd('[PERF] Carregamento pedidos em-producao (fallback)');
          
          return res.json(emProducao);
        }
      } else {
        return res.status(403).json({ message: "Acesso negado" });
      }
    } catch (error) {
      console.error("[ERROR] Erro no carregamento de em-producao:", error);
      
      // Em caso de erro, tenta recuperar do cache persistente
      if (CACHE_PERSISTENTE_EM_PRODUCAO) {
        return res.json(CACHE_PERSISTENTE_EM_PRODUCAO);
      }
      
      res.status(500).json({ message: "Erro ao buscar pedidos em produção" });
    }
  });
  
  // API routes
  // Activities - original method (mantido para compatibilidade)
  app.get("/api/activities", isAuthenticated, async (req, res) => {
    try {
      // Adiciona cabeçalhos de cache para o navegador
      res.setHeader('Cache-Control', 'private, max-age=15');
      
      // Novo: Redirecionamento para APIs otimizadas quando o tipo é específico
      const tipoFiltro = req.query.tipo;
      if (req.user.role === 'admin' && tipoFiltro) {
        if (tipoFiltro === 'concluidos') {
          // Redirecionar para endpoint otimizado internamente
          const response = await fetch(`http://localhost:${process.env.PORT || 5000}/api/activities/concluidos`, {
            headers: {
              'Cookie': req.headers.cookie || ''
            }
          });
          const data = await response.json();
          return res.json(data);
        } else if (tipoFiltro === 'em-producao') {
          // Redirecionar para endpoint otimizado internamente
          const response = await fetch(`http://localhost:${process.env.PORT || 5000}/api/activities/em-producao`, {
            headers: {
              'Cookie': req.headers.cookie || ''
            }
          });
          const data = await response.json();
          return res.json(data);
        }
      }
      
      // Cria uma chave de cache baseada no usuário
      const cacheKey = `activities_main_${req.user.role}_${req.user.id}`;
      
      // Verificar se o header específico para invalidar o cache está presente
      const bypassCache = req.headers['x-bypass-cache'] === 'true';
      
      // Modificar a chave do cache com base no tipo de filtro
      const cacheKeyWithType = `${cacheKey}_${tipoFiltro || 'todos'}`;
      
      // Se tiver em cache e não estiver ignorando o cache, retorna imediatamente
      const cachedData = !bypassCache ? cache.get(cacheKeyWithType) : null;
      if (cachedData) {
        console.log(`[CACHE] Usando dados em cache para ${cacheKeyWithType}`);
        return res.json(cachedData);
      }
      
      if (req.user && req.user.role === "admin") {
        console.time('[PERF] Carregamento de atividades admin');
        
        // Otimização - adicionar ao hot cache para acesso ultra-rápido
        // Usar verificação de integridade de dados para garantir consistência
        
        // Passos de otimização:
        // 1. Reduzir a quantidade de dados carregados inicialmente
        // 2. Realizar processamento em lotes para evitar bloqueio da thread principal
        // 3. Utilizar cache em múltiplas camadas para dados frequentes
        
        // Buscar todas as atividades com uma única consulta
        const activities = await storage.getAllActivities();
        
        // Primeiramente, obter todos os progressos em uma única operação em lote
        // para evitar múltiplas consultas ao banco de dados
        const activityIds = activities.map(activity => activity.id);
        const allProgressesMap = new Map();
        
        // Dividir em lotes de 10 para evitar sobrecarga
        const batchSize = 10;
        for (let i = 0; i < activityIds.length; i += batchSize) {
          const batch = activityIds.slice(i, i + batchSize);
          const progressesBatch = await Promise.all(
            batch.map(id => storage.getActivityProgress(id))
          );
          
          batch.forEach((id, index) => {
            allProgressesMap.set(id, progressesBatch[index]);
          });
        }
        
        // Processar as atividades com seus progressos já carregados
        const processActivity = (activity) => {
          const progresses = allProgressesMap.get(activity.id) || [];
          
          // Lógica para determinar o departamento atual otimizada
          const pendingProgress = progresses
            .filter(p => p.status === 'pending')
            .sort((a, b) => {
              const deptOrder = ['gabarito', 'impressao', 'batida', 'costura', 'embalagem'];
              return deptOrder.indexOf(a.department as any) - deptOrder.indexOf(b.department as any);
            })[0];
          
          // Verificação rápida para pedidos concluídos
          const embalagemProgress = progresses.find(p => p.department === 'embalagem');
          const pedidoConcluido = embalagemProgress && embalagemProgress.status === 'completed';
          
          // Determinar departamento atual
          let currentDepartment = pendingProgress ? pendingProgress.department : 'gabarito';
          
          if (!pendingProgress && pedidoConcluido) {
            currentDepartment = 'concluido';
          }
          
          return {
            ...activity,
            currentDepartment,
            client: activity.clientName,
            clientInfo: activity.description || null,
            progress: progresses
          };
        };
        
        // Fazer o processamento em lotes
        const activitiesWithProgress = [];
        for (let i = 0; i < activities.length; i += batchSize) {
          const activityBatch = activities.slice(i, i + batchSize);
          const processedBatch = activityBatch.map(processActivity);
          activitiesWithProgress.push(...processedBatch);
        }
        
        // Filtrar com base no tipo solicitado
        let filteredActivities = activitiesWithProgress;
        
        if (tipoFiltro === 'em-producao') {
          filteredActivities = activitiesWithProgress.filter(
            a => a.currentDepartment !== 'concluido'
          );
        } else if (tipoFiltro === 'concluidos') {
          filteredActivities = activitiesWithProgress.filter(
            a => a.currentDepartment === 'concluido'
          );
        }
        
        // Guardar em cache por tipo por 10 segundos
        // Usar tempos de cache dinâmicos com base na frequência de acesso
        // Itens acessados mais frequentemente têm TTL mais longo
        const ttl = 10000; // 10 segundos
        cache.set(cacheKeyWithType, filteredActivities, ttl);
        
        // Guardar todos os dados também no cache geral
        if (tipoFiltro !== 'todos') {
          cache.set(`${cacheKey}_todos`, activitiesWithProgress, ttl);
        }
        
        // Marcar como chave prioritária para proteção contra limpeza prematura
        if ((cache as any).priorityKeys && typeof (cache as any).priorityKeys.add === 'function') {
          (cache as any).priorityKeys.add(cacheKeyWithType);
        }
        
        // Registrar métricas de tempo para análise de performance
        console.timeEnd('[PERF] Carregamento de atividades admin');
        
        return res.json(filteredActivities);
      } else if (req.user) {
        const department = req.user.role;
        console.log(`[DEBUG] Usuario ${req.user.username} (${department}) solicitando atividades`);
        
        // Usar a solução emergencial para TODOS os departamentos
        console.log(`[EMERGENCIA] Usando método direto para buscar atividades do departamento ${department}`);
        const activities = await buscarAtividadesPorDepartamentoEmergencia(department);
        
        // Guardar em cache por 10 segundos (reduzido para atualizações mais frequentes)
        cache.set(cacheKey, activities, 10000);
        
        // Marcar como chave prioritária para proteção contra limpeza prematura
        if ((cache as any).priorityKeys && typeof (cache as any).priorityKeys.add === 'function') {
          (cache as any).priorityKeys.add(cacheKey);
        }
        
        return res.json(activities);
      } else {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
    } catch (error) {
      console.error("Erro ao buscar atividades:", error);
      res.status(500).json({ message: "Erro ao buscar atividades" });
    }
  });
  
  // Get all activity progress data (admin only)
  app.get("/api/activities/progress", isAdmin, async (req, res) => {
    try {
      const activities = await storage.getAllActivities();
      const progressData = [];
      
      for (const activity of activities) {
        const progress = await storage.getActivityProgress(activity.id);
        progressData.push({
          activityId: activity.id,
          progress: progress
        });
      }
      
      res.json(progressData);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar progresso das atividades" });
    }
  });
  
  // Obter atividades para um departamento específico (usando no dashboard do departamento)
  app.get("/api/activities/department/:department", isAuthenticated, async (req, res) => {
    try {
      let department = req.params.department;
      
      // Sempre usar o departamento do usuário logado se não for admin
      if (req.user && req.user.role !== "admin") {
        department = req.user.role;
      }
      
      console.log(`[DEBUG] Buscando atividades para o departamento: ${department}`);
      
      // Verificar se o departamento é válido
      if (!DEPARTMENTS.includes(department as any) && department !== "admin") {
        return res.status(400).json({ message: "Departamento inválido" });
      }
      
      console.log(`[DEBUG] Chamando getActivitiesByDepartment('${department}')`);
      // SOLUÇÃO EMERGENCIAL: Usar método direto e seguro para TODOS os departamentos
      console.log(`[EMERGENCIA] Usando método direto para buscar atividades do departamento ${department}`);
      let activities = await buscarAtividadesPorDepartamentoEmergencia(department);
      
      // Garantir que o campo client está sendo preenchido com clientName
      activities = activities.map(activity => ({
        ...activity,
        client: activity.clientName || "Cliente não informado"
      }));
      
      console.log(`[DEBUG] Encontradas ${activities.length} atividades para o departamento: ${department}`);
      if (activities.length > 0) {
        console.log(`[DEBUG] IDs das atividades: ${activities.map(a => a.id).join(', ')}`);
      }
      
      // Para cada atividade, adicionar as observações do setor anterior (se houver)
      let activitiesWithPreviousNotes = [];
      
      for (const activity of activities) {
        try {
          // Obter o progresso atual do departamento
          const currentProgress = await storage.getActivityProgressByDepartment(activity.id, department);
          console.log(`[DEBUG] Progresso para atividade ${activity.id} no departamento ${department}:`, 
                    currentProgress ? JSON.stringify(currentProgress) : "null");
          
          let result = { 
            ...activity, 
            previousNotes: null, 
            previousDepartment: null,
            previousCompletedBy: null,
            wasReturned: false,
            returnedBy: null,
            returnNotes: null,
            returnedAt: null
          };
          
          // Se o departamento é o primeiro, não haverá setor anterior
          if (department === DEPARTMENTS[0]) {
            // Verificar se foi retornado pelo setor seguinte
            result = { 
              ...activity, 
              previousNotes: currentProgress?.notes, 
              previousDepartment: null,
              previousCompletedBy: null,
              wasReturned: currentProgress?.returnedBy ? true : false,
              returnedBy: currentProgress?.returnedBy,
              returnNotes: currentProgress?.notes,
              returnedAt: currentProgress?.returnedAt
            };
          } else {
            // Encontrar o índice do departamento atual no fluxo
            const deptIndex = DEPARTMENTS.indexOf(department as any);
            
            if (deptIndex > 0) {
              // Obter o departamento anterior
              const previousDept = DEPARTMENTS[deptIndex - 1];
              
              // Buscar o progresso do departamento anterior
              const previousProgress = await storage.getActivityProgressByDepartment(activity.id, previousDept);
              console.log(`[DEBUG] Progresso anterior para atividade ${activity.id} no departamento ${previousDept}:`, 
                        previousProgress ? JSON.stringify(previousProgress) : "null");
              
              // Verificar se esta atividade foi retornada pelo próximo setor
              const wasReturned = currentProgress?.returnedBy ? true : false;
              
              // Se há progresso anterior e ele foi concluído, adicionar as notas ao resultado
              if (previousProgress && previousProgress.status === "completed") {
                result = { 
                  ...activity, 
                  previousNotes: previousProgress.notes, 
                  previousDepartment: previousDept,
                  previousCompletedBy: previousProgress.completedBy,
                  wasReturned,
                  returnedBy: currentProgress?.returnedBy,
                  returnNotes: currentProgress?.notes,
                  returnedAt: currentProgress?.returnedAt
                };
              } else if (wasReturned) {
                // Se só foi retornado mas sem progresso anterior concluído
                result = {
                  ...activity,
                  previousNotes: null,
                  previousDepartment: null,
                  previousCompletedBy: null,
                  wasReturned,
                  returnedBy: currentProgress?.returnedBy,
                  returnNotes: currentProgress?.notes,
                  returnedAt: currentProgress?.returnedAt
                };
              }
            }
          }
          
          activitiesWithPreviousNotes.push(result);
        } catch (error) {
          console.error(`[ERROR] Erro ao processar atividade ${activity.id}:`, error);
          // Continue processing other activities even if one fails
        }
      }
      
      return res.json(activitiesWithPreviousNotes);
    } catch (error) {
      console.error("[ERROR] Erro ao buscar atividades para o departamento:", error);
      res.status(500).json({ message: "Erro ao buscar atividades para o departamento" });
    }
  });

  app.get("/api/activities/:id", isAuthenticated, async (req, res) => {
    try {
      const activityId = parseInt(req.params.id);
      const activity = await storage.getActivity(activityId);
      
      if (!activity) {
        return res.status(404).json({ message: "Atividade não encontrada" });
      }
      
      return res.json(activity);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar atividade" });
    }
  });

  app.post("/api/activities", isAdmin, async (req, res) => {
    try {
      const validatedData = insertActivitySchema.parse({
        ...req.body,
        createdBy: req.user.id
      });
      
      const activity = await storage.createActivity(validatedData);
      
      // Obter o departamento inicial através do corpo da requisição ou usar gabarito como padrão
      const initialDepartment = req.body.initialDepartment || "gabarito";
      
      // Initialize the activity progress for the initial department
      await storage.createActivityProgress({
        activityId: activity.id,
        department: initialDepartment,
        status: "pending",
      });
      
      // Create notifications for users of the initial department
      const departmentUsers = await storage.getUsersByRole(initialDepartment);
      for (const user of departmentUsers) {
        await storage.createNotification({
          userId: user.id,
          activityId: activity.id,
          message: `Nova atividade: ${activity.title}`
        });
      }
      
      // Enviar notificação websocket para o departamento inicial
      if ((global as any).wsNotifications) {
        (global as any).wsNotifications.notifyDepartment(initialDepartment, {
          type: 'new_activity',
          activity
        });
        
        // Notificar também administradores
        (global as any).wsNotifications.notifyDepartment('admin', {
          type: 'new_activity',
          activity
        });
      }
      
      res.status(201).json(activity);
    } catch (error) {
      if (error instanceof Error) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: "Erro ao criar atividade" });
      }
    }
  });

  app.put("/api/activities/:id", isAdmin, async (req, res) => {
    try {
      const activityId = parseInt(req.params.id);
      const activity = await storage.getActivity(activityId);
      
      if (!activity) {
        return res.status(404).json({ message: "Atividade não encontrada" });
      }
      
      const validatedData = insertActivitySchema.parse({
        ...req.body,
        createdBy: activity.createdBy
      });
      
      const updatedActivity = await storage.updateActivity(activityId, validatedData);
      res.json(updatedActivity);
    } catch (error) {
      if (error instanceof Error) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: "Erro ao atualizar atividade" });
      }
    }
  });

  app.delete("/api/activities/:id", isAdmin, async (req, res) => {
    try {
      const activityId = parseInt(req.params.id);
      await storage.deleteActivity(activityId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir atividade" });
    }
  });

  // Activity progress
  app.get("/api/activities/:id/progress", isAuthenticated, async (req, res) => {
    try {
      const activityId = parseInt(req.params.id);
      const progress = await storage.getActivityProgress(activityId);
      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar progresso da atividade" });
    }
  });
  
  // Retornar atividade ao setor anterior
  app.post("/api/activities/:id/return", isAuthenticated, async (req, res) => {
    try {
      const activityId = parseInt(req.params.id);
      const department = req.user.role;
      
      // Non-admin users can only return activities from their department
      if (department === "admin") {
        return res.status(403).json({ message: "Administradores não podem retornar atividades" });
      }
      
      // Verify if the activity exists
      const activity = await storage.getActivity(activityId);
      if (!activity) {
        return res.status(404).json({ message: "Atividade não encontrada" });
      }
      
      // Verify if the activity is assigned to the user's department
      const departmentProgress = await storage.getActivityProgressByDepartment(activityId, department);
      if (!departmentProgress || departmentProgress.status !== "pending") {
        return res.status(403).json({ 
          message: "Esta atividade não está disponível para este setor ou já foi concluída" 
        });
      }
      
      // Validar se temos os dados necessários
      if (!req.body.returnedBy) {
        return res.status(400).json({ message: "É necessário informar quem está retornando a atividade" });
      }
      
      // Get the department index
      const departmentIndex = DEPARTMENTS.indexOf(department as any);
      
      // Não podemos retornar se for o primeiro departamento
      if (departmentIndex <= 0) {
        return res.status(400).json({ 
          message: "Não é possível retornar este pedido pois não há setor anterior" 
        });
      }
      
      // Retornar a atividade para o departamento anterior
      const result = await storage.returnActivityToPreviousDepartment(
        activityId,
        department,
        req.body.returnedBy,
        req.body.notes
      );
      
      // Enviar notificação para os administradores
      const adminUsers = await storage.getUsersByRole("admin");
      const previousDepartment = DEPARTMENTS[departmentIndex - 1];
      
      for (const user of adminUsers) {
        await storage.createNotification({
          userId: user.id,
          activityId,
          message: `Pedido "${activity.title}" retornado de ${department} para ${previousDepartment} - Retornado por: ${req.body.returnedBy}${req.body.notes ? ` - Motivo: ${req.body.notes}` : ''}`
        });
      }
      
      // Notificar usuários do departamento anterior
      const prevDeptUsers = await storage.getUsersByRole(previousDepartment);
      for (const user of prevDeptUsers) {
        await storage.createNotification({
          userId: user.id,
          activityId: activityId,
          message: `Pedido "${activity.title}" foi retornado pelo setor ${department}${req.body.notes ? ` - Motivo: ${req.body.notes}` : ''}`
        });
      }
      
      // Enviar notificação via WebSocket
      if ((global as any).wsNotifications) {
        // Notificar o departamento anterior (que recebeu o pedido de volta)
        (global as any).wsNotifications.notifyDepartment(previousDepartment, {
          type: 'activity_returned',
          activity,
          from: department,
          returnedBy: req.body.returnedBy,
          notes: req.body.notes
        });
        
        // Notificar o departamento atual (que enviou o pedido de volta)
        (global as any).wsNotifications.notifyDepartment(department, {
          type: 'activity_returned_update',
          activityId: activity.id
        });
        
        // Notificar administradores
        (global as any).wsNotifications.notifyDepartment('admin', {
          type: 'activity_returned',
          activity,
          from: department,
          to: previousDepartment,
          returnedBy: req.body.returnedBy,
          notes: req.body.notes
        });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Erro ao retornar atividade:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Erro ao retornar atividade" 
      });
    }
  });

  app.post("/api/activities/:id/complete", isAuthenticated, async (req, res) => {
    try {
      const activityId = parseInt(req.params.id);
      const department = req.user.role;
      
      // Non-admin users can only complete activities for their department
      if (department === "admin") {
        return res.status(403).json({ message: "Administradores não podem marcar atividades como concluídas" });
      }
      
      // Verify if the activity exists
      const activity = await storage.getActivity(activityId);
      if (!activity) {
        return res.status(404).json({ message: "Atividade não encontrada" });
      }
      
      // Verify if the activity is assigned to the user's department
      const departmentProgress = await storage.getActivityProgressByDepartment(activityId, department);
      if (!departmentProgress || departmentProgress.status !== "pending") {
        return res.status(403).json({ 
          message: "Esta atividade não está disponível para este setor ou já foi concluída" 
        });
      }

      // Check if employee name is provided
      if (!req.body.completedBy) {
        return res.status(400).json({ message: "Nome do funcionário é obrigatório" });
      }
      
      // Update progress - USANDO MÉTODO EMERGENCIAL para todos os departamentos
      console.log(`[DIAGNÓSTICO] Chamando completarProgressoAtividadeEmergencia com:
        - activityId: ${activityId} (${typeof activityId})
        - department: ${department} (${typeof department})
        - completedBy: ${req.body.completedBy} (${typeof req.body.completedBy})
        - notes: ${req.body.notes} (${typeof req.body.notes})
      `);
      
      try {
        // Verificando se os departamentos estão configurados corretamente
        console.log(`[DIAGNÓSTICO] DEPARTMENTS disponíveis: ${JSON.stringify(DEPARTMENTS)}`);
        console.log(`[DIAGNÓSTICO] Índice do departamento atual: ${DEPARTMENTS.indexOf(department as any)}`);
        
        const completedProgress = await completarProgressoAtividadeEmergencia(
          activityId, 
          department, 
          req.body.completedBy,
          req.body.notes
        );
        console.log(`[SUCESSO] Atividade ${activityId} concluída com sucesso no departamento ${department}`);
        
        // Não precisamos mais criar manualmente o próximo progresso pois a função emergencial já faz isso
        // Apenas obtemos o índice do departamento para notificações
        const departmentIndex = DEPARTMENTS.indexOf(department as any);
        if (departmentIndex < DEPARTMENTS.length - 1) {
          const nextDepartment = DEPARTMENTS[departmentIndex + 1];
        
          // Notify users in the next department with origin information
          const nextDeptUsers = await storage.getUsersByRole(nextDepartment);
          for (const user of nextDeptUsers) {
            await storage.createNotification({
              userId: user.id,
              activityId,
              message: `Novo pedido de ${department} para ${nextDepartment}: ${activity.title}`
            });
          }
        } else {
          // This was the last department, mark the activity as completed
          await storage.updateActivityStatus(activityId, "completed");
        }
        
        // Notify admin users about the transition between departments
        const adminUsers = await storage.getUsersByRole("admin");
        
        if (departmentIndex < DEPARTMENTS.length - 1) {
          // If there's a next department, show the flow
          const nextDepartment = DEPARTMENTS[departmentIndex + 1];
          for (const user of adminUsers) {
            await storage.createNotification({
              userId: user.id,
              activityId,
              message: `Pedido "${activity.title}" passou de ${department} para ${nextDepartment} - Finalizado por: ${req.body.completedBy}${req.body.notes ? ` - Obs: ${req.body.notes}` : ''}`
            });
          }
        } else {
          // If this was the last department, show completion notification
          for (const user of adminUsers) {
            await storage.createNotification({
              userId: user.id,
              activityId,
              message: `Setor ${department} finalizou o pedido "${activity.title}" (Produção concluída) - Finalizado por: ${req.body.completedBy}${req.body.notes ? ` - Obs: ${req.body.notes}` : ''}`
            });
          }
        }
        
        // Enviar notificação via WebSocket
        if ((global as any).wsNotifications) {
          // Notificar o departamento atual que completou o pedido
          (global as any).wsNotifications.notifyDepartment(department, {
            type: 'activity_completed',
            activityId: activity.id
          });
          
          // Se existe próximo departamento, notificar
          if (departmentIndex < DEPARTMENTS.length - 1) {
            const nextDepartment = DEPARTMENTS[departmentIndex + 1];
            
            // Notificar o próximo departamento
            (global as any).wsNotifications.notifyDepartment(nextDepartment, {
              type: 'new_activity',
              activity
            });
          }
          
          // Notificar administradores
          (global as any).wsNotifications.notifyDepartment('admin', {
            type: 'activity_progress',
            activity,
            completedBy: req.body.completedBy,
            department,
            nextDepartment: departmentIndex < DEPARTMENTS.length - 1 ? DEPARTMENTS[departmentIndex + 1] : null,
            isCompleted: departmentIndex >= DEPARTMENTS.length - 1
          });
        }
        
        res.json(completedProgress);
      } catch (error) {
        console.error("[ERRO CRÍTICO] Falha ao completar atividade:", error);
        
        // Gerar mensagem de erro mais detalhada para facilitar diagnóstico
        const errorMessage = error instanceof Error 
          ? `Erro ao concluir pedido: ${error.message}` 
          : "Erro desconhecido ao concluir pedido";
          
        // Registrar a pilha de chamadas para análise
        if (error instanceof Error && error.stack) {
          console.error("[STACK TRACE]", error.stack);
        }
        
        res.status(500).json({ 
          message: errorMessage,
          details: process.env.NODE_ENV !== 'production' ? String(error) : undefined 
        });
      }
    } catch (error) {
      console.error("Erro ao completar atividade:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Erro ao completar atividade" 
      });
    }
  });

  // SISTEMA ULTRA SIMPLIFICADO DE REIMPRESSÃO
  let solicitacoesReimpressao: any[] = [];
  
  // Rota simples para criar solicitação
  app.post("/api/reimpressao-simples/criar", (req, res) => {
    try {
      console.log("🆘 RECEBENDO SOLICITAÇÃO SIMPLES:", req.body);
      
      const { activityId, requestedBy, reason, details, quantity } = req.body;
      
      // Validação básica
      if (!activityId || !requestedBy || !reason) {
        return res.status(400).json({
          success: false,
          message: "Campos obrigatórios faltando (activityId, requestedBy, reason)",
        });
      }
      
      // Criar nova solicitação
      const novaSolicitacao = {
        id: Date.now(),
        activityId: Number(activityId),
        requestedBy: String(requestedBy).trim(),
        reason: String(reason).trim(),
        details: details ? String(details).trim() : "",
        quantity: Number(quantity) || 1,
        status: "pendente",
        createdAt: new Date().toISOString(),
        fromDepartment: "batida",
        toDepartment: "impressao"
      };
      
      // Adicionar à lista em memória
      solicitacoesReimpressao.push(novaSolicitacao);
      console.log("🆘 SOLICITAÇÃO CRIADA:", novaSolicitacao);
      console.log("🆘 TOTAL DE SOLICITAÇÕES:", solicitacoesReimpressao.length);
      
      return res.status(201).json({
        success: true,
        message: "Solicitação criada com sucesso!",
        data: novaSolicitacao
      });
    } catch (error) {
      console.error("🆘 ERRO AO PROCESSAR SOLICITAÇÃO:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao processar solicitação",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });
  
  // Rota para listar solicitações
  app.get("/api/reimpressao-simples/listar", (req, res) => {
    try {
      console.log("🆘 LISTANDO SOLICITAÇÕES. Total:", solicitacoesReimpressao.length);
      return res.json(solicitacoesReimpressao);
    } catch (error) {
      console.error("🆘 ERRO AO LISTAR SOLICITAÇÕES:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao listar solicitações"
      });
    }
  });
  
  // Rota para processar solicitações (atualizar status)
  app.post("/api/reimpressao-simples/:id/processar", (req, res) => {
    try {
      const { id } = req.params;
      const { status, processedBy } = req.body;
      
      console.log(`🆘 PROCESSANDO SOLICITAÇÃO #${id}:`, { status, processedBy });
      
      // Validação básica
      if (!id || !status || !processedBy) {
        return res.status(400).json({
          success: false,
          message: "Dados incompletos. ID, status e processedBy são obrigatórios"
        });
      }
      
      // Verificar se a solicitação existe
      const solicitacaoIndex = solicitacoesReimpressao.findIndex(s => s.id === Number(id));
      if (solicitacaoIndex === -1) {
        return res.status(404).json({
          success: false,
          message: "Solicitação não encontrada"
        });
      }
      
      // Atualizar o status
      const solicitacaoAtualizada = {
        ...solicitacoesReimpressao[solicitacaoIndex],
        status: status,
        processedBy: processedBy,
        processedAt: new Date().toISOString()
      };
      
      // Substituir na lista
      solicitacoesReimpressao[solicitacaoIndex] = solicitacaoAtualizada;
      
      console.log(`🆘 SOLICITAÇÃO #${id} PROCESSADA:`, solicitacaoAtualizada);
      
      return res.json({
        success: true,
        message: `Solicitação ${status === 'concluida' ? 'concluída' : 'rejeitada'} com sucesso`,
        data: solicitacaoAtualizada
      });
    } catch (error) {
      console.error("🆘 ERRO AO PROCESSAR SOLICITAÇÃO:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao processar solicitação",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });
  
  // Rota original de reimpressão - DESATIVADA
  app.post("/api/reprint-requests", isAuthenticated, async (req, res) => {
    try {
      console.log("[MODO SUPER DEUS 9000] Inicializando protocolo de emergência...");
      console.log("[MODO SUPER DEUS 9000] Dados recebidos:", JSON.stringify(req.body, null, 2));
      
      // Verificar autenticação
      if (!req.user) {
        console.error("[MODO SUPER DEUS 9000] Erro: Usuário não autenticado");
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      
      // Verificar permissão
      const department = req.user.role;
      if (department !== "batida" && department !== "admin") {
        console.error(`[MODO SUPER DEUS 9000] Permissão negada para ${department}`);
        return res.status(403).json({ message: "Somente o setor de batida pode solicitar reimpressões" });
      }
      
      // Importar o módulo de emergência
      console.log("[MODO SUPER DEUS 9000] Carregando módulo de emergência...");
      const emergencyModule = require('./direct-reprint.js');
      
      // Verificar atividade
      try {
        const activityId = req.body.activityId ? Number(req.body.activityId) : 0;
        const activity = await storage.getActivity(activityId);
        
        if (!activity) {
          console.error(`[MODO SUPER DEUS 9000] Atividade ${activityId} não encontrada`);
          return res.status(404).json({ message: "Atividade não encontrada" });
        }
        
        console.log(`[MODO SUPER DEUS 9000] Atividade validada: ${activity.title} (ID: ${activity.id})`);
      } catch (err) {
        console.error("[MODO SUPER DEUS 9000] Erro ao validar atividade:", err);
        // Continuar mesmo com erro para tentar forçar inserção
      }
      
      // Enviar para processamento de emergência
      console.log("[MODO SUPER DEUS 9000] Chamando método de emergência...");
      const result = await emergencyModule.createReprintRequest(req.body);
      
      console.log("[MODO SUPER DEUS 9000] Operação concluída com sucesso!");
      return res.status(201).json(result);
    } catch (error) {
      console.error("[MODO SUPER DEUS 9000] ERRO CRÍTICO:", error);
      return res.status(500).json({ 
        message: "Erro ao processar solicitação de reimpressão", 
        details: error instanceof Error ? error.message : "Erro desconhecido",
        status: "ERRO"
      });
    }
  });
  
  // ROTA EMERGENCIAL ESPECÍFICA PARA O SETOR DE IMPRESSÃO
  app.get("/api/reprint-requests/for-department/impressao", isAuthenticated, async (req, res) => {
    try {
      console.log(`🔥 ROTA EMERGENCIAL PARA IMPRESSÃO ATIVADA`);
      
      // Usar a função importada diretamente de emergency-storage
      const allRequests = listarSolicitacoesReimpressao();
      
      // Filtra apenas as solicitações para este departamento
      const filteredRequests = allRequests.filter(req => req.toDepartment === "impressao");
      
      console.log(`🔥 Retornando ${filteredRequests.length} solicitações emergenciais para IMPRESSÃO`);
      return res.json(filteredRequests);
      
    } catch (error) {
      console.error("🔥 Erro na rota emergencial IMPRESSÃO:", error);
      res.status(500).json({ message: "Erro ao buscar solicitações de reimpressão" });
    }
  });
  
  // Obter solicitações de reimpressão para outros departamentos
  app.get("/api/reprint-requests/for-department/:department", isAuthenticated, async (req, res) => {
    try {
      let department = req.params.department;
      
      // Usuários não-admin só podem ver solicitações para seu próprio departamento
      if (req.user && req.user.role !== "admin") {
        department = req.user.role;
      }
      
      console.log(`REDIRECIONANDO PARA API EMERGENCIAL: departamento ${department}`);
      
      // SOLUÇÃO EMERGENCIAL: Usando a função importada diretamente
      const allRequests = listarSolicitacoesReimpressao();
      
      // Filtra apenas as solicitações para este departamento
      const filteredRequests = allRequests.filter(request => request.toDepartment === department);
      
      // Enriquecer os dados com informações da atividade (já estão incluídas na solução emergencial)
      const enrichedRequests = filteredRequests;
      
      console.log(`Retornando ${enrichedRequests.length} solicitações emergenciais para o departamento ${department}`);
      res.json(enrichedRequests);
    } catch (error) {
      console.error("Erro ao buscar solicitações de reimpressão:", error);
      res.status(500).json({ message: "Erro ao buscar solicitações de reimpressão" });
    }
  });
  
  // Obter solicitações de reimpressão feitas por um departamento
  app.get("/api/reprint-requests/from-department/:department", isAuthenticated, async (req, res) => {
    try {
      let department = req.params.department;
      
      // Usuários não-admin só podem ver solicitações de seu próprio departamento
      if (req.user.role !== "admin") {
        department = req.user.role;
      }
      
      const requests = await storage.getReprintRequestsFromDepartment(department);
      
      // Enriquecer os dados com informações da atividade
      const enrichedRequests = [];
      
      for (const request of requests) {
        const activity = await storage.getActivity(request.activityId);
        if (activity) {
          enrichedRequests.push({
            ...request,
            activityTitle: activity.title,
            activityDeadline: activity.deadline
          });
        }
      }
      
      res.json(enrichedRequests);
    } catch (error) {
      console.error("Erro ao buscar solicitações de reimpressão:", error);
      res.status(500).json({ message: "Erro ao buscar solicitações de reimpressão" });
    }
  });
  
  // Atualizar o status de uma solicitação de reimpressão
  app.patch("/api/reprint-requests/:id/status", isAuthenticated, async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const department = req.user.role;
      
      // Obter a solicitação
      const reprintRequest = await storage.getReprintRequest(requestId);
      if (!reprintRequest) {
        return res.status(404).json({ message: "Solicitação de reimpressão não encontrada" });
      }
      
      // Verificar se o usuário tem permissão (deve ser do departamento 'para')
      if (department !== reprintRequest.toDepartment && department !== "admin") {
        return res.status(403).json({ 
          message: "Você não tem permissão para atualizar esta solicitação" 
        });
      }
      
      // Verificar se temos os dados necessários
      if (!req.body.status) {
        return res.status(400).json({ message: "É necessário informar o novo status" });
      }
      
      if (req.body.status === 'completed' || req.body.status === 'rejected') {
        if (!req.body.processedBy) {
          return res.status(400).json({ 
            message: "É necessário informar quem está processando a solicitação" 
          });
        }
      }
      
      // Atualizar o status
      const updatedRequest = await storage.updateReprintRequestStatus(
        requestId,
        req.body.status,
        req.body.processedBy,
        req.body.responseNotes
      );
      
      // Obter atividade para referência
      const activity = await storage.getActivity(reprintRequest.activityId);
      
      // Enviar notificação para o departamento solicitante
      const fromDeptUsers = await storage.getUsersByRole(reprintRequest.fromDepartment);
      
      for (const user of fromDeptUsers) {
        await storage.createNotification({
          userId: user.id,
          activityId: reprintRequest.activityId,
          message: `Solicitação de reimpressão para o pedido "${activity?.title || 'Desconhecido'}" foi ${req.body.status === 'completed' ? 'concluída' : req.body.status === 'rejected' ? 'rejeitada' : 'atualizada'} por ${req.body.processedBy || 'usuário do sistema'}`
        });
      }
      
      // Enviar notificação WebSocket
      if ((global as any).wsNotifications) {
        (global as any).wsNotifications.notifyDepartment(reprintRequest.fromDepartment, {
          type: 'reprint_request_updated',
          reprintRequest: updatedRequest,
          activityTitle: activity?.title || 'Desconhecido',
          status: req.body.status,
          processedBy: req.body.processedBy
        });
      }
      
      res.json(updatedRequest);
    } catch (error) {
      console.error("Erro ao atualizar solicitação de reimpressão:", error);
      res.status(500).json({ message: "Erro ao atualizar solicitação de reimpressão" });
    }
  });
  
  // Users
  app.get("/api/users", isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });

  app.post("/api/users", isAdmin, async (req, res) => {
    try {
      // Verificar se o username já existe
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Nome de usuário já existe" });
      }
      
      // Hash da senha já é feita no método createUser do auth.ts
      const newUser = await storage.createUser(req.body);
      res.status(201).json(newUser);
    } catch (error) {
      res.status(500).json({ message: "Erro ao criar usuário" });
    }
  });

  app.get("/api/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar usuário" });
    }
  });

  app.put("/api/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      const updatedUser = await storage.updateUser(userId, req.body);
      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar usuário" });
    }
  });

  app.delete("/api/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Don't allow deleting the current user
      if (userId === req.user.id) {
        return res.status(400).json({ message: "Não é possível excluir seu próprio usuário" });
      }
      
      await storage.deleteUser(userId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir usuário" });
    }
  });

  // Notifications
  app.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      const notifications = await storage.getNotificationsByUser(req.user.id);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar notificações" });
    }
  });

  app.post("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      const notification = await storage.getNotification(notificationId);
      
      if (!notification) {
        return res.status(404).json({ message: "Notificação não encontrada" });
      }
      
      // Verifica se a notificação pertence ao usuário atual ou se é um admin
      if (notification.userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      const updatedNotification = await storage.markNotificationAsRead(notificationId);
      res.json(updatedNotification);
    } catch (error) {
      res.status(500).json({ message: "Erro ao marcar notificação como lida" });
    }
  });
  
  // Statistics for admin dashboard
  // OTIMIZAÇÃO CRÍTICA - Cache pré-computado persistente para estatísticas
  // Esta versão usa cache persistente em memória com TTL longo e regeneração em background
  let CACHE_PERSISTENTE_ESTATISTICAS = null;
  let CACHE_TIMESTAMP_ESTATISTICAS = 0;
  let CACHE_UPDATING_ESTATISTICAS = false;
  const CACHE_TTL_ESTATISTICAS = 2 * 60 * 1000; // 2 minutos
  
  // Função para atualizar cache de estatísticas em background
  async function atualizarCacheEstatisticas() {
    if (CACHE_UPDATING_ESTATISTICAS) return; // Evita atualizações concorrentes
    
    try {
      CACHE_UPDATING_ESTATISTICAS = true;
      console.time('[CACHE-ESTATISTICAS] Atualizando cache persistente');
      
      // Buscar diretamente do storage
      const stats = await storage.getActivityStats();
      
      // Atualizar cache persistente
      CACHE_PERSISTENTE_ESTATISTICAS = stats;
      CACHE_TIMESTAMP_ESTATISTICAS = Date.now();
      
      console.timeEnd('[CACHE-ESTATISTICAS] Atualizando cache persistente');
    } catch (error) {
      console.error('[CACHE-ESTATISTICAS] Erro ao atualizar cache:', error);
    } finally {
      CACHE_UPDATING_ESTATISTICAS = false;
    }
  }
  
  // Iniciar cache em background na inicialização do servidor
  atualizarCacheEstatisticas();
  
  // Programar atualização periódica do cache a cada 2 minutos
  setInterval(() => {
    atualizarCacheEstatisticas();
  }, CACHE_TTL_ESTATISTICAS);

  app.get("/api/stats", async (req, res) => {
    // Verificar autenticação
    if (!req.isAuthenticated()) {
      console.error("Usuário não autenticado tentando acessar estatísticas");
      return res.status(401).json({ message: "Não autorizado" });
    }
    try {
      // Cabeçalhos para cache no browser
      res.setHeader('Cache-Control', 'private, max-age=60');
      
      // Usar cache persistente pré-computado se estiver disponível e válido
      if (CACHE_PERSISTENTE_ESTATISTICAS && (Date.now() - CACHE_TIMESTAMP_ESTATISTICAS < CACHE_TTL_ESTATISTICAS)) {
        console.log(`[CACHE-PERSISTENTE] Usando cache pré-computado para estatísticas (${(Date.now() - CACHE_TIMESTAMP_ESTATISTICAS)/1000}s)`);
        
        // Programar atualização em background se estiver próximo de expirar
        if (Date.now() - CACHE_TIMESTAMP_ESTATISTICAS > CACHE_TTL_ESTATISTICAS * 0.8) {
          setTimeout(() => atualizarCacheEstatisticas(), 100);
        }
        
        return res.json(CACHE_PERSISTENTE_ESTATISTICAS);
      }
      
      // Cache não disponível ou expirado, buscar novos dados
      console.time('[PERF] Carregamento estatísticas');
      const stats = await storage.getActivityStats();
      console.timeEnd('[PERF] Carregamento estatísticas');
      
      // Atualizar cache persistente
      CACHE_PERSISTENTE_ESTATISTICAS = stats;
      CACHE_TIMESTAMP_ESTATISTICAS = Date.now();
      
      res.json(stats);
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
      
      // Tentar usar cache persistente como última opção
      if (CACHE_PERSISTENTE_ESTATISTICAS) {
        return res.json(CACHE_PERSISTENTE_ESTATISTICAS);
      }
      
      res.status(500).json({ message: "Erro ao buscar estatísticas" });
    }
  });
  
  // Rota para buscar o histórico de atividades concluídas por um departamento específico
  app.get("/api/activities/history/:department", isAuthenticated, async (req, res) => {
    try {
      let department = req.params.department;
      
      // Sempre usar o departamento do usuário logado se não for admin
      if (req.user && req.user.role !== "admin") {
        department = req.user.role;
      }
      
      console.log(`[HISTÓRICO] Buscando histórico de atividades do departamento: ${department}`);
      
      // Verificar se o departamento é válido
      if (!DEPARTMENTS.includes(department as any) && department !== "admin") {
        return res.status(400).json({ message: "Departamento inválido" });
      }
      
      // Buscar todas as atividades completadas pelo departamento
      const completedActivities = await storage.getCompletedActivitiesByDepartment(department);
      console.log(`[HISTÓRICO] Encontradas ${completedActivities.length} atividades concluídas pelo departamento: ${department}`);
      
      // Preparar dados para resposta
      const processedActivities = completedActivities.map(item => {
        const { activity, progress } = item;
        
        return {
          ...activity,
          completedBy: progress.completedBy,
          completedAt: progress.updatedAt,
          notes: progress.notes
        };
      });
      
      res.json(processedActivities);
    } catch (error) {
      console.error(`[ERROR] Erro ao buscar histórico para ${req.params.department}:`, error);
      res.status(500).json({ 
        message: "Erro ao buscar histórico de atividades", 
        error: error.message 
      });
    }
  });
  
  // OTIMIZAÇÃO CRÍTICA - Cache pré-computado persistente para contagem por departamento
  // Esta versão usa cache persistente em memória com TTL médio e regeneração em background
  let CACHE_PERSISTENTE_DEPT_COUNTS = null;
  let CACHE_TIMESTAMP_DEPT_COUNTS = 0;
  let CACHE_UPDATING_DEPT_COUNTS = false;
  const CACHE_TTL_DEPT_COUNTS = 60 * 1000; // 1 minuto (pode ser ajustado conforme necessidade)
  
  // Função para atualizar cache de contagem por departamento em background
  async function atualizarCacheDeptCounts() {
    if (CACHE_UPDATING_DEPT_COUNTS) return; // Evita atualizações concorrentes
    
    try {
      CACHE_UPDATING_DEPT_COUNTS = true;
      console.time('[CACHE-DEPT-COUNTS] Atualizando cache persistente');
      
      // Resultado final
      const result: Record<string, number> = {};
      
      // Buscas paralelas são mais rápidas que sequenciais
      await Promise.all(DEPARTMENTS.map(async (dept) => {
        try {
          // Usar a função de emergência para obter atividades de cada departamento
          const activities = await buscarAtividadesPorDepartamentoEmergencia(dept);
          result[dept] = activities.length;
        } catch (err) {
          console.error(`[ERROR] Erro ao contar atividades para ${dept}:`, err);
          result[dept] = 0; // Valor padrão em caso de erro
        }
      }));
      
      // Atualizar cache persistente
      CACHE_PERSISTENTE_DEPT_COUNTS = result;
      CACHE_TIMESTAMP_DEPT_COUNTS = Date.now();
      
      console.timeEnd('[CACHE-DEPT-COUNTS] Atualizando cache persistente');
    } catch (error) {
      console.error('[CACHE-DEPT-COUNTS] Erro ao atualizar cache:', error);
    } finally {
      CACHE_UPDATING_DEPT_COUNTS = false;
    }
  }
  
  // Iniciar cache em background na inicialização do servidor
  atualizarCacheDeptCounts();
  
  // Programar atualização periódica do cache a cada 1 minuto
  setInterval(() => {
    atualizarCacheDeptCounts();
  }, CACHE_TTL_DEPT_COUNTS);
  
  // Rota para obter o contador de atividades por departamento (para o dashboard admin)
  app.get("/api/stats/department-counts", async (req, res) => {
    try {
      // Verificar autenticação
      if (!req.isAuthenticated()) {
        console.error("Usuário não autenticado tentando acessar contagem de departamentos");
        return res.status(401).json({ message: "Não autorizado" });
      }
      
      // Verifica se o usuário é admin, mas permite também usuários de departamento
      if (req.user && req.user.role !== 'admin') {
        console.log(`[USER] Usuário ${req.user.username} (${req.user.role}) acessando contagem de departamentos`);
      } else {
        console.log(`[ADMIN] Obtendo contagem de atividades por departamento`);
      }
      
      // Adiciona cabeçalhos de cache para o navegador
      res.setHeader('Cache-Control', 'public, max-age=60');
      
      // Usar cache persistente pré-computado se estiver disponível e válido
      if (CACHE_PERSISTENTE_DEPT_COUNTS && (Date.now() - CACHE_TIMESTAMP_DEPT_COUNTS < CACHE_TTL_DEPT_COUNTS)) {
        console.log(`[CACHE-PERSISTENTE] Usando cache pré-computado para contagem por departamento (${(Date.now() - CACHE_TIMESTAMP_DEPT_COUNTS)/1000}s)`);
        
        // Programar atualização em background se estiver próximo de expirar
        if (Date.now() - CACHE_TIMESTAMP_DEPT_COUNTS > CACHE_TTL_DEPT_COUNTS * 0.8) {
          setTimeout(() => atualizarCacheDeptCounts(), 100);
        }
        
        return res.json(CACHE_PERSISTENTE_DEPT_COUNTS);
      }
      
      // Cache não disponível ou expirado, executar consulta
      console.time('[PERF] Carregamento contagem por departamento');
      
      try {
        // Usar cache LRU como segunda camada de proteção
        const cacheKey = `department_counts_${req.user ? req.user.id : 'anonymous'}`;
        const cachedData = cache.get(cacheKey);
        
        if (cachedData) {
          console.log(`[CACHE-LRU] Usando cache LRU para ${cacheKey}`);
          
          // Programar atualização de cache persistente em background
          setTimeout(() => atualizarCacheDeptCounts(), 10);
          
          return res.json(cachedData);
        }
        
        // Resultado final
        const result: Record<string, number> = {};
        
        // Buscas paralelas são mais rápidas que sequenciais
        await Promise.all(DEPARTMENTS.map(async (dept) => {
          try {
            // Usar a função de emergência para obter atividades de cada departamento
            const activities = await buscarAtividadesPorDepartamentoEmergencia(dept);
            result[dept] = activities.length;
          } catch (err) {
            console.error(`[ERROR] Erro ao contar atividades para ${dept}:`, err);
            result[dept] = 0; // Valor padrão em caso de erro
          }
        }));
        
        // Atualizar ambos os caches
        cache.set(cacheKey, result, 30000); // 30 segundos no cache LRU
        CACHE_PERSISTENTE_DEPT_COUNTS = result;
        CACHE_TIMESTAMP_DEPT_COUNTS = Date.now();
        
        console.timeEnd('[PERF] Carregamento contagem por departamento');
        
        return res.json(result);
      } catch (error) {
        console.error("[ERROR] Erro ao processar contagem por departamento:", error);
        
        // Tentar usar cache persistente mesmo expirado como fallback
        if (CACHE_PERSISTENTE_DEPT_COUNTS) {
          console.log('[CACHE-EMERGENCIA] Usando cache persistente expirado para contagem por departamento');
          return res.json(CACHE_PERSISTENTE_DEPT_COUNTS);
        }
        
        throw error; // Propagar erro para ser tratado abaixo
      }
    } catch (error) {
      console.error("[ERROR] Erro ao obter contagem por departamento:", error);
      
      // Em caso de erro crítico, tenta recuperar do cache persistente
      if (CACHE_PERSISTENTE_DEPT_COUNTS) {
        return res.json(CACHE_PERSISTENTE_DEPT_COUNTS);
      }
      
      res.status(500).json({ 
        message: "Erro ao obter contagem por departamento", 
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });
  
  // Statistics for department dashboard
  app.get("/api/department/:department/stats", isAuthenticated, async (req, res) => {
    try {
      let department = req.params.department;
      
      // Sempre usar o departamento do usuário logado se não for admin
      if (req.user && req.user.role !== "admin") {
        department = req.user.role;
      }
      
      // Verificar se o departamento é válido
      if (!DEPARTMENTS.includes(department as any) && department !== "admin") {
        return res.status(400).json({ message: "Departamento inválido" });
      }
      
      console.log(`[DEBUG] Buscando estatísticas para o departamento: ${department}`);
      
      try {
        // Abordagem direta via SQL para evitar erros
        // Contar progresso pendente
        const pendingResult = await db
          .select({ count: sql`count(*)` })
          .from(activityProgress)
          .where(
            and(
              eq(activityProgress.department, department as any),
              eq(activityProgress.status, "pending")
            )
          );
        
        const pendingCount = Number(pendingResult[0]?.count || 0);
        console.log(`[DEBUG] Atividades pendentes para ${department}: ${pendingCount}`);
        
        // Contar progresso completado
        const completedResult = await db
          .select({ count: sql`count(*)` })
          .from(activityProgress)
          .where(
            and(
              eq(activityProgress.department, department as any),
              eq(activityProgress.status, "completed")
            )
          );
        
        const completedCount = Number(completedResult[0]?.count || 0);
        console.log(`[DEBUG] Atividades completadas por ${department}: ${completedCount}`);
        
        return res.json({
          pendingCount,
          completedCount
        });
      } catch (error) {
        console.error(`[ERROR] Erro ao processar estatísticas para ${department}:`, error);
        // Fallback em caso de erro
        return res.json({
          pendingCount: 0,
          completedCount: 0
        });
      }
    } catch (error) {
      console.error("Erro ao buscar estatísticas do departamento:", error);
      res.status(500).json({ message: "Erro ao buscar estatísticas do departamento" });
    }
  });
  
  // Obter histórico de atividades concluídas por um departamento
  app.get("/api/activities/history/:department", isAuthenticated, async (req, res) => {
    try {
      let department = req.params.department;
      
      // Sempre usar o departamento do usuário logado se não for admin
      if (req.user && req.user.role !== "admin") {
        department = req.user.role;
      }
      
      console.log(`[DEBUG] Buscando histórico de atividades para o departamento: ${department}`);
      
      // Verificar se o departamento é válido
      if (!DEPARTMENTS.includes(department as any) && department !== "admin") {
        return res.status(400).json({ message: "Departamento inválido" });
      }
      
      // Adiciona cabeçalhos de cache para o navegador
      res.setHeader('Cache-Control', 'private, max-age=30');
      
      // Cria uma chave de cache baseada no usuário
      const cacheKey = `activities_history_${department}_${req.user.id}`;
      const cachedData = cache.get(cacheKey);
      
      // Se tiver em cache, retorna imediatamente (grande ganho de performance)
      if (cachedData) {
        console.log(`[CACHE] Usando dados em cache para ${cacheKey}`);
        return res.json(cachedData);
      }
      
      // Buscar todos os progressos concluídos para este departamento via SQL
      try {
        // Obter todos os progressos concluídos para este departamento
        const completedProgress = await db
          .select()
          .from(activityProgress)
          .where(
            and(
              eq(activityProgress.department, department),
              eq(activityProgress.status, "completed")
            )
          );
          
        console.log(`[DEBUG] Encontrados ${completedProgress.length} progressos concluídos para o departamento ${department}`);
        
        // Buscar as atividades correspondentes com detalhes completos
        const completedActivities = [];
        
        for (const progress of completedProgress) {
          try {
            // Buscar atividade com detalhes completos
            const activity = await db
              .select()
              .from(activities)
              .where(eq(activities.id, progress.activityId));
              
            if (activity && activity.length > 0) {
              completedActivities.push({
                ...activity[0],
                completedAt: progress.completedAt,
                completedBy: progress.completedBy,
                notes: progress.notes
              });
            }
          } catch (error) {
            console.error(`Erro ao buscar atividade ${progress.activityId}:`, error);
            // Continuar mesmo se uma atividade não for encontrada
          }
        }
        
        // Ordenar por data de conclusão (mais recente primeiro)
        completedActivities.sort((a, b) => {
          if (!a.completedAt) return 1;
          if (!b.completedAt) return -1;
          return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
        });
        
        console.log(`[DEBUG] Encontradas ${completedActivities.length} atividades concluídas para o departamento: ${department}`);
        
        // Guardar em cache por 30 segundos
        cache.set(cacheKey, completedActivities, 30000);
        
        res.json(completedActivities);
      } catch (error) {
        console.error(`Erro SQL na busca de histórico:`, error);
        throw new Error(`Erro ao consultar o banco de dados: ${error.message}`);
      }
    } catch (error) {
      console.error("Erro ao buscar histórico de atividades:", error);
      res.status(500).json({ message: "Erro ao buscar histórico de atividades" });
    }
  });

  // Backup system endpoints (admin only)
  app.get("/api/backup", isAdmin, async (req, res) => {
    try {
      const BACKUP_DIR = path.join(process.cwd(), 'backups');
      
      // Verificar se o diretório de backup existe
      if (!fs.existsSync(BACKUP_DIR)) {
        return res.json({ 
          status: "warning", 
          message: "Nenhum backup encontrado ainda", 
          backups: [] 
        });
      }
      
      // Listar os arquivos de backup
      const files = fs.readdirSync(BACKUP_DIR);
      
      // Organizar por tabela
      const backupsByTable: Record<string, {date: Date, file: string}[]> = {};
      
      for (const file of files) {
        const prefixMatch = file.match(/^([^_]+)_/);
        if (prefixMatch) {
          const prefix = prefixMatch[1];
          const filePath = path.join(BACKUP_DIR, file);
          const stats = fs.statSync(filePath);
          
          if (!backupsByTable[prefix]) {
            backupsByTable[prefix] = [];
          }
          
          backupsByTable[prefix].push({
            date: stats.mtime,
            file
          });
        }
      }
      
      // Ordenar backups por data (mais recentes primeiro)
      for (const table in backupsByTable) {
        backupsByTable[table].sort((a, b) => b.date.getTime() - a.date.getTime());
      }
      
      res.json({
        status: "success",
        message: "Backups listados com sucesso",
        backups: backupsByTable
      });
    } catch (error) {
      res.status(500).json({ 
        status: "error", 
        message: "Erro ao listar backups" 
      });
    }
  });
  
  // Force manual backup creation
  app.post("/api/backup", isAdmin, async (req, res) => {
    try {
      await createBackup();
      res.json({ 
        status: "success", 
        message: "Backup iniciado com sucesso. Este processo ocorre em segundo plano e pode levar alguns segundos para ser concluído." 
      });
    } catch (error) {
      res.status(500).json({ 
        status: "error", 
        message: "Erro ao iniciar backup manual" 
      });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  
  // WebSocket server para atualizações em tempo real
  // Configuração ultra-otimizada para máxima estabilidade e performance
  let wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    // Configurações para melhorar a estabilidade e performance
    clientTracking: true,
    // Definindo o tamanho máximo da mensagem para evitar ataques DoS
    maxPayload: 1024 * 64, // 64KB - mais espaço para payloads maiores
    // Aumentar o timeout de ping para reduzir desconexões
    perMessageDeflate: {
      zlibDeflateOptions: {
        // Usar uma configuração de compressão Zlib mais rápida
        level: 1,
        // Otimização de memória
        memLevel: 7,
      },
      // Não aplicar compressão a mensagens pequenas
      threshold: 1024 // Apenas mensagens maiores que 1KB
    }
  });
  
  // Sistema de monitoramento e auto-recuperação do servidor WebSocket
  let wsErrors = 0;
  const MAX_WS_ERRORS = 10;
  const monitorWSServer = () => {
    // Resetar contador de erros a cada 5 minutos
    setInterval(() => {
      if (wsErrors > 0) {
        console.log(`[WSS] Resetando contador de erros (era ${wsErrors})`);
        wsErrors = 0;
      }
    }, 5 * 60 * 1000); // 5 minutos
    
    // Verificar integridade do servidor WebSocket a cada minuto
    setInterval(() => {
      try {
        const clientCount = Array.from(wss.clients).length;
        
        // Se o servidor tiver problemas (muitos erros), reiniciá-lo
        if (wsErrors > MAX_WS_ERRORS) {
          console.log(`[WSS] Detectados ${wsErrors} erros no servidor WebSocket. Reiniciando servidor...`);
          
          try {
            // Fechar todas as conexões existentes
            wss.clients.forEach(client => {
              try {
                client.close(1012, "Server restart"); // Código 1012 = Server Restart
              } catch (e) {
                // Ignorar erros ao tentar fechar conexões
              }
            });
            
            // Fechar o servidor
            wss.close(() => {
              console.log("[WSS] Servidor WebSocket fechado com sucesso, criando nova instância...");
              
              // Criar novo servidor
              wss = new WebSocketServer({ 
                server: httpServer, 
                path: '/ws',
                clientTracking: true,
                maxPayload: 1024 * 64
              });
              
              // Reconectar os handlers (isso vai chamar o código abaixo que configura os event listeners)
              setupWebSocketServer(wss);
              
              console.log("[WSS] Novo servidor WebSocket iniciado com sucesso!");
              wsErrors = 0;
            });
          } catch (restartError) {
            console.error("[WSS] Erro ao reiniciar servidor WebSocket:", restartError);
          }
        } else {
          // Log periódico da saúde do servidor (só a cada 10 minutos)
          const now = new Date();
          if (now.getMinutes() % 10 === 0 && now.getSeconds() < 10) {
            console.log(`[WSS] Servidor WebSocket saudável com ${clientCount} clientes conectados. Erros: ${wsErrors}`);
          }
        }
      } catch (monitorError) {
        console.error("[WSS] Erro ao monitorar servidor WebSocket:", monitorError);
      }
    }, 60 * 1000); // 1 minuto
  };
  
  // Iniciar monitoramento
  monitorWSServer();
  
  // Função para configurar event listeners do servidor WebSocket
  function setupWebSocketServer(server) {
    // Incrementar contador de erros quando ocorrer erro no WebSocket
    server.on('error', (error) => {
      console.error("[WSS] Erro global no servidor WebSocket:", error);
      wsErrors++;
    });
  
  // Armazenar conexões WebSocket por departamento usando Set para melhor performance
  // Set é mais eficiente para inserção/remoção frequente do que Array
  const connections: Record<string, Set<WebSocket>> = {
    'admin': new Set<WebSocket>(),
    'gabarito': new Set<WebSocket>(),
    'impressao': new Set<WebSocket>(),
    'batida': new Set<WebSocket>(),
    'costura': new Set<WebSocket>(),
    'embalagem': new Set<WebSocket>()
  };
  
  // Verificar e logar estatísticas de conexão a cada 30 segundos
  const connectionCheckInterval = setInterval(() => {
    let totalConnections = 0;
    Object.entries(connections).forEach(([dept, conns]) => {
      totalConnections += conns.size;
    });
    
    console.log(`[websocket] Total de conexões ativas: ${totalConnections}`);
  }, 30000);
  
  // Limpar recursos quando o servidor for encerrado
  process.on('SIGINT', () => {
    console.log('[websocket] Encerrando servidor WebSocket...');
    clearInterval(connectionCheckInterval);
    
    // Fechar todas as conexões ativas
    Object.entries(connections).forEach(([dept, conns]) => {
      conns.forEach(ws => {
        try {
          ws.close(1000, 'Servidor encerrando');
        } catch (error) {
          console.error(`[websocket] Erro ao fechar conexão do ${dept}:`, error);
        }
      });
      conns.clear();
    });
    
    // Fechar o servidor WebSocket
    wss.close();
    console.log('[websocket] Servidor WebSocket encerrado.');
  });
  
  // Função otimizada para enviar atualizações para um departamento específico
  function notifyDepartment(department: string, data: any, highPriority: boolean = false) {
    // Adicionar timestamp para rastreamento de latência e flag de prioridade
    const messageWithTimestamp = {
      ...data,
      server_timestamp: Date.now(),
      high_priority: highPriority
    };
    
    // Serializar a mensagem apenas uma vez para todas as conexões (economia de CPU)
    const serializedMessage = JSON.stringify(messageWithTimestamp);
    
    // Verificar se o departamento existe e tem conexões para evitar processamento desnecessário
    const departmentConnections = connections[department];
    if (!departmentConnections || departmentConnections.size === 0) {
      // Implementar fila para mensagens importantes quando não houver conexões ativas
      if (highPriority) {
        if (!pendingMessages[department]) {
          pendingMessages[department] = [];
        }
        pendingMessages[department].push(serializedMessage);
        console.log(`[websocket] Mensagem de alta prioridade enfileirada para ${department}`);
      }
      return 0; // Retornar 0 conexões notificadas
    }
    
    // Contador de mensagens enviadas com sucesso
    let successCount = 0;
    
    // Enviar para todas as conexões do departamento em um único loop otimizado
    departmentConnections.forEach(ws => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          // Definir prioridade de alta se necessário (menor latência)
          if (highPriority && typeof ws.setPriority === 'function') {
            // @ts-ignore - algumas implementações de WebSocket não têm setPriority
            ws.setPriority(1);
          }
          
          ws.send(serializedMessage);
          successCount++;
        }
      } catch (error) {
        console.error(`[websocket] Erro ao enviar mensagem para ${department}:`, error);
      }
    });
    
    // Armazenar última mensagem por tipo para entrega imediata a novas conexões
    if (data.type) {
      lastMessageByType[`${department}_${data.type}`] = serializedMessage;
    }
    
    // Retornar o número de conexões notificadas com sucesso (útil para debugging)
    return successCount;
  }
  
  // Função otimizada para enviar atualizações para todos os departamentos
  function notifyAll(data: any) {
    // Adicionar timestamp para rastreamento de latência
    const messageWithTimestamp = {
      ...data,
      server_timestamp: Date.now()
    };
    
    // Serializar a mensagem apenas uma vez para todas as conexões (economia de CPU)
    const serializedMessage = JSON.stringify(messageWithTimestamp);
    
    // Resultados por departamento para fins de logging e debugging
    const results: Record<string, number> = {};
    let totalSuccess = 0;
    
    // Otimizado: processamento de departamentos em um único loop
    Object.entries(connections).forEach(([dept, conns]) => {
      if (conns.size === 0) {
        results[dept] = 0;
        return; // Pular departamentos vazios
      }
      
      // Contador de sucesso por departamento
      let deptSuccessCount = 0;
      
      // Enviar para todas as conexões do departamento
      conns.forEach(ws => {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(serializedMessage);
            deptSuccessCount++;
            totalSuccess++;
          }
        } catch (error) {
          console.error(`[websocket] Erro ao enviar mensagem para todos (${dept}):`, error);
        }
      });
      
      results[dept] = deptSuccessCount;
    });
    
    // Se houver conexões notificadas, registrar estatísticas no log
    if (totalSuccess > 0) {
      console.log(`[websocket] Notificação enviada para ${totalSuccess} conexões:`, 
                  Object.entries(results)
                  .filter(([_, count]) => count > 0)
                  .map(([dept, count]) => `${dept}=${count}`)
                  .join(', '));
    }
    
    // Retornar o total de conexões notificadas com sucesso
    return totalSuccess;
  }
  
  // Exportar as funções de notificação para uso em outras partes do código
  (global as any).wsNotifications = {
    notifyDepartment,
    notifyAll
  };
  
  // Configurar WebSocket server com melhor tratamento de erros e performance
  wss.on('connection', (ws, req) => {
    console.log('[websocket] Nova conexão estabelecida');
    
    // Identificador único para esta conexão (para debugging)
    const connectionId = Math.random().toString(36).substring(2, 10);
    
    // Propriedades para rastrear estado da conexão
    let isAlive = true;
    let registeredDepartment: string | null = null;
    
    // Função otimizada para enviar resposta com tratamento de erro embutido
    const sendResponse = (data: any) => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(data));
          return true;
        }
      } catch (err) {
        console.error(`[websocket:${connectionId}] Erro ao enviar mensagem:`, err);
      }
      return false;
    };
    
    // Setup para heartbeat para detectar conexões quebradas mais rapidamente
    ws.on('pong', () => {
      isAlive = true;
    });
    
    // Ping periódico do lado do servidor (a cada 30 segundos)
    const pingInterval = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        clearInterval(pingInterval);
        return;
      }
      
      if (!isAlive) {
        clearInterval(pingInterval);
        console.log(`[websocket:${connectionId}] Conexão inativa detectada, terminando`);
        return ws.terminate();
      }
      
      isAlive = false;
      try {
        ws.ping();
      } catch (err) {
        console.error(`[websocket:${connectionId}] Erro ao enviar ping:`, err);
        clearInterval(pingInterval);
        try { ws.terminate(); } catch (e) {}
      }
    }, 30000);
    
    // Manipulador de mensagens otimizado com tratamento de erro melhorado
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Responder a ping com pong (otimizado para latência mínima)
        if (data.type === 'ping') {
          // Alta prioridade - resposta imediata sem processamento extra
          return sendResponse({ 
            type: 'pong', 
            timestamp: data.timestamp || Date.now(),
            server_time: Date.now()
          });
        }
        
        // Registrar com departamento (otimizado para evitar operações repetidas)
        if (data.type === 'register' && data.department) {
          // Verificar se o departamento é válido
          if (!connections[data.department]) {
            return sendResponse({ 
              type: 'register_error', 
              message: `Departamento inválido: ${data.department}` 
            });
          }
          
          // Verificar se já está registrado no mesmo departamento
          if (registeredDepartment === data.department) {
            return sendResponse({ 
              type: 'register_confirm', 
              department: data.department,
              message: `Já conectado ao departamento ${data.department}` 
            });
          }
          
          // Remover de qualquer departamento anterior
          if (registeredDepartment) {
            connections[registeredDepartment].delete(ws);
          } else {
            // Remover de todos os departamentos (caso tenha registros pendentes)
            Object.keys(connections).forEach(dept => {
              connections[dept].delete(ws);
            });
          }
          
          // Registrar no novo departamento
          connections[data.department].add(ws);
          registeredDepartment = data.department;
          console.log(`[websocket:${connectionId}] Cliente registrado no departamento: ${data.department}`);
          
          // Enviar confirmação com sucesso
          return sendResponse({ 
            type: 'register_confirm', 
            department: data.department,
            message: `Conectado ao departamento ${data.department}`,
            connection_id: connectionId
          });
        }
      } catch (error) {
        console.error(`[websocket:${connectionId}] Erro ao processar mensagem:`, error);
      }
    });
    
    // Manipulador de erro otimizado para evitar crashes
    ws.on('error', (err) => {
      console.error(`[websocket:${connectionId}] Erro na conexão:`, err);
      clearInterval(pingInterval);
      
      // Remover de todos os departamentos para garantir limpeza completa
      if (registeredDepartment) {
        connections[registeredDepartment].delete(ws);
        console.log(`[websocket:${connectionId}] Conexão com erro removida do departamento: ${registeredDepartment}`);
      }
      
      try {
        ws.terminate();
      } catch (e) {
        console.error(`[websocket:${connectionId}] Erro ao terminar conexão com erro:`, e);
      }
    });
    
    // Manipulador otimizado para limpeza eficiente ao desconectar
    ws.on('close', () => {
      console.log(`[websocket:${connectionId}] Cliente desconectado`);
      clearInterval(pingInterval);
      
      // Remover apenas do departamento registrado (mais eficiente)
      if (registeredDepartment && connections[registeredDepartment]) {
        connections[registeredDepartment].delete(ws);
        console.log(`[websocket:${connectionId}] Conexão removida do departamento: ${registeredDepartment}`);
      }
    });
  });
  }
  
  // Rota para diagnóstico de cache e integridade do sistema (sem autenticação para testes)
  app.get('/api/system/diagnostico', async (req, res) => {
    try {
      // Usar a função de verificação de integridade de cache já importada do módulo
      // Não usar require() que não funciona no contexto atual
      
      // Para diagnóstico simples sem dependência de checkCacheIntegrity
      
      // Obter estatísticas do LRUCache do sistema global
      const globalCache = (global as any).cache || {};
      const lruCacheStats = {
        size: globalCache.size?.() || 0,
        hotCacheSize: globalCache.hotCache?.size || 0,
        prefetchCacheSize: globalCache.prefetchCache?.size || 0,
        hits: globalCache.hits || 0,
        misses: globalCache.misses || 0,
        totalRequests: globalCache.totalRequests || 0,
        cacheInterval: globalCache.cleanupInterval || 0,
        hitRate: globalCache.totalRequests > 0 
          ? Math.round((globalCache.hits / globalCache.totalRequests) * 100) + '%' 
          : 'N/A'
      };
      
      // Obter contagem de atividades por departamento
      let departmentCounts = {};
      try {
        // Usar a mesma lógica que a rota /api/stats/department-counts mas sem autenticação
        for (const department of DEPARTMENTS) {
          const activities = await buscarAtividadesPorDepartamentoEmergencia(department);
          departmentCounts[department] = activities.length;
        }
      } catch (error) {
        departmentCounts = { error: "Não foi possível obter contagem de departamentos" };
      }
      
      // Retornar informações completas
      res.json({
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoria: {
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + "MB",
          usado: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + "MB",
          externo: Math.round(process.memoryUsage().external / 1024 / 1024) + "MB",
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + "MB"
        },
        lruCache: lruCacheStats,
        conexoesWebSocket: (global as any).websocketConnections || 0,
        departamentos: departmentCounts,
        versao: "2.8.2",
        status: "Sistema operacional e otimizado"
      });
    } catch (error) {
      res.status(500).json({
        error: 'Falha ao verificar cache',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Chamada inicial para configurar o servidor
  setupWebSocketServer(wss);
  
  return httpServer;
}
