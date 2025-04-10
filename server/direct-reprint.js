// Solução emergencial para o problema de reimpressão
// MODO DEUS 5000 - Bypass direto para o banco de dados

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Cria uma solicitação de reimpressão diretamente no banco de dados
 * Sem validações, apenas para emergências
 */
async function createReprintRequest(data) {
  console.log('🔥 MODO DEUS 5000 - Criando solicitação de reimpressão direto no banco');
  console.log('🔥 Dados:', JSON.stringify(data, null, 2));

  try {
    // Validação manual mínima dos campos obrigatórios
    if (!data.activityId || isNaN(Number(data.activityId))) {
      throw new Error('activityId é obrigatório e deve ser um número');
    }
    
    if (!data.requestedBy || data.requestedBy.trim() === '') {
      throw new Error('requestedBy é obrigatório');
    }
    
    if (!data.reason || data.reason.trim() === '') {
      throw new Error('reason é obrigatório');
    }

    // Valores padrão e sanitização
    const activityId = Number(data.activityId);
    const requestedBy = String(data.requestedBy).trim();
    const reason = String(data.reason).trim();
    const details = data.details ? String(data.details).trim() : '';
    const quantity = Number(data.quantity) || 1;
    const priority = ['low', 'normal', 'high', 'urgent'].includes(data.priority) 
      ? data.priority 
      : 'normal';
    const fromDepartment = 'batida';
    const toDepartment = 'impressao';
    
    // Inserção direta no banco de dados
    const query = `
      INSERT INTO reprint_requests (
        activity_id, 
        requested_by, 
        requested_department, 
        target_department, 
        reason, 
        details, 
        quantity, 
        priority, 
        status, 
        requested_at
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW())
      RETURNING *
    `;
    
    const values = [
      activityId,
      requestedBy,
      fromDepartment,
      toDepartment,
      reason,
      details,
      quantity,
      priority
    ];
    
    console.log('🔥 Executando query:', query);
    console.log('🔥 Com valores:', values);
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Falha ao inserir - nenhuma linha retornada');
    }
    
    const createdRequest = result.rows[0];
    console.log('🔥 Solicitação criada com sucesso:', createdRequest);
    
    // Criar notificação no banco para usuários de impressão
    await createNotificationsForPrinting(activityId, reason);
    
    return createdRequest;
  } catch (error) {
    console.error('🔥 ERRO MODO DEUS:', error);
    throw error;
  }
}

/**
 * Cria notificações para o setor de impressão
 */
async function createNotificationsForPrinting(activityId, reason) {
  try {
    // Buscar título da atividade
    const activityQuery = 'SELECT title FROM activities WHERE id = $1';
    const activityResult = await pool.query(activityQuery, [activityId]);
    
    if (activityResult.rows.length === 0) {
      console.warn('🔥 Atividade não encontrada, notificações podem não ter contexto completo');
      return;
    }
    
    const activityTitle = activityResult.rows[0].title;
    
    // Buscar usuários do setor de impressão
    const usersQuery = 'SELECT id FROM users WHERE role = $1 OR role = $2';
    const usersResult = await pool.query(usersQuery, ['impressao', 'admin']);
    
    if (usersResult.rows.length === 0) {
      console.warn('🔥 Nenhum usuário encontrado para notificar');
      return;
    }
    
    // Criar notificações
    const notificationPromises = usersResult.rows.map(user => {
      const notificationQuery = `
        INSERT INTO notifications (
          user_id, 
          activity_id, 
          message, 
          created_at
        ) 
        VALUES ($1, $2, $3, NOW())
      `;
      
      const message = `Nova solicitação de reimpressão para o pedido "${activityTitle}" - Motivo: ${reason}`;
      
      return pool.query(notificationQuery, [user.id, activityId, message]);
    });
    
    await Promise.all(notificationPromises);
    console.log(`🔥 Criadas ${notificationPromises.length} notificações`);
  } catch (error) {
    // Apenas log, não falhar a operação principal
    console.error('🔥 Erro ao criar notificações:', error);
  }
}

module.exports = {
  createReprintRequest
};