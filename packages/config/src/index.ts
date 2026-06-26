import { z } from "zod";

export const EnvSchema = z.object({
  DATABASE_URL: z.string().url().default("postgres://sanctuary:sanctuary@localhost:5432/pet_sanctuary"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  WEB_PORT: z.coerce.number().int().positive().default(3000)
});

export type SanctuaryEnv = z.infer<typeof EnvSchema>;

export function parseEnv(env: NodeJS.ProcessEnv = process.env): SanctuaryEnv {
  return EnvSchema.parse(env);
}
