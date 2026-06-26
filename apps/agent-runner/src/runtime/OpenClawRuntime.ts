/**
 * OpenClawRuntime — PLACEHOLDER (compile-safe stub).
 *
 * Integration plan (to be implemented by the agent team):
 *  - OpenClaw runs as the agent runtime / gateway.
 *  - An Agent City skill/session bridge exposes the world protocol to OpenClaw.
 *  - OpenClaw actions are mirrored through `world` (still register / heartbeat /
 *    message / publish events via the Society Server).
 *
 * Like HermesRuntime, this registers + heartbeats so the agent shows up, then
 * logs that real integration is pending. It must never throw on import.
 */
import type { AgentRuntime, AgentRuntimeContext } from "./RuntimeAdapter";

export class OpenClawRuntime implements AgentRuntime {
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  async start(ctx: AgentRuntimeContext): Promise<void> {
    console.warn(
      "OpenClawRuntime is a placeholder. Use AGENT_RUNTIME=mock for the demo until OpenClaw integration is configured.",
    );
    await ctx.world.register();
    await ctx.world.status("idle", undefined, "OpenClaw runtime placeholder — awaiting integration.");
    this.heartbeatTimer = setInterval(() => void ctx.world.heartbeat("idle"), 5000);

    // TODO(agent-team): connect to the OpenClaw session/gateway, expose the
    // world bridge as a skill, and forward actions via worldClient methods.
  }

  async stop(): Promise<void> {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }
}
