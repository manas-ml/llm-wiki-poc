import { Router } from "express";
import { usersController } from "./users.controller.js";

export const usersRouter = Router();

usersRouter.post("/", usersController.create);
usersRouter.get("/", usersController.list);
usersRouter.get("/:id", usersController.getById);
