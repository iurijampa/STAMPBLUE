import { 
  User, InsertUser, 
  Activity, InsertActivity, 
  ActivityProgress, InsertActivityProgress, 
  Notification, InsertNotification,
  DEPARTMENTS, Department,
  users,
  activities,
  activityProgress,
  notifications
} from "@shared/schema";
import createMemoryStore from "memorystore";
import session from "express-session";
import { db } from "./db";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import connectPg from "connect-pg-simple";
// Para armazenamento em memória (sessões)
const MemoryStore = createMemoryStore(session);

// Para persistência em banco de dados (sessões)
const PostgresSessionStore = connectPg(session);

// Storage interface
export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getUsersByRole(role: string): Promise<User[]>;
  updateUser(id: number, userData: Partial<InsertUser>): Promise<User>;
  deleteUser(id: number): Promise<void>;
  
  // Activities
  createActivity(activity: InsertActivity): Promise<Activity>;
  getActivity(id: number): Promise<Activity | undefined>;
  getAllActivities(): Promise<Activity[]>;
  getActivitiesByDepartment(department: string): Promise<Activity[]>;
  updateActivity(id: number, activityData: InsertActivity): Promise<Activity>;
  updateActivityStatus(id: number, status: string): Promise<Activity>;
  deleteActivity(id: number): Promise<void>;
  getActivityStats(): Promise<{ total: number, inProgress: number, completed: number }>;
  
  // Activity Progress
  createActivityProgress(progress: InsertActivityProgress): Promise<ActivityProgress>;
  getActivityProgress(activityId: number): Promise<ActivityProgress[]>;
  getAllActivitiesProgress(): Promise<ActivityProgress[]>; // Novo método para alta performance
  getActivityProgressByDepartment(activityId: number, department: string): Promise<ActivityProgress | undefined>;
  completeActivityProgress(
    activityId: number, 
    department: string, 
    completedBy: string, 
    notes?: string
  ): Promise<ActivityProgress>;
  getCompletedActivitiesByDepartment(department: string): Promise<{ activity: Activity, progress: ActivityProgress }[]>;
  
  // Notifications
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotification(id: number): Promise<Notification | undefined>;
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  markNotificationAsRead(id: number): Promise<Notification>;
  
  // Session store
  sessionStore: any;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private activities: Map<number, Activity>;
  private activitiesProgress: Map<number, ActivityProgress>;
  private notifications: Map<number, Notification>;
  private userIdCounter: number;
  private activityIdCounter: number;
  private progressIdCounter: number;
  private notificationIdCounter: number;
  public sessionStore: any;

  constructor() {
    this.users = new Map();
    this.activities = new Map();
    this.activitiesProgress = new Map();
    this.notifications = new Map();
    this.userIdCounter = 1;
    this.activityIdCounter = 1;
    this.progressIdCounter = 1;
    this.notificationIdCounter = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // 24 hours
    });
    
    // Create a default admin user
    this.createUser({
      username: "admin",
      password: "admin123", // Senha simples para facilitar testes
      name: "Administrador",
      role: "admin"
    });
    
    // Create a user for each department
    const departments = ["gabarito", "impressao", "batida", "costura", "embalagem"];
    departments.forEach(dept => {
      this.createUser({
        username: dept,
        password: "senha123", // Senha simples para facilitar testes
        name: `Usuário ${dept}`,
        role: dept as any
      });
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(userData: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...userData, id };
    this.users.set(id, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.role === role);
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error("User not found");
    }
    
    const updatedUser = { ...user, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<void> {
    this.users.delete(id);
  }

  // Activity methods
  async createActivity(activityData: InsertActivity): Promise<Activity> {
    const id = this.activityIdCounter++;
    const activity: Activity = {
      ...activityData,
      id,
      createdAt: new Date(),
      status: "in_progress"
    };
    this.activities.set(id, activity);
    return activity;
  }

  async getActivity(id: number): Promise<Activity | undefined> {
    return this.activities.get(id);
  }

  async getAllActivities(): Promise<Activity[]> {
    return Array.from(this.activities.values());
  }

  async getActivitiesByDepartment(department: string): Promise<Activity[]> {
    // Get all activity progress for this department with pending status
    const pendingProgress = Array.from(this.activitiesProgress.values())
      .filter(progress => progress.department === department && progress.status === "pending");
    
    // Get the corresponding activities
    const activityIds = new Set(pendingProgress.map(progress => progress.activityId));
    return Array.from(this.activities.values())
      .filter(activity => activityIds.has(activity.id));
  }

  async updateActivity(id: number, activityData: InsertActivity): Promise<Activity> {
    const activity = this.activities.get(id);
    if (!activity) {
      throw new Error("Activity not found");
    }
    
    const updatedActivity = { 
      ...activity, 
      ...activityData,
      id, // Keep the same ID
      createdAt: activity.createdAt, // Keep the original creation date
      status: activity.status // Keep the current status
    };
    
    this.activities.set(id, updatedActivity);
    return updatedActivity;
  }

  async updateActivityStatus(id: number, status: string): Promise<Activity> {
    const activity = this.activities.get(id);
    if (!activity) {
      throw new Error("Activity not found");
    }
    
    const updatedActivity = { ...activity, status: status as any };
    this.activities.set(id, updatedActivity);
    return updatedActivity;
  }

  async deleteActivity(id: number): Promise<void> {
    // Delete the activity
    this.activities.delete(id);
    
    // Delete related progress
    for (const [progressId, progress] of this.activitiesProgress.entries()) {
      if (progress.activityId === id) {
        this.activitiesProgress.delete(progressId);
      }
    }
    
    // Delete related notifications
    for (const [notificationId, notification] of this.notifications.entries()) {
      if (notification.activityId === id) {
        this.notifications.delete(notificationId);
      }
    }
  }

  async getActivityStats(): Promise<{ total: number; inProgress: number; completed: number; }> {
    const activities = Array.from(this.activities.values());
    return {
      total: activities.length,
      inProgress: activities.filter(a => a.status === "in_progress").length,
      completed: activities.filter(a => a.status === "completed").length
    };
  }

  // Activity Progress methods
  async createActivityProgress(progressData: InsertActivityProgress): Promise<ActivityProgress> {
    const id = this.progressIdCounter++;
    const progress: ActivityProgress = {
      ...progressData,
      id,
      completedBy: progressData.completedBy || null,
      completedAt: progressData.completedAt || null,
      notes: progressData.notes || null
    };
    
    this.activitiesProgress.set(id, progress);
    return progress;
  }

  async getActivityProgress(activityId: number): Promise<ActivityProgress[]> {
    return Array.from(this.activitiesProgress.values())
      .filter(progress => progress.activityId === activityId);
  }
  
  // Implementação do método getAllActivitiesProgress na MemStorage
  async getAllActivitiesProgress(): Promise<ActivityProgress[]> {
    console.log("[MEMORY] Obtendo TODOS os progressos de TODAS as atividades de uma vez só");
    return Array.from(this.activitiesProgress.values());
  }

  async getActivityProgressByDepartment(
    activityId: number, 
    department: string
  ): Promise<ActivityProgress | undefined> {
    return Array.from(this.activitiesProgress.values())
      .find(progress => 
        progress.activityId === activityId && 
        progress.department === department
      );
  }

  async completeActivityProgress(
    activityId: number,
    department: string,
    completedBy: string,
    notes?: string
  ): Promise<ActivityProgress> {
    const progress = Array.from(this.activitiesProgress.values())
      .find(p => p.activityId === activityId && p.department === department);
    
    if (!progress) {
      throw new Error("Activity progress not found");
    }
    
    const updatedProgress: ActivityProgress = {
      ...progress,
      status: "completed",
      completedBy,
      completedAt: new Date(),
      notes: notes || null
    };
    
    this.activitiesProgress.set(progress.id, updatedProgress);
    return updatedProgress;
  }
  
  async returnActivityToPreviousDepartment(
    activityId: number,
    currentDepartment: string,
    returnedBy: string,
    notes?: string
  ): Promise<{ previousProgress: ActivityProgress, currentProgress: ActivityProgress }> {
    // Pegar todos os progressos para esta atividade
    const allProgresses = Array.from(this.activitiesProgress.values())
      .filter(p => p.activityId === activityId)
      .sort((a, b) => {
        const aIndex = DEPARTMENTS.indexOf(a.department as Department);
        const bIndex = DEPARTMENTS.indexOf(b.department as Department);
        return aIndex - bIndex;
      });
    
    // Encontrar o índice do departamento atual
    const currentDeptIndex = allProgresses.findIndex(p => p.department === currentDepartment);
    
    if (currentDeptIndex <= 0) {
      throw new Error("Não é possível retornar esta atividade, pois não há departamento anterior");
    }
    
    // Obter o progresso atual
    const currentProgress = allProgresses[currentDeptIndex];
    
    // Obter o progresso do departamento anterior
    const previousProgress = allProgresses[currentDeptIndex - 1];
    
    if (!currentProgress || !previousProgress) {
      throw new Error("Progresso não encontrado");
    }
    
    // Remover o progresso atual para que não apareça mais neste departamento
    const updatedCurrentProgress: ActivityProgress = {
      ...currentProgress,
      status: "completed", // Marcamos como completed para que não apareça mais neste departamento
      completedBy: returnedBy, // Registramos quem retornou
      completedAt: new Date(),
      notes: notes || null
    };
    
    // Marcar o progresso anterior como pendente novamente e limpar quaisquer marcações anteriores de conclusão
    const updatedPreviousProgress: ActivityProgress = {
      ...previousProgress,
      status: "pending",
      notes: notes || null,
      returnedBy,
      returnedAt: new Date(),
      completedBy: null,  // Limpar quem completou anteriormente
      completedAt: null,  // Limpar quando foi completado
    };
    
    // Atualizar os progressos no armazenamento
    this.activitiesProgress.set(currentProgress.id, updatedCurrentProgress);
    this.activitiesProgress.set(previousProgress.id, updatedPreviousProgress);
    
    return {
      previousProgress: updatedPreviousProgress,
      currentProgress: updatedCurrentProgress
    };
  }

  async getCompletedActivitiesByDepartment(
    department: string
  ): Promise<{ activity: Activity; progress: ActivityProgress; }[]> {
    // Get all progress for this department that are completed
    const completedProgress = Array.from(this.activitiesProgress.values())
      .filter(progress => 
        progress.department === department && 
        progress.status === "completed"
      );
    
    // Get the corresponding activities
    return completedProgress
      .map(progress => {
        const activity = this.activities.get(progress.activityId);
        return activity ? { activity, progress } : null;
      })
      .filter((item): item is { activity: Activity; progress: ActivityProgress } => item !== null);
  }

  // Notification methods
  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const id = this.notificationIdCounter++;
    const notification: Notification = {
      ...notificationData,
      id,
      read: false,
      createdAt: new Date()
    };
    
    this.notifications.set(id, notification);
    return notification;
  }

  async getNotification(id: number): Promise<Notification | undefined> {
    return this.notifications.get(id);
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Most recent first
  }

  async markNotificationAsRead(id: number): Promise<Notification> {
    const notification = this.notifications.get(id);
    if (!notification) {
      throw new Error("Notification not found");
    }
    
    const updatedNotification = { ...notification, read: true };
    this.notifications.set(id, updatedNotification);
    return updatedNotification;
  }
  
  // Métodos para otimização ultrarrápida
  async getCompletedActivities(limit: number = 50): Promise<Activity[]> {
    console.log(`[DB OTIMIZADO] Buscando até ${limit} atividades concluídas`);
    const activities = Array.from(this.activities.values());
    const completedActivities = [];
    
    // Buscar todos os progressos de embalagem concluídos
    const completedInEmbalagem = Array.from(this.activitiesProgress.values())
      .filter(p => p.department === 'embalagem' && p.status === 'completed')
      .map(p => p.activityId);
      
    // Buscar as atividades correspondentes
    for (const activityId of completedInEmbalagem) {
      const activity = this.activities.get(activityId);
      if (activity) {
        completedActivities.push({
          ...activity,
          currentDepartment: 'concluido' as any
        });
        
        if (completedActivities.length >= limit) break;
      }
    }
    
    return completedActivities;
  }
  
  async getActivitiesInProgress(limit: number = 50): Promise<Activity[]> {
    console.log(`[DB OTIMIZADO] Buscando até ${limit} atividades em progresso`);
    const activities = Array.from(this.activities.values());
    const activitiesInProgress = [];
    
    // Primeiro encontrar atividades que não estão em embalagem concluída
    const completedInEmbalagem = new Set(
      Array.from(this.activitiesProgress.values())
        .filter(p => p.department === 'embalagem' && p.status === 'completed')
        .map(p => p.activityId)
    );
    
    // Agrupar progressos por atividade para determinar o departamento atual
    const progressByActivity = new Map();
    for (const progress of Array.from(this.activitiesProgress.values())) {
      if (!progressByActivity.has(progress.activityId)) {
        progressByActivity.set(progress.activityId, []);
      }
      progressByActivity.get(progress.activityId).push(progress);
    }
    
    // Encontrar atividades em progresso
    for (const activity of activities) {
      // Pular se já está concluída
      if (completedInEmbalagem.has(activity.id)) continue;
      
      const progresses = progressByActivity.get(activity.id) || [];
      
      // Encontrar o departamento pendente
      const pendingProgress = progresses
        .filter(p => p.status === 'pending')
        .sort((a, b) => {
          const deptOrder = ['gabarito', 'impressao', 'batida', 'costura', 'embalagem'];
          return deptOrder.indexOf(a.department as any) - deptOrder.indexOf(b.department as any);
        })[0];
        
      // Se encontramos um departamento pendente, adicionar à lista
      if (pendingProgress) {
        activitiesInProgress.push({
          ...activity,
          currentDepartment: pendingProgress.department
        });
        
        if (activitiesInProgress.length >= limit) break;
      } else if (progresses.length === 0) {
        // Se não tem nenhum progresso, está em gabarito
        activitiesInProgress.push({
          ...activity,
          currentDepartment: 'gabarito'
        });
        
        if (activitiesInProgress.length >= limit) break;
      }
    }
    
    return activitiesInProgress;
  }
}

