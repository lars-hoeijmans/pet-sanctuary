import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// Secrets live in the monorepo root .env (single source of truth), but Next only
// auto-loads .env files from the app directory. Pull the root .env into the
// server process env so server-only routes (e.g. /api/tts) can read keys like
// ELEVENLABS_API_KEY. Values here never reach the client bundle.
try {
  process.loadEnvFile?.(resolve(workspaceRoot, ".env"));
} catch {
  /* root .env optional — keys may already be in the environment */
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: workspaceRoot
  }
};

export default nextConfig;
