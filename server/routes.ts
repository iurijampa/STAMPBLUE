import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { 
  insertActivitySchema, 
  insertActivityProgressSchema,
  DEPARTMENTS
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import fs from 'fs';
import path from 'path';
import { createBackup } from "./backup";

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
  // Setup authentication routes
  setupAuth(app);

  // API routes
  // Activities
  app.get("/api/activities", isAuthenticated, async (req, res) => {
    try {
      if (req.user.role === "admin") {
        const activities = await storage.getAllActivities();
        return res.json(activities);
      } else {
        const department = req.user.role;
        const activities = await storage.getActivitiesByDepartment(department);
        return res.json(activities);
      }
    } catch (error) {
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
      const department = req.params.department;
      
      // Verificar se o departamento requisitado é o mesmo do usuário ou se é admin
      if (req.user.role !== "admin" && req.user.role !== department) {
        return res.status(403).json({ message: "Acesso negado para este departamento" });
      }
      
      // Verificar se o departamento é válido
      if (!DEPARTMENTS.includes(department as any) && department !== "admin") {
        return res.status(400).json({ message: "Departamento inválido" });
      }
      
      // Obter as atividades para o departamento
      const activities = await storage.getActivitiesByDepartment(department);
      
      // Para cada atividade, adicionar as observações do setor anterior (se houver)
      const activitiesWithPreviousNotes = await Promise.all(activities.map(async (activity) => {
        // Se o departamento é o primeiro, não haverá setor anterior
        if (department === DEPARTMENTS[0]) {
          return { ...activity, previousNotes: null, previousDepartment: null };
        }
        
        // Encontrar o índice do departamento atual no fluxo
        const deptIndex = DEPARTMENTS.indexOf(department as any);
        
        if (deptIndex > 0) {
          // Obter o departamento anterior
          const previousDept = DEPARTMENTS[deptIndex - 1];
          
          // Buscar o progresso do departamento anterior
          const previousProgress = await storage.getActivityProgressByDepartment(activity.id, previousDept);
          
          // Se há progresso e ele foi concluído, adicionar as notas ao resultado
          if (previousProgress && previousProgress.status === "completed") {
            return { 
              ...activity, 
              previousNotes: previousProgress.notes, 
              previousDepartment: previousDept,
              previousCompletedBy: previousProgress.completedBy
            };
          }
        }
        
        return { ...activity, previousNotes: null, previousDepartment: null };
      }));
      
      return res.json(activitiesWithPreviousNotes);
    } catch (error) {
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
      
      // Update progress
      const completedProgress = await storage.completeActivityProgress(
        activityId, 
        department, 
        req.body.completedBy,
        req.body.notes
      );
      
      // Find the next department in the workflow
      const departmentIndex = DEPARTMENTS.indexOf(department as any);
      if (departmentIndex < DEPARTMENTS.length - 1) {
        const nextDepartment = DEPARTMENTS[departmentIndex + 1];
        
        // Create progress entry for the next department
        await storage.createActivityProgress({
          activityId,
          department: nextDepartment,
          status: "pending",
          completedBy: null,
          completedAt: null,
          notes: null,
          returnedBy: null,
          returnedAt: null
        });
        
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
      
      res.json(completedProgress);
    } catch (error) {
      res.status(500).json({ message: "Erro ao concluir pedido" });
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
      const department = req.params.department;
      
      // Verificar se o departamento requisitado é o mesmo do usuário ou se é admin
      if (req.user.role !== "admin" && req.user.role !== department) {
        return res.status(403).json({ message: "Acesso negado para este departamento" });
      }
      
      // Verificar se o departamento é válido
      if (!DEPARTMENTS.includes(department as any) && department !== "admin") {
        return res.status(400).json({ message: "Departamento inválido" });
      }
      
      // Obter atividades pendentes para o departamento
      const activities = await storage.getActivitiesByDepartment(department);
      const pendingCount = activities.length;
      
      // Obter atividades concluídas pelo departamento
      const completedActivities = await storage.getCompletedActivitiesByDepartment(department);
      const completedCount = completedActivities.length;
      
      return res.json({
        pendingCount,
        completedCount
      });
    } catch (error) {
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

  // Create HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
