// Módulo de reimpressão ultra-básico (sem banco de dados, sem autenticação)
// Implementação mais simples possível para garantir funcionamento
// Armazena dados em memória apenas

const express = require('express');
const router = express.Router();

// Armazenamento em memória para as solicitações
let solicitacoes = [];

// Rota para criar solicitação (POST /api/reimpressao-ultrabasico/criar)
router.post('/criar', (req, res) => {
  console.log('💡 Requisição para criar solicitação:', req.body);
  
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
    
    // Criar solicitação
    const novaSolicitacao = {
      id: Date.now(),
      activityId: Number(activityId),
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
    
    console.log('✅ Solicitação criada com sucesso:', novaSolicitacao);
    
    // Retornar resposta
    return res.status(201).json({
      success: true,
      message: 'Solicitação criada com sucesso',
      data: novaSolicitacao
    });
    
  } catch (error) {
    console.error('🔥 Erro ao criar solicitação:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor: ' + (error.message || 'Erro desconhecido')
    });
  }
});

// Rota para listar solicitações (GET /api/reimpressao-ultrabasico/listar)
router.get('/listar', (req, res) => {
  console.log('💡 Requisição para listar solicitações');
  return res.status(200).json(solicitacoes);
});

// Rota para obter uma solicitação específica (GET /api/reimpressao-ultrabasico/:id)
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  console.log(`💡 Requisição para obter solicitação #${id}`);
  
  const solicitacao = solicitacoes.find(s => s.id === id);
  
  if (!solicitacao) {
    return res.status(404).json({
      success: false,
      message: 'Solicitação não encontrada'
    });
  }
  
  return res.status(200).json(solicitacao);
});

// Rota para processar solicitação (POST /api/reimpressao-ultrabasico/:id/processar)
router.post('/:id/processar', (req, res) => {
  const id = parseInt(req.params.id);
  console.log(`💡 Requisição para processar solicitação #${id}:`, req.body);
  
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
  
  console.log(`✅ Solicitação #${id} processada com sucesso:`, solicitacoes[index]);
  
  return res.status(200).json({
    success: true,
    message: 'Solicitação processada com sucesso',
    data: solicitacoes[index]
  });
});

module.exports = router;