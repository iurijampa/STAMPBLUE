// Solução super simples para o problema de reimpressão
// Versão ultra básica com apenas o necessário

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Rota ultra simples para criar solicitação
router.post('/criar', async (req, res) => {
  console.log('📋 Recebendo solicitação simples:', req.body);
  
  try {
    const { activityId, requestedBy, reason, details, quantity } = req.body;
    
    // Validação mínima
    if (!activityId || !requestedBy || !reason) {
      return res.status(400).send('Campos obrigatórios faltando');
    }
    
    const result = await pool.query(
      'INSERT INTO reprint_requests_simple (activity_id, requested_by, reason, details, quantity) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [activityId, requestedBy, reason, details || '', quantity || 1]
    );
    
    console.log('📋 Solicitação criada:', result.rows[0]);
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('📋 Erro:', error);
    return res.status(500).send('Erro ao processar solicitação: ' + error.message);
  }
});

// Rota para listar solicitações para impressão
router.get('/listar-impressao', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT rs.*, a.title as activity_title FROM reprint_requests_simple rs JOIN activities a ON rs.activity_id = a.id ORDER BY rs.created_at DESC'
    );
    
    return res.json(result.rows);
  } catch (error) {
    console.error('📋 Erro ao listar:', error);
    return res.status(500).send('Erro ao listar solicitações');
  }
});

// Rota para listar solicitações criadas pela batida
router.get('/listar-batida', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT rs.*, a.title as activity_title FROM reprint_requests_simple rs JOIN activities a ON rs.activity_id = a.id ORDER BY rs.created_at DESC'
    );
    
    return res.json(result.rows);
  } catch (error) {
    console.error('📋 Erro ao listar:', error);
    return res.status(500).send('Erro ao listar solicitações');
  }
});

module.exports = router;