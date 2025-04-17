import express from 'express';
import { storage } from './storage';
import { DEPARTMENTS } from '@shared/schema';

const router = express.Router();

// Middleware to check if user is authenticated and is an admin
function isAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.isAuthenticated && req.isAuthenticated() && req.user && req.user.role === "admin") {
    return next();
  }
  return res.status(403).json({ message: "Acesso negado" });
}

// Esta função pré-carrega TODAS as atividades com seus progressos em uma única chamada
// Isso reduz drasticamente o número de consultas ao banco de dados
async function preloadActivitiesWithProgress() {
  console.log('[ADMIN DASHBOARD] Pré-carregando todas as atividades com seus progressos');
  
  try {
    // Buscar todas as atividades
    const activities = await storage.getAllActivities();
    
    // Buscar TODOS os progressos de uma vez só (ultra otimização)
    // Esta é a chave da otimização: buscar todos os progressos de uma vez
    const allProgressData = await storage.getAllActivitiesProgress();
    
    // Agrupar progressos por ID de atividade para acesso rápido
    const progressesByActivityId = new Map();
    for (const progress of allProgressData) {
      if (!progressesByActivityId.has(progress.activityId)) {
        progressesByActivityId.set(progress.activityId, []);
      }
      progressesByActivityId.get(progress.activityId).push(progress);
    }
    
    // Processar todas as atividades com seus progressos
    const activitiesWithProgress = activities.map(activity => {
      // Obter progressos desta atividade do mapa
      const progresses = progressesByActivityId.get(activity.id) || [];
      
      // Ordenar os progressos por departamento
      const pendingProgress = progresses
        .filter(p => p.status === 'pending')
        .sort((a, b) => {
          const deptOrder = ['gabarito', 'impressao', 'batida', 'costura', 'embalagem'];
          return deptOrder.indexOf(a.department as any) - deptOrder.indexOf(b.department as any);
        })[0];
        
      // Verificar se o pedido foi concluído pelo último departamento (embalagem)
      const embalagemProgress = progresses.find(p => p.department === 'embalagem');
      const pedidoConcluido = embalagemProgress && embalagemProgress.status === 'completed';
      
      // Determinar o departamento atual ou marcar como concluído se embalagem já finalizou
      let currentDepartment = pendingProgress ? pendingProgress.department : 'gabarito';
      
      // Se o pedido foi concluído pela embalagem, vamos marcar como "concluido" 
      if (!pendingProgress && pedidoConcluido) {
        currentDepartment = 'concluido' as any;
      }
      
      return {
        ...activity,
        currentDepartment,
        client: activity.clientName,  // Nome do cliente
        clientInfo: activity.description || null, // Adiciona informações adicionais do cliente (descrição)
        progress: progresses
      };
    });
    
    return activitiesWithProgress;
  } catch (error) {
    console.error('[ADMIN DASHBOARD] Erro ao pré-carregar atividades:', error);
    throw error;
  }
}

