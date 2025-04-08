import { 
  User, InsertUser, 
  Activity, InsertActivity, 
  ActivityProgress, InsertActivityProgress, 
  Notification, InsertNotification,
  DEPARTMENTS
} from "@shared/schema";
import createMemoryStore from "memorystore";
import session from "express-session";

// Memory Store for session
const MemoryStore = createMemoryStore(session);

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
  sessionStore: session.SessionStore;
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
  public sessionStore: session.SessionStore;

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
    
    // Marcar o progresso anterior como pendente novamente
    const updatedPreviousProgress: ActivityProgress = {
      ...previousProgress,
      status: "pending",
      notes: notes || null,
      returnedBy,
      returnedAt: new Date(),
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
}

export const storage = new MemStorage();
