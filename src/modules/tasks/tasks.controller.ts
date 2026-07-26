import type { Request, Response } from "express";
import {
  assignTaskSchema,
  createTaskSchema,
  listTasksQuerySchema,
  updateTaskStatusSchema,
} from "./tasks.schemas.js";
import { tasksService } from "./tasks.service.js";

export const tasksController = {
  create(req: Request, res: Response): void {
    const { title, description, priority } = createTaskSchema.parse(req.body);
    const task = tasksService.createTask(title, description, priority);
    res.status(201).json(task);
  },

  list(req: Request, res: Response): void {
    const filter = listTasksQuerySchema.parse(req.query);
    res.json(tasksService.listTasks(filter));
  },

  getById(req: Request, res: Response): void {
    res.json(tasksService.getTask(req.params.id));
  },

  assign(req: Request, res: Response): void {
    const { assigneeId } = assignTaskSchema.parse(req.body);
    res.json(tasksService.assignTask(req.params.id, assigneeId));
  },

  updateStatus(req: Request, res: Response): void {
    const { status } = updateTaskStatusSchema.parse(req.body);
    res.json(tasksService.updateStatus(req.params.id, status));
  },
};
