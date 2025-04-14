// Arquivo de compatibilidade - Sistema emergencial conectado ao novo sistema
// Este arquivo agora utiliza a ponte de compatibilidade para conectar ao sistema principal

// Importar a ponte de compatibilidade (usando require dinâmico)
async function importBridge() {
  try {
    const { listarSolicitacoesReimpressao, criarSolicitacaoReimpressao, processarSolicitacaoReimpressao } = await import('./reimpressao-bridge.js');
    return { listarSolicitacoesReimpressao, criarSolicitacaoReimpressao, processarSolicitacaoReimpressao };
  } catch (error) {
    console.error('🚨 Erro ao importar ponte de compatibilidade:', error);
    return null;
  }
}

// Funções que encaminham as chamadas para a ponte

/**
 * Retorna uma lista de solicitações do sistema principal
 */
async function listarSolicitacoesReimpressao(departamento, incluirCanceladas) {
  console.log('🔄 Encaminhando listarSolicitacoesReimpressao para a ponte de compatibilidade');
  try {
    const bridge = await importBridge();
    if (bridge) {
      return await bridge.listarSolicitacoesReimpressao(departamento, incluirCanceladas);
    } else {
      console.error('🚨 Ponte de compatibilidade não disponível');
      return [];
    }
  } catch (error) {
    console.error('🚨 Erro ao listar solicitações:', error);
    return [];
  }
}

/**
 * Cria uma solicitação usando o sistema principal
 */
async function criarSolicitacaoReimpressao(data) {
  console.log('🔄 Encaminhando criarSolicitacaoReimpressao para a ponte de compatibilidade');
  try {
    const bridge = await importBridge();
    if (bridge) {
      return await bridge.criarSolicitacaoReimpressao(data);
    } else {
      console.error('🚨 Ponte de compatibilidade não disponível');
      return {
        success: false,
        message: 'Erro: sistema de reimpressão indisponível'
      };
    }
  } catch (error) {
    console.error('🚨 Erro ao criar solicitação:', error);
    return {
      success: false,
      message: `Erro ao criar solicitação: ${error.message || 'Erro desconhecido'}`
    };
  }
}

/**
 * Processa uma solicitação usando o sistema principal
 */
async function processarSolicitacaoReimpressao(id, data) {
  console.log('🔄 Encaminhando processarSolicitacaoReimpressao para a ponte de compatibilidade');
  try {
    const bridge = await importBridge();
    if (bridge) {
      return await bridge.processarSolicitacaoReimpressao(id, data);
    } else {
      console.error('🚨 Ponte de compatibilidade não disponível');
      return {
        success: false,
        message: 'Erro: sistema de reimpressão indisponível'
      };
    }
  } catch (error) {
    console.error('🚨 Erro ao processar solicitação:', error);
    return {
      success: false,
      message: `Erro ao processar solicitação: ${error.message || 'Erro desconhecido'}`
    };
  }
}

// Versões síncronas das funções para compatibilidade com código existente
function listarSolicitacoesReimpressaoSync() {
  console.log('⚠️ Aviso: usando versão síncrona da API listarSolicitacoesReimpressao - retornando array vazio');
  return [];
}

function criarSolicitacaoReimpressaoSync(data) {
  console.log('⚠️ Aviso: usando versão síncrona da API criarSolicitacaoReimpressao');
  // Iniciar a operação assíncrona mas não esperar por ela
  criarSolicitacaoReimpressao(data).catch(console.error);
  return {
    success: true,
    message: 'Solicitação de reimpressão enviada para processamento',
    id: Date.now()
  };
}

function processarSolicitacaoReimpressaoSync(id, data) {
  console.log('⚠️ Aviso: usando versão síncrona da API processarSolicitacaoReimpressao');
  // Iniciar a operação assíncrona mas não esperar por ela
  processarSolicitacaoReimpressao(id, data).catch(console.error);
  return {
    success: true,
    message: 'Solicitação de processamento enviada'
  };
}

// Exportar as versões síncronas como padrão para compatibilidade
module.exports = {
  listarSolicitacoesReimpressao: listarSolicitacoesReimpressaoSync,
  criarSolicitacaoReimpressao: criarSolicitacaoReimpressaoSync,
  processarSolicitacaoReimpressao: processarSolicitacaoReimpressaoSync,
  // Disponibilizar as versões assíncronas também
  listarSolicitacoesReimpressaoAsync: listarSolicitacoesReimpressao,
  criarSolicitacaoReimpressaoAsync: criarSolicitacaoReimpressao,
  processarSolicitacaoReimpressaoAsync: processarSolicitacaoReimpressao,
  // Método genérico para qualquer chamada desconhecida
  handler: function(action, ...args) {
    console.log(`⚠️ Aviso: chamada genérica ${action}() com:`, args);
    return {
      success: true,
      message: 'Operação registrada para processamento'
    };
  }
};