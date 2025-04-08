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

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type ActivityProgress = typeof activityProgress.$inferSelect;
export type InsertActivityProgress = z.infer<typeof insertActivityProgressSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
