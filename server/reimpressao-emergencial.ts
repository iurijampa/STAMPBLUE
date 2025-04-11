// Módulo de reimpressão ultra-básico (sem banco de dados, sem autenticação)
// Implementação mais simples possível para garantir funcionamento
// Armazena dados em memória compartilhada

import express, { Router, Request, Response } from 'express';
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
    // Caminho base para as imagens
    const basePath = '/uploads/';
    return `${basePath}activity_${activityId}.jpg`;
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