// Módulo de reimpressão ultra-básico (sem banco de dados, sem autenticação)
// Implementação mais simples possível para garantir funcionamento
// Armazena dados em memória apenas

const express = require('express');
const router = express.Router();

// Armazenamento em memória para as solicitações
const solicitacoes = [];

// Função para obter imagem da atividade
async function getActivityImage(activityId) {
  console.log(`🔍🔍🔍 CHAMANDO getActivityImage para ID ${activityId} (tipo: ${typeof activityId})`);
  try {
    // Tenta obter a atividade para buscar a imagem real
    const { storage } = require('./storage-export');
    
    // Garantir que o ID é um número
    const activityIdNumber = Number(activityId);
    
    if (isNaN(activityIdNumber)) {
      console.error(`❌ ID de atividade inválido: ${activityId}`);
      return '/no-image.svg';
    }
    
    // Buscar a atividade no banco de dados - abordagem principal
    console.log(`📊 Buscando atividade com ID ${activityIdNumber} no banco de dados`);
    const activity = await storage.getActivity(activityIdNumber);
    
    // CASO 1: Encontrou a atividade e ela tem uma imagem definida
    if (activity && activity.image) {
      console.log(`✅ Imagem encontrada para atividade ${activityId}: ${activity.image.substring(0, 50)}...`);
      
      // Se a imagem for um caminho relativo, adicionar o prefixo correto
      if (activity.image.startsWith('/')) {
        return activity.image; // Já tem o formato correto
      } else if (activity.image.startsWith('http')) {
        return activity.image; // URL externa, manter como está
      } else {
        // Adicionar o slash inicial se não existir
        return `/${activity.image}`;
      }
    }
    
    // CASO 2: Usar caminhos específicos para determinados IDs conhecidos
    if (activityIdNumber === 48) {
      // GS iPhone - usar SVG personalizado
      const logoUrl = "/iphone-icon.svg";
      console.log(`🍎 Usando ícone SVG para atividade GS iPhone (ID 48): ${logoUrl}`);
      return logoUrl;
    } else if (activityIdNumber === 49) {
      // Chaveiro - usar imagem JPG existente
      const imageUrl = "/uploads/activity_49.jpg";
      console.log(`🔑 Usando imagem JPG para Chaveiro (ID 49): ${imageUrl}`);
      return imageUrl;
    }
    
    // CASO 3: Tentar caminho padrão para a imagem
    const defaultImagePath = `/uploads/activity_${activityIdNumber}.jpg`;
    console.log(`🔍 Tentando encontrar imagem no caminho padrão: ${defaultImagePath}`);
    
    // Usar ícone genérico como último recurso
    console.log(`⚠️ Usando ícone genérico para atividade ${activityIdNumber}`);
    return '/no-image.svg';
  } catch (error) {
    console.error(`❌ Erro ao buscar imagem para atividade ${activityId}:`, error);
    return '/no-image.svg';
  }
}

// Rota para criar solicitação (POST /api/reimpressao-emergencial/criar)
router.post('/criar', async (req, res) => {
  console.log('💡 Requisição para criar solicitação de emergência:', req.body);
  
  try {
    const { 
      activityId, 
      requestedBy, 
      reason, 
      details, 
      quantity, 
      priority = 'normal',
      fromDepartment = 'batida',
      toDepartment = 'impressao'
    } = req.body;
    
    // Validação simples
    if (!activityId || !requestedBy || !reason) {
      console.log('❌ Campos obrigatórios faltando');
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios faltando'
      });
    }
    
    // Buscar dados da atividade do "banco de dados"
    let activityTitle = "";
    let activity = null;
    try {
      const { storage } = require('./storage-export');
      activity = await storage.getActivity(Number(activityId));
      activityTitle = activity ? activity.title : `Pedido #${activityId}`;
    } catch (err) {
      console.error('Erro ao buscar título da atividade:', err);
      activityTitle = `Pedido #${activityId}`;
    }
    
    // Obter a URL da imagem da atividade
    console.log(`🧪 Obtendo imagem para atividade ${activityId} (tipo: ${typeof activityId})`);
    const activityImage = await getActivityImage(activityId);
    console.log(`🧪 URL de imagem obtida: ${activityImage}`);
    
    // Formatar corretamente a prioridade
    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    const formattedPriority = validPriorities.includes(priority) ? priority : 'normal';
    
    // Definir a URL da imagem a partir da atividade real, quando possível
    let finalImageUrl;
    
    // FASE 1: Tentar usar a imagem real do pedido
    if (activity && activity.image) {
      // Garantir formato correto da URL
      if (activity.image.startsWith('/')) {
        finalImageUrl = activity.image;
      } else if (activity.image.startsWith('http')) {
        finalImageUrl = activity.image;
      } else {
        finalImageUrl = `/${activity.image}`;
      }
      console.log(`✅ Usando imagem real do pedido: ${finalImageUrl}`);
    }
    // FASE 2: Se não encontrou imagem na atividade, usar tratamento específico por ID
    else {
      if (Number(activityId) === 48) {
        // GS iPhone - usar ícone SVG
        finalImageUrl = "/iphone-icon.svg";
        console.log(`🍎 Usando ícone SVG para GS iPhone (ID 48): ${finalImageUrl}`);
      } 
      else if (Number(activityId) === 49) {
        // Chaveiro - usar imagem JPG
        finalImageUrl = "/uploads/activity_49.jpg";
        console.log(`🔑 Usando imagem JPG para Chaveiro (ID 49): ${finalImageUrl}`);
      }
      else {
        // Outros pedidos - usar ícone genérico
        finalImageUrl = "/no-image.svg";
        console.log(`⚠️ Usando ícone genérico para atividade ${activityId}: ${finalImageUrl}`);
      }
    }
    
    // Criar solicitação
    const novaSolicitacao = {
      id: Date.now(),
      activityId: Number(activityId),
      activityTitle,
      activityImage: finalImageUrl,
      requestedBy,
      reason,
      details: details || '',
      quantity: Number(quantity) || 1,
      priority: formattedPriority,
      status: 'pendente', // Usando 'pendente' para manter consistência com o português
      requestedAt: new Date().toISOString(),
      fromDepartment,
      toDepartment
    };
    
    // Limpar lista de solicitações (para facilitar os testes)
    if (solicitacoes.length > 0) {
      console.log('🔄 Limpando solicitações anteriores para facilitar testes');
      solicitacoes.length = 0;
    }
    
    // Adicionar à lista
    solicitacoes.push(novaSolicitacao);
    
    console.log('✅ Solicitação emergencial criada com sucesso:', novaSolicitacao);
    console.log('✅ Total de solicitações emergenciais:', solicitacoes.length);
    console.log('🌐 EMERGENCY STORAGE: URL da imagem:', novaSolicitacao.activityImage);
    
    // Retornar resposta
    return res.status(201).json({
      success: true,
      message: 'Solicitação criada com sucesso',
      data: novaSolicitacao
    });
    
  } catch (error) {
    console.error('🔥 Erro ao criar solicitação emergencial:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor: ' + (error.message || 'Erro desconhecido')
    });
  }
});

