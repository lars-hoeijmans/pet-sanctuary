/**
 * MockWorldSource — a fully client-side stand-in for the Society Server + agents.
 *
 * It behaves like an independent little world: the five resident agents wander,
 * talk, change status, build furniture, publish artifacts, learn skills and
 * message each other on their own. There is NO LLM and NO backend here — this is
 * the placeholder runtime so the frontend is alive and demo-ready before real
 * agents (Hermes / OpenClaw) are connected via SocketWorldSource.
 *
 * Every action is funneled through `dispatch()`, which validates the event with
 * the shared Zod schema exactly like the real server would — so the wiring is
 * proven, not faked.
 */
import {
  applyWorldEvent,
  createEmptyWorld,
  safeParseWorldEvent,
  type AgentStatus,
  type ObjectKind,
  type WorldEvent,
  type WorldSnapshot,
} from "../../protocol/index";
import type { WorldSource, WorldSourceHandlers } from "./WorldSource";
import { ev } from "./eventFactory";
import { runDemo } from "./demoScenario";
import { AGENT_DEFS, type AgentDef } from "./agentDefs";
import { getZone, randomTileInZone, zoneCenter } from "./zones";
import { buildInitialObjects, canPlace } from "./placement";

/** Small seeded PRNG (mulberry32) so the city is lively but reproducible. */
function makeRng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type AmbientAction = "move" | "say" | "status" | "artifact" | "build" | "skill" | "memory" | "message";

const ACTION_WEIGHTS: Array<[AmbientAction, number]> = [
  ["move", 44],
  ["say", 18],
  ["status", 10],
  ["artifact", 9],
  ["build", 8],
  ["skill", 5],
  ["memory", 3],
  ["message", 3],
];

const STATUS_POOL: AgentStatus[] = [
  "thinking",
  "coding",
  "reviewing",
  "debugging",
  "testing",
  "building",
];

const AMBIENT_INTERVAL_MS = 1400;
const HEARTBEAT_INTERVAL_MS = 5000;

export class MockWorldSource implements WorldSource {
  readonly kind = "mock" as const;

  private handlers: WorldSourceHandlers | null = null;
  private world: WorldSnapshot = createEmptyWorld();
  private rng = makeRng(0xa9c1);

  private ambientTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pendingTimers = new Set<ReturnType<typeof setTimeout>>();
  private cancelDemo: (() => void) | null = null;

  private actionCursor = 0;
  private testAgentCount = 0;

  connect(handlers: WorldSourceHandlers): void {
    this.handlers = handlers;
    handlers.onStatus("connecting");
    this.world = this.freshWorld();
    handlers.onSnapshot(this.world);

    this.registerResidents();
    handlers.onStatus("live");
    this.startLoops();
  }

  disconnect(): void {
    this.stopLoops();
    this.stopDemoInternal();
    this.handlers?.onStatus("offline");
    this.handlers = null;
  }

  // ---- command surface (the levers) --------------------------------------

  playDemo(): void {
    if (this.cancelDemo) return;
    // Reseed to a clean, known stage so the scripted scenario is deterministic
    // and its builds always satisfy the placement ruleset.
    this.reseed();
    this.handlers?.onDemoStateChange(true);
    this.cancelDemo = runDemo(
      (event) => this.dispatch(event),
      () => {
        this.cancelDemo = null;
        this.handlers?.onDemoStateChange(false);
      },
    );
  }

  stopDemo(): void {
    if (!this.cancelDemo) return;
    this.stopDemoInternal();
    this.dispatch(ev.notification("Demo stopped", "Returning to ambient city life.", "info"));
  }

  reset(): void {
    this.stopDemoInternal();
    this.reseed();
    this.dispatch(ev.notification("World reset", "The city has been reset to its base state.", "info"));
  }

  /** Re-seed the world to its base state and re-register the residents. */
  private reseed(): void {
    this.clearPendingTimers();
    this.world = this.freshWorld();
    this.handlers?.onSnapshot(this.world);
    this.registerResidents();
  }

  createTask(title: string, description: string, createdByAgentId = "product-agent"): void {
    const event = ev.taskCreated(title, description, createdByAgentId);
    if (event.type !== "task.created") return;
    const taskId = event.task.id;
    this.dispatch(event);

    // Make the manual task feel alive: a relevant agent claims then completes it.
    const claimer = this.pickAgentId((id) => id !== createdByAgentId) ?? createdByAgentId;
    this.schedule(() => this.dispatch(ev.taskClaimed(taskId, claimer)), 2500);
    this.schedule(() => {
      this.dispatch(ev.artifact(claimer, "commit", `Resolve: ${title}`, "Auto-resolved by mock runtime."));
      this.dispatch(ev.taskCompleted(taskId, claimer, `Completed: ${title}`, []));
    }, 6500);
  }

