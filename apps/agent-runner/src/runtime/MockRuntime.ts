/**
 * MockRuntime — an independent, LLM-free agent. It registers, heartbeats, and
 * runs a lively-but-bounded behavior loop, acting only through the worldClient.
 * This is the runtime used for the Docker demo; swap in Hermes/OpenClaw later.
 */
import type { GridPos } from "../../../../src/protocol/index";
import type { AgentRuntime, AgentRuntimeContext } from "./RuntimeAdapter";

const HEARTBEAT_MS = 5000;
const ZONE_TILES: Record<string, GridPos> = {
  "Frontend Engineer": { x: 3, y: 2, roomId: "Frontend Studio" },
  "API Engineer": { x: 17, y: 3, roomId: "Backend Lab" },
  "Code Reviewer": { x: 3, y: 9, roomId: "Review Lounge" },
  "DevOps Engineer": { x: 18, y: 10, roomId: "Infra Corner" },
  "Product Strategist": { x: 10, y: 2, roomId: "Product Room" },
};

export class MockRuntime implements AgentRuntime {
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private loopTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private ctx: AgentRuntimeContext | null = null;

  async start(ctx: AgentRuntimeContext): Promise<void> {
    this.ctx = ctx;
    const home = ZONE_TILES[ctx.role] ?? { x: 11, y: 7, roomId: "Central Plaza" };

    await ctx.world.register(home);
    await ctx.world.status("idle");
    await ctx.world.moveTo(home, `Heading to ${home.roomId}`);
    await ctx.world.say(`${ctx.name} online.`);

    this.heartbeatTimer = setInterval(() => {
      void ctx.world.heartbeat("idle");
    }, HEARTBEAT_MS);

    this.scheduleLoop();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.loopTimer) clearTimeout(this.loopTimer);
    this.heartbeatTimer = null;
    this.loopTimer = null;
  }

  private scheduleLoop(): void {
    if (this.stopped) return;
    const delay = 4000 + Math.floor(Math.random() * 4000);
    this.loopTimer = setTimeout(() => {
      void this.tick().finally(() => this.scheduleLoop());
    }, delay);
  }

  private async tick(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    const home = ZONE_TILES[ctx.role] ?? { x: 11, y: 7, roomId: "Central Plaza" };

    // Check inbox + tasks like a real agent would.
    const inbox = await ctx.world.getInbox();
    if (inbox && inbox.length > 0) {
      await ctx.world.say("On it — checking my inbox.");
    }
    const tasks = await ctx.world.getTasks();
    const open = tasks?.find((t) => t.status === "open");
    if (open && Math.random() < 0.4) {
      await ctx.world.claimTask(open.id);
      await ctx.world.status("coding", open.title);
      return;
    }

    const roll = Math.random();
    if (roll < 0.45) {
      const target: GridPos = { x: home.x + (Math.random() < 0.5 ? -1 : 1), y: home.y + (Math.random() < 0.5 ? -1 : 1), roomId: home.roomId };
      await ctx.world.moveTo(target, `Working around the ${home.roomId}`);
    } else if (roll < 0.65) {
      await ctx.world.say(`${ctx.role} thoughts in progress…`);
    } else if (roll < 0.8) {
      await ctx.world.publishArtifact("commit", `Update by ${ctx.name}`);
    } else if (roll < 0.92) {
      await ctx.world.build("terminal", { x: home.x, y: home.y });
    } else {
      await ctx.world.learnSkill("collaboration");
    }
  }
}
