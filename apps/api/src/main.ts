import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

/**
 * Load the nearest `.env` (walking up from the working directory) into
 * `process.env` before anything reads it, so a plain `pnpm dev` picks up the
 * same `SANCTUARY_AI_*` configuration the `dev:ai` script bakes in inline.
 * Node's loader never overrides variables already present in the real
 * environment, so an explicit `dev:ai` (or shell export) still wins.
 */
function loadDotEnv(): void {
  let dir = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) {
      try {
        process.loadEnvFile(candidate);
      } catch {
        // A malformed or unreadable .env must never crash boot; real env wins.
      }
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return;
    }
    dir = parent;
  }
}

loadDotEnv();

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(",") ?? true,
    credentials: true
  });

  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();
