import { Router } from "express";
import { tasksController } from "./tasks.controller.js";

export const tasksRouter = Router();

tasksRouter.post("/", tasksController.create);
tasksRouter.get("/", tasksController.list);
tasksRouter.get("/:id", tasksController.getById);
tasksRouter.post("/:id/assign", tasksController.assign);
tasksRouter.patch("/:id/status", tasksController.updateStatus);