// Implementação de armazenamento de banco de dados PostgreSQL usando Drizzle ORM
export class DatabaseStorage implements IStorage {
  sessionStore: any;
  
  constructor() {
    // Inicializar o armazenamento em banco de dados
    this.sessionStore = new PostgresSessionStore({
      conObject: {
        connectionString: process.env.DATABASE_URL!,
        ssl: true,
      },
      createTableIfMissing: true
    });
    
    // Inicializar usuários padrão
    this.initializeDefaultUsers().catch(err => 
      console.error("Erro ao inicializar usuários padrão:", err)
    );
  }

  private async initializeDefaultUsers() {
    try {
      // Verificar se já existe usuário admin
      const adminUser = await this.getUserByUsername("admin");
      
      // Se não existir, criar usuários padrão
      if (!adminUser) {
        console.log("Criando usuários padrão...");
        
        // Criar usuário admin
        await this.createUser({
          username: "admin",
          password: "admin123", // Senha simples para facilitar testes
          name: "Administrador",
          role: "admin"
        });
        
        // Criar usuário para cada departamento
        const departments = ["gabarito", "impressao", "batida", "costura", "embalagem"];
        for (const dept of departments) {
          await this.createUser({
            username: dept,
            password: "senha123", // Senha simples para facilitar testes
            name: `Usuário ${dept}`,
            role: dept as any
          });
        }
        
        console.log("Usuários padrão criados com sucesso!");
      }
    } catch (error) {
      console.error("Erro ao inicializar usuários padrão:", error);
    }
  }

