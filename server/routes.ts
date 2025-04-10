import express, { type Express, Request, Response } from "express";
import path from "path";
import { fileURLToPath } from 'url';
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { WebSocketServer, WebSocket } from "ws";
import { 
  insertActivitySchema, 
  insertActivityProgressSchema,
  insertReprintRequestSchema,
  DEPARTMENTS,
  activityProgress,
  activities,
  reprintRequests
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import fs from 'fs';
import { db } from "./db";
import { createBackup } from "./backup";
import { and, eq, sql } from "drizzle-orm";
import { 
  buscarAtividadesPorDepartamentoEmergencia, 
  criarProgressoProximoDepartamentoEmergencia, 
  completarProgressoAtividadeEmergencia 
} from "./solucao-emergencial";

// Middleware to check if the user is authenticated
function isAuthenticated(req: Request, res: Response, next: Function) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Não autorizado" });
}

// Middleware to check if the user is an admin
function isAdmin(req: Request, res: Response, next: Function) {
  if (req.isAuthenticated() && req.user.role === "admin") {
    return next();
  }
  res.status(403).json({ message: "Acesso negado" });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Obter o diretório atual em módulos ESM
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  // Configurar rota para servir os arquivos de upload
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
  // Setup authentication routes
  setupAuth(app);

  // API routes
  // Activities
  app.get("/api/activities", isAuthenticated, async (req, res) => {
    try {
      if (req.user && req.user.role === "admin") {
        const activities = await storage.getAllActivities();
        return res.json(activities);
      } else if (req.user) {
        const department = req.user.role;
        console.log(`[DEBUG] Usuario ${req.user.username} (${department}) solicitando atividades`);
        // Usar a solução emergencial para TODOS os departamentos
        console.log(`[EMERGENCIA] Usando método direto para buscar atividades do departamento ${department}`);
        const activities = await buscarAtividadesPorDepartamentoEmergencia(department);
        return res.json(activities);
      } else {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
    } catch (error) {
      console.error("Erro ao buscar atividades:", error);
      res.status(500).json({ message: "Erro ao buscar atividades" });
    }
  });
  
  // Get all activity progress data (admin only)
  app.get("/api/activities/progress", isAdmin, async (req, res) => {
    try {
      const activities = await storage.getAllActivities();
      const progressData = [];
      
      for (const activity of activities) {
        const progress = await storage.getActivityProgress(activity.id);
        progressData.push({
          activityId: activity.id,
          progress: progress
        });
      }
      
      res.json(progressData);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar progresso das atividades" });
    }
  });
  
  // Obter atividades para um departamento específico (usando no dashboard do departamento)
  app.get("/api/activities/department/:department", isAuthenticated, async (req, res) => {
    try {
      let department = req.params.department;
      
      // Sempre usar o departamento do usuário logado se não for admin
      if (req.user && req.user.role !== "admin") {
        department = req.user.role;
      }
      
      console.log(`[DEBUG] Buscando atividades para o departamento: ${department}`);
      
      // Verificar se o departamento é válido
      if (!DEPARTMENTS.includes(department as any) && department !== "admin") {
        return res.status(400).json({ message: "Departamento inválido" });
      }
      
      console.log(`[DEBUG] Chamando getActivitiesByDepartment('${department}')`);
      // SOLUÇÃO EMERGENCIAL: Usar método direto e seguro para TODOS os departamentos
      console.log(`[EMERGENCIA] Usando método direto para buscar atividades do departamento ${department}`);
      const activities = await buscarAtividadesPorDepartamentoEmergencia(department);
      
      console.log(`[DEBUG] Encontradas ${activities.length} atividades para o departamento: ${department}`);
      if (activities.length > 0) {
        console.log(`[DEBUG] IDs das atividades: ${activities.map(a => a.id).join(', ')}`);
      }
      
      // Para cada atividade, adicionar as observações do setor anterior (se houver)
      let activitiesWithPreviousNotes = [];
      
      for (const activity of activities) {
        try {
          // Obter o progresso atual do departamento
          const currentProgress = await storage.getActivityProgressByDepartment(activity.id, department);
          console.log(`[DEBUG] Progresso para atividade ${activity.id} no departamento ${department}:`, 
                    currentProgress ? JSON.stringify(currentProgress) : "null");
          
          let result = { 
            ...activity, 
            previousNotes: null, 
            previousDepartment: null,
            previousCompletedBy: null,
            wasReturned: false,
            returnedBy: null,
            returnNotes: null,
            returnedAt: null
          };
          
          // Se o departamento é o primeiro, não haverá setor anterior
          if (department === DEPARTMENTS[0]) {
            // Verificar se foi retornado pelo setor seguinte
            result = { 
              ...activity, 
              previousNotes: currentProgress?.notes, 
              previousDepartment: null,
              previousCompletedBy: null,
              wasReturned: currentProgress?.returnedBy ? true : false,
              returnedBy: currentProgress?.returnedBy,
              returnNotes: currentProgress?.notes,
              returnedAt: currentProgress?.returnedAt
            };
          } else {
            // Encontrar o índice do departamento atual no fluxo
            const deptIndex = DEPARTMENTS.indexOf(department as any);
            
            if (deptIndex > 0) {
              // Obter o departamento anterior
              const previousDept = DEPARTMENTS[deptIndex - 1];
              
              // Buscar o progresso do departamento anterior
              const previousProgress = await storage.getActivityProgressByDepartment(activity.id, previousDept);
              console.log(`[DEBUG] Progresso anterior para atividade ${activity.id} no departamento ${previousDept}:`, 
                        previousProgress ? JSON.stringify(previousProgress) : "null");
              
              // Verificar se esta atividade foi retornada pelo próximo setor
              const wasReturned = currentProgress?.returnedBy ? true : false;
              
              // Se há progresso anterior e ele foi concluído, adicionar as notas ao resultado
              if (previousProgress && previousProgress.status === "completed") {
                result = { 
                  ...activity, 
                  previousNotes: previousProgress.notes, 
                  previousDepartment: previousDept,
                  previousCompletedBy: previousProgress.completedBy,
                  wasReturned,
                  returnedBy: currentProgress?.returnedBy,
                  returnNotes: currentProgress?.notes,
                  returnedAt: currentProgress?.returnedAt
                };
              } else if (wasReturned) {
                // Se só foi retornado mas sem progresso anterior concluído
                result = {
                  ...activity,
                  previousNotes: null,
                  previousDepartment: null,
                  previousCompletedBy: null,
                  wasReturned,
                  returnedBy: currentProgress?.returnedBy,
                  returnNotes: currentProgress?.notes,
                  returnedAt: currentProgress?.returnedAt
                };
              }
            }
          }
          
          activitiesWithPreviousNotes.push(result);
        } catch (error) {
          console.error(`[ERROR] Erro ao processar atividade ${activity.id}:`, error);
          // Continue processing other activities even if one fails
        }
      }
      
      return res.json(activitiesWithPreviousNotes);
    } catch (error) {
      console.error("[ERROR] Erro ao buscar atividades para o departamento:", error);
      res.status(500).json({ message: "Erro ao buscar atividades para o departamento" });
    }
  });

  app.get("/api/activities/:id", isAuthenticated, async (req, res) => {
    try {
      const activityId = parseInt(req.params.id);
      const activity = await storage.getActivity(activityId);
      
      if (!activity) {
        return res.status(404).json({ message: "Atividade não encontrada" });
      }
      
      return res.json(activity);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar atividade" });
    }
  });

  app.post("/api/activities", isAdmin, async (req, res) => {
    try {
      const validatedData = insertActivitySchema.parse({
        ...req.body,
        createdBy: req.user.id
      });
      
      const activity = await storage.createActivity(validatedData);
      
      // Initialize the activity progress for the first department (gabarito)
      await storage.createActivityProgress({
        activityId: activity.id,
        department: "gabarito",
        status: "pending",
      });
      
      // Create notifications for users of the first department
      const gabaritoDeptUsers = await storage.getUsersByRole("gabarito");
      for (const user of gabaritoDeptUsers) {
        await storage.createNotification({
          userId: user.id,
          activityId: activity.id,
          message: `Nova atividade: ${activity.title}`
        });
      }
      
      // Enviar notificação websocket para o departamento gabarito
      if ((global as any).wsNotifications) {
        (global as any).wsNotifications.notifyDepartment('gabarito', {
          type: 'new_activity',
          activity
        });
        
        // Notificar também administradores
        (global as any).wsNotifications.notifyDepartment('admin', {
          type: 'new_activity',
          activity
        });
      }
      
      res.status(201).json(activity);
    } catch (error) {
      if (error instanceof Error) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: "Erro ao criar atividade" });
      }
    }
  });

  app.put("/api/activities/:id", isAdmin, async (req, res) => {
    try {
      const activityId = parseInt(req.params.id);
      const activity = await storage.getActivity(activityId);
      
      if (!activity) {
        return res.status(404).json({ message: "Atividade não encontrada" });
      }
      
      const validatedData = insertActivitySchema.parse({
        ...req.body,
        createdBy: activity.createdBy
      });
      
      const updatedActivity = await storage.updateActivity(activityId, validatedData);
      res.json(updatedActivity);
    } catch (error) {
      if (error instanceof Error) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: "Erro ao atualizar atividade" });
      }
    }
  });

  app.delete("/api/activities/:id", isAdmin, async (req, res) => {
    try {
      const activityId = parseInt(req.params.id);
      await storage.deleteActivity(activityId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir atividade" });
    }
  });

  // Activity progress
  app.get("/api/activities/:id/progress", isAuthenticated, async (req, res) => {
    try {
      const activityId = parseInt(req.params.id);
      const progress = await storage.getActivityProgress(activityId);
      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar progresso da atividade" });
    }
  });
  
  // Retornar atividade ao setor anterior
  app.post("/api/activities/:id/return", isAuthenticated, async (req, res) => {
    try {
      const activityId = parseInt(req.params.id);
      const department = req.user.role;
      
      // Non-admin users can only return activities from their department
      if (department === "admin") {
        return res.status(403).json({ message: "Administradores não podem retornar atividades" });
      }
      
      // Verify if the activity exists
      const activity = await storage.getActivity(activityId);
      if (!activity) {
        return res.status(404).json({ message: "Atividade não encontrada" });
      }
      
      // Verify if the activity is assigned to the user's department
      const departmentProgress = await storage.getActivityProgressByDepartment(activityId, department);
      if (!departmentProgress || departmentProgress.status !== "pending") {
        return res.status(403).json({ 
          message: "Esta atividade não está disponível para este setor ou já foi concluída" 
        });
      }
      
      // Validar se temos os dados necessários
      if (!req.body.returnedBy) {
        return res.status(400).json({ message: "É necessário informar quem está retornando a atividade" });
      }
      
      // Get the department index
      const departmentIndex = DEPARTMENTS.indexOf(department as any);
      
      // Não podemos retornar se for o primeiro departamento
      if (departmentIndex <= 0) {
        return res.status(400).json({ 
          message: "Não é possível retornar este pedido pois não há setor anterior" 
        });
      }
      
      // Retornar a atividade para o departamento anterior
      const result = await storage.returnActivityToPreviousDepartment(
        activityId,
        department,
        req.body.returnedBy,
        req.body.notes
      );
      
      // Enviar notificação para os administradores
      const adminUsers = await storage.getUsersByRole("admin");
      const previousDepartment = DEPARTMENTS[departmentIndex - 1];
      
      for (const user of adminUsers) {
        await storage.createNotification({
          userId: user.id,
          activityId,
          message: `Pedido "${activity.title}" retornado de ${department} para ${previousDepartment} - Retornado por: ${req.body.returnedBy}${req.body.notes ? ` - Motivo: ${req.body.notes}` : ''}`
        });
      }
      
      // Notificar usuários do departamento anterior
      const prevDeptUsers = await storage.getUsersByRole(previousDepartment);
      for (const user of prevDeptUsers) {
        await storage.createNotification({
          userId: user.id,
          activityId: activityId,
          message: `Pedido "${activity.title}" foi retornado pelo setor ${department}${req.body.notes ? ` - Motivo: ${req.body.notes}` : ''}`
        });
      }
      
      // Enviar notificação via WebSocket
      if ((global as any).wsNotifications) {
        // Notificar o departamento anterior (que recebeu o pedido de volta)
        (global as any).wsNotifications.notifyDepartment(previousDepartment, {
          type: 'activity_returned',
          activity,
          from: department,
          returnedBy: req.body.returnedBy,
          notes: req.body.notes
        });
        
        // Notificar o departamento atual (que enviou o pedido de volta)
        (global as any).wsNotifications.notifyDepartment(department, {
          type: 'activity_returned_update',
          activityId: activity.id
        });
        
        // Notificar administradores
        (global as any).wsNotifications.notifyDepartment('admin', {
          type: 'activity_returned',
          activity,
          from: department,
          to: previousDepartment,
          returnedBy: req.body.returnedBy,
          notes: req.body.notes
        });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Erro ao retornar atividade:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Erro ao retornar atividade" 
      });
    }
  });

  app.post("/api/activities/:id/complete", isAuthenticated, async (req, res) => {
    try {
      const activityId = parseInt(req.params.id);
      const department = req.user.role;
      
      // Non-admin users can only complete activities for their department
      if (department === "admin") {
        return res.status(403).json({ message: "Administradores não podem marcar atividades como concluídas" });
      }
      
      // Verify if the activity exists
      const activity = await storage.getActivity(activityId);
      if (!activity) {
        return res.status(404).json({ message: "Atividade não encontrada" });
      }
      
      // Verify if the activity is assigned to the user's department
      const departmentProgress = await storage.getActivityProgressByDepartment(activityId, department);
      if (!departmentProgress || departmentProgress.status !== "pending") {
        return res.status(403).json({ 
          message: "Esta atividade não está disponível para este setor ou já foi concluída" 
        });
      }

      // Check if employee name is provided
      if (!req.body.completedBy) {
        return res.status(400).json({ message: "Nome do funcionário é obrigatório" });
      }
      
      // Update progress - USANDO MÉTODO EMERGENCIAL para todos os departamentos
      console.log(`[DIAGNÓSTICO] Chamando completarProgressoAtividadeEmergencia com:
        - activityId: ${activityId} (${typeof activityId})
        - department: ${department} (${typeof department})
        - completedBy: ${req.body.completedBy} (${typeof req.body.completedBy})
        - notes: ${req.body.notes} (${typeof req.body.notes})
      `);
      
      try {
        // Verificando se os departamentos estão configurados corretamente
        console.log(`[DIAGNÓSTICO] DEPARTMENTS disponíveis: ${JSON.stringify(DEPARTMENTS)}`);
        console.log(`[DIAGNÓSTICO] Índice do departamento atual: ${DEPARTMENTS.indexOf(department as any)}`);
        
        const completedProgress = await completarProgressoAtividadeEmergencia(
          activityId, 
          department, 
          req.body.completedBy,
          req.body.notes
        );
        console.log(`[SUCESSO] Atividade ${activityId} concluída com sucesso no departamento ${department}`);
        
        // Não precisamos mais criar manualmente o próximo progresso pois a função emergencial já faz isso
        // Apenas obtemos o índice do departamento para notificações
        const departmentIndex = DEPARTMENTS.indexOf(department as any);
        if (departmentIndex < DEPARTMENTS.length - 1) {
          const nextDepartment = DEPARTMENTS[departmentIndex + 1];
        
          // Notify users in the next department with origin information
          const nextDeptUsers = await storage.getUsersByRole(nextDepartment);
          for (const user of nextDeptUsers) {
            await storage.createNotification({
              userId: user.id,
              activityId,
              message: `Novo pedido de ${department} para ${nextDepartment}: ${activity.title}`
            });
          }
        } else {
          // This was the last department, mark the activity as completed
          await storage.updateActivityStatus(activityId, "completed");
        }
        
        // Notify admin users about the transition between departments
        const adminUsers = await storage.getUsersByRole("admin");
        
        if (departmentIndex < DEPARTMENTS.length - 1) {
          // If there's a next department, show the flow
          const nextDepartment = DEPARTMENTS[departmentIndex + 1];
          for (const user of adminUsers) {
            await storage.createNotification({
              userId: user.id,
              activityId,
              message: `Pedido "${activity.title}" passou de ${department} para ${nextDepartment} - Finalizado por: ${req.body.completedBy}${req.body.notes ? ` - Obs: ${req.body.notes}` : ''}`
            });
          }
        } else {
          // If this was the last department, show completion notification
          for (const user of adminUsers) {
            await storage.createNotification({
              userId: user.id,
              activityId,
              message: `Setor ${department} finalizou o pedido "${activity.title}" (Produção concluída) - Finalizado por: ${req.body.completedBy}${req.body.notes ? ` - Obs: ${req.body.notes}` : ''}`
            });
          }
        }
        
        // Enviar notificação via WebSocket
        if ((global as any).wsNotifications) {
          // Notificar o departamento atual que completou o pedido
          (global as any).wsNotifications.notifyDepartment(department, {
            type: 'activity_completed',
            activityId: activity.id
          });
          
          // Se existe próximo departamento, notificar
          if (departmentIndex < DEPARTMENTS.length - 1) {
            const nextDepartment = DEPARTMENTS[departmentIndex + 1];
            
            // Notificar o próximo departamento
            (global as any).wsNotifications.notifyDepartment(nextDepartment, {
              type: 'new_activity',
              activity
            });
          }
          
          // Notificar administradores
          (global as any).wsNotifications.notifyDepartment('admin', {
            type: 'activity_progress',
            activity,
            completedBy: req.body.completedBy,
            department,
            nextDepartment: departmentIndex < DEPARTMENTS.length - 1 ? DEPARTMENTS[departmentIndex + 1] : null,
            isCompleted: departmentIndex >= DEPARTMENTS.length - 1
          });
        }
        
        res.json(completedProgress);
      } catch (error) {
        console.error("[ERRO CRÍTICO] Falha ao completar atividade:", error);
        
        // Gerar mensagem de erro mais detalhada para facilitar diagnóstico
        const errorMessage = error instanceof Error 
          ? `Erro ao concluir pedido: ${error.message}` 
          : "Erro desconhecido ao concluir pedido";
          
        // Registrar a pilha de chamadas para análise
        if (error instanceof Error && error.stack) {
          console.error("[STACK TRACE]", error.stack);
        }
        
        res.status(500).json({ 
          message: errorMessage,
          details: process.env.NODE_ENV !== 'production' ? String(error) : undefined 
        });
      }
    } catch (error) {
      console.error("Erro ao completar atividade:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Erro ao completar atividade" 
      });
    }
  });

  // Users
  app.get("/api/users", isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });

  app.post("/api/users", isAdmin, async (req, res) => {
    try {
      // Verificar se o username já existe
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Nome de usuário já existe" });
      }
      
      // Hash da senha já é feita no método createUser do auth.ts
      const newUser = await storage.createUser(req.body);
      res.status(201).json(newUser);
    } catch (error) {
      res.status(500).json({ message: "Erro ao criar usuário" });
    }
  });

  app.get("/api/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar usuário" });
    }
  });

  app.put("/api/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      const updatedUser = await storage.updateUser(userId, req.body);
      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar usuário" });
    }
  });

  app.delete("/api/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Don't allow deleting the current user
      if (userId === req.user.id) {
        return res.status(400).json({ message: "Não é possível excluir seu próprio usuário" });
      }
      
      await storage.deleteUser(userId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir usuário" });
    }
  });

  // Notifications
  app.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      const notifications = await storage.getNotificationsByUser(req.user.id);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar notificações" });
    }
  });

  app.post("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      const notification = await storage.getNotification(notificationId);
      
      if (!notification) {
        return res.status(404).json({ message: "Notificação não encontrada" });
      }
      
      // Verifica se a notificação pertence ao usuário atual ou se é um admin
      if (notification.userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      const updatedNotification = await storage.markNotificationAsRead(notificationId);
      res.json(updatedNotification);
    } catch (error) {
      res.status(500).json({ message: "Erro ao marcar notificação como lida" });
    }
  });
  
  // Statistics for admin dashboard
  app.get("/api/stats", isAdmin, async (req, res) => {
    try {
      const stats = await storage.getActivityStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar estatísticas" });
    }
  });
  
  // Statistics for department dashboard
  app.get("/api/department/:department/stats", isAuthenticated, async (req, res) => {
    try {
      let department = req.params.department;
      
      // Sempre usar o departamento do usuário logado se não for admin
      if (req.user && req.user.role !== "admin") {
        department = req.user.role;
      }
      
      // Verificar se o departamento é válido
      if (!DEPARTMENTS.includes(department as any) && department !== "admin") {
        return res.status(400).json({ message: "Departamento inválido" });
      }
      
      console.log(`[DEBUG] Buscando estatísticas para o departamento: ${department}`);
      
      try {
        // Abordagem direta via SQL para evitar erros
        // Contar progresso pendente
        const pendingResult = await db
          .select({ count: sql`count(*)` })
          .from(activityProgress)
          .where(
            and(
              eq(activityProgress.department, department as any),
              eq(activityProgress.status, "pending")
            )
          );
        
        const pendingCount = Number(pendingResult[0]?.count || 0);
        console.log(`[DEBUG] Atividades pendentes para ${department}: ${pendingCount}`);
        
        // Contar progresso completado
        const completedResult = await db
          .select({ count: sql`count(*)` })
          .from(activityProgress)
          .where(
            and(
              eq(activityProgress.department, department as any),
              eq(activityProgress.status, "completed")
            )
          );
        
        const completedCount = Number(completedResult[0]?.count || 0);
        console.log(`[DEBUG] Atividades completadas por ${department}: ${completedCount}`);
        
        return res.json({
          pendingCount,
          completedCount
        });
      } catch (error) {
        console.error(`[ERROR] Erro ao processar estatísticas para ${department}:`, error);
        // Fallback em caso de erro
        return res.json({
          pendingCount: 0,
          completedCount: 0
        });
      }
    } catch (error) {
      console.error("Erro ao buscar estatísticas do departamento:", error);
      res.status(500).json({ message: "Erro ao buscar estatísticas do departamento" });
    }
  });

  // Backup system endpoints (admin only)
  app.get("/api/backup", isAdmin, async (req, res) => {
    try {
      const BACKUP_DIR = path.join(process.cwd(), 'backups');
      
      // Verificar se o diretório de backup existe
      if (!fs.existsSync(BACKUP_DIR)) {
        return res.json({ 
          status: "warning", 
          message: "Nenhum backup encontrado ainda", 
          backups: [] 
        });
      }
      
      // Listar os arquivos de backup
      const files = fs.readdirSync(BACKUP_DIR);
      
      // Organizar por tabela
      const backupsByTable: Record<string, {date: Date, file: string}[]> = {};
      
      for (const file of files) {
        const prefixMatch = file.match(/^([^_]+)_/);
        if (prefixMatch) {
          const prefix = prefixMatch[1];
          const filePath = path.join(BACKUP_DIR, file);
          const stats = fs.statSync(filePath);
          
          if (!backupsByTable[prefix]) {
            backupsByTable[prefix] = [];
          }
          
          backupsByTable[prefix].push({
            date: stats.mtime,
            file
          });
        }
      }
      
      // Ordenar backups por data (mais recentes primeiro)
      for (const table in backupsByTable) {
        backupsByTable[table].sort((a, b) => b.date.getTime() - a.date.getTime());
      }
      
      res.json({
        status: "success",
        message: "Backups listados com sucesso",
        backups: backupsByTable
      });
    } catch (error) {
      res.status(500).json({ 
        status: "error", 
        message: "Erro ao listar backups" 
      });
    }
  });
  
  // Force manual backup creation
  app.post("/api/backup", isAdmin, async (req, res) => {
    try {
      await createBackup();
      res.json({ 
        status: "success", 
        message: "Backup iniciado com sucesso. Este processo ocorre em segundo plano e pode levar alguns segundos para ser concluído." 
      });
    } catch (error) {
      res.status(500).json({ 
        status: "error", 
        message: "Erro ao iniciar backup manual" 
      });
    }
  });

  // ===== ROTAS PARA SISTEMA DE REIMPRESSÃO =====
  
  // Criar solicitação de reimpressão independente (sem atividade associada)
  app.post("/api/reprint-requests/independent", isAuthenticated, async (req, res) => {
    try {
      // Só o setor de batida pode solicitar reimpressões
      if (req.user && req.user.role !== "batida" && req.user.role !== "admin") {
        return res.status(403).json({ 
          message: "Apenas o setor de batida pode solicitar reimpressões" 
        });
      }
      
      // Verificar campos obrigatórios
      const { title, requestedBy, reason, quantity, priority } = req.body;
      
      if (!title || !requestedBy || !reason) {
        return res.status(400).json({ 
          message: "Dados incompletos. Título, solicitante e motivo são obrigatórios." 
        });
      }
      
      let imageUrl = null;
      
      // Processar upload de imagem se existir
      if (req.files && Object.keys(req.files).length > 0) {
        const imageFile = req.files.image;
        const uploadPath = path.join(__dirname, '..', 'uploads', `reprint_${Date.now()}_${imageFile.name}`);
        
        await new Promise((resolve, reject) => {
          imageFile.mv(uploadPath, (err) => {
            if (err) return reject(err);
            resolve(null);
          });
        });
        
        // Gerar URL relativa para a imagem
        imageUrl = `/uploads/${path.basename(uploadPath)}`;
      }
      
      // Criar uma nova "atividade temporária" para associar à reimpressão
      const temporaryActivity = await storage.createActivity({
        title,
        description: req.body.description || "Solicitação de reimpressão independente",
        status: "pending",
        priority: priority || "normal",
        department: "impressao", // Destino imediato
        previousDepartment: "batida", // Origem
        createdBy: req.user?.username || "sistema",
        image: imageUrl,
        deadline: null,
        isReprintRequest: true // Flag especial para marcar como solicitação independente
      });
      
      // Criar solicitação de reimpressão associada à atividade temporária
      const reprintRequest = await storage.createReprintRequest({
        activityId: temporaryActivity.id,
        quantity: parseInt(quantity) || 1,
        reason,
        details: req.body.details || "",
        priority: priority || "normal",
        requestedBy,
        requestedDepartment: "batida",
        targetDepartment: "impressao",
        status: "pending",
        requestedAt: new Date()
      });
      
      // Notificar o setor de impressão
      // Criar notificação para o setor de impressão
      const impressaoUsers = await storage.getUsersByRole("impressao");
      for (const user of impressaoUsers) {
        await storage.createNotification({
          userId: user.id,
          activityId: temporaryActivity.id,
          department: "impressao",
          type: "reprint_request",
          message: `REIMPRESSÃO SOLICITADA: ${title} - Quantidade: ${quantity} - Solicitado por: ${requestedBy}${reason ? ` - Motivo: ${reason}` : ''}`
        });
      }
      
      // Notificar via WebSocket
      if ((global as any).wsNotifications) {
        (global as any).wsNotifications.notifyDepartment("impressao", {
          type: "new_reprint_request",
          message: `Nova solicitação de reimpressão recebida do setor de batida`,
          reprintRequest,
          activity: temporaryActivity
        });
      }
      
      res.status(201).json({
        success: true,
        reprintRequest,
        activity: temporaryActivity
      });
    } catch (error) {
      console.error("Erro ao criar solicitação de reimpressão independente:", error);
      res.status(500).json({ message: "Erro ao criar solicitação de reimpressão" });
    }
  });
  
  // Criar nova solicitação de reimpressão
  app.post("/api/reprint-requests", isAuthenticated, async (req, res) => {
    try {
      // Só o setor de batida pode solicitar reimpressões
      if (req.user && req.user.role !== "batida" && req.user.role !== "admin") {
        return res.status(403).json({ 
          message: "Apenas o setor de batida pode solicitar reimpressões" 
        });
      }
      
      // Pega o setor do usuário autenticado ou usa o setor específico (para admin)
      const requestedDepartment = req.user!.role === "admin" ? "batida" : req.user!.role;
      
      // Validar dados
      const validatedData = insertReprintRequestSchema.parse({
        ...req.body,
        requestedBy: req.body.requestedBy,
        requestedDepartment: requestedDepartment,
        targetDepartment: "impressao", // Reimpressões sempre vão para o setor de impressão
        status: "pending",
        requestedAt: new Date()
      });
      
      // Verificar se a atividade existe
      const activity = await storage.getActivity(validatedData.activityId);
      if (!activity) {
        return res.status(404).json({ message: "Atividade não encontrada" });
      }
      
      // Criar solicitação de reimpressão
      const reprintRequest = await storage.createReprintRequest(validatedData);
      
      // Criar notificação para o setor de impressão
      const impressaoUsers = await storage.getUsersByRole("impressao");
      for (const user of impressaoUsers) {
        await storage.createNotification({
          userId: user.id,
          activityId: activity.id,
          department: "impressao",
          type: "reprint_request",
          message: `REIMPRESSÃO SOLICITADA: ${activity.title} - Quantidade: ${reprintRequest.quantity} - Solicitado por: ${reprintRequest.requestedBy}${reprintRequest.reason ? ` - Motivo: ${reprintRequest.reason}` : ''}`
        });
      }
      
      // Notificar via WebSocket
      if ((global as any).wsNotifications) {
        (global as any).wsNotifications.notifyDepartment("impressao", {
          type: "new_reprint_request",
          reprintRequest,
          activity
        });
        
        // Notificar administradores
        (global as any).wsNotifications.notifyDepartment("admin", {
          type: "new_reprint_request",
          reprintRequest,
          activity
        });
      }
      
      res.status(201).json(reprintRequest);
    } catch (error) {
      console.error("Erro ao criar solicitação de reimpressão:", error);
      if (error instanceof Error) {
        try {
          const validationError = fromZodError(error);
          res.status(400).json({ message: validationError.message });
        } catch (e) {
          res.status(500).json({ message: "Erro ao criar solicitação de reimpressão" });
        }
      } else {
        res.status(500).json({ message: "Erro ao criar solicitação de reimpressão" });
      }
    }
  });
  
  // Obter solicitações de reimpressão para um departamento
  app.get("/api/department/:department/reprint-requests", isAuthenticated, async (req, res) => {
    try {
      let department = req.params.department;
      const status = req.query.status as string | undefined;
      
      // Sempre usar o departamento do usuário logado se não for admin
      if (req.user && req.user.role !== "admin") {
        department = req.user.role;
      }
      
      // Verificar se o departamento é válido
      if (!DEPARTMENTS.includes(department as any)) {
        return res.status(400).json({ message: "Departamento inválido" });
      }
      
      // Buscar solicitações
      const requests = await storage.getReprintRequestsByDepartment(department, status);
      
      // Para cada solicitação, adicionar informações da atividade relacionada
      const requestsWithActivity = [];
      
      for (const request of requests) {
        const activity = await storage.getActivity(request.activityId);
        requestsWithActivity.push({
          ...request,
          activity
        });
      }
      
      res.json(requestsWithActivity);
    } catch (error) {
      console.error("Erro ao buscar solicitações de reimpressão:", error);
      res.status(500).json({ message: "Erro ao buscar solicitações de reimpressão" });
    }
  });
  
  // Obter solicitações de reimpressão para uma atividade específica
  app.get("/api/activities/:id/reprint-requests", isAuthenticated, async (req, res) => {
    try {
      const activityId = parseInt(req.params.id);
      
      // Verificar se a atividade existe
      const activity = await storage.getActivity(activityId);
      if (!activity) {
        return res.status(404).json({ message: "Atividade não encontrada" });
      }
      
      // Buscar solicitações para esta atividade
      const requests = await storage.getReprintRequestsByActivity(activityId);
      
      res.json(requests);
    } catch (error) {
      console.error("Erro ao buscar solicitações de reimpressão:", error);
      res.status(500).json({ message: "Erro ao buscar solicitações de reimpressão" });
    }
  });
  
  // Completar uma solicitação de reimpressão (setor de impressão)
  app.post("/api/reprint-requests/:id/complete", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verificar se o usuário é do setor de impressão
      if (req.user && req.user.role !== "impressao" && req.user.role !== "admin") {
        return res.status(403).json({ 
          message: "Apenas o setor de impressão pode completar reimpressões" 
        });
      }
      
      // Verificar se a solicitação existe
      const reprintRequest = await storage.getReprintRequest(id);
      if (!reprintRequest) {
        return res.status(404).json({ message: "Solicitação de reimpressão não encontrada" });
      }
      
      // Verificar se a solicitação já foi completada
      if (reprintRequest.status === "completed") {
        return res.status(400).json({ message: "Esta solicitação já foi completada" });
      }
      
      // Validar dados
      if (!req.body.completedBy) {
        return res.status(400).json({ message: "É necessário informar quem completou a reimpressão" });
      }
      
      // Completar a solicitação
      const updatedRequest = await storage.completeReprintRequest(id, req.body.completedBy);
      
      // Buscar atividade relacionada
      const activity = await storage.getActivity(reprintRequest.activityId);
      
      // Criar notificação para o setor de batida (que solicitou a reimpressão)
      const batidaUsers = await storage.getUsersByRole("batida");
      for (const user of batidaUsers) {
        await storage.createNotification({
          userId: user.id,
          activityId: reprintRequest.activityId,
          department: "batida",
          type: "reprint_completed",
          message: `REIMPRESSÃO CONCLUÍDA: ${activity?.title} - Quantidade: ${reprintRequest.quantity} - Completado por: ${req.body.completedBy}`
        });
      }
      
      // Notificar via WebSocket
      if ((global as any).wsNotifications) {
        (global as any).wsNotifications.notifyDepartment("batida", {
          type: "reprint_request_completed",
          reprintRequest: updatedRequest,
          activity
        });
        
        // Notificar setor de impressão
        (global as any).wsNotifications.notifyDepartment("impressao", {
          type: "reprint_request_updated",
          reprintRequest: updatedRequest
        });
        
        // Notificar administradores
        (global as any).wsNotifications.notifyDepartment("admin", {
          type: "reprint_request_completed",
          reprintRequest: updatedRequest,
          activity
        });
      }
      
      res.json(updatedRequest);
    } catch (error) {
      console.error("Erro ao completar solicitação de reimpressão:", error);
      res.status(500).json({ message: "Erro ao completar solicitação de reimpressão" });
    }
  });
  
  // Confirmar recebimento de reimpressão (setor de batida)
  app.post("/api/reprint-requests/:id/confirm-received", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verificar se o usuário é do setor de batida
      if (req.user && req.user.role !== "batida" && req.user.role !== "admin") {
        return res.status(403).json({ 
          message: "Apenas o setor de batida pode confirmar recebimento de reimpressões" 
        });
      }
      
      // Verificar se a solicitação existe
      const reprintRequest = await storage.getReprintRequest(id);
      if (!reprintRequest) {
        return res.status(404).json({ message: "Solicitação de reimpressão não encontrada" });
      }
      
      // Verificar se a solicitação já foi completada
      if (reprintRequest.status !== "completed") {
        return res.status(400).json({ message: "Esta solicitação ainda não foi completada" });
      }
      
      // Verificar se já foi confirmada
      if (reprintRequest.receivedBy) {
        return res.status(400).json({ message: "Esta reimpressão já foi confirmada como recebida" });
      }
      
      // Validar dados
      if (!req.body.receivedBy) {
        return res.status(400).json({ message: "É necessário informar quem recebeu a reimpressão" });
      }
      
      // Confirmar recebimento
      const updatedRequest = await storage.confirmReprintReceived(id, req.body.receivedBy);
      
      // Buscar atividade relacionada
      const activity = await storage.getActivity(reprintRequest.activityId);
      
      // Notificar via WebSocket
      if ((global as any).wsNotifications) {
        // Notificar administradores
        (global as any).wsNotifications.notifyDepartment("admin", {
          type: "reprint_request_received",
          reprintRequest: updatedRequest,
          activity
        });
      }
      
      res.json(updatedRequest);
    } catch (error) {
      console.error("Erro ao confirmar recebimento de reimpressão:", error);
      res.status(500).json({ message: "Erro ao confirmar recebimento de reimpressão" });
    }
  });
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  // WebSocket server para atualizações em tempo real
  // Configuração otimizada para melhor performance
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    // Configurações para melhorar a estabilidade e performance
    clientTracking: true,
    // Definindo o tamanho máximo da mensagem para evitar ataques DoS
    maxPayload: 1024 * 50 // 50KB
  });
  
  // Armazenar conexões WebSocket por departamento usando Set para melhor performance
  // Set é mais eficiente para inserção/remoção frequente do que Array
  const connections: Record<string, Set<WebSocket>> = {
    'admin': new Set<WebSocket>(),
    'gabarito': new Set<WebSocket>(),
    'impressao': new Set<WebSocket>(),
    'batida': new Set<WebSocket>(),
    'costura': new Set<WebSocket>(),
    'embalagem': new Set<WebSocket>()
  };
  
  // Verificar e logar estatísticas de conexão a cada 30 segundos
  const connectionCheckInterval = setInterval(() => {
    let totalConnections = 0;
    Object.entries(connections).forEach(([dept, conns]) => {
      totalConnections += conns.size;
    });
    
    console.log(`[websocket] Total de conexões ativas: ${totalConnections}`);
  }, 30000);
  
  // Limpar recursos quando o servidor for encerrado
  process.on('SIGINT', () => {
    console.log('[websocket] Encerrando servidor WebSocket...');
    clearInterval(connectionCheckInterval);
    
    // Fechar todas as conexões ativas
    Object.entries(connections).forEach(([dept, conns]) => {
      conns.forEach(ws => {
        try {
          ws.close(1000, 'Servidor encerrando');
        } catch (error) {
          console.error(`[websocket] Erro ao fechar conexão do ${dept}:`, error);
        }
      });
      conns.clear();
    });
    
    // Fechar o servidor WebSocket
    wss.close();
    console.log('[websocket] Servidor WebSocket encerrado.');
  });
  
  // Função para enviar atualizações para um departamento específico
  function notifyDepartment(department: string, data: any) {
    // Enviar para todas as conexões do departamento
    if (connections[department]) {
      connections[department].forEach(ws => {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
          }
        } catch (error) {
          console.error(`[websocket] Erro ao enviar mensagem para ${department}:`, error);
        }
      });
    }
  }
  
  // Função para enviar atualizações para todos
  function notifyAll(data: any) {
    // Para cada departamento
    Object.entries(connections).forEach(([dept, conns]) => {
      // Para cada conexão no departamento
      conns.forEach(ws => {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
          }
        } catch (error) {
          console.error(`[websocket] Erro ao enviar mensagem para todos (${dept}):`, error);
        }
      });
    });
  }
  
  // Exportar as funções de notificação para uso em outras partes do código
  (global as any).wsNotifications = {
    notifyDepartment,
    notifyAll
  };
  
  wss.on('connection', (ws, req) => {
    console.log('[websocket] Nova conexão estabelecida');
    
    // Adicionar manipuladores de mensagens recebidas do cliente
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Responder a ping com pong para manter a conexão ativa
        if (data.type === 'ping') {
          // Enviando de volta o timestamp original para medir latência, se disponível
          ws.send(JSON.stringify({ 
            type: 'pong', 
            timestamp: data.timestamp || Date.now(),
            server_time: Date.now()
          }));
          return;
        }
        
        // Registrar a conexão em um departamento específico
        if (data.type === 'register' && data.department) {
          // Verificar se o departamento é válido
          if (connections[data.department]) {
            // Remover esta conexão de qualquer outro departamento primeiro
            Object.keys(connections).forEach(dept => {
              connections[dept].delete(ws);
            });
            
            // Adicionar a conexão ao departamento correto
            connections[data.department].add(ws);
            console.log(`[websocket] Cliente registrado no departamento: ${data.department}`);
            
            // Enviar confirmação para o cliente
            try {
              ws.send(JSON.stringify({ 
                type: 'register_confirm', 
                department: data.department,
                message: `Conectado ao departamento ${data.department}` 
              }));
            } catch (error) {
              console.error(`[websocket] Erro ao enviar confirmação para ${data.department}:`, error);
            }
          }
        }
      } catch (error) {
        console.error('[websocket] Erro ao processar mensagem:', error);
      }
    });
    
    // Limpar conexões quando cliente desconectar
    ws.on('close', () => {
      console.log('[websocket] Cliente desconectado');
      
      // Remover conexão de todos os departamentos
      Object.keys(connections).forEach(dept => {
        if (connections[dept].has(ws)) {
          connections[dept].delete(ws);
          console.log(`[websocket] Conexão removida do departamento: ${dept}`);
        }
      });
    });
  });
  
  return httpServer;
}
