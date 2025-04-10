import { pgTable, text, serial, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User role enum
export const roleEnum = pgEnum('role', ['admin', 'gabarito', 'impressao', 'batida', 'costura', 'embalagem', 'user']);

// Reprint request status enum
export const reprintStatusEnum = pgEnum('reprint_status', ['pending', 'completed', 'cancelled']);

// Reprint priority enum
export const reprintPriorityEnum = pgEnum('reprint_priority', ['normal', 'urgent']);

// Sequential departments for workflow
export const DEPARTMENTS = ['admin', 'gabarito', 'impressao', 'batida', 'costura', 'embalagem'] as const;
export type Department = typeof DEPARTMENTS[number];

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull(),
  department: roleEnum("department").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  role: true,
  department: true,
});

// Activity status enum
export const activityStatusEnum = pgEnum('status', ['pending', 'in_progress', 'completed']);

// Activities table
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  image: text("image"), // Imagem principal pode ser null agora para solicitações de reimpressão
  additionalImages: text("additional_images").array(), // Array para armazenar múltiplas imagens
  quantity: integer("quantity").default(1),
  clientName: text("client_name"),
  priority: text("priority").default("normal"),
  deadline: timestamp("deadline"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by"), // Alterado para text para aceitar nome de usuário
  status: activityStatusEnum("status").notNull().default('in_progress'),
  isReprintRequest: boolean("is_reprint_request").default(false) // Flag para identificar solicitações independentes
});

// Criamos o esquema base e depois sobrescrevemos o deadline para aceitar string ISO
export const insertActivitySchema = createInsertSchema(activities)
  .pick({
    title: true,
    description: true,
    image: true,
    additionalImages: true,
    quantity: true,
    clientName: true,
    priority: true,
    deadline: true,
    notes: true,
    createdBy: true,
    isReprintRequest: true,
  })
  .extend({
    deadline: z.string().nullable().transform(val => val ? new Date(val) : null),
    additionalImages: z.array(z.string()).optional().default([]),
    isReprintRequest: z.boolean().optional().default(false),
  });

// Activity progress tracking
export const activityProgress = pgTable("activity_progress", {
  id: serial("id").primaryKey(),
  activityId: integer("activity_id").notNull(),
  department: roleEnum("department").notNull(),
  status: activityStatusEnum("status").notNull().default('pending'),
  completedBy: text("completed_by"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  returnedBy: text("returned_by"),
  returnedAt: timestamp("returned_at"),
});

export const insertActivityProgressSchema = createInsertSchema(activityProgress).pick({
  activityId: true,
  department: true,
  status: true,
  completedBy: true,
  completedAt: true,
  notes: true,
  returnedBy: true,
  returnedAt: true,
});

// Notifications table
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  activityId: integer("activity_id").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  department: roleEnum("department"),
  type: text("type"),
  metadata: text("metadata"),
  title: text("title"),
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  activityId: true,
  message: true,
  department: true,
  type: true,
  metadata: true,
  title: true,
});

// Reprint requests table
export const reprintRequests = pgTable("reprint_requests", {
  id: serial("id").primaryKey(),
  activityId: integer("activity_id").notNull(),
  quantity: integer("quantity").notNull(),
  reason: text("reason").notNull(),
  details: text("details"),
  requestedBy: text("requested_by").notNull(),
  requestedDepartment: roleEnum("requested_department").notNull(),
  targetDepartment: roleEnum("target_department").notNull(),
  priority: reprintPriorityEnum("priority").notNull().default("normal"),
  status: reprintStatusEnum("status").notNull().default("pending"),
  completedBy: text("completed_by"),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  receivedBy: text("received_by"),
  receivedAt: timestamp("received_at"),
});

export const insertReprintRequestSchema = createInsertSchema(reprintRequests).pick({
  activityId: true,
  quantity: true,
  reason: true,
  details: true,
  requestedBy: true,
  requestedDepartment: true, 
  targetDepartment: true,
  priority: true,
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type ActivityProgress = typeof activityProgress.$inferSelect;
export type InsertActivityProgress = z.infer<typeof insertActivityProgressSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type ReprintRequest = typeof reprintRequests.$inferSelect;
export type InsertReprintRequest = z.infer<typeof insertReprintRequestSchema>;