  spawnTestAgent(): void {
    this.testAgentCount += 1;
    const n = this.testAgentCount;
    const palette = ["#22d3ee", "#f472b6", "#facc15", "#4ade80", "#818cf8"];
    const avatars = ["default", "robot", "hoodie", "wizard", "infra"] as const;
    const identity = {
      id: `test-agent-${n}`,
      name: `Test Agent ${n}`,
      role: "Visitor",
      avatar: avatars[n % avatars.length],
      color: palette[n % palette.length],
      runtime: "mock" as const,
    };
    const pos = { ...zoneCenter("central-plaza"), x: 11 + (n % 5), y: 8 };
    this.dispatch(ev.register(identity, pos));
    this.schedule(() => this.dispatch(ev.say(identity.id, "Hello, Agent City!")), 600);
  }

  sendRandomMessage(): void {
    const from = this.pickAgentId();
    const to = this.pickAgentId((id) => id !== from);
    if (!from || !to) return;
    const def = AGENT_DEFS.find((d) => d.identity.id === from);
    const line = def ? this.choose(def.sayings) : "Got a sec to sync?";
    this.dispatch(ev.message(from, to, line));
  }

  buildRandomObject(): void {
    const agentId = this.pickAgentId();
    if (!agentId) return;
    const def = AGENT_DEFS.find((d) => d.identity.id === agentId);
    if (!def) return;
    const kind = this.choose(def.buildKinds);
    const pos = this.findFreeBuildTile(def.homeZoneId, kind);
    if (!pos) return;
    this.dispatch(ev.status(agentId, "building"));
    this.dispatch(ev.build(agentId, kind, { x: pos.x, y: pos.y }, undefined, 1000));
  }

  emit(event: WorldEvent): void {
    // Generic escape hatch (command palette). Goes through the same validation.
    this.dispatch(event);
  }

  // ---- internals ----------------------------------------------------------

  private freshWorld(): WorldSnapshot {
    const world = createEmptyWorld();
    // Seed through the placement ruleset so the starting room is guaranteed
    // tidy (no overlaps, within per-kind + density caps).
    for (const obj of buildInitialObjects()) world.objects[obj.id] = obj;
    return world;
  }

