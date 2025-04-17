import { Request, Response, Router } from "express";
import { storage } from "./storage";

// Cache dedicado apenas para dados do dashboard admin
let cachedActivities = {
  producao: [] as any[],
  concluido: [] as any[],
  all: [] as any[]
};

let lastUpdate = 0;
const UPDATE_INTERVAL = 30000; // 30 segundos

// Obter atividades com seus progressos de forma otimizada
async function preloadActivitiesWithProgress() {
  console.log("[ULTRA OTIMIZAÇÃO] Iniciando carregamento de dados para admin");
  const startTime = Date.now();
  try {
    // 1. Obter todas as atividades de uma vez só
    const allActivities = await storage.getAllActivities();
    console.log(`[ULTRA OTIMIZAÇÃO] Obtidas ${allActivities.length} atividades`);
    
    // 2. Obter TODOS os progressos de TODAS as atividades com uma única consulta
    // Isso é muito mais eficiente que fazer N consultas separadas
    const allProgressData = await storage.getAllActivitiesProgress();
    console.log(`[ULTRA OTIMIZAÇÃO] Obtidos dados de progresso para todas as atividades`);
    
    // 3. Processar tudo de uma vez
    const processedActivities = allActivities.map(activity => {
      // Encontrar os progressos desta atividade
      const progresses = allProgressData.filter(p => p.activityId === activity.id);
      
      // Determinar o departamento atual
      const pendingProgress = progresses
        .filter(p => p.status === 'pending')
        .sort((a, b) => {
          const deptOrder = ['gabarito', 'impressao', 'batida', 'costura', 'embalagem'];
          return deptOrder.indexOf(a.department as any) - deptOrder.indexOf(b.department as any);
        })[0];
      
      // Verificar se foi concluído pela embalagem
      const embalagemProgress = progresses.find(p => p.department === 'embalagem');
      const pedidoConcluido = embalagemProgress && embalagemProgress.status === 'completed';
      
      // Determinar o departamento atual
      let currentDepartment = pendingProgress ? pendingProgress.department : 'gabarito';
      
      // Se foi concluído pela embalagem, marcar como concluído
      if (!pendingProgress && pedidoConcluido) {
        currentDepartment = 'concluido';
      }
      
      return {
        ...activity,
        currentDepartment,
        client: activity.clientName || 'Cliente',
        clientInfo: activity.description || null,
        progress: progresses
      };
    });
    
    // 4. Separar por status e ordenar
    const concluidos = processedActivities.filter(a => a.currentDepartment === 'concluido');
    const emProducao = processedActivities.filter(a => a.currentDepartment !== 'concluido');
    
    // 5. Função para ordenar por data de entrega
    const sortByDeadline = (a: any, b: any) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    };
    
    // 6. Atualizar o cache
    cachedActivities = {
      producao: emProducao.sort(sortByDeadline),
      concluido: concluidos.sort(sortByDeadline),
      all: processedActivities.sort(sortByDeadline)
    };
    
    // 7. Atualizar o timestamp de última atualização
    lastUpdate = Date.now();
    
    const endTime = Date.now();
    console.log(`[ULTRA OTIMIZAÇÃO] Dados carregados com sucesso em ${(endTime - startTime)/1000}s`);
    console.log(`[ULTRA OTIMIZAÇÃO] Total: ${processedActivities.length} atividades (${concluidos.length} concluídas, ${emProducao.length} em produção)`);
    
    return true;
  } catch (error) {
    console.error("[ULTRA OTIMIZAÇÃO] Erro ao carregar dados:", error);
    return false;
  }
}

// Iniciar o precarregamento imediatamente
preloadActivitiesWithProgress();

// Criar um intervalo para atualizar os dados periodicamente
setInterval(preloadActivitiesWithProgress, UPDATE_INTERVAL);

// Middleware para verificar se o usuário é admin
function isAdmin(req: Request, res: Response, next: Function) {
  if (req.isAuthenticated && req.isAuthenticated() && req.user && req.user.role === "admin") {
    return next();
  }
  return res.status(403).json({ message: "Acesso negado. Apenas administradores podem acessar esta rota." });
}

// Router para as rotas otimizadas do admin
const adminDashboardRouter = Router();

// Rota para obter todas as atividades (otimizada)
adminDashboardRouter.get('/activities', isAdmin, async (req, res) => {
  // Verificar se os dados estão desatualizados (mais de 30 segundos)
  if (Date.now() - lastUpdate > UPDATE_INTERVAL) {
    // Se estiverem desatualizados, recarregar
    console.log("[ULTRA OTIMIZAÇÃO] Dados desatualizados, recarregando...");
    await preloadActivitiesWithProgress();
  }
  
  try {
    // Parâmetros da requisição
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 30;
    const status = req.query.status as string || 'producao';
    
    // Selecionar os dados conforme o status solicitado
    const activities = status === 'all' 
      ? cachedActivities.all 
      : (status === 'concluido' ? cachedActivities.concluido : cachedActivities.producao);
    
    // Aplicar paginação
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedItems = activities.slice(startIndex, endIndex);
    
    // Montar resposta
    const response = {
      items: paginatedItems,
      total: activities.length,
      page: page,
      totalPages: Math.ceil(activities.length / limit)
    };
    
    console.log(`[ULTRA OTIMIZAÇÃO] Retornando ${paginatedItems.length} atividades (status=${status}, page=${page}/${Math.ceil(activities.length / limit)})`);
    
    return res.json(response);
  } catch (error) {
    console.error("[ULTRA OTIMIZAÇÃO] Erro ao processar requisição:", error);
    return res.status(500).json({ 
      message: "Erro ao processar requisição", 
      error: error.message 
    });
  }
});

// Rota para forçar recarga dos dados
adminDashboardRouter.post('/activities/reload', isAdmin, async (req, res) => {
  console.log("[ULTRA OTIMIZAÇÃO] Recarga forçada solicitada");
  const success = await preloadActivitiesWithProgress();
  
  if (success) {
    return res.json({
      message: "Dados recarregados com sucesso",
      timestamp: lastUpdate,
      counts: {
        producao: cachedActivities.producao.length,
        concluido: cachedActivities.concluido.length,
        total: cachedActivities.all.length
      }
    });
  } else {
    return res.status(500).json({ message: "Erro ao recarregar dados" });
  }
});

// Rota para obter contagens rápidas (dashboard)
adminDashboardRouter.get('/activities/counts', isAdmin, (req, res) => {
  const counts = {
    total: cachedActivities.all.length,
    producao: cachedActivities.producao.length,
    concluido: cachedActivities.concluido.length,
    lastUpdate: lastUpdate
  };
  
  return res.json(counts);
});

export default adminDashboardRouter;