/**
 * Tiny typed event emitter used to bridge React/Zustand -> Phaser.
 *
 * React/Zustand owns world state; Phaser only visualizes it. Discrete events
 * (say, build, artifact, …) are forwarded here so the scene can animate them,
 * while steady state is read from the store.
 */
import type { WorldEvent, WorldSnapshot } from "../../protocol/index";

type EventMap = Record<string, unknown>;

export class Emitter<E extends EventMap> {
  private handlers: { [K in keyof E]?: Set<(payload: E[K]) => void> } = {};

  on<K extends keyof E>(type: K, handler: (payload: E[K]) => void): () => void {
    const set = (this.handlers[type] ??= new Set());
    set.add(handler);
    return () => set.delete(handler);
  }

  off<K extends keyof E>(type: K, handler: (payload: E[K]) => void): void {
    this.handlers[type]?.delete(handler);
  }

  emit<K extends keyof E>(type: K, payload: E[K]): void {
    this.handlers[type]?.forEach((handler) => handler(payload));
  }
}

export type WorldBusEvents = {
  "world:event": WorldEvent;
  "world:snapshot": WorldSnapshot;
};

export type SceneBusEvents = {
  "camera:reset": null;
  "camera:focusAgent": string;
};

/** Carries world events + snapshots from the store to the Phaser scene. */
export const worldBus = new Emitter<WorldBusEvents>();

/** Carries camera/UI commands from React controls to the Phaser scene. */
export const sceneBus = new Emitter<SceneBusEvents>();
