import { InMemoryStore } from "../../db/in-memory-store.js";
import type { User } from "../../types/index.js";

const store = new InMemoryStore<User>();

export const usersRepository = {
  create(name: string, email: string): User {
    return store.create((id) => ({
      id,
      name,
      email,
      createdAt: new Date().toISOString(),
    }));
  },
  findAll(): User[] {
    return store.findAll();
  },
  findById(id: string): User | undefined {
    return store.findById(id);
  },
  findByEmail(email: string): User | undefined {
    return store.findAll().find((user) => user.email === email);
  },
};