  // ===== MÉTODOS DE USUÁRIO =====
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return db.select().from(users).where(sql`${users.role} = ${role}`);
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    
    if (!updatedUser) {
      throw new Error("Usuário não encontrado");
    }
    
    return updatedUser;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // ===== MÉTODOS DE ATIVIDADE =====
  async createActivity(activityData: InsertActivity): Promise<Activity> {
    const [activity] = await db.insert(activities).values({
      ...activityData,
      clientName: activityData.clientName || null,
      priority: activityData.priority || null,
      notes: activityData.notes || null,
      additionalImages: activityData.additionalImages || [],
      createdAt: new Date(),
      status: "in_progress"
    }).returning();
    
    return activity;
  }

  async getActivity(id: number): Promise<Activity | undefined> {
    const [activity] = await db.select().from(activities).where(eq(activities.id, id));
    return activity;
  }

  async getAllActivities(): Promise<Activity[]> {
    return db.select().from(activities);
  }

  async getActivitiesByDepartment(department: string): Promise<Activity[]> {
    // Pegar todas as atividades com progresso pendente neste departamento
    const progresses = await db
      .select()
      .from(activityProgress)
      .where(
        sql`${activityProgress.department} = ${department} AND ${activityProgress.status} = 'pending'`
      );
    
    if (progresses.length === 0) return [];
    
    // Montar a lista de IDs de atividades
    const activityIds = progresses.map(p => p.activityId);
    
    // Buscar as atividades correspondentes
    return db
      .select()
      .from(activities)
      .where(sql`${activities.id} IN (${activityIds.join(',')})`);
  }

