import express, { type Express } from "express";
import { requireApiKey } from "./middleware/auth.middleware.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";
import { tasksRouter } from "./modules/tasks/tasks.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";

export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/users", requireApiKey, usersRouter);
  app.use("/tasks", requireApiKey, tasksRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
