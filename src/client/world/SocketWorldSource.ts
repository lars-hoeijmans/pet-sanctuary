/**
 * SocketWorldSource — the real-backend implementation of WorldSource.
 *
 * This is a fully-wired STUB: it speaks the exact protocol the Society Server
 * is specced to emit (world:snapshot / world:event) and POSTs commands to the
 * documented REST endpoints. It is not active by default (the app uses
 * MockWorldSource) — set VITE_WORLD_SOURCE=socket and run a world-server to use it.
 *
 * When a colleague stands up the backend + real agents, this is the only file
 * that needs to "go live" — the UI, store, panels and Phaser scene are unchanged.
 */
import { safeParseWorldEvent, type WorldEvent, type WorldSnapshot } from "../../protocol/index";
import type { WorldSource, WorldSourceHandlers } from "./WorldSource";
import { createSocket, postJson } from "../realtime/socketClient";
import type { Socket } from "socket.io-client";

export class SocketWorldSource implements WorldSource {
  readonly kind = "socket" as const;

  private socket: Socket | null = null;
  private handlers: WorldSourceHandlers | null = null;

  constructor(private readonly baseUrl: string) {}

  connect(handlers: WorldSourceHandlers): void {
    this.handlers = handlers;
    handlers.onStatus("connecting");

    const socket = createSocket(this.baseUrl);
    this.socket = socket;

    socket.on("connect", () => handlers.onStatus("live"));
    socket.on("disconnect", () => handlers.onStatus("offline"));
    socket.on("connect_error", () => handlers.onStatus("connecting"));

    socket.on("world:snapshot", (snapshot: WorldSnapshot) => handlers.onSnapshot(snapshot));
    socket.on("world:reset", (snapshot: WorldSnapshot) => handlers.onSnapshot(snapshot));
    socket.on("world:event", (raw: unknown) => {
      const event = safeParseWorldEvent(raw);
      if (event) handlers.onEvent(event);
      else console.warn("[SocketWorldSource] dropped invalid event from server", raw);
    });
  }

  disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.handlers?.onStatus("offline");
    this.handlers = null;
  }

  playDemo(): void {
    void postJson(this.baseUrl, "/api/demo/play");
  }

  stopDemo(): void {
    void postJson(this.baseUrl, "/api/demo/stop");
  }

  reset(): void {
    void postJson(this.baseUrl, "/api/demo/reset");
  }

  createTask(title: string, description: string, createdByAgentId?: string): void {
    void postJson(this.baseUrl, "/api/tasks", { title, description, createdByAgentId });
  }

  spawnTestAgent(): void {
    void postJson(this.baseUrl, "/api/agents/register", {
      id: `test-agent-${Date.now()}`,
      name: "Test Agent",
      role: "Visitor",
      avatar: "default",
      color: "#22d3ee",
      runtime: "mock",
    });
  }

  sendRandomMessage(): void {
    // The server owns "random" semantics; the UI just asks for one.
    void postJson(this.baseUrl, "/api/demo/random-message");
  }

  buildRandomObject(): void {
    void postJson(this.baseUrl, "/api/demo/random-build");
  }

  emit(event: WorldEvent): void {
    // Prefer the socket channel if connected; fall back to REST.
    if (this.socket?.connected) this.socket.emit("world:event", event);
    else void postJson(this.baseUrl, "/api/world/events", event);
  }
}