  async updateActivity(id: number, activityData: InsertActivity): Promise<Activity> {
    // Primeiro, obter a atividade atual para preservar campos importantes
    const existingActivity = await this.getActivity(id);
    if (!existingActivity) {
      throw new Error("Atividade não encontrada");
    }
    
    // Atualizar preservando campos originais
    const [updatedActivity] = await db
      .update(activities)
      .set({
        ...activityData,
        clientName: activityData.clientName || null,
        priority: activityData.priority || null,
        notes: activityData.notes || null,
        additionalImages: activityData.additionalImages || [],
        id,  // Manter o mesmo ID
        createdAt: existingActivity.createdAt,  // Manter a data original
        status: existingActivity.status  // Manter o status atual
      })
      .where(eq(activities.id, id))
      .returning();
    
    return updatedActivity;
  }

  async updateActivityStatus(id: number, status: string): Promise<Activity> {
    const [updatedActivity] = await db
      .update(activities)
      .set({ status: status as any })
      .where(eq(activities.id, id))
      .returning();
    
    if (!updatedActivity) {
      throw new Error("Atividade não encontrada");
    }
    
    return updatedActivity;
  }

  async deleteActivity(id: number): Promise<void> {
    // Primeiro, excluir registros relacionados em outras tabelas
    await db.delete(activityProgress).where(eq(activityProgress.activityId, id));
    await db.delete(notifications).where(eq(notifications.activityId, id));
    
    // Por fim, excluir a atividade
    await db.delete(activities).where(eq(activities.id, id));
  }

