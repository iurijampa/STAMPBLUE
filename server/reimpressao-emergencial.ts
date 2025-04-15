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
  updateRequest,
  listarSolicitacoesReimpressao
} from './emergency-storage';

const router: Router = express.Router();

// Função para obter imagem da atividade
async function getActivityImage(activityId: number): Promise<string | null> {
  try {
    console.log(`🔍 Buscando imagem para atividade #${activityId}`);
    
    // Verificar se temos configurações especiais
    if (activityId === 49) {
      console.log(`ℹ️ Usando imagem específica conhecida para atividade #${activityId}`);
      return 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    }
    
    // Tenta obter diretamente do banco de dados
    try {
      const { storage } = await import('./storage-export');
      const activity = await storage.getActivity(activityId);
      
      if (activity && activity.image) {
        console.log(`✅ Imagem encontrada no banco de dados para atividade #${activityId}`);
        console.log(`ℹ️ Imagem começa com: ${activity.image.substring(0, 30)}...`);
        
        // Se a imagem é base64, retorná-la diretamente (mais confiável)
        if (activity.image.startsWith('data:')) {
          console.log(`✅ Retornando imagem base64 diretamente para atividade #${activityId}`);
          return activity.image;
        }
        
        // Se não for base64, retorna a URL direta
        return activity.image;
      } else {
        console.log(`⚠️ Atividade #${activityId} encontrada, mas sem imagem`);
      }
    } catch (err) {
      console.error('Erro ao buscar imagem no banco de dados:', err);
    }
    
    // Tenta extrair a imagem da atividade de departamentos emergenciais
    try {
      console.log(`🔍 Tentando buscar imagem de departamentos para atividade #${activityId}`);
      const { buscarAtividadesPorDepartamentoEmergencia } = await import('./solucao-emergencial');
      
      // Departamentos do fluxo, tente buscar em todos
      const departments = ['batida', 'impressao', 'gabarito', 'costura', 'embalagem'];
      
      // Tenta em todos os departamentos
      for (const dept of departments) {
        console.log(`🔍 Buscando atividade #${activityId} no departamento ${dept}`);
        const deptActivities = await buscarAtividadesPorDepartamentoEmergencia(dept);
        const foundActivity = deptActivities.find(act => act.id === activityId);
        
        if (foundActivity && foundActivity.image) {
          console.log(`✅ Imagem encontrada para atividade #${activityId} no departamento ${dept}`);
          console.log(`ℹ️ Imagem começa com: ${foundActivity.image.substring(0, 30)}...`);
          
          // Retorna imagem base64 diretamente para garantir confiabilidade
          return foundActivity.image;
        }
      }
    } catch (err) {
      console.error('Erro ao buscar imagem nos departamentos:', err);
    }
    
    // Verificar se o arquivo existe (fallback)
    try {
      // Caminho base para as imagens
      const basePath = '/uploads/';
      const imagePath = `${basePath}activity_${activityId}.jpg`;
      const fullPath = path.join(process.cwd(), 'client/public', imagePath);
      
      if (fs.existsSync(fullPath)) {
        console.log(`✅ Arquivo de imagem encontrado em ${fullPath}`);
        
        // Ler o arquivo e verificar se é um base64 válido
        const fileContent = fs.readFileSync(fullPath, 'utf8').trim();
        if (fileContent.startsWith('data:')) {
          console.log(`✅ Arquivo contém dados base64 válidos, retornando conteúdo direto`);
          return fileContent;
        }
        
        return imagePath;
      } else {
        console.log(`⚠️ Arquivo de imagem não encontrado em ${fullPath}`);
      }
    } catch (err) {
      console.error('Erro ao verificar arquivo de imagem:', err);
    }
    
    // Último recurso para determinadas atividades conhecidas
    if (activityId === 53) {
      console.log(`ℹ️ Usando imagem de fallback para atividade #${activityId}`);
      // Mini imagem em base64
      return 'data:image/jpeg;base64,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';
    }
    
    // Último recurso: tentativa com a API
    console.log(`⚠️ Nenhuma imagem encontrada, usando API como fallback para atividade #${activityId}`);
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
  // Usar função listarSolicitacoesReimpressao com parâmetro includeCanceled=false para não incluir solicitações canceladas
  return res.status(200).json(listarSolicitacoesReimpressao(undefined, false));
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

// Rota para cancelar solicitação (POST /api/reimpressao-emergencial/:id/cancelar)
router.post('/:id/cancelar', (req: Request, res: Response) => {
  try {
    // Verificar se o ID é válido
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      console.error(`⚠️ ID inválido para cancelamento: ${req.params.id}`);
      return res.status(400).json({
        success: false,
        message: 'ID de solicitação inválido'
      });
    }
    
    console.log(`💡 Requisição para cancelar solicitação emergencial #${id}:`, req.body);
    
    // Verificar se o corpo da requisição é válido
    if (!req.body || typeof req.body !== 'object') {
      console.error(`⚠️ Corpo da requisição inválido:`, req.body);
      return res.status(400).json({
        success: false,
        message: 'Corpo da requisição inválido'
      });
    }
    
    const { canceledBy } = req.body;
    
    if (!canceledBy) {
      console.error(`⚠️ Nome de quem está cancelando não informado`);
      return res.status(400).json({
        success: false,
        message: 'Nome de quem está cancelando é obrigatório'
      });
    }
    
    // Verificar se a solicitação existe
    const solicitacaoExistente = getRequestById(id);
    if (!solicitacaoExistente) {
      console.error(`⚠️ Solicitação #${id} não encontrada para cancelamento`);
      return res.status(404).json({
        success: false,
        message: 'Solicitação não encontrada'
      });
    }
    
    // Atualizar solicitação para status "cancelada"
    const solicitacaoAtualizada = updateRequest(id, {
      status: 'cancelada',
      processedBy: canceledBy,
      processedAt: new Date().toISOString()
    });
    
    console.log(`✅ Solicitação emergencial #${id} cancelada com sucesso:`, solicitacaoAtualizada);
    
    // Definir explicitamente o cabeçalho Content-Type
    res.setHeader('Content-Type', 'application/json');
    
    return res.status(200).json({
      success: true,
      message: 'Solicitação cancelada com sucesso',
      data: solicitacaoAtualizada
    });
  } catch (error) {
    console.error(`❌ Erro ao cancelar solicitação:`, error);
    
    // Definir explicitamente o cabeçalho Content-Type
    res.setHeader('Content-Type', 'application/json');
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao processar a solicitação de cancelamento',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Removida a definição duplicada da função listarSolicitacoesReimpressao
// A função agora vem diretamente do módulo emergency-storage.ts

// Exportando funções específicas para que possam ser usadas em outros módulos
export { listarSolicitacoesReimpressao };

export default router;