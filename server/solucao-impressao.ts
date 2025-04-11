// Módulo especial para reimpressão do setor de impressão
// (sem banco de dados, sem autenticação)
// Solução emergencial

import express, { Router, Request, Response } from 'express';
import { listarSolicitacoesReimpressao } from './reimpressao-emergencial';

const router: Router = express.Router();

// Rota para listar solicitações para impressão (GET /api/impressao-emergencial/listar)
router.get('/listar', (req: Request, res: Response) => {
  console.log('📋 SOLUÇÃO IMPRESSÃO: Requisição para listar solicitações');
  
  try {
    // Definir explicitamente o tipo de conteúdo como JSON
    res.setHeader('Content-Type', 'application/json');
    
    // Obter todas as solicitações
    const allRequests = listarSolicitacoesReimpressao();
    
    // Filtrar apenas para impressão
    const filteredRequests = allRequests.filter(request => request.toDepartment === 'impressao');
    
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

export default router;