  async getActivityStats(): Promise<{ total: number; inProgress: number; completed: number; }> {
    const allActivities = await this.getAllActivities();
    return {
      total: allActivities.length,
      inProgress: allActivities.filter(a => a.status === "in_progress").length,
      completed: allActivities.filter(a => a.status === "completed").length
    };
  }

  // ===== MÉTODOS DE PROGRESSO DA ATIVIDADE =====
  async createActivityProgress(progressData: InsertActivityProgress): Promise<ActivityProgress> {
    const [progress] = await db
      .insert(activityProgress)
      .values({
        ...progressData,
        completedBy: progressData.completedBy || null,
        completedAt: progressData.completedAt || null,
        notes: progressData.notes || null
      })
      .returning();
    
    return progress;
  }

  async getActivityProgress(activityId: number): Promise<ActivityProgress[]> {
    return db
      .select()
      .from(activityProgress)
      .where(eq(activityProgress.activityId, activityId));
  }
  
  // Novo método otimizado para alta performance - retorna progressos de todas as atividades de uma vez
  async getAllActivitiesProgress(): Promise<ActivityProgress[]> {
    console.log("[DB] Obtendo TODOS os progressos de TODAS as atividades de uma vez só");
    return db
      .select()
      .from(activityProgress);
  }

  async getActivityProgressByDepartment(
    activityId: number, 
    department: string
  ): Promise<ActivityProgress | undefined> {
    const [progress] = await db
      .select()
      .from(activityProgress)
      .where(
        sql`${activityProgress.activityId} = ${activityId} AND ${activityProgress.department} = ${department}`
      );
    
    return progress;
  }

