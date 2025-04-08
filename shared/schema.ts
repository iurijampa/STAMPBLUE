import { pgTable, text, serial, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User role enum
export const roleEnum = pgEnum('role', ['admin', 'gabarito', 'impressao', 'batida', 'costura', 'embalagem']);

// Sequential departments for workflow
export const DEPARTMENTS = ['gabarito', 'impressao', 'batida', 'costura', 'embalagem'] as const;
export type Department = typeof DEPARTMENTS[number];

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  role: true,
});

// Activity status enum
export const activityStatusEnum = pgEnum('status', ['pending', 'in_progress', 'completed']);

// Activities table
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  image: text("image").notNull(),
  quantity: integer("quantity").notNull(),
  deadline: timestamp("deadline"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").notNull(),
  status: activityStatusEnum("status").notNull().default('in_progress'),
});

export const insertActivitySchema = createInsertSchema(activities).pick({
  title: true,
  description: true,
  image: true,
  quantity: true,
  deadline: true,
  notes: true,
  createdBy: true,
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
});

export const insertActivityProgressSchema = createInsertSchema(activityProgress).pick({
  activityId: true,
  department: true,
  status: true,
  completedBy: true,
  completedAt: true,
  notes: true,
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
