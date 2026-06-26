/**
 * PetCoreWorldSource — the live bridge between the agent-city frontend and the
 * pet-core backend (NestJS + Socket.IO + the `@pet-sanctuary/domain` kernel).
 *
 * It implements the same `WorldSource` interface the UI + Phaser scene already
 * speak, so nothing downstream changes. Internally it:
 *   - pulls initial truth over REST (`GET /rooms/{id}`),
 *   - streams live updates over Socket.IO (`/living-room`), and
 *   - maps every pet-core `RoomSnapshot` / `WorldEvent` onto the agent-city
 *     protocol via the pure mappers in `petcoreMapping.ts`.
 *
 * State model (mirrors how the store + scene were designed for MockWorldSource):
 * a full snapshot is pushed on connect / reconnect / reset; between those, each
 * `room:event` is forwarded so the reducer + scene stay in sync and animate.
 * If the backend is unreachable we fall back to a deterministic seed snapshot.
 */
import { io, type Socket } from "socket.io-client";
import type {
  RoomSnapshot as ContractRoomSnapshot,
  WorldEvent as ContractWorldEvent,
} from "@pet-sanctuary/contracts";
import { createSeedRoomSnapshot } from "@pet-sanctuary/domain";
import { API_BASE_URL, ROOM_ID, SOCKET_URL } from "@/lib/sanctuary-client";
import { createPet as apiCreatePet, createTask as apiCreateTask } from "@/lib/manager-client";
import { humanizeEvent, type WorldEvent } from "../../protocol/index";
import type { WorldSource, WorldSourceHandlers } from "./WorldSource";
import { mapEvent, mapSnapshot } from "./petcoreMapping";

interface RoomResponse {
  snapshot: ContractRoomSnapshot;
  simulation?: { paused: boolean };
}

interface RoomUpdate {
  snapshot: ContractRoomSnapshot;
  event?: ContractWorldEvent;
  simulation?: { paused: boolean };
}

export class PetCoreWorldSource implements WorldSource {
  // Reuse the existing "socket" kind so the UI's source-kind gating keeps working.
  readonly kind = "socket" as const;

  private handlers: WorldSourceHandlers | null = null;
  private socket: Socket | null = null;
  private last: ContractRoomSnapshot | null = null;
  private seenEventIds = new Set<string>();

  connect(handlers: WorldSourceHandlers): void {
    this.handlers = handlers;
    handlers.onStatus("connecting");

    // 1) Initial truth via REST — renders immediately even before the socket is up.
    void this.fetchSnapshot()
      .then((snapshot) => this.applySnapshot(snapshot))
      .catch(() => {
        // Offline fallback: the same deterministic seed the server starts from.
        if (!this.handlers) return;
        this.applySnapshot(createSeedRoomSnapshot());
        this.handlers.onStatus("offline");
      });

    // 2) Live stream via Socket.IO.
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 600,
    });
    this.socket = socket;

    socket.on("connect", () => {
      this.handlers?.onStatus("live");
      socket.emit("room:getSnapshot", { roomId: ROOM_ID });
    });
    socket.on("disconnect", () => this.handlers?.onStatus("offline"));
    socket.on("connect_error", () => this.handlers?.onStatus("offline"));

    socket.on("room:snapshot", (response: RoomResponse) => {
      const snapshot = response?.snapshot ?? (response as unknown as ContractRoomSnapshot);
      if (snapshot?.room) this.applySnapshot(snapshot, response?.simulation?.paused);
    });

    socket.on("room:update", (update: RoomUpdate) => {
      if (update?.snapshot?.room) {
        this.last = update.snapshot; // authoritative cache for event lookups
        const paused = update.simulation?.paused ?? update.snapshot.room.paused;
        this.handlers?.onDemoStateChange(!paused);
      }
      // The embedded event is also emitted on `room:event`; dedupe handles both.
      this.handleRawEvent(update?.event);
    });

    socket.on("room:event", (event: ContractWorldEvent) => this.handleRawEvent(event));
  }

  disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.seenEventIds.clear();
    this.handlers?.onStatus("offline");
    this.handlers = null;
  }

  // --- commands ------------------------------------------------------------

  playDemo(): void {
    void this.post("/simulation/resume");
  }

  stopDemo(): void {
    void this.post("/simulation/pause");
  }

  reset(): void {
    void this.post(`/rooms/${ROOM_ID}/reset`)
      .then((body) => {
        const snapshot = (body as RoomResponse | undefined)?.snapshot;
        if (snapshot?.room) {
          this.seenEventIds.clear();
          this.applySnapshot(snapshot);
        }
      })
      .catch(() => {
        /* server unreachable — keep current view */
      });
  }

  createTask(title: string, description: string): void {
    void apiCreateTask({ title, description: description || undefined, riskLevel: "low" }).catch(() => {});
  }

  spawnTestAgent(): void {
    // Server rolls a fresh pet; it arrives back as a PetCreated → agent.register.
    void apiCreatePet({}).catch(() => {});
  }

  sendRandomMessage(): void {
    // No pet-core endpoint for this; the button is hidden outside mock mode.
  }

  buildRandomObject(): void {
    // Object placement is a kernel-validated pet action, not a REST lever; hidden outside mock mode.
  }

  emit(event: WorldEvent): void {
    // Best-effort escape hatch: surface speech / notifications as room events.
    const summary =
      event.type === "world.notification"
        ? event.message
        : event.type === "agent.say"
          ? event.text
          : humanizeEvent(event);
    void this.post(`/rooms/${ROOM_ID}/events`, {
      summary,
      significance: "low",
      metadata: { originalType: event.type },
    }).catch(() => {});
  }

  // --- internals -----------------------------------------------------------

  private applySnapshot(snapshot: ContractRoomSnapshot, paused?: boolean): void {
    if (!this.handlers) return;
    this.last = snapshot;
    this.handlers.onSnapshot(mapSnapshot(snapshot));
    this.handlers.onDemoStateChange(!(paused ?? snapshot.room.paused));
  }

  private handleRawEvent(event: ContractWorldEvent | undefined): void {
    if (!event || this.seenEventIds.has(event.id)) return;
    this.seenEventIds.add(event.id);
    if (this.seenEventIds.size > 1000) {
      this.seenEventIds = new Set([...this.seenEventIds].slice(-500));
    }
    const mapped = mapEvent(event, this.last ?? undefined);
    if (mapped) this.handlers?.onEvent(mapped);
  }

  private async fetchSnapshot(): Promise<ContractRoomSnapshot> {
    const response = await fetch(`${API_BASE_URL}/rooms/${encodeURIComponent(ROOM_ID)}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Snapshot request failed with ${response.status}`);
    const body = (await response.json()) as RoomResponse | ContractRoomSnapshot;
    const snapshot = "snapshot" in body ? body.snapshot : body;
    if (!snapshot?.room) throw new Error("Snapshot response did not include a room");
    return snapshot;
  }

  private async post(path: string, body: unknown = {}): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${path} failed with ${response.status}`);
    if (response.status === 204) return undefined;
    return response.json().catch(() => undefined);
  }
}