  async completeActivityProgress(
    activityId: number,
    department: string,
    completedBy: string,
    notes?: string
  ): Promise<ActivityProgress> {
    // Primeiro, encontrar o registro de progresso
    const progress = await this.getActivityProgressByDepartment(activityId, department);
    if (!progress) {
      throw new Error("Progresso da atividade não encontrado");
    }
    
    // Atualizar o progresso
    const [updatedProgress] = await db
      .update(activityProgress)
      .set({
        status: "completed",
        completedBy,
        completedAt: new Date(),
        notes: notes || null
      })
      .where(
        sql`${activityProgress.activityId} = ${activityId} AND ${activityProgress.department} = ${department}`
      )
      .returning();
    
    return updatedProgress;
  }
  
  async returnActivityToPreviousDepartment(
    activityId: number,
    currentDepartment: string,
    returnedBy: string,
    notes?: string
  ): Promise<{ previousProgress: ActivityProgress, currentProgress: ActivityProgress }> {
    // Obter todos os progressos para esta atividade
    const allProgresses = await this.getActivityProgress(activityId);
    
    // Ordenar com base na ordem dos departamentos
    allProgresses.sort((a, b) => {
      const aIndex = DEPARTMENTS.indexOf(a.department as any);
      const bIndex = DEPARTMENTS.indexOf(b.department as any);
      return aIndex - bIndex;
    });
    
    // Encontrar o índice do departamento atual
    const currentDeptIndex = allProgresses.findIndex(p => p.department === currentDepartment);
    
    if (currentDeptIndex <= 0) {
      throw new Error("Não é possível retornar esta atividade, pois não há departamento anterior");
    }
    
    // Obter o progresso atual
    const currentProgress = allProgresses[currentDeptIndex];
    
    // Obter o progresso do departamento anterior
    const previousProgress = allProgresses[currentDeptIndex - 1];
    
    if (!currentProgress || !previousProgress) {
      throw new Error("Progresso não encontrado");
    }
    
    // Atualizar o progresso atual para que não apareça mais neste departamento
    const [updatedCurrentProgress] = await db
      .update(activityProgress)
      .set({
        status: "completed", // Marcamos como completed para que não apareça mais neste departamento
        completedBy: returnedBy, // Registramos quem retornou
        completedAt: new Date(),
        notes: notes || null
      })
      .where(eq(activityProgress.id, currentProgress.id))
      .returning();
    
    // Atualizar o progresso anterior para pendente novamente
    const [updatedPreviousProgress] = await db
      .update(activityProgress)
      .set({
        status: "pending",
        notes: notes || null,
        returnedBy,
        returnedAt: new Date(),
        completedBy: null,  // Limpar quem completou anteriormente
        completedAt: null,  // Limpar quando foi completado
      })
      .where(eq(activityProgress.id, previousProgress.id))
      .returning();
    
    return {
      previousProgress: updatedPreviousProgress,
      currentProgress: updatedCurrentProgress
    };
  }

  async getCompletedActivitiesByDepartment(
    department: string
  ): Promise<{ activity: Activity; progress: ActivityProgress; }[]> {
    // Obter todos os progressos concluídos para este departamento
    const completedProgress = await db
      .select()
      .from(activityProgress)
      .where(
        sql`${activityProgress.department} = ${department} AND ${activityProgress.status} = 'completed'`
      );
    
    if (completedProgress.length === 0) return [];
    
    // Criar um conjunto de resultados
    const result: { activity: Activity; progress: ActivityProgress; }[] = [];
    
    // Para cada progresso, buscar a atividade correspondente
    for (const progress of completedProgress) {
      const activity = await this.getActivity(progress.activityId);
      if (activity) {
        result.push({ activity, progress });
      }
    }
    
    return result;
  }

  // ===== MÉTODOS DE NOTIFICAÇÃO =====
  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const [notification] = await db
      .insert(notifications)
      .values({
        ...notificationData,
        read: false,
        createdAt: new Date()
      })
      .returning();
    