// Rota ultra-otimizada para buscar atividades com paginação - extremamente eficiente
router.get('/activities', isAdmin, async (req, res) => {
  try {
    const status = req.query.status as string || 'all';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 30;
    const search = req.query.search as string || '';
    
    console.log(`[ULTRA OTIMIZAÇÃO] Buscando atividades para admin com status=${status}, page=${page}, limit=${limit}`);
    
    // Usar cache para dados processados - chave baseada nos parâmetros da requisição
    const cacheKey = `admin_dashboard_${status}_${page}_${limit}_${search}`;
    const cache = (global as any).cache;
    
    // Verificar se os dados já estão em cache
    const cachedData = cache ? cache.get(cacheKey) : null;
    if (cachedData) {
      console.log(`[CACHE HIT] Usando dados em cache para ${cacheKey}`);
      return res.json(cachedData);
    }
    
    // Timeout para garantir resposta rápida
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });
    
    try {
      // Race entre busca de dados e timeout
      const activitiesWithProgress = await Promise.race([
        preloadActivitiesWithProgress(),
        timeoutPromise
      ]) as any[];
      
      // Filtrar por status (se especificado)
      let filteredActivities = activitiesWithProgress;
      if (status === 'concluido') {
        filteredActivities = activitiesWithProgress.filter(act => act.currentDepartment === 'concluido');
      } else if (status === 'producao') {
        filteredActivities = activitiesWithProgress.filter(act => act.currentDepartment !== 'concluido');
      }
      
      // Filtrar por texto de busca se especificado
      if (search) {
        const searchLower = search.toLowerCase();
        filteredActivities = filteredActivities.filter(act => 
          act.title.toLowerCase().includes(searchLower) || 
          (act.clientName && act.clientName.toLowerCase().includes(searchLower)) ||
          (act.description && act.description.toLowerCase().includes(searchLower))
        );
      }
      
      // Ordenar por data de entrega
      filteredActivities.sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;  // Sem data vai para o final
        if (!b.deadline) return -1; // Sem data vai para o final
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
      
      // Log para diagnóstico: mostrar quantos pedidos estamos retornando
      if (status === 'producao') {
        console.log(`[ADMIN] Retornando ${filteredActivities.length} pedidos EM PRODUÇÃO`);
      } else if (status === 'concluido') {
        console.log(`[ADMIN] Retornando ${filteredActivities.length} pedidos CONCLUÍDOS`);
      } else {
        console.log(`[ADMIN] Retornando ${filteredActivities.length} pedidos NO TOTAL`);
      }
      
      // Aplicar paginação
      const paginatedResult = {
        items: filteredActivities.slice((page - 1) * limit, page * limit),
        total: filteredActivities.length,
        page,
        totalPages: Math.ceil(filteredActivities.length / limit)
      };
      
      // Salvar no cache por 30 segundos (aumentado para melhor performance)
      if (cache) {
        cache.set(cacheKey, paginatedResult, 30000);
      }
      
      return res.json(paginatedResult);
    } catch (timeoutError) {
      console.log('[TIMEOUT] Usando estratégia de fallback para resposta rápida');
      
      // FALLBACK: buscar diretamente do storage em caso de timeout
      // Vamos buscar apenas a quantidade necessária no limite atual para resposta mais rápida
      let activities;
      
      if (status === 'concluido') {
        // Buscar apenas atividades concluídas - mais rápido
        activities = await storage.getCompletedActivities(limit * 2); // Busca um pouco mais para ter margem
      } else {
        // Buscar atividades em andamento - mais rápido
        activities = await storage.getActivitiesInProgress(limit * 2); // Busca um pouco mais para ter margem
      }
      
      // Formatar resposta simplificada com campos essenciais
      const simplifiedActivities = activities.map(activity => ({
        ...activity,
        currentDepartment: status === 'concluido' ? 'concluido' : (activity.currentDepartment || 'gabarito'),
        client: activity.clientName,
        clientInfo: activity.description || null
      }));
      
      // Aplicar paginação
      const paginatedResult = {
        items: simplifiedActivities.slice((page - 1) * limit, page * limit),
        total: simplifiedActivities.length,
        page,
        totalPages: Math.ceil(simplifiedActivities.length / limit),
        isPartialResult: true // Indica que é um resultado parcial/fallback
      };
      
      // Cache por tempo menor para resultados parciais
      if (cache) {
        cache.set(cacheKey, paginatedResult, 10000);
      }
      
      return res.json(paginatedResult);
    }
  } catch (error) {
    console.error('[ADMIN DASHBOARD] Erro ao buscar atividades:', error);
    return res.status(500).json({ message: 'Erro ao buscar atividades' });
  }
});

// Rota para obter estatísticas dos departamentos (contagem de pedidos por departamento)
router.get('/department-stats', isAdmin, async (req, res) => {
  try {
    // Obter todas as atividades com progresso de uma vez só
    const activitiesWithProgress = await preloadActivitiesWithProgress();
    
    // Inicializar contador por departamento
    const departmentCounts = {};
    DEPARTMENTS.forEach(dept => {
      departmentCounts[dept] = 0;
    });
    
    // Contar atividades por departamento atual
    activitiesWithProgress.forEach(activity => {
      if (activity.currentDepartment && activity.currentDepartment !== 'concluido') {
        departmentCounts[activity.currentDepartment] = 
          (departmentCounts[activity.currentDepartment] || 0) + 1;
      }
    });
    
    // Adicionar contador para concluídos
    departmentCounts['concluido'] = activitiesWithProgress.filter(
      a => a.currentDepartment === 'concluido'
    ).length;
    
    return res.json(departmentCounts);
  } catch (error) {
    console.error('[ADMIN DASHBOARD] Erro ao obter estatísticas dos departamentos:', error);
    return res.status(500).json({ message: 'Erro ao obter estatísticas dos departamentos' });
  }
});

export default router;