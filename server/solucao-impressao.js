// Módulo especial para reimpressão do setor de impressão
// (sem banco de dados, sem autenticação)
// Solução emergencial

const express = require('express');
const router = express.Router();

// Importamos a API emergencial 
const emergencialApi = require('./reimpressao-emergencial');

// Rota para listar solicitações para impressão (GET /api/impressao-emergencial/listar)
router.get('/listar', (req, res) => {
  console.log('📋 SOLUÇÃO IMPRESSÃO: Requisição para listar solicitações');
  
  try {
    // Definir explicitamente o tipo de conteúdo como JSON
    res.setHeader('Content-Type', 'application/json');
    
    // Obter todas as solicitações
    const allRequests = emergencialApi.listarSolicitacoesReimpressao();
    
    // Filtrar apenas para impressão
    const filteredRequests = allRequests.filter(req => req.toDepartment === 'impressao');
    
    console.log(`📋 SOLUÇÃO IMPRESSÃO: Retornando ${filteredRequests.length} solicitações`);
    return res.status(200).json(filteredRequests);
  } catch (error) {
    console.error('🚨 SOLUÇÃO IMPRESSÃO: Erro ao listar solicitações:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor' 
    });
  }
});

// Exportar o router para uso em routes.ts
module.exports = router;