    return notification;
  }

  async getNotification(id: number): Promise<Notification | undefined> {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id));
    
    return notification;
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt)); // Mais recentes primeiro
  }

  async markNotificationAsRead(id: number): Promise<Notification> {
    const [updatedNotification] = await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, id))
      .returning();
    
    if (!updatedNotification) {
      throw new Error("Notificação não encontrada");
    }
    
    return updatedNotification;
  }
  
  // Métodos de otimização ultra-rápida
  async getCompletedActivities(limit: number = 50): Promise<Activity[]> {
    console.log(`[DB OTIMIZADO] Buscando até ${limit} atividades concluídas no banco de dados`);
    
    // Buscar progressos concluídos em embalagem
    const embalagemProgresses = await db
      .select()
      .from(activityProgress)
      .where(
        sql`${activityProgress.department} = 'embalagem' AND ${activityProgress.status} = 'completed'`
      )
      .limit(limit);
    
    if (embalagemProgresses.length === 0) return [];
    
    // Extrair IDs das atividades
    const activityIds = embalagemProgresses.map(p => p.activityId);
    
    // Buscar as atividades correspondentes uma a uma (evita erro de sintaxe)
    let completedActivities = [];
    for (const id of activityIds) {
      const [activity] = await db
        .select()
        .from(activities)
        .where(eq(activities.id, id));
        
      if (activity) {
        completedActivities.push(activity);
      }
      
      if (completedActivities.length >= limit) break;
    }
    
    // Adicionar o campo currentDepartment = 'concluido' para compatibilidade
    return completedActivities.map(activity => ({
      ...activity,
      currentDepartment: 'concluido' as any
    }));
  }
  
  async getActivitiesInProgress(limit: number = 50): Promise<Activity[]> {
    console.log(`[DB SUPER OTIMIZADO] Buscando até ${limit} atividades em progresso`);
    try {
      // SUPER OTIMIZAÇÃO: Buscar atividades diretamente com uma única consulta SQL
      const result = await db.execute(sql`
        WITH completed_in_embalagem AS (
          SELECT DISTINCT "activity_id" 
          FROM "activity_progress" 
          WHERE "department" = 'embalagem' AND "status" = 'completed'
        ),
        pending_activities AS (
          SELECT DISTINCT "activity_id" 
          FROM "activity_progress" 
          WHERE "status" = 'pending'
          AND "activity_id" NOT IN (SELECT "activity_id" FROM completed_in_embalagem)
        )
        SELECT a.*, MIN(ap."department") as current_department
        FROM "activities" a
        JOIN "activity_progress" ap ON a."id" = ap."activity_id"
        WHERE a."id" IN (SELECT "activity_id" FROM pending_activities)
        AND ap."status" = 'pending'
        GROUP BY a."id"
        ORDER BY a."deadline" ASC NULLS LAST
        LIMIT ${limit}
      `);
      
      // Mapear resultados para o formato esperado com tipagem correta
      const activitiesData: Activity[] = [];
      
      // @ts-ignore - Ignorar erros de tipagem ao acessar resultado SQL bruto
      for (const row of result.rows) {
        activitiesData.push({
          id: Number(row.id),
          title: row.title,
          description: row.description,
          image: row.image,
          additionalImages: row.additionalImages,
          quantity: Number(row.quantity),
          clientName: row.clientName,
          priority: row.priority,
          deadline: row.deadline ? new Date(row.deadline) : null,
          notes: row.notes,
          createdAt: new Date(row.createdAt),
          createdBy: Number(row.createdBy),
          status: row.status,
          currentDepartment: row.current_department
        });
      }
      
      if (activitiesData.length === 0) {
        console.log('[DB SUPER OTIMIZADO] Nenhuma atividade em progresso encontrada');
        return [];
      }
      
      // Retornar diretamente o resultado já com o departamento atual
      // Não precisamos fazer mais consultas, pois o SQL já buscou tudo de uma vez só
      return activitiesData;
    } catch (error) {
      console.error('[DB ERROR] Erro ao buscar atividades em progresso:', error);
      // Não queremos que falhas aqui interrompam a execução
      return [];
    }
  }
}

// Usar armazenamento em banco de dados para persistência
export const storage = new DatabaseStorage();
