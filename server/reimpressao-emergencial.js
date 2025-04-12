// Módulo de reimpressão ultra-básico (sem banco de dados, sem autenticação)
// Implementação mais simples possível para garantir funcionamento
// Armazena dados em memória apenas

const express = require('express');
const router = express.Router();

// Armazenamento em memória para as solicitações
const solicitacoes = [];

// Função para obter imagem da atividade
async function getActivityImage(activityId) {
  try {
    // Tenta obter a atividade para buscar a imagem real
    const { storage } = require('./storage-export');
    const activity = await storage.getActivity(Number(activityId));
    
    if (activity && activity.image) {
      console.log(`Imagem encontrada para atividade ${activityId}: ${activity.image.substring(0, 50)}...`);
      return activity.image;
    } else {
      // Fallback para caminho de imagem estático (logo)
      console.log(`Imagem não encontrada para atividade ${activityId}, usando logo padrão`);
      return '/logo.svg';
    }
  } catch (error) {
    console.error('Erro ao obter imagem da atividade:', error);
    return '/logo.svg';
  }
}

// Rota para criar solicitação (POST /api/reimpressao-emergencial/criar)
router.post('/criar', async (req, res) => {
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
      const { storage } = require('./storage-export');
      const activity = await storage.getActivity(Number(activityId));
      activityTitle = activity ? activity.title : `Pedido #${activityId}`;
    } catch (err) {
      console.error('Erro ao buscar título da atividade:', err);
      activityTitle = `Pedido #${activityId}`;
    }
    
    // Obter a URL da imagem da atividade
    const activityImage = await getActivityImage(activityId);
    
    // Criar solicitação
    const novaSolicitacao = {
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
    
    // Adicionar à lista
    solicitacoes.push(novaSolicitacao);
    
    console.log('✅ Solicitação emergencial criada com sucesso:', novaSolicitacao);
    console.log('✅ Total de solicitações emergenciais:', solicitacoes.length);
    
    // Retornar resposta
    return res.status(201).json({
      success: true,
      message: 'Solicitação criada com sucesso',
      data: novaSolicitacao
    });
    
  } catch (error) {
    console.error('🔥 Erro ao criar solicitação emergencial:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor: ' + (error.message || 'Erro desconhecido')
    });
  }
});

// Rota para listar solicitações (GET /api/reimpressao-emergencial/listar)
router.get('/listar', (req, res) => {
  console.log('💡 Requisição para listar solicitações emergenciais');
  return res.status(200).json(solicitacoes);
});

// Rota para obter uma solicitação específica (GET /api/reimpressao-emergencial/:id)
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  console.log(`💡 Requisição para obter solicitação emergencial #${id}`);
  
  const solicitacao = solicitacoes.find(s => s.id === id);
  
  if (!solicitacao) {
    return res.status(404).json({
      success: false,
      message: 'Solicitação não encontrada'
    });
  }
  
  return res.status(200).json(solicitacao);
});

// Rota para processar solicitação (POST /api/reimpressao-emergencial/:id/processar)
router.post('/:id/processar', (req, res) => {
  const id = parseInt(req.params.id);
  console.log(`💡 Requisição para processar solicitação emergencial #${id}:`, req.body);
  
  const { status, processedBy } = req.body;
  
  if (!status || !processedBy) {
    return res.status(400).json({
      success: false,
      message: 'Status e responsável são obrigatórios'
    });
  }
  
  const index = solicitacoes.findIndex(s => s.id === id);
  
  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: 'Solicitação não encontrada'
    });
  }
  
  // Atualizar solicitação
  solicitacoes[index] = {
    ...solicitacoes[index],
    status,
    processedBy,
    processedAt: new Date().toISOString()
  };
  
  console.log(`✅ Solicitação emergencial #${id} processada com sucesso:`, solicitacoes[index]);
  
  return res.status(200).json({
    success: true,
    message: 'Solicitação processada com sucesso',
    data: solicitacoes[index]
  });
});

// Exportar as funções para acesso direto em rotas padrão
function listarSolicitacoesReimpressao() {
  console.log('📋 Retornando solicitações da memória:', solicitacoes.length);
  return solicitacoes;
}

module.exports = router;
module.exports.listarSolicitacoesReimpressao = listarSolicitacoesReimpressao;