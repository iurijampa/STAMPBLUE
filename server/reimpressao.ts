import { Express, Request, Response } from "express";
import { storage } from "./storage";
import path from "path";
import fs from "fs";

/**
 * Função ultra-simplificada para criar solicitações de reimpressão independentes
 * Versão 2.0 - sem validações complexas, apenas o essencial
 */
export async function criarReimpressaoIndependente(req: Request, res: Response) {
  try {
    console.log("[REIMPRESSAO] Iniciando criação de reimpressão independente", req.body);
    console.log("[REIMPRESSAO] Arquivos:", req.files ? Object.keys(req.files) : "Nenhum");
    
    // Extrair dados básicos do formulário (com valores padrão para evitar erros)
    const titulo = req.body.title || "Reimpressão Solicitada";
    const solicitante = req.body.requestedBy || "Funcionário da Batida";
    const motivo = req.body.reason || "Necessidade de Reimpressão";
    const quantidade = parseInt(req.body.quantity || "1");
    const prioridade = req.body.priority || "normal";
    
    // Processar imagem de forma simplificada, se houver
    let caminhoImagem = null;
    if (req.files && req.files.image) {
      try {
        console.log("[REIMPRESSAO] Processando imagem");
        const imagem = Array.isArray(req.files.image) ? req.files.image[0] : req.files.image;
        const diretorioUpload = path.join(__dirname, "..", "uploads");
        
        // Criar diretório se não existir
        if (!fs.existsSync(diretorioUpload)) {
          fs.mkdirSync(diretorioUpload, { recursive: true });
        }
        
        // Nome único para o arquivo
        const timestamp = Date.now();
        const nomeSeguro = "reimpressao_" + timestamp + "_" + Date.now() + ".jpg";
        const caminhoCompleto = path.join(diretorioUpload, nomeSeguro);
        
        // Salvar arquivo
        await imagem.mv(caminhoCompleto);
        caminhoImagem = `/uploads/${nomeSeguro}`;
        console.log("[REIMPRESSAO] Imagem salva:", caminhoImagem);
      } catch (erroImagem) {
        console.error("[REIMPRESSAO] Erro ao processar imagem:", erroImagem);
        // Continuamos mesmo com erro na imagem
      }
    }
    
    console.log("[REIMPRESSAO] Dados a serem usados:", {
      titulo,
      solicitante,
      motivo,
      quantidade,
      prioridade,
      caminhoImagem
    });
    
    // 1. Criar uma nova atividade para reimpressão
    console.log("[REIMPRESSAO] Criando atividade");
    const atividade = await storage.createActivity({
      title: `REIMPRESSÃO: ${titulo}`,
      description: `Solicitação de reimpressão originada do setor de Batida`,
      image: caminhoImagem,
      additionalImages: [],
      quantity: quantidade,
      clientName: null,
      priority: prioridade,
      deadline: null,
      notes: `REIMPRESSÃO - Solicitante: ${solicitante} - Motivo: ${motivo}`,
      createdBy: solicitante,
      isReprintRequest: true
    });
    
    console.log("[REIMPRESSAO] Atividade criada com ID:", atividade.id);
    
    // 2. Criar progresso para o setor de impressão
    console.log("[REIMPRESSAO] Criando progresso para impressão");
    await storage.createActivityProgress({
      activityId: atividade.id,
      department: "impressao",
      status: "pending",
      notes: `Reimpressão solicitada por ${solicitante} do setor de Batida. Motivo: ${motivo}`
    });
    
    // 3. Criar notificações para usuários de impressão
    console.log("[REIMPRESSAO] Criando notificações");
    const usuariosImpressao = await storage.getUsersByRole("impressao");
    for (const usuario of usuariosImpressao) {
      await storage.createNotification({
        userId: usuario.id,
        activityId: atividade.id,
        department: "impressao",
        type: "reprint_request",
        message: `REIMPRESSÃO URGENTE: ${titulo} - Solicitada por: ${solicitante} (Batida)`
      });
    }
    
    // 4. Notificar via WebSocket
    console.log("[REIMPRESSAO] Enviando notificação WebSocket");
    if ((global as any).wsNotifications) {
      (global as any).wsNotifications.notifyDepartment("impressao", {
        type: "new_activity",
        message: `Nova reimpressão recebida do setor de batida: ${titulo}`,
        activityId: atividade.id
      });
    }
    
    console.log("[REIMPRESSAO] Processo concluído com sucesso!");
    return res.status(201).json({
      success: true,
      message: "Reimpressão criada com sucesso!",
      id: atividade.id
    });
    
  } catch (erro) {
    console.error("[REIMPRESSAO] ERRO CRÍTICO:", erro);
    return res.status(500).json({
      success: false,
      message: "Ocorreu um erro ao processar a solicitação de reimpressão",
      erro: erro instanceof Error ? erro.message : "Erro desconhecido"
    });
  }
}

// Versão ultra-simplificada para emergências
export async function criarReimpressaoEmergencia(req: Request, res: Response) {
  try {
    console.log("[REIMPRESSAO-EMERGENCIA] Iniciando processo simplificado", req.body);
    
    // Dados simplificados
    const titulo = "REIMPRESSÃO URGENTE";
    const solicitante = "Setor de Batida";
    
    // Criar atividade com dados mínimos
    const atividade = await storage.createActivity({
      title: titulo,
      description: "Solicitação de reimpressão urgente do setor de batida",
      image: null,
      additionalImages: [],
      quantity: 1,
      clientName: null,
      priority: "high",
      deadline: null,
      notes: "REIMPRESSÃO URGENTE SOLICITADA PELO SETOR DE BATIDA",
      createdBy: solicitante,
      isReprintRequest: true
    });
    
    // Criar progresso para impressão
    await storage.createActivityProgress({
      activityId: atividade.id,
      department: "impressao",
      status: "pending",
      notes: "Reimpressão urgente do setor de batida"
    });
    
    // Notificar impressão
    const usuariosImpressao = await storage.getUsersByRole("impressao");
    for (const usuario of usuariosImpressao) {
      await storage.createNotification({
        userId: usuario.id,
        activityId: atividade.id,
        department: "impressao",
        type: "reprint_request",
        message: "REIMPRESSÃO URGENTE SOLICITADA"
      });
    }
    
    // Notificar via WebSocket
    if ((global as any).wsNotifications) {
      (global as any).wsNotifications.notifyDepartment("impressao", {
        type: "new_activity",
        message: "Nova reimpressão urgente recebida",
        activityId: atividade.id
      });
    }
    
    return res.status(201).json({
      success: true,
      message: "Reimpressão de emergência criada com sucesso!",
      id: atividade.id
    });
    
  } catch (erro) {
    console.error("[REIMPRESSAO-EMERGENCIA] Erro:", erro);
    return res.status(500).json({
      success: false,
      message: "Erro na reimpressão de emergência",
    });
  }
}

// Função para registrar a rota no Express
export function registrarRotasReimpressao(app: Express) {
  console.log("[REIMPRESSAO] Registrando rotas de reimpressão");
  
  // Rota normal
  app.post("/api/reimpressao-independente", (req, res) => criarReimpressaoIndependente(req, res));
  
  // Rota de emergência (ultra simplificada)
  app.post("/api/reimpressao-emergencia", (req, res) => criarReimpressaoEmergencia(req, res));
  
  // Rota de fallback para compatibilidade
  app.post("/api/reprint-requests/independent", (req, res) => criarReimpressaoIndependente(req, res));
}