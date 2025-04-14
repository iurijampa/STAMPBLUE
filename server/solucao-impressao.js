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
    const { default: bridge } = await import('./reimpressao-bridge.js');
    
    // Obter solicitações de reimpressão para o setor de impressão
    const requests = await bridge.listarSolicitacoesReimpressao('impressao');
    
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

// Exportar o router para uso em routes.ts
module.exports = router;