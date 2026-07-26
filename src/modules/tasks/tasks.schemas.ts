import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1, "title is required"),
  description: z.string().default(""),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(["todo", "in_progress", "done"]),
});

export const assignTaskSchema = z.object({
  assigneeId: z.string().min(1, "assigneeId is required"),
});

export const listTasksQuerySchema = z.object({
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  assigneeId: z.string().optional(),
});
