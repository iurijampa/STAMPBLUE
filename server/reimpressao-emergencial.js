// Arquivo de compatibilidade - Sistema emergencial removido
// Este arquivo existe apenas para garantir que as importações não quebrem

/**
 * Retorna uma lista vazia de solicitações para compatibilidade
 * O sistema emergencial foi removido
 */
function listarSolicitacoesReimpressao() {
  console.log('🚨 Sistema emergencial removido - listarSolicitacoesReimpressao() retornando array vazio');
  return [];
}

/**
 * Função fictícia para compatibilidade
 * O sistema emergencial foi removido
 */
function criarSolicitacaoReimpressao(data) {
  console.log('🚨 Sistema emergencial removido - criarSolicitacaoReimpressao() retornando resposta simulada');
  return {
    success: true,
    message: 'O sistema emergencial foi removido. Esta API permanece apenas por compatibilidade.',
    id: Date.now()
  };
}

/**
 * Função fictícia para compatibilidade
 * O sistema emergencial foi removido
 */
function processarSolicitacaoReimpressao(id, data) {
  console.log('🚨 Sistema emergencial removido - processarSolicitacaoReimpressao() retornando resposta simulada');
  return {
    success: true,
    message: 'O sistema emergencial foi removido. Esta API permanece apenas por compatibilidade.'
  };
}

// Exportar todas as funções para compatibilidade
module.exports = {
  listarSolicitacoesReimpressao,
  criarSolicitacaoReimpressao,
  processarSolicitacaoReimpressao,
  // Método genérico para qualquer chamada desconhecida
  handler: function(action, ...args) {
    console.log(`🚨 Sistema emergencial removido - ${action}() chamado com:`, args);
    return {
      success: true,
      message: 'O sistema emergencial foi removido. Esta API permanece apenas por compatibilidade.'
    };
  }
};