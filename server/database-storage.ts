import { 
  User, InsertUser, 
  Activity, InsertActivity, 
  ActivityProgress, InsertActivityProgress, 
  Notification, InsertNotification,
  DEPARTMENTS,
  users,
  activities,
  activityProgress,
  notifications
} from "@shared/schema";
import session from "express-session";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Para persistência em banco de dados (sessões)
const PostgresSessionStore = connectPg(session);

// Implementação de armazenamento de banco de dados PostgreSQL usando Drizzle ORM
import type { IStorage } from "./storage-interface";

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
      // Verificar se já existem usuários no sistema
      const existingUsers = await db.select().from(users);
      
      if (existingUsers.length === 0) {
        // Criar usuário admin padrão se não houver usuários
        await this.createUser({
          username: "admin",
          password: await hashPassword("admin"),
          role: "admin",
          name: "Administrador",
          department: "admin"
        });
        
        // Criar usuários para cada departamento
        const defaultPassword = await hashPassword("123456");
        
        for (const dept of DEPARTMENTS) {
          if (dept === "admin") continue;
          
          await this.createUser({
            username: dept,
            password: defaultPassword,
            role: dept, // Usar o departamento como role também
            name: dept.charAt(0).toUpperCase() + dept.slice(1),
            department: dept
          });
        }
        
        console.log("Usuários padrão criados com sucesso");
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
        notes: progressData.notes || null,
        returnedBy: progressData.returnedBy || null,
        returnedAt: progressData.returnedAt || null
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
}