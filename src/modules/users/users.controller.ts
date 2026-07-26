import type { Request, Response } from "express";
import { createUserSchema } from "./users.schemas.js";
import { usersService } from "./users.service.js";

export const usersController = {
  create(req: Request, res: Response): void {
    const { name, email } = createUserSchema.parse(req.body);
    const user = usersService.createUser(name, email);
    res.status(201).json(user);
  },

  list(_req: Request, res: Response): void {
    res.json(usersService.listUsers());
  },

  getById(req: Request, res: Response): void {
    const user = usersService.getUser(req.params.id);
    res.json(user);
  },
};
