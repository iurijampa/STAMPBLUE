import { Express, Request, Response } from "express";
import { storage } from "./storage";

/**
 * Função ultra-simplificada para notificar o setor de impressão sobre uma peça com defeito
 * Versão minimalista - apenas o essencial para comunicação direta entre departamentos
 */
export async function notificarImpressao(req: Request, res: Response) {
  try {
    console.log("[NOTIFICACAO] Recebendo notificação para impressão");
    
    // Criar nova atividade (pedido) para o setor de impressão
    const atividade = await storage.createActivity({
      title: "REIMPRESSÃO URGENTE",
      description: "Solicitação direta do setor de batida - peça com defeito",
      image: null,
      additionalImages: [],
      quantity: 1,
      clientName: null,
      priority: "high",
      deadline: null,
      notes: "Uma peça ficou com defeito durante a batida e precisa ser reimpressa",
      createdBy: "Setor de Batida",
      isReprintRequest: true
    });
    
    // Criar progresso para o setor de impressão
    await storage.createActivityProgress({
      activityId: atividade.id,
      department: "impressao",
      status: "pending",
      notes: "Peça com defeito na batida - reimpressão necessária"
    });
    
    // Notificar usuários do setor de impressão
    const usuariosImpressao = await storage.getUsersByRole("impressao");
    for (const usuario of usuariosImpressao) {
      await storage.createNotification({
        userId: usuario.id,
        activityId: atividade.id,
        department: "impressao",
        type: "new_activity",
        message: "REIMPRESSÃO URGENTE solicitada pela batida"
      });
    }
    
    // Notificar via WebSocket (se disponível)
    if ((global as any).wsNotifications) {
      (global as any).wsNotifications.notifyDepartment("impressao", {
        type: "new_activity",
        message: "Nova reimpressão urgente solicitada",
        activityId: atividade.id
      });
    }
    
    return res.status(200).json({
      success: true,
      message: "Notificação enviada com sucesso para o setor de impressão"
    });
  } catch (erro) {
    console.error("[NOTIFICACAO] Erro:", erro);
    return res.status(500).json({
      success: false,
      message: "Erro ao enviar notificação"
    });
  }
}

/**
 * Registra as rotas para o sistema simplificado de notificação entre departamentos
 */
export function registrarRotasReimpressao(app: Express) {
  console.log("[REIMPRESSAO] Registrando rotas de reimpressão");
  
  // Rota única e simples
  app.post("/api/notificar-impressao", notificarImpressao);
}