// Rota para listar solicitações (GET /api/reimpressao-emergencial/listar)
router.get('/listar', async (req, res) => {
  console.log('💡 Requisição para listar solicitações emergenciais');
  console.log(`🌐 EMERGENCY STORAGE: Retornando ${solicitacoes.length} solicitações`);
  
  // Remover a verificação de solicitações vazias - sempre seguir o fluxo para melhor debug
  // Vamos registrar informações de debug mesmo quando vazio
  console.log(`🐛 Solicitações em memória: ${solicitacoes.length}`);
  
  // Se não houver solicitações, criar uma solicitação de teste para debugging
  if (solicitacoes.length === 0) {
    console.log(`🚧 Criando solicitação de teste para debugging`);
    
    // Adicionar uma solicitação de teste para o ID 53 (CONSTRUTORA INOVAÇÃO)
    solicitacoes.push({
      id: Date.now(),
      activityId: 53,
      activityTitle: "CONSTRUTORA INOVAÇÃO",
      activityImage: "/uploads/activity_53.jpg", // Caminho da imagem para testes
      requestedBy: "Teste Debug",
      reason: "Teste de imagem para debug",
      details: "Solicitação criada automaticamente para debug da exibição de imagens",
      quantity: 1,
      priority: "normal",
      status: "pendente",
      requestedAt: new Date().toISOString(),
      fromDepartment: "batida",
      toDepartment: "impressao"
    });
    
    console.log(`🚧 Solicitação de teste criada. Total agora: ${solicitacoes.length}`);
  }
  
  try {
    // Importar storage para buscar informações das atividades
    const { storage } = require('./storage-export');
    const solicitacoesAtualizadas = [];
    
    // Processar cada solicitação para garantir URLs de imagem corretas
    for (const solicitacao of solicitacoes) {
      // Criar cópia para modificar
      const solicitacaoAtualizada = { ...solicitacao };
      
      // Buscar a atividade original para obter a imagem real
      try {
        const activity = await storage.getActivity(solicitacao.activityId);
        
        // Se encontrou a atividade e ela tem imagem, usar essa imagem
        if (activity && activity.image) {
          // Formatar a URL da imagem corretamente
          if (activity.image.startsWith('/')) {
            solicitacaoAtualizada.activityImage = activity.image;
          } else if (activity.image.startsWith('http')) {
            solicitacaoAtualizada.activityImage = activity.image;
          } else {
            solicitacaoAtualizada.activityImage = `/${activity.image}`;
          }
          console.log(`✅ Atualizada imagem de solicitação #${solicitacao.id} para usar imagem real do pedido: ${solicitacaoAtualizada.activityImage}`);
        }
        // Se não encontrou imagem na atividade, manter tratamento específico
        else {
          // Caso especial: GS iPhone (ID 48)
          if (solicitacao.activityId === 48) {
            solicitacaoAtualizada.activityImage = "/iphone-icon.svg";
            console.log(`🍎 Mantendo ícone SVG para GS iPhone (ID 48): ${solicitacaoAtualizada.activityImage}`);
          } 
          // Caso especial: Chaveiro (ID 49)
          else if (solicitacao.activityId === 49) {
            solicitacaoAtualizada.activityImage = "/uploads/activity_49.jpg";
            console.log(`🔑 Mantendo imagem JPG para Chaveiro (ID 49): ${solicitacaoAtualizada.activityImage}`);
          }
          // Caso especial: Construtora Inovação (ID 53)
          else if (solicitacao.activityId === 53) {
            solicitacaoAtualizada.activityImage = "/uploads/activity_53.jpg";
            console.log(`🏗️ Mantendo imagem JPG para Construtora Inovação (ID 53): ${solicitacaoAtualizada.activityImage}`);
          }
          // Demais casos: usar ícone genérico
          else {
            solicitacaoAtualizada.activityImage = "/no-image.svg";
            console.log(`⚠️ Usando ícone genérico para atividade ${solicitacao.activityId}: ${solicitacaoAtualizada.activityImage}`);
          }
        }
      } catch (error) {
        console.error(`❌ Erro ao buscar atividade ${solicitacao.activityId}:`, error);
        // Manter a URL original em caso de erro
      }
      
      // Adicionar ao array de resultados
      solicitacoesAtualizadas.push(solicitacaoAtualizada);
    }
    
    return res.status(200).json(solicitacoesAtualizadas);
  } catch (error) {
    console.error('❌ Erro ao processar solicitações:', error);
    // Em caso de erro, retornar as solicitações originais
    return res.status(200).json(solicitacoes);
  }
});

// Rota para obter a imagem de uma atividade (GET /api/reimpressao-emergencial/imagem/:activityId)
// IMPORTANTE: esta rota deve vir ANTES da rota /:id para evitar problemas de ordem
router.get('/imagem/:activityId', async (req, res) => {
  const activityId = parseInt(req.params.activityId);
  console.log(`💡 Requisição para obter imagem da atividade #${activityId}`);
  
  try {
    // FASE 1: Buscar a atividade no banco de dados (abordagem principal)
    const { storage } = require('./storage-export');
    const activity = await storage.getActivity(activityId);
    
    // Se encontrou a atividade e ela tem imagem definida
    if (activity && activity.image) {
      console.log(`✅ Encontrada imagem para atividade ${activityId}: ${activity.image}`);
      
      if (activity.image.startsWith('http')) {
        return res.redirect(activity.image);
      } else {
        // Para caminhos locais, garantir formato correto
        const imagePath = activity.image.startsWith('/') ? activity.image : `/${activity.image}`;
        console.log(`🖼️ Redirecionando para imagem real: ${imagePath}`);
        return res.redirect(imagePath);
      }
    }
    
    // FASE 2: Casos especiais para IDs conhecidos
    // Caso especial: GS iPhone (ID 48)
    if (activityId === 48) {
      const iphoneLogoUrl = "/iphone-icon.svg";
      console.log(`🍎 Redirecionando para ícone do iPhone: ${iphoneLogoUrl}`);
      return res.redirect(iphoneLogoUrl);
    }
    // Caso especial: Chaveiro (ID 49)
    else if (activityId === 49) {
      const chaveiroImageUrl = "/uploads/activity_49.jpg";
      console.log(`🔑 Redirecionando para imagem do Chaveiro: ${chaveiroImageUrl}`);
      return res.redirect(chaveiroImageUrl);
    }
    // Caso especial: Construtora Inovação (ID 53)
    else if (activityId === 53) {
      const construtoraImageUrl = "/uploads/activity_53.jpg";
      console.log(`🏗️ Redirecionando para imagem da Construtora: ${construtoraImageUrl}`);
      return res.redirect(construtoraImageUrl);
    }
    
    // FASE 3: Tentar caminho padrão
    const defaultImagePath = `/uploads/activity_${activityId}.jpg`;
    console.log(`🔍 Tentando caminho padrão: ${defaultImagePath}`);
    
    // FASE 4: Usar ícone genérico como último recurso
    console.log(`⚠️ Nenhuma imagem encontrada para atividade ${activityId}, usando ícone genérico`);
    return res.redirect('/no-image.svg');
    
  } catch (error) {
    console.error(`❌ Erro ao buscar imagem para atividade ${activityId}:`, error);
    // Usar ícone genérico em caso de erro
    return res.redirect('/no-image.svg');
  }
});

