/**
 * IdleLife — a purely *visual* ambient layer so agents feel alive when nothing
 * is scheduled for them.
 *
 * The Phaser scene is otherwise event-driven: it only animates in response to
 * authoritative world events. In a live backend that means agents with no task
 * just stand on their tile. IdleLife fills that gap by:
 *   - making idle agents wander to nearby walkable tiles, and
 *   - pairing up nearby idle agents to chat (canned today, LLM-ready via
 *     `IdleDialogue`'s pluggable provider).
 *
 * It never touches world truth (no events are dispatched to the store/backend).
 * The instant a real event arrives for an agent, the scene calls
 * `notifyActivity(id)`, which cancels any in-flight idle behavior for that agent
 * so the authoritative animation takes over cleanly.
 */
import type Phaser from "phaser";
import { WORLD_HEIGHT, WORLD_WIDTH, type AgentStatus } from "../../protocol/index";
import type { AgentSprite } from "./AgentSprite";
import { findPath } from "./Pathfinding";
import { getIdleDialogueProvider } from "./IdleDialogue";

interface IdleLifeOpts {
  getAgents: () => Map<string, AgentSprite>;
  /** Tile keys (y * WORLD_WIDTH + x) occupied by furniture. */
  getBlocked: () => Set<number>;
}

const TICK_MS = 2500;
const WANDER_CHANCE = 0.25; // per idle agent, per tick
const CONVO_CHANCE = 0.5; // per tick when ≥2 idle agents exist
const WANDER_RADIUS = 4; // tiles from current position
const CHAT_RADIUS = 4; // manhattan distance to chat in place
const APPROACH_CHANCE = 0.45; // walk over to a far idle agent to chat
const TURN_MS = 2400; // gap between spoken lines
const PER_TILE_MS = 320; // matches AgentSprite walk cadence (+slack)

/** Statuses where an agent is fair game for idle ambience. */
function isManagedStatus(status: AgentStatus): boolean {
  return status === "idle" || status === "offline";
}

function tileKey(x: number, y: number): number {
  return y * WORLD_WIDTH + x;
}

function manhattan(a: AgentSprite, b: AgentSprite): number {
  return Math.abs(a.gridX - b.gridX) + Math.abs(a.gridY - b.gridY);
}

export class IdleLife {
  private scene: Phaser.Scene;
  private opts: IdleLifeOpts;
  private loop: Phaser.Time.TimerEvent | null = null;
  private timers = new Set<Phaser.Time.TimerEvent>();

  /** Agents currently driven by an idle behavior (wander-to-chat / chatting). */
  private busy = new Set<string>();
  /** Per-agent generation counter; bumping it cancels pending idle callbacks. */
  private tokens = new Map<string, number>();

  constructor(scene: Phaser.Scene, opts: IdleLifeOpts) {
    this.scene = scene;
    this.opts = opts;
  }

  start(): void {
    this.stop();
    this.loop = this.scene.time.addEvent({
      delay: TICK_MS,
      loop: true,
      callback: () => this.tick(),
    });
  }

  stop(): void {
    this.loop?.remove(false);
    this.loop = null;
    for (const t of this.timers) t.remove(false);
    this.timers.clear();
    this.busy.clear();
  }

  /** True while an idle behavior (wander-to-chat / chatting) owns this agent. */
  isBusy(agentId: string): boolean {
    return this.busy.has(agentId);
  }

  /** A real world event landed for this agent — drop any idle behavior on it. */
  notifyActivity(agentId: string): void {
    if (!this.busy.has(agentId) && !this.tokens.has(agentId)) return;
    this.bump(agentId);
    this.busy.delete(agentId);
  }

  // ---- internals ----------------------------------------------------------

  private bump(id: string): void {
    this.tokens.set(id, (this.tokens.get(id) ?? 0) + 1);
  }

  private tokenOf(id: string): number {
    return this.tokens.get(id) ?? 0;
  }

  private delay(ms: number, fn: () => void): void {
    const timer = this.scene.time.delayedCall(ms, () => {
      this.timers.delete(timer);
      fn();
    });
    this.timers.add(timer);
  }

  private isIdleFree(a: AgentSprite): boolean {
    return isManagedStatus(a.status) && !a.isMoving && !this.busy.has(a.id);
  }

  private tick(): void {
    const idle = [...this.opts.getAgents().values()].filter((a) => this.isIdleFree(a));
    if (idle.length === 0) return;

    // Occasionally stage a conversation between two idle agents.
    if (idle.length >= 2 && Math.random() < CONVO_CHANCE) {
      if (this.tryStartChat(idle)) return;
    }

    // Otherwise let some idle agents stretch their legs.
    for (const a of idle) {
      if (Math.random() < WANDER_CHANCE) this.wander(a);
    }
  }

  private blockedWithAgents(exclude?: string): Set<number> {
    const blocked = new Set(this.opts.getBlocked());
    for (const a of this.opts.getAgents().values()) {
      if (a.id === exclude) continue;
      blocked.add(tileKey(a.gridX, a.gridY));
    }
    return blocked;
  }

