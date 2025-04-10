// Solução temporária usando JSON em vez de banco de dados
// Uma abordagem simples que certamente vai funcionar

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Local onde armazenaremos os dados
const DADOS_ARQUIVO = path.join(process.cwd(), 'dados-reimpressao.json');

// Função para carregar dados do arquivo
function carregarDados() {
  try {
    if (fs.existsSync(DADOS_ARQUIVO)) {
      const conteudo = fs.readFileSync(DADOS_ARQUIVO, 'utf8');
      return JSON.parse(conteudo);
    }
  } catch (erro) {
    console.error('Erro ao carregar dados:', erro);
  }
  
  // Retorna objeto vazio se arquivo não existir ou tiver erro
  return { solicitacoes: [] };
}

// Função para salvar dados no arquivo
function salvarDados(dados) {
  try {
    fs.writeFileSync(DADOS_ARQUIVO, JSON.stringify(dados, null, 2), 'utf8');
    return true;
  } catch (erro) {
    console.error('Erro ao salvar dados:', erro);
    return false;
  }
}

// Rota para criar nova solicitação
router.post('/criar', (req, res) => {
  const { activityId, requestedBy, reason, details, quantity } = req.body;
  
  // Validação básica
  if (!activityId || !requestedBy || !reason) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'Faltam campos obrigatórios (activityId, requestedBy, reason)',
    });
  }
  
  // Carregar dados existentes
  const dados = carregarDados();
  
  // Criar nova solicitação
  const novaSolicitacao = {
    id: Date.now(), // ID único baseado no timestamp
    activityId: Number(activityId),
    requestedBy,
    reason,
    details: details || '',
    quantity: Number(quantity) || 1,
    status: 'pendente',
    createdAt: new Date().toISOString(),
  };
  
  // Adicionar à lista
  dados.solicitacoes.push(novaSolicitacao);
  
  // Salvar no arquivo
  if (salvarDados(dados)) {
    res.json({
      sucesso: true,
      mensagem: 'Solicitação criada com sucesso',
      dados: novaSolicitacao,
    });
  } else {
    res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao salvar solicitação',
    });
  }
});

// Rota para listar solicitações
router.get('/listar', (req, res) => {
  const dados = carregarDados();
  res.json(dados.solicitacoes);
});

// Rota para obter detalhes de uma solicitação
router.get('/detalhes/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const dados = carregarDados();
  
  const solicitacao = dados.solicitacoes.find(s => s.id === id);
  
  if (solicitacao) {
    res.json(solicitacao);
  } else {
    res.status(404).json({
      sucesso: false,
      mensagem: 'Solicitação não encontrada',
    });
  }
});

// Rota para atualizar status
router.post('/atualizar/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { status, processadoPor } = req.body;
  
  if (!status) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'Status não informado',
    });
  }
  
  const dados = carregarDados();
  const indice = dados.solicitacoes.findIndex(s => s.id === id);
  
  if (indice === -1) {
    return res.status(404).json({
      sucesso: false,
      mensagem: 'Solicitação não encontrada',
    });
  }
  
  // Atualizar solicitação
  dados.solicitacoes[indice].status = status;
  dados.solicitacoes[indice].processadoPor = processadoPor || '';
  dados.solicitacoes[indice].atualizadoEm = new Date().toISOString();
  
  if (salvarDados(dados)) {
    res.json({
      sucesso: true,
      mensagem: 'Status atualizado com sucesso',
      dados: dados.solicitacoes[indice],
    });
  } else {
    res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao atualizar status',
    });
  }
});

module.exports = router;