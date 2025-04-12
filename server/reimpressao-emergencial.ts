// Módulo de reimpressão ultra-básico (sem banco de dados, sem autenticação)
// Implementação mais simples possível para garantir funcionamento
// Armazena dados em memória compartilhada

import express, { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { 
  EmergencyReprintRequest, 
  getAllRequests, 
  getRequestById, 
  addRequest, 
  updateRequest 
} from './emergency-storage';

const router: Router = express.Router();

// Função para obter imagem da atividade
async function getActivityImage(activityId: number): Promise<string | null> {
  try {
    // Casos especiais - referências diretas para arquivos específicos
    if (activityId === 48) {
      return '/iphone-icon.svg';
    } else if (activityId === 49) {
      return '/uploads/activity_49.jpg';
    } else if (activityId === 53) {
      return '/uploads/activity_53.jpg';
    }
    
    // Tenta extrair a imagem da atividade da lista de departamentos
    try {
      const { buscarAtividadesPorDepartamentoEmergencia } = await import('./solucao-emergencial');
      
      // Departamentos do fluxo, tente buscar do atual primeiro
      const departments = ['gabarito', 'impressao', 'batida', 'costura', 'embalagem'];
      
      // Verificar em qual departamento a atividade está atualmente
      const { storage } = await import('./storage-export');
      const allProgresses = await storage.getActivityProgress(activityId);
      const pendingProgress = allProgresses
        .filter(p => p.status === 'pending')
        .sort((a, b) => {
          return departments.indexOf(a.department as any) - departments.indexOf(b.department as any);
        })[0];
      
      const currentDepartment = pendingProgress ? pendingProgress.department : 'gabarito';
      
      // Buscar atividade na lista de departamentos
      const departmentActivities = await buscarAtividadesPorDepartamentoEmergencia(currentDepartment);
      let activity = departmentActivities.find(act => act.id === activityId);
      
      // Se não encontrou, tenta em todos os departamentos
      if (!activity || !activity.image) {
        for (const dept of departments) {
          const deptActivities = await buscarAtividadesPorDepartamentoEmergencia(dept);
          const foundActivity = deptActivities.find(act => act.id === activityId);
          if (foundActivity && foundActivity.image) {
            activity = foundActivity;
            break;
          }
        }
      }
      
      // Se houver imagem base64, salva em um arquivo temporário
      if (activity && activity.image && activity.image.startsWith('data:')) {
        // Caminho base para as imagens
        const basePath = '/uploads/';
        const imagePath = `${basePath}activity_${activityId}.jpg`;
        
        // Salvar imagem em arquivo para acesso direto
        try {
          // Extrai os dados base64
          const matches = activity.image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const data = Buffer.from(matches[2], 'base64');
            const fullPath = path.join(process.cwd(), 'client/public', imagePath);
            console.log(`⚠️ Tentando salvar imagem em ${fullPath}`);
            
            // Cria o diretório se não existir
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            
            // Salva o arquivo
            fs.writeFileSync(fullPath, data);
            console.log(`✅ Imagem salva em ${fullPath}`);
            return imagePath;
          }
        } catch (err) {
          console.error('Erro ao salvar imagem:', err);
        }
        
        // Se não conseguiu salvar, usa a imagem da API
        return `/api/activity-image/${activityId}`;
      } else if (activity && activity.image) {
        // Se não for base64, retorna a URL direta
        return activity.image;
      }
    } catch (err) {
      console.error('Erro ao buscar imagem nas atividades dos departamentos:', err);
    }
    
    // Verificar se o arquivo existe (fallback)
    try {
      // Caminho base para as imagens
      const basePath = '/uploads/';
      const fullPath = path.join(process.cwd(), 'client/public', `${basePath}activity_${activityId}.jpg`);
      if (fs.existsSync(fullPath)) {
        return `${basePath}activity_${activityId}.jpg`;
      }
    } catch (err) {
      console.error('Erro ao verificar arquivo:', err);
    }
    
    // Último recurso: tentativa com a API
    return `/api/activity-image/${activityId}`;
  } catch (error) {
    console.error('Erro ao obter imagem da atividade:', error);
    return null;
  }
}

