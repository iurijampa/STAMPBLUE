import { 
  User, InsertUser, 
  Activity, InsertActivity, 
  ActivityProgress, InsertActivityProgress, 
  Notification, InsertNotification,
  ReprintRequest, InsertReprintRequest
} from "@shared/schema";

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
  returnActivityToPreviousDepartment(
    activityId: number,
    currentDepartment: string,
    returnedBy: string,
    notes?: string
  ): Promise<{ previousProgress: ActivityProgress, currentProgress: ActivityProgress }>;
  getCompletedActivitiesByDepartment(department: string): Promise<{ activity: Activity, progress: ActivityProgress }[]>;
  
  // Notifications
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotification(id: number): Promise<Notification | undefined>;
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  markNotificationAsRead(id: number): Promise<Notification>;
  
  // Reprint Requests
  createReprintRequest(request: InsertReprintRequest): Promise<ReprintRequest>;
  getReprintRequest(id: number): Promise<ReprintRequest | undefined>;
  getReprintRequestsByActivity(activityId: number): Promise<ReprintRequest[]>;
  getReprintRequestsByStatus(status: string): Promise<ReprintRequest[]>;
  getReprintRequestsForDepartment(department: string): Promise<ReprintRequest[]>;
  getReprintRequestsFromDepartment(department: string): Promise<ReprintRequest[]>;
  updateReprintRequestStatus(
    id: number, 
    status: string, 
    processedBy?: string, 
    responseNotes?: string
  ): Promise<ReprintRequest>;
  
  // Session store
  sessionStore: any;
}