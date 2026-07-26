import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

/**
 * Simple API-key auth: every request must carry `x-api-key` matching the
 * configured server key. Good enough for a demo; swap for OAuth/JWT in
 * a real deployment.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const providedKey = req.header("x-api-key");
  if (providedKey !== env.API_KEY) {
    res.status(401).json({ error: "Unauthorized: missing or invalid x-api-key header" });
    return;
  }
  next();
}
