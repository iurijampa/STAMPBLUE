// Módulo especial para reimpressão do setor de impressão
// (sem banco de dados, sem autenticação)
// Solução emergencial - Usando armazenamento compartilhado

import express, { Router, Request, Response } from 'express';
import { getRequestsForDepartment, updateRequest } from './emergency-storage';

const router: Router = express.Router();

// Rota para listar solicitações para impressão (GET /api/impressao-emergencial/listar)
router.get('/listar', (req: Request, res: Response) => {
  console.log('📋 SOLUÇÃO IMPRESSÃO: Requisição para listar solicitações');
  
  try {
    // Definir explicitamente o tipo de conteúdo como JSON
    res.setHeader('Content-Type', 'application/json');
    
    // Obter solicitações diretamente do setor de impressão
    const requests = getRequestsForDepartment('impressao');
    
    console.log(`📋 SOLUÇÃO IMPRESSÃO: Retornando ${requests.length} solicitações`);
    return res.status(200).json(requests);
  } catch (error) {
    console.error('🚨 SOLUÇÃO IMPRESSÃO: Erro ao listar solicitações:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor' 
    });
  }
});

// Rota para processar uma solicitação (POST /api/impressao-emergencial/:id/processar)
router.post('/:id/processar', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  console.log(`📋 SOLUÇÃO IMPRESSÃO: Processando solicitação #${id}`);
  
  try {
    const { status, processedBy } = req.body;
    
    if (!status || !processedBy) {
      return res.status(400).json({
        success: false,
        message: 'Status e responsável são obrigatórios'
      });
    }
    
    // Atualizar a solicitação
    const updatedRequest = updateRequest(id, {
      status,
      processedBy,
      processedAt: new Date().toISOString()
    });
    
    if (!updatedRequest) {
      return res.status(404).json({
        success: false,
        message: 'Solicitação não encontrada'
      });
    }
    
    console.log(`📋 SOLUÇÃO IMPRESSÃO: Solicitação #${id} processada como "${status}" por ${processedBy}`);
    return res.status(200).json({
      success: true,
      message: `Solicitação processada com sucesso`,
      data: updatedRequest
    });
  } catch (error) {
    console.error('🚨 SOLUÇÃO IMPRESSÃO: Erro ao processar solicitação:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor' 
    });
  }
});

export default router;