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
import { db, sql as postgresClient, cachedQuery, clearCacheByPattern } from "./db";
import { eq, desc, sql, inArray } from "drizzle-orm";
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
    // Usar uma junção (JOIN) para otimizar a consulta
    try {
      console.log(`[DEBUG] getActivitiesByDepartment: Buscando atividades pendentes para: ${department}`);
      
      // Desabilitar o cache temporariamente para depuração
      // Primeiro, obter IDs das atividades pendentes neste departamento
      const progresses = await db
        .select()
        .from(activityProgress)
        .where(
          sql`${activityProgress.department} = ${department} AND ${activityProgress.status} = 'pending'`
        );
      
      console.log(`[DEBUG] getActivitiesByDepartment: Encontrados ${progresses.length} progresso(s) pendente(s) para ${department}`);
      
      if (progresses.length === 0) return [];
      
      // Montar a lista de IDs de atividades
      const activityIds = progresses.map(p => p.activityId);
      console.log(`[DEBUG] getActivitiesByDepartment: IDs de atividades encontradas: ${activityIds.join(', ')}`);

      // Se não houver activity IDs, retornar array vazio
      if (activityIds.length === 0) return [];
      
      // Buscar detalhes completos das atividades 
      // Se houver muitos IDs, fazer múltiplas consultas para evitar problemas de tamanho
      let result: typeof activities.$inferSelect[] = [];
      
      // Processar cada ID individualmente para garantir que não haverá erros de sintaxe
      for (const activityId of activityIds) {
        const activityResult = await db
          .select()
          .from(activities)
          .where(eq(activities.id, activityId));
        
        if (activityResult.length > 0) {
          result.push(activityResult[0]);
        }
      }
      
      console.log(`[DEBUG] getActivitiesByDepartment: Recuperadas ${result.length} atividades completas`);
      
      // Ordenar por deadline (mais urgentes primeiro)
      return result.sort((a, b) => {
        // Se não tiver deadline, vai para o final
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        // Ordernar do mais antigo para o mais recente
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
    } catch (error) {
      console.error(`[ERROR] getActivitiesByDepartment para ${department}:`, error);
      throw error;
    }
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
    
    // Limpar caches relacionados à atividade
    clearCacheByPattern(`activity_`);
    
    // Limpar cache de todos os departamentos, já que esta atividade 
    // pode estar em qualquer estágio do fluxo
    for (const dept of DEPARTMENTS) {
      clearCacheByPattern(`activities_by_dept_${dept}`);
    }
    
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
    
    // Limpar caches relacionados à atividade
    clearCacheByPattern(`activity_`);
    
    // Limpar cache de todos os departamentos, já que esta atividade 
    // pode ter seu status alterado
    for (const dept of DEPARTMENTS) {
      clearCacheByPattern(`activities_by_dept_${dept}`);
    }
    
    return updatedActivity;
  }

  async deleteActivity(id: number): Promise<void> {
    // Primeiro, obter dados de notificações para limpar caches relacionados a usuários
    const affectedNotifications = await db.select().from(notifications).where(eq(notifications.activityId, id));
    const userIds = new Set(affectedNotifications.map(n => n.userId));
    
    // Excluir registros relacionados em outras tabelas
    await db.delete(activityProgress).where(eq(activityProgress.activityId, id));
    await db.delete(notifications).where(eq(notifications.activityId, id));
    
    // Excluir a atividade
    await db.delete(activities).where(eq(activities.id, id));
    
    // Limpar caches relacionados à atividade
    clearCacheByPattern(`activity_`);
    
    // Limpar cache de todos os departamentos
    for (const dept of DEPARTMENTS) {
      clearCacheByPattern(`activities_by_dept_${dept}`);
    }
    
    // Limpar cache de notificações para usuários afetados
    for (const userId of userIds) {
      clearCacheByPattern(`user_notifications_${userId}`);
    }
  }

  async getActivityStats(): Promise<{ total: number; inProgress: number; completed: number; }> {
    // Usar cache para estatísticas com TTL curto (5 segundos)
    return cachedQuery('activity_stats', async () => {
      // Obter todas as atividades
      const activityList = await db.select().from(activities);
      
      // Calcular estatísticas
      return {
        total: activityList.length,
        inProgress: activityList.filter(a => a.status === 'in_progress').length,
        completed: activityList.filter(a => a.status === 'completed').length
      };
    }, 5000);
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
    
    // Limpar cache relacionado ao departamento desta atividade
    clearCacheByPattern(`activities_by_dept_${progressData.department}`);
    
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
    
    // Limpar o cache relacionado a esta atividade e departamento
    // para que as mudanças sejam refletidas imediatamente
    clearCacheByPattern(`activities_by_dept_${department}`);
    
    // Limpar qualquer estatística em cache
    clearCacheByPattern('activity_stats');
    
    // Se o próximo departamento na sequência existir, limpar seu cache também
    const deptIndex = DEPARTMENTS.indexOf(department as any);
    if (deptIndex >= 0 && deptIndex < DEPARTMENTS.length - 1) {
      const nextDept = DEPARTMENTS[deptIndex + 1];
      clearCacheByPattern(`activities_by_dept_${nextDept}`);
    }
    
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
    
    // Limpar o cache dos departamentos afetados
    clearCacheByPattern(`activities_by_dept_${currentDepartment}`);
    clearCacheByPattern(`activities_by_dept_${previousProgress.department}`);
    clearCacheByPattern('activity_stats');
    
    return {
      previousProgress: updatedPreviousProgress,
      currentProgress: updatedCurrentProgress
    };
  }

  async getCompletedActivitiesByDepartment(
    department: string
  ): Promise<{ activity: Activity; progress: ActivityProgress; }[]> {
    // Cache para atividades completadas por departamento (10 segundos)
    return cachedQuery(`completed_activities_dept_${department}`, async () => {
      // Obter todos os progressos concluídos para este departamento
      const completedProgress = await db
        .select()
        .from(activityProgress)
        .where(
          sql`${activityProgress.department} = ${department} AND ${activityProgress.status} = 'completed'`
        );
      
      if (completedProgress.length === 0) return [];
      
      // Obter todos os IDs de atividades necessários
      const activityIds = completedProgress.map(progress => progress.activityId);
      
      // Buscar todas as atividades usando o mesmo método de lotes para evitar problemas
      const activitiesMap = new Map<number, Activity>();
      let activityList: typeof activities.$inferSelect[] = [];
      
      // Processar cada ID individualmente para evitar erros de sintaxe SQL
      for (const activityId of activityIds) {
        const activityResult = await db
          .select()
          .from(activities)
          .where(eq(activities.id, activityId));
        
        if (activityResult.length > 0) {
          activityList.push(activityResult[0]);
        }
      }
      
      // Criar um mapa para lookup rápido por ID
      activityList.forEach(activity => {
        activitiesMap.set(activity.id, activity);
      });
      
      // Montar o resultado final usando o mapa
      const result: { activity: Activity; progress: ActivityProgress; }[] = [];
      for (const progress of completedProgress) {
        const activity = activitiesMap.get(progress.activityId);
        if (activity) {
          result.push({ activity, progress });
        }
      }
      
      return result;
    }, 10000); // Cache por 10 segundos
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
    
    // Limpar cache de notificações para este usuário
    clearCacheByPattern(`user_notifications_${notificationData.userId}`);
    
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
    // Cache notificações por um período curto (2 segundos)
    return cachedQuery(`user_notifications_${userId}`, async () => {
      const results = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt)); // Mais recentes primeiro
      
      return results;
    }, 2000); // Cache por apenas 2 segundos para garantir notificações atualizadas
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
    
    // Limpar cache de notificações para este usuário
    clearCacheByPattern(`user_notifications_${updatedNotification.userId}`);
    
    return updatedNotification;
  }
}