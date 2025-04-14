// Módulo especial para reimpressão do setor de impressão
// Agora conectado ao sistema principal via ponte de compatibilidade

const express = require('express');
const router = express.Router();

// Rota para listar solicitações para impressão (GET /api/impressao-emergencial/listar)
router.get('/listar', async (req, res) => {
  console.log('📋 SOLUÇÃO IMPRESSÃO: Requisição para listar solicitações');
  
  try {
    // Definir explicitamente o tipo de conteúdo como JSON
    res.setHeader('Content-Type', 'application/json');
    
    // Importar a ponte de compatibilidade dinamicamente
    const { listarSolicitacoesReimpressao } = await import('./reimpressao-bridge.js');
    
    // Obter solicitações de reimpressão para o setor de impressão
    const requests = await listarSolicitacoesReimpressao('impressao');
    
    console.log(`📋 SOLUÇÃO IMPRESSÃO: Retornando ${requests.length} solicitações`);
    return res.status(200).json(requests);
  } catch (error) {
    console.error('🚨 SOLUÇÃO IMPRESSÃO: Erro ao listar solicitações:', error);
    console.error(error);
    
    // Em caso de erro, tentar usar o método emergencial antigo
    try {
      const emergencialApi = require('./reimpressao-emergencial');
      const allRequests = emergencialApi.listarSolicitacoesReimpressao();
      const filteredRequests = allRequests.filter(req => req.toDepartment === 'impressao');
      
      console.log(`📋 SOLUÇÃO IMPRESSÃO (fallback): Retornando ${filteredRequests.length} solicitações`);
      return res.status(200).json(filteredRequests);
    } catch (fallbackError) {
      console.error('🚨 SOLUÇÃO IMPRESSÃO: Fallback também falhou:', fallbackError);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor - todos os métodos falharam' 
      });
    }
  }
});

// Rota para processar solicitações (POST /api/impressao-emergencial/processar/:id)
router.post('/processar/:id', async (req, res) => {
  console.log(`📋 SOLUÇÃO IMPRESSÃO: Processando solicitação #${req.params.id}`);
  
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'ID inválido' });
    }
    
    // Importar a ponte de compatibilidade dinamicamente
    const { processarSolicitacaoReimpressao } = await import('./reimpressao-bridge.js');
    
    // Processar a solicitação
    const result = await processarSolicitacaoReimpressao(id, req.body);
    
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('🚨 SOLUÇÃO IMPRESSÃO: Erro ao processar solicitação:', error);
    
    // Em caso de erro, tentar usar o método emergencial antigo
    try {
      const emergencialApi = require('./reimpressao-emergencial');
      const result = emergencialApi.processarSolicitacaoReimpressao(parseInt(req.params.id), req.body);
      
      return res.status(result.success ? 200 : 400).json(result);
    } catch (fallbackError) {
      console.error('🚨 SOLUÇÃO IMPRESSÃO: Fallback também falhou:', fallbackError);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor - todos os métodos falharam' 
      });
    }
  }
});

// Rota para criar solicitações (POST /api/impressao-emergencial/criar)
router.post('/criar', async (req, res) => {
  console.log('📋 SOLUÇÃO IMPRESSÃO: Criando nova solicitação');
  
  try {
    // Importar a ponte de compatibilidade dinamicamente
    const { criarSolicitacaoReimpressao } = await import('./reimpressao-bridge.js');
    
    // Criar solicitação
    const result = await criarSolicitacaoReimpressao({
      ...req.body,
      toDepartment: 'impressao' // Garantir que vai para o setor de impressão
    });
    
    return res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    console.error('🚨 SOLUÇÃO IMPRESSÃO: Erro ao criar solicitação:', error);
    
    // Em caso de erro, tentar usar o método emergencial antigo
    try {
      const emergencialApi = require('./reimpressao-emergencial');
      const result = emergencialApi.criarSolicitacaoReimpressao({
        ...req.body,
        toDepartment: 'impressao'
      });
      
      return res.status(result.success ? 201 : 400).json(result);
    } catch (fallbackError) {
      console.error('🚨 SOLUÇÃO IMPRESSÃO: Fallback também falhou:', fallbackError);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor - todos os métodos falharam' 
      });
    }
  }
});

// Exportar o router para uso em routes.ts
module.exports = router;