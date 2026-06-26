/**
 * HermesRuntime — PLACEHOLDER (compile-safe stub).
 *
 * Integration plan (to be implemented by the agent team):
 *  - Hermes runs inside this agent container.
 *  - Agent City is exposed to Hermes as a tool / MCP endpoint backed by `world`.
 *  - Hermes' meaningful actions are mirrored into world events via the worldClient
 *    methods (world.say, world.moveTo, world.messageAgent, world.claimTask, …).
 *  - Respect the per-agent /workspace boundary; never share secrets across agents.
 *
 * This stub registers + heartbeats so the agent still APPEARS in the city, then
 * logs that real Hermes integration is pending. It must never throw on import.
 */
import type { AgentRuntime, AgentRuntimeContext } from "./RuntimeAdapter";

export class HermesRuntime implements AgentRuntime {
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  async start(ctx: AgentRuntimeContext): Promise<void> {
    console.warn(
      "HermesRuntime is a placeholder. Use AGENT_RUNTIME=mock for the demo until Hermes integration is configured.",
    );
    await ctx.world.register();
    await ctx.world.status("idle", undefined, "Hermes runtime placeholder — awaiting integration.");
    this.heartbeatTimer = setInterval(() => void ctx.world.heartbeat("idle"), 5000);

    // TODO(agent-team): boot Hermes here, hand it `ctx.world` as a tool surface,
    // and forward its actions to the world via worldClient methods.
  }

  async stop(): Promise<void> {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }
}
