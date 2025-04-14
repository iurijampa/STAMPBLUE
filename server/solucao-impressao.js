// Módulo especial para reimpressão do setor de impressão
// Agora conectado ao sistema principal via ponte de compatibilidade

import express from 'express';
const router = express.Router();

// Rota para listar solicitações para impressão (GET /api/impressao-emergencial/listar)
router.get('/listar', async (req, res) => {
  console.log('📋 SOLUÇÃO IMPRESSÃO: Requisição para listar solicitações');
  
  try {
    // Importar a ponte de compatibilidade dinamicamente
    const { listarSolicitacoesReimpressao } = await import('./reimpressao-bridge.js');
    
    // Obter solicitações de reimpressão para o setor de impressão
    const requests = await listarSolicitacoesReimpressao('impressao');
    
    console.log(`📋 SOLUÇÃO IMPRESSÃO: Retornando ${requests.length} solicitações`);
    return res.json(requests); // Usar res.json para garantir content-type correto
  } catch (error) {
    console.error('🚨 SOLUÇÃO IMPRESSÃO: Erro ao listar solicitações:', error);
    return res.json([]); // Em caso de erro, retornar array vazio (compatibilidade)
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
    
    return res.json(result);
  } catch (error) {
    console.error('🚨 SOLUÇÃO IMPRESSÃO: Erro ao processar solicitação:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor' 
    });
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
    
    return res.json(result);
  } catch (error) {
    console.error('🚨 SOLUÇÃO IMPRESSÃO: Erro ao criar solicitação:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor' 
    });
  }
});

// Teste simples para verificar se o router está funcionando
router.get('/teste', (req, res) => {
  return res.json({ message: "API de impressão emergencial funcionando!" });
});

// Exportar o router como default para uso em routes.ts
export default router;