// Rota para criar solicitação (POST /api/reimpressao-emergencial/criar)
router.post('/criar', async (req: Request, res: Response) => {
  console.log('💡 Requisição para criar solicitação de emergência:', req.body);
  
  try {
    const { activityId, requestedBy, reason, details, quantity } = req.body;
    
    // Validação simples
    if (!activityId || !requestedBy || !reason) {
      console.log('❌ Campos obrigatórios faltando');
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios faltando'
      });
    }
    
    // Buscar título da atividade do "banco de dados"
    let activityTitle = "";
    try {
      const { storage } = await import('./storage-export');
      const activity = await storage.getActivity(Number(activityId));
      activityTitle = activity ? activity.title : `Pedido #${activityId}`;
    } catch (err) {
      console.error('Erro ao buscar título da atividade:', err);
      activityTitle = `Pedido #${activityId}`;
    }
    
    // Obter a URL da imagem da atividade
    const activityImage = await getActivityImage(Number(activityId));
    
    // Criar solicitação
    const novaSolicitacao: EmergencyReprintRequest = {
      id: Date.now(),
      activityId: Number(activityId),
      activityTitle,
      activityImage,
      requestedBy,
      reason,
      details: details || '',
      quantity: Number(quantity) || 1,
      status: 'pendente',
      createdAt: new Date().toISOString(),
      fromDepartment: 'batida',
      toDepartment: 'impressao'
    };
    
    // Adicionar à lista compartilhada
    addRequest(novaSolicitacao);
    
    console.log('✅ Solicitação emergencial criada com sucesso:', novaSolicitacao);
    
    // Retornar resposta
    return res.status(201).json({
      success: true,
      message: 'Solicitação criada com sucesso',
      data: novaSolicitacao
    });
    
  } catch (error: any) {
    console.error('🔥 Erro ao criar solicitação emergencial:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor: ' + (error.message || 'Erro desconhecido')
    });
  }
});

// Rota para listar solicitações (GET /api/reimpressao-emergencial/listar)
router.get('/listar', (req: Request, res: Response) => {
  console.log('💡 Requisição para listar solicitações emergenciais');
  return res.status(200).json(getAllRequests());
});

// Rota para obter uma solicitação específica (GET /api/reimpressao-emergencial/:id)
router.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  console.log(`💡 Requisição para obter solicitação emergencial #${id}`);
  
  const solicitacao = getRequestById(id);
  
  if (!solicitacao) {
    return res.status(404).json({
      success: false,
      message: 'Solicitação não encontrada'
    });
  }
  
  return res.status(200).json(solicitacao);
});

// Rota para processar solicitação (POST /api/reimpressao-emergencial/:id/processar)
router.post('/:id/processar', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  console.log(`💡 Requisição para processar solicitação emergencial #${id}:`, req.body);
  
  const { status, processedBy } = req.body;
  
  if (!status || !processedBy) {
    return res.status(400).json({
      success: false,
      message: 'Status e responsável são obrigatórios'
    });
  }
  
  // Atualizar solicitação usando o storage compartilhado
  const solicitacaoAtualizada = updateRequest(id, {
    status,
    processedBy,
    processedAt: new Date().toISOString()
  });
  
  if (!solicitacaoAtualizada) {
    return res.status(404).json({
      success: false,
      message: 'Solicitação não encontrada'
    });
  }
  
  console.log(`✅ Solicitação emergencial #${id} processada com sucesso:`, solicitacaoAtualizada);
  
  return res.status(200).json({
    success: true,
    message: 'Solicitação processada com sucesso',
    data: solicitacaoAtualizada
  });
});

// Função para listar solicitações de reimpressão 
// Mantido para compatibilidade, mas usando o storage compartilhado
export function listarSolicitacoesReimpressao(): EmergencyReprintRequest[] {
  return getAllRequests();
}

export default router;