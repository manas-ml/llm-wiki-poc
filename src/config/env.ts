import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  API_KEY: z.string().min(1).default("dev-local-key"),
});

export const env = envSchema.parse({
  PORT: process.env.PORT,
  API_KEY: process.env.API_KEY,
});
