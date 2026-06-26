import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * No-cost local LLM bridge for the sanctuary's real agents.
 *
 * The product must never depend on a paid per-token API (PRD §14). Instead it
 * drives pets through a locally-installed, already-authenticated coding-agent CLI
 * that bills against a flat subscription:
 *
 *   - `hermes` → the user's OpenAI **Codex** subscription (preferred, PRD §16).
 *   - `opencode` → the user's **GitHub Copilot** subscription (no per-token cost).
 *
 * Both are real LLMs (gpt-5.5 / gpt-4.1 / claude / gemini behind the subscription),
 * so pets make genuine model-driven decisions and do genuine work. The backend is
 * swappable via env so the same runtime upgrades to Hermes/Codex automatically when
 * that quota is available, and falls to Copilot otherwise — always zero incremental
 * cost. On any failure the caller falls back to the deterministic policy so the
 * world never stalls.
 */

export type AgentBackend = "opencode" | "hermes";

export interface AgentBackendConfig {
  backend: AgentBackend;
  /** Stronger model for real task execution (`runTask`). */
  model: string;
  /** Cheaper/faster model for per-tick behaviour (`decideAction`). */
  fastModel: string;
  /** Optional provider override (Hermes credential-pool provider, e.g. "copilot"). */
  provider: string | null;
  timeoutMs: number;
  /** Neutral working directory so the CLI never touches the product repo. */
  cwd: string;
}

/**
 * Each agent run gets its OWN fresh working directory. The CLIs write session/lock
 * state into their cwd, so a shared dir makes concurrent pet calls clobber each
 * other and fail (then silently fall back to deterministic). Isolating every call
 * keeps parallel agents from getting in each other's way.
 */
function makeRunCwd(override?: string | null): string {
  if (override) return override;
  try {
    return mkdtempSync(join(tmpdir(), "pet-sanctuary-agent-"));
  } catch {
    return tmpdir();
  }
}

export function getBackendConfig(env: NodeJS.ProcessEnv = process.env): AgentBackendConfig {
  const backend = (env.SANCTUARY_AGENT_BACKEND as AgentBackend) || "opencode";
  const model = env.SANCTUARY_AGENT_MODEL || (backend === "hermes" ? "gpt-5.5" : "github-copilot/gpt-4.1");
  return {
    backend,
    model,
    fastModel: env.SANCTUARY_AGENT_FAST_MODEL || model,
    provider: env.SANCTUARY_AGENT_PROVIDER || null,
    timeoutMs: Number(env.SANCTUARY_LLM_TIMEOUT_MS ?? 60_000),
    // Empty unless explicitly overridden; each agentComplete() makes its own
    // isolated dir so concurrent pets never share CLI session state.
    cwd: env.SANCTUARY_AGENT_CWD || ""
  };
}

const ANSI = /\[[0-9;]*[A-Za-z]/g;

/** Strip ANSI colour codes and the CLI's own banner/log lines from raw stdout. */
export function cleanCliOutput(raw: string): string {
  return raw
    .replace(ANSI, "")
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      // opencode prints a `> build · <model>` banner; drop chrome-only lines.
      if (t.startsWith(">") && t.includes("·")) return false;
      return true;
    })
    .join("\n")
    .trim();
}

function buildArgs(prompt: string, model: string, cfg: AgentBackendConfig): { cmd: string; args: string[] } {
  if (cfg.backend === "hermes") {
    const args = ["-z", prompt, "--cli", "--yolo", "-m", model];
    if (cfg.provider) args.push("--provider", cfg.provider);
    return { cmd: "hermes", args };
  }
  // opencode (GitHub Copilot subscription) — `--pure` avoids loading project plugins.
  return { cmd: "opencode", args: ["run", "--pure", "-m", model, prompt] };
}

export interface CompleteOptions {
  fast?: boolean;
  env?: NodeJS.ProcessEnv;
}

interface SpawnResult {
  stdout: string;
}

/**
 * Spawn the CLI with stdin **ignored**. These agent CLIs read stdin when it is an
 * open pipe and block forever waiting for a TTY; closing it (stdin = "ignore")
 * makes one-shot `run`/`-z` mode return immediately. The process is hard-killed
 * on timeout. Always resolves — never rejects — so callers can treat null as
 * "fall back to deterministic".
 */
function spawnCli(cmd: string, args: string[], cwd: string, timeoutMs: number): Promise<SpawnResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout });
    };

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env } });
    } catch {
      resolve({ stdout: "" });
      return;
    }

    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
      finish();
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      if (stdout.length > 16 * 1024 * 1024) {
        try {
          child.kill("SIGKILL");
        } catch {
          // ignore
        }
        finish();
      }
    });
    child.on("error", finish);
    child.on("close", finish);
  });
}

/**
 * Run one prompt through the configured no-cost agent CLI and return the cleaned
 * text response, or `null` on timeout / no usable output.
 */
export async function agentComplete(prompt: string, options: CompleteOptions = {}): Promise<string | null> {
  const cfg = getBackendConfig(options.env);
  const model = options.fast ? cfg.fastModel : cfg.model;
  const { cmd, args } = buildArgs(prompt, model, cfg);

  const isolated = !cfg.cwd;
  const runCwd = makeRunCwd(cfg.cwd);
  const started = Date.now();
  try {
    const { stdout } = await spawnCli(cmd, args, runCwd, cfg.timeoutMs);
    const cleaned = cleanCliOutput(stdout);
    if (process.env.SANCTUARY_AGENT_DEBUG) {
      console.warn(
        `[agent] ${cmd} ${model} ${Date.now() - started}ms raw=${stdout.length} clean=${cleaned.length}${cleaned.length === 0 ? " EMPTY->fallback" : ""}`
      );
    }
    return cleaned.length > 0 ? cleaned : null;
  } finally {
    if (isolated) {
      try {
        rmSync(runCwd, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }
  }
}

/**
 * Extract the first balanced JSON object from arbitrary model text (handles stray
 * prose, ```json fences, and trailing chatter). Returns the parsed value or null.
 */
export function extractJson(text: string): unknown | null {
  if (!text) return null;
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