  /**
   * Find a grid spot in a zone where `kind` may legally be built, per the
   * shared placement ruleset. Returns null when the zone has no valid spot
   * (full / at a cap) — the caller then keeps the agent busy another way.
   */
  private findFreeBuildTile(zoneId: string, kind: ObjectKind): { x: number; y: number } | null {
    const zone = getZone(zoneId);
    if (!zone) return null;
    const objects = Object.values(this.world.objects);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const x = Math.max(1, zone.rect.x) + Math.floor(this.rng() * zone.rect.w);
      const y = Math.max(1, zone.rect.y) + Math.floor(this.rng() * zone.rect.h);
      if (canPlace(objects, kind, { x, y }).ok) return { x, y };
    }
    return null;
  }

  /** The single chokepoint: validate -> reduce -> notify. Mirrors the server. */
  private dispatch(event: WorldEvent): void {
    const valid = safeParseWorldEvent(event);
    if (!valid) {
      console.warn("[MockWorldSource] dropped invalid event", event);
      return;
    }
    // Enforce the placement ruleset on every build — mock now, real agents later
    // go through the same chokepoint, so the room can never become a mess.
    if (valid.type === "agent.build") {
      const check = canPlace(Object.values(this.world.objects), valid.object.kind, valid.object.position);
      if (!check.ok) {
        console.warn(`[MockWorldSource] build rejected by placement rules (${check.reason})`, valid.object);
        return;
      }
    }
    this.world = applyWorldEvent(this.world, valid);
    this.handlers?.onEvent(valid);
  }

  private registerResidents(): void {
    AGENT_DEFS.forEach((def, index) => {
      const center = zoneCenter(def.homeZoneId);
      const pos = { x: center.x, y: center.y, roomId: center.roomId };
      this.dispatch(ev.register(def.identity, pos));
      this.dispatch(ev.status(def.identity.id, "idle", { mood: "focused" }));
      // Staggered intro lines so the city greets you on load.
      this.schedule(() => this.dispatch(ev.say(def.identity.id, this.choose(def.sayings))), 800 + index * 700);
    });
  }

  private startLoops(): void {
    this.stopLoops();
    this.ambientTimer = setInterval(() => this.ambientTick(), AMBIENT_INTERVAL_MS);
    this.heartbeatTimer = setInterval(() => this.heartbeatTick(), HEARTBEAT_INTERVAL_MS);
  }

  private stopLoops(): void {
    if (this.ambientTimer !== null) clearInterval(this.ambientTimer);
    if (this.heartbeatTimer !== null) clearInterval(this.heartbeatTimer);
    this.ambientTimer = null;
    this.heartbeatTimer = null;
  }

  private heartbeatTick(): void {
    for (const agent of Object.values(this.world.agents)) {
      this.dispatch(ev.heartbeat(agent.id, agent.status, agent.currentTask));
    }
  }

  private ambientTick(): void {
    if (this.cancelDemo) return; // demo owns the stage
    const residents = AGENT_DEFS;
    if (residents.length === 0) return;

    // Rotate through residents so everyone stays active; act for ~2 per tick.
    for (let i = 0; i < 2; i += 1) {
      const def = residents[this.actionCursor % residents.length];
      this.actionCursor += 1;
      this.performAmbientAction(def);
    }
  }

  private performAmbientAction(def: AgentDef): void {
    const action = this.weightedAction();
    const id = def.identity.id;

    switch (action) {
      case "move": {
        const toPlaza = this.rng() < 0.25;
        const target = toPlaza
          ? randomTileInZone("central-plaza", this.rng)
          : randomTileInZone(def.homeZoneId, this.rng);
        this.dispatch(ev.move(id, target, toPlaza ? "Heading to the plaza" : `Working around the ${target.roomId}`));
        break;
      }
      case "say": {
        this.dispatch(ev.say(id, this.choose(def.sayings)));
        break;
      }
      case "status": {
        this.dispatch(ev.status(id, this.choose(STATUS_POOL)));
        break;
      }
      case "artifact": {
        const kind = this.choose(def.artifactKinds);
        const title = this.choose(def.artifactTitles);
        this.dispatch(ev.status(id, "shipping"));
        this.dispatch(ev.artifact(id, kind, title));
        break;
      }
      case "build": {
        const kind = this.choose(def.buildKinds);
        const pos = this.findFreeBuildTile(def.homeZoneId, kind);
        if (pos) {
          this.dispatch(ev.status(id, "building"));
          this.dispatch(ev.build(id, kind, { x: pos.x, y: pos.y }, undefined, 1000));
        } else {
          // zone is full — keep the agent lively instead of overlapping furniture
          this.dispatch(ev.say(id, this.choose(def.sayings)));
        }
        break;
      }
      case "skill": {
        const known = new Set(this.world.agents[id]?.skills ?? []);
        const fresh = def.skills.filter((s) => !known.has(s));
        if (fresh.length > 0) {
          this.dispatch(ev.status(id, "learning"));
          this.dispatch(ev.skillLearned(id, this.choose(fresh)));
        } else {
          this.dispatch(ev.say(id, this.choose(def.sayings)));
        }
        break;
      }
      case "memory": {
        this.dispatch(ev.memoryUpdated(id, `Context: ${this.choose(def.sayings)}`));
        break;
      }
      case "message": {
        const to = this.pickAgentId((other) => other !== id);
        if (to) this.dispatch(ev.message(id, to, this.choose(def.sayings)));
        break;
      }
    }
  }

  private weightedAction(): AmbientAction {
    const total = ACTION_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
    let roll = this.rng() * total;
    for (const [action, weight] of ACTION_WEIGHTS) {
      roll -= weight;
      if (roll <= 0) return action;
    }
    return "move";
  }

  private choose<T>(items: readonly T[]): T {
    return items[Math.floor(this.rng() * items.length)];
  }

  private pickAgentId(filter?: (id: string) => boolean): string | undefined {
    const ids = Object.keys(this.world.agents).filter((id) => (filter ? filter(id) : true));
    if (ids.length === 0) return undefined;
    return ids[Math.floor(this.rng() * ids.length)];
  }

  private schedule(fn: () => void, delayMs: number): void {
    const timer = setTimeout(() => {
      this.pendingTimers.delete(timer);
      fn();
    }, delayMs);
    this.pendingTimers.add(timer);
  }

  private clearPendingTimers(): void {
    for (const timer of this.pendingTimers) clearTimeout(timer);
    this.pendingTimers.clear();
  }

  private stopDemoInternal(): void {
    if (this.cancelDemo) {
      this.cancelDemo();
      this.cancelDemo = null;
      this.handlers?.onDemoStateChange(false);
    }
  }
}
