import { pgTable, text, serial, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User role enum
export const roleEnum = pgEnum('role', ['admin', 'gabarito', 'impressao', 'batida', 'costura', 'embalagem', 'user']);

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
  image: text("image").notNull(), // Mantemos a imagem principal para compatibilidade
  additionalImages: text("additional_images").array(), // Array para armazenar múltiplas imagens
  quantity: integer("quantity").notNull(),
  clientName: text("client_name"),
  priority: text("priority").default("normal"),
  deadline: timestamp("deadline"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").notNull(),
  status: activityStatusEnum("status").notNull().default('in_progress'),
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
  })
  .extend({
    deadline: z.string().nullable().transform(val => val ? new Date(val) : null),
    additionalImages: z.array(z.string()).optional().default([]),
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
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  activityId: true,
  message: true,
});

// Solicitações de reimpressão
export const reprintStatusEnum = pgEnum('reprint_status', ['pending', 'in_progress', 'completed', 'rejected']);
export const priorityEnum = pgEnum('priority', ['low', 'normal', 'high', 'urgent']);

export const reprintRequests = pgTable("reprint_requests", {
  id: serial("id").primaryKey(),
  activityId: integer("activity_id").notNull(),
  // Quem solicitou a reimpressão
  requestedBy: text("requested_by").notNull(),
  // Departamento que solicitou (normalmente 'batida')
  fromDepartment: roleEnum("requested_department").notNull(),
  // Departamento para onde vai a solicitação (normalmente 'impressao')
  toDepartment: roleEnum("target_department").notNull(),
  // Quando foi solicitada
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  // Motivo da reimpressão
  reason: text("reason").notNull(), 
  // Detalhes adicionais, como descrição das peças/itens
  details: text("details"),
  // Quantidade de peças a reimprimir
  quantity: integer("quantity").notNull().default(1),
  // Prioridade da solicitação
  priority: priorityEnum("priority").notNull().default('normal'),
  // Status da solicitação
  status: reprintStatusEnum("status").notNull().default('pending'),
  // Quem completou a reimpressão
  completedBy: text("completed_by"),
  // Quando foi completada
  completedAt: timestamp("completed_at"),
  // Quem recebeu/verificou a reimpressão
  receivedBy: text("received_by"),
  // Quando foi recebida/verificada
  receivedAt: timestamp("received_at"),
});

export const insertReprintRequestSchema = createInsertSchema(reprintRequests).pick({
  activityId: true,
  requestedBy: true,
  fromDepartment: true,
  toDepartment: true,
  reason: true,
  details: true,
  quantity: true,
  priority: true,
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Activity = typeof activities.$inferSelect & {
  // Campo virtual para armazenar o departamento atual do fluxo
  currentDepartment?: string;
};
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type ActivityProgress = typeof activityProgress.$inferSelect;
export type InsertActivityProgress = z.infer<typeof insertActivityProgressSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type ReprintRequest = typeof reprintRequests.$inferSelect;
export type InsertReprintRequest = z.infer<typeof insertReprintRequestSchema>;
