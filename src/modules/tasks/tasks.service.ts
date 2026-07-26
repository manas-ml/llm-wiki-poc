import { AppError } from "../../middleware/error.middleware.js";
import type { Task, TaskPriority, TaskStatus } from "../../types/index.js";
import { usersService } from "../users/users.service.js";
import { tasksRepository } from "./tasks.repository.js";

export const tasksService = {
  createTask(title: string, description: string, priority: TaskPriority): Task {
    return tasksRepository.create(title, description, priority);
  },

  listTasks(filter: { status?: TaskStatus; assigneeId?: string }): Task[] {
    return tasksRepository
      .findAll()
      .filter((task) => (filter.status ? task.status === filter.status : true))
      .filter((task) => (filter.assigneeId ? task.assigneeId === filter.assigneeId : true));
  },

  getTask(id: string): Task {
    const task = tasksRepository.findById(id);
    if (!task) {
      throw new AppError(404, `Task not found: ${id}`);
    }
    return task;
  },

  assignTask(id: string, assigneeId: string): Task {
    this.getTask(id);
    usersService.getUser(assigneeId); // throws 404 if the assignee doesn't exist
    const updated = tasksRepository.update(id, { assigneeId });
    return updated!;
  },

  updateStatus(id: string, status: TaskStatus): Task {
    this.getTask(id);
    const updated = tasksRepository.update(id, { status });
    return updated!;
  },
};
