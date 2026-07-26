import { InMemoryStore } from "../../db/in-memory-store.js";
import type { Task, TaskPriority } from "../../types/index.js";

const store = new InMemoryStore<Task>();

export const tasksRepository = {
  create(title: string, description: string, priority: TaskPriority): Task {
    const now = new Date().toISOString();
    return store.create((id) => ({
      id,
      title,
      description,
      status: "todo",
      priority,
      assigneeId: null,
      createdAt: now,
      updatedAt: now,
    }));
  },
  findAll(): Task[] {
    return store.findAll();
  },
  findById(id: string): Task | undefined {
    return store.findById(id);
  },
  update(id: string, patch: Partial<Task>): Task | undefined {
    return store.update(id, { ...patch, updatedAt: new Date().toISOString() });
  },
};
