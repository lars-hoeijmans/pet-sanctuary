/**
 * Agent runner entrypoint. One process == one independent agent container.
 *
 * Configured entirely via environment variables (see docker-compose.yml):
 *   AGENT_ID, AGENT_NAME, AGENT_ROLE, AGENT_AVATAR, AGENT_COLOR,
 *   AGENT_RUNTIME (mock|hermes|openclaw), WORLD_SERVER_URL
 *
 * Selects a runtime via the RuntimeAdapter contract — the rest of the system is
 * agnostic to which runtime powers the agent.
 */
import type { AgentAvatar } from "../../../src/protocol/index";
import { WorldClient } from "./worldClient";
import type { AgentRuntime, AgentRuntimeContext, RuntimeKind } from "./runtime/RuntimeAdapter";
import { MockRuntime } from "./runtime/MockRuntime";
import { HermesRuntime } from "./runtime/HermesRuntime";
import { OpenClawRuntime } from "./runtime/OpenClawRuntime";

function env(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function makeRuntime(kind: RuntimeKind): AgentRuntime {
  switch (kind) {
    case "hermes":
      return new HermesRuntime();
    case "openclaw":
      return new OpenClawRuntime();
    case "mock":
    default:
      return new MockRuntime();
  }
}

async function main(): Promise<void> {
  const agentId = env("AGENT_ID", "mock-agent");
  const worldServerUrl = env("WORLD_SERVER_URL", "http://localhost:3001");
  const kind = env("AGENT_RUNTIME", "mock") as RuntimeKind;

  const world = new WorldClient({
    baseUrl: worldServerUrl,
    agentId,
    name: env("AGENT_NAME", "Mock Agent"),
    role: env("AGENT_ROLE", "Engineer"),
    avatar: env("AGENT_AVATAR", "default") as AgentAvatar,
    color: env("AGENT_COLOR", "#60a5fa"),
    workspace: "/workspace",
  });

  const ctx: AgentRuntimeContext = {
    agentId,
    name: env("AGENT_NAME", "Mock Agent"),
    role: env("AGENT_ROLE", "Engineer"),
    avatar: env("AGENT_AVATAR", "default") as AgentAvatar,
    color: env("AGENT_COLOR", "#60a5fa"),
    workspaceDir: "/workspace",
    worldServerUrl,
    world,
  };

  const runtime = makeRuntime(kind);
  console.info(`[agent-runner] ${agentId} starting with runtime="${kind}" -> ${worldServerUrl}`);
  await runtime.start(ctx);

  const shutdown = (): void => {
    console.info(`[agent-runner] ${agentId} shutting down`);
    void runtime.stop().then(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void main();
