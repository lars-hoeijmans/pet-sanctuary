/**
 * WorldSource — the seam between the UI and "where world events come from".
 *
 * Today the active implementation is MockWorldSource (randomized resident agents,
 * fully client-side, no backend). Tomorrow a colleague can drop in a real
 * Society Server via SocketWorldSource — every UI lever, panel and animation
 * already speaks this interface, so nothing else has to change.
 */
import type { WorldEvent, WorldSnapshot } from "../../protocol/index";

export type ConnectionStatus = "connecting" | "live" | "offline";

export interface WorldSourceHandlers {
  /** Full snapshot replace (sent on connect / reset). */
  onSnapshot: (snapshot: WorldSnapshot) => void;
  /** A single validated world event to apply + animate. */
  onEvent: (event: WorldEvent) => void;
  /** Connection lifecycle for the status pill. */
  onStatus: (status: ConnectionStatus) => void;
  /** Whether the deterministic demo is currently running. */
  onDemoStateChange: (playing: boolean) => void;
}

/**
 * Command surface — these are the "tools and levers" the frontend exposes.
 * In mock mode they drive the local simulation; in socket mode they POST to the
 * Society Server. The UI never mutates world state directly — it calls these.
 */
export interface WorldCommands {
  playDemo: () => void;
  stopDemo: () => void;
  reset: () => void;
  createTask: (title: string, description: string, createdByAgentId?: string) => void;
  spawnTestAgent: () => void;
  sendRandomMessage: () => void;
  buildRandomObject: () => void;
  /** Generic escape hatch — push any protocol event (used by the command palette). */
  emit: (event: WorldEvent) => void;
}

export interface WorldSource extends WorldCommands {
  readonly kind: "mock" | "socket";
  connect: (handlers: WorldSourceHandlers) => void;
  disconnect: () => void;
}