  private wander(a: AgentSprite): void {
    const blocked = this.blockedWithAgents(a.id);
    const target = this.pickWanderTile(a, blocked);
    if (!target) return;
    const path = findPath({ x: a.gridX, y: a.gridY }, target, blocked);
    if (path.length === 0) return;
    a.walkAlong(path);
  }

  private pickWanderTile(a: AgentSprite, blocked: Set<number>): { x: number; y: number } | null {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const dx = Math.floor((Math.random() * 2 - 1) * WANDER_RADIUS);
      const dy = Math.floor((Math.random() * 2 - 1) * WANDER_RADIUS);
      const x = a.gridX + dx;
      const y = a.gridY + dy;
      if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) continue;
      if (x === a.gridX && y === a.gridY) continue;
      if (blocked.has(tileKey(x, y))) continue;
      return { x, y };
    }
    return null;
  }

  private tryStartChat(idle: AgentSprite[]): boolean {
    // Prefer a pair already standing close together.
    for (let i = 0; i < idle.length; i += 1) {
      for (let j = i + 1; j < idle.length; j += 1) {
        if (manhattan(idle[i], idle[j]) <= CHAT_RADIUS) {
          this.startConversation(idle[i], idle[j]);
          return true;
        }
      }
    }
    // Else sometimes walk one agent over to another to chat.
    if (Math.random() < APPROACH_CHANCE) {
      const a = idle[Math.floor(Math.random() * idle.length)];
      const b = idle[Math.floor(Math.random() * idle.length)];
      if (a !== b) return this.approachAndChat(a, b);
    }
    return false;
  }

  private approachAndChat(a: AgentSprite, b: AgentSprite): boolean {
    const blocked = this.blockedWithAgents(a.id);
    // Aim for a free tile next to b (the goal tile itself is allowed by findPath,
    // but we want to stop adjacent rather than on top of b).
    const spot = this.freeNeighbor(b, blocked) ?? { x: b.gridX, y: b.gridY };
    const path = findPath({ x: a.gridX, y: a.gridY }, spot, blocked);
    if (path.length === 0) {
      this.startConversation(a, b);
      return true;
    }
    this.bump(a.id);
    const token = this.tokenOf(a.id);
    this.busy.add(a.id);
    a.walkAlong(path);
    this.delay(path.length * PER_TILE_MS + 250, () => {
      if (this.tokenOf(a.id) !== token) return;
      this.busy.delete(a.id);
      if (this.isIdleFree(a) && this.isIdleFree(b) && manhattan(a, b) <= CHAT_RADIUS) {
        this.startConversation(a, b);
      }
    });
    return true;
  }

  private freeNeighbor(b: AgentSprite, blocked: Set<number>): { x: number; y: number } | null {
    const dirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    for (const { dx, dy } of dirs) {
      const x = b.gridX + dx;
      const y = b.gridY + dy;
      if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) continue;
      if (blocked.has(tileKey(x, y))) continue;
      return { x, y };
    }
    return null;
  }

  private startConversation(a: AgentSprite, b: AgentSprite): void {
    this.bump(a.id);
    this.bump(b.id);
    const ta = this.tokenOf(a.id);
    const tb = this.tokenOf(b.id);
    this.busy.add(a.id);
    this.busy.add(b.id);

    const prevA = a.status;
    const prevB = b.status;
    a.faceToGrid(b.gridX, b.gridY);
    b.faceToGrid(a.gridX, a.gridY);
    a.setStatus("talking");
    b.setStatus("talking");

    const totalTurns = 2 + Math.floor(Math.random() * 3); // 2–4 lines
    const history: string[] = [];
    const provider = getIdleDialogueProvider();

    const stillOurs = (): boolean => this.tokenOf(a.id) === ta && this.tokenOf(b.id) === tb;

    const finish = (): void => {
      // Only release the "busy" reservation if it's still ours (a real event may
      // have re-claimed the agent), but always clear a dangling "talking" chip —
      // setStatus is a no-op once an authoritative status has replaced it.
      if (this.tokenOf(a.id) === ta) this.busy.delete(a.id);
      if (this.tokenOf(b.id) === tb) this.busy.delete(b.id);
      if (a.status === "talking") a.setStatus(isManagedStatus(prevA) ? prevA : "idle");
      if (b.status === "talking") b.setStatus(isManagedStatus(prevB) ? prevB : "idle");
    };

    const runTurn = (turn: number): void => {
      if (!stillOurs()) {
        finish();
        return;
      }
      if (turn >= totalTurns) {
        finish();
        return;
      }
      const speaker = turn % 2 === 0 ? a : b;
      const listener = turn % 2 === 0 ? b : a;
      const part = (s: AgentSprite) => ({ id: s.id, name: s.name, role: s.role });
      Promise.resolve(
        provider.nextLine({
          speaker: part(speaker),
          listener: part(listener),
          turn,
          totalTurns,
          history: [...history],
        }),
      )
        .then((line) => {
          if (!stillOurs()) {
            finish();
            return;
          }
          speaker.faceToGrid(listener.gridX, listener.gridY);
          speaker.say(line);
          history.push(line);
          this.delay(TURN_MS, () => runTurn(turn + 1));
        })
        .catch(() => finish());
    };

    runTurn(0);
  }
}