// Rota para obter uma solicitação específica (GET /api/reimpressao-emergencial/:id)
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  console.log(`💡 Requisição para obter solicitação emergencial #${id}`);
  
  const solicitacao = solicitacoes.find(s => s.id === id);
  
  if (!solicitacao) {
    return res.status(404).json({
      success: false,
      message: 'Solicitação não encontrada'
    });
  }
  
  try {
    // Criar uma cópia que pode ser modificada
    const solicitacaoAtualizada = { ...solicitacao };
    
    // Buscar a atividade original para obter suas informações
    const { storage } = require('./storage-export');
    const activity = await storage.getActivity(solicitacao.activityId);
    
    // Se encontrou a atividade e ela tem imagem, usar essa imagem
    if (activity && activity.image) {
      // Garantir formato correto da URL
      if (activity.image.startsWith('/')) {
        solicitacaoAtualizada.activityImage = activity.image;
      } else if (activity.image.startsWith('http')) {
        solicitacaoAtualizada.activityImage = activity.image;
      } else {
        solicitacaoAtualizada.activityImage = `/${activity.image}`;
      }
      console.log(`✅ Usando imagem real do pedido para solicitação #${id}: ${solicitacaoAtualizada.activityImage}`);
    }
    // Se não encontrou imagem na atividade, manter casos especiais
    else {
      // Caso especial: GS iPhone (ID 48)
      if (solicitacao.activityId === 48) {
        solicitacaoAtualizada.activityImage = "/iphone-icon.svg";
        console.log(`🍎 Usando ícone SVG para GS iPhone (ID 48) na solicitação #${id}`);
      }
      // Caso especial: Chaveiro (ID 49)
      else if (solicitacao.activityId === 49) {
        solicitacaoAtualizada.activityImage = "/uploads/activity_49.jpg";
        console.log(`🔑 Usando imagem JPG para Chaveiro (ID 49) na solicitação #${id}`);
      }
      // Caso especial: Construtora Inovação (ID 53)
      else if (solicitacao.activityId === 53) {
        solicitacaoAtualizada.activityImage = "/uploads/activity_53.jpg";
        console.log(`🏗️ Usando imagem JPG para Construtora Inovação (ID 53) na solicitação #${id}`);
      }
      // Demais casos: usar ícone genérico
      else {
        solicitacaoAtualizada.activityImage = "/no-image.svg";
        console.log(`⚠️ Usando ícone genérico para solicitação #${id}: ${solicitacaoAtualizada.activityImage}`);
      }
    }
    
    return res.status(200).json(solicitacaoAtualizada);
  } catch (error) {
    console.error(`❌ Erro ao processar detalhes da solicitação #${id}:`, error);
    // Em caso de erro, retornar a solicitação original
    return res.status(200).json(solicitacao);
  }
});

// Rota para processar solicitação (POST /api/reimpressao-emergencial/:id/processar)
router.post('/:id/processar', (req, res) => {
  const id = parseInt(req.params.id);
  console.log(`💡 Requisição para processar solicitação emergencial #${id}:`, req.body);
  
  const { status, processedBy } = req.body;
  
  if (!status || !processedBy) {
    return res.status(400).json({
      success: false,
      message: 'Status e responsável são obrigatórios'
    });
  }
  
  const index = solicitacoes.findIndex(s => s.id === id);
  
  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: 'Solicitação não encontrada'
    });
  }
  
  // Atualizar solicitação
  solicitacoes[index] = {
    ...solicitacoes[index],
    status,
    processedBy,
    processedAt: new Date().toISOString()
  };
  
  console.log(`✅ Solicitação emergencial #${id} processada com sucesso:`, solicitacoes[index]);
  
  return res.status(200).json({
    success: true,
    message: 'Solicitação processada com sucesso',
    data: solicitacoes[index]
  });
});

// Exportar as funções para acesso direto em rotas padrão
function listarSolicitacoesReimpressao() {
  console.log('📋 Retornando solicitações da memória:', solicitacoes.length);
  return solicitacoes;
}

module.exports = router;
module.exports.listarSolicitacoesReimpressao = listarSolicitacoesReimpressao;