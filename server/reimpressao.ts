import { Express, Request, Response } from "express";
import { storage } from "./storage";
import path from "path";
import fs from "fs";

/**
 * Função simplificada para criar solicitações de reimpressão independentes
 * Esta abordagem contorna os problemas com validação de schema complexo
 */
export async function criarReimpressaoIndependente(req: Request, res: Response) {
  try {
    console.log("[REIMPRESSAO] Iniciando criação de reimpressão independente");
    
    // Verificar permissão (apenas batida e admin podem solicitar)
    if (req.user && req.user.role !== "batida" && req.user.role !== "admin") {
      return res.status(403).json({ 
        message: "Apenas o setor de batida pode solicitar reimpressões" 
      });
    }
    
    // Processar imagem, se houver
    let imagePath: string | null = null;
    if (req.files && req.files.image) {
      console.log("[REIMPRESSAO] Processando imagem enviada");
      const image = Array.isArray(req.files.image) ? req.files.image[0] : req.files.image;
      const uploadDir = path.join(__dirname, "..", "uploads");
      
      // Garantir que o diretório existe
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      // Gerar nome único
      const timestamp = Date.now();
      const safeFilename = image.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const uniqueFilename = `reimpressao_${timestamp}_${safeFilename}`;
      const uploadPath = path.join(uploadDir, uniqueFilename);
      
      // Salvar o arquivo
      await image.mv(uploadPath);
      imagePath = `/uploads/${uniqueFilename}`;
      console.log("[REIMPRESSAO] Imagem salva em:", imagePath);
    }
    
    // Extrair dados do formulário
    const {
      title,
      description = "",
      requestedBy,
      quantity = "1",
      priority = "normal",
      reason,
      details = ""
    } = req.body;
    
    // Validação básica
    if (!title || !requestedBy || !reason) {
      console.log("[REIMPRESSAO] Dados inválidos:", { title, requestedBy, reason });
      return res.status(400).json({ 
        message: "Dados incompletos. Título, solicitante e motivo são obrigatórios." 
      });
    }
    
    // 1. Criar a atividade temporária
    console.log("[REIMPRESSAO] Criando atividade temporária");
    const notes = `REIMPRESSÃO INDEPENDENTE - Solicitada por: ${requestedBy} - Motivo: ${reason}`;
    
    const atividade = await storage.createActivity({
      title: `REIMPRESSÃO: ${title}`,
      description: description || `Solicitação de reimpressão para: ${title}`,
      image: imagePath,
      additionalImages: [],
      quantity: parseInt(quantity) || 1,
      clientName: null,
      priority: priority || "normal",
      deadline: null,
      notes: notes,
      createdBy: requestedBy,
      isReprintRequest: true
    });
    console.log("[REIMPRESSAO] Atividade criada com ID:", atividade.id);
    
    // 2. Criar o progresso para o departamento de impressão
    console.log("[REIMPRESSAO] Criando progresso para o departamento de impressão");
    await storage.createActivityProgress({
      activityId: atividade.id,
      department: "impressao",
      status: "pending"
    });
    
    // 3. Criar notificações para o setor de impressão
    console.log("[REIMPRESSAO] Enviando notificações para o setor de impressão");
    const usuariosImpressao = await storage.getUsersByRole("impressao");
    for (const usuario of usuariosImpressao) {
      await storage.createNotification({
        userId: usuario.id,
        activityId: atividade.id,
        department: "impressao",
        type: "reprint_request",
        message: `NOVA REIMPRESSÃO: ${title} - Solicitada por: ${requestedBy} - Motivo: ${reason}`
      });
    }
    
    // 4. Notificar via WebSocket
    console.log("[REIMPRESSAO] Enviando notificação via WebSocket");
    if ((global as any).wsNotifications) {
      (global as any).wsNotifications.notifyDepartment("impressao", {
        type: "new_activity",
        message: `Nova solicitação de reimpressão recebida: ${title}`,
        activityId: atividade.id
      });
    }
    
    console.log("[REIMPRESSAO] Processo concluído com sucesso");
    return res.status(201).json({
      success: true,
      message: "Solicitação de reimpressão criada com sucesso",
      atividade
    });
    
  } catch (error) {
    console.error("[REIMPRESSAO] Erro ao criar reimpressão:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao processar solicitação de reimpressão",
      error: error instanceof Error ? error.message : "Erro desconhecido"
    });
  }
}

// Função para registrar a rota no Express
export function registrarRotasReimpressao(app: Express) {
  console.log("[REIMPRESSAO] Registrando rota simplificada para reimpressão independente");
  app.post("/api/reimpressao-independente", (req, res) => criarReimpressaoIndependente(req, res));
}