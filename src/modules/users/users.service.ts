import { AppError } from "../../middleware/error.middleware.js";
import type { User } from "../../types/index.js";
import { usersRepository } from "./users.repository.js";

export const usersService = {
  createUser(name: string, email: string): User {
    if (usersRepository.findByEmail(email)) {
      throw new AppError(409, `A user with email "${email}" already exists`);
    }
    return usersRepository.create(name, email);
  },

  listUsers(): User[] {
    return usersRepository.findAll();
  },

  getUser(id: string): User {
    const user = usersRepository.findById(id);
    if (!user) {
      throw new AppError(404, `User not found: ${id}`);
    }
    return user;
  },
};
