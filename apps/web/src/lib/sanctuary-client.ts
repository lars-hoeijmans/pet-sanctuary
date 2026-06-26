import { io, type Socket } from "socket.io-client";
import type {
  Pet,
  ResponseLevel,
  RoomObject,
  RoomSnapshot,
  SanctuaryContractEvent,
  SanctuaryContractObject,
  SanctuaryContractPet,
  SanctuaryContractSnapshot,
  WorldEvent
} from "./contracts";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_SANCTUARY_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
export const SOCKET_URL =
  process.env.NEXT_PUBLIC_SANCTUARY_SOCKET_URL?.replace(/\/$/, "") ??
  `${API_BASE_URL}/living-room`;

export const ROOM_ID = process.env.NEXT_PUBLIC_SANCTUARY_ROOM_ID ?? "main";

type SimulationStatus = {
  paused: boolean;
  tick: number;
  tickIntervalMs: number;
};

type RoomResponse = {
  snapshot: SanctuaryContractSnapshot;
  simulation: SimulationStatus;
};

type RoomUpdate = {
  snapshot: SanctuaryContractSnapshot;
  event?: SanctuaryContractEvent;
  simulation: SimulationStatus;
};

export type LiveHandlers = {
  onConnect: () => void;
  onDisconnect: () => void;
  onError: (message: string) => void;
  onSnapshot: (snapshot: RoomSnapshot) => void;
  onEvent: (event: WorldEvent) => void;
};

export async function fetchRoomSnapshot(roomId = ROOM_ID): Promise<RoomSnapshot> {
  const response = await fetch(`${API_BASE_URL}/rooms/${encodeURIComponent(roomId)}`, {
    headers: {
      accept: "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Snapshot request failed with ${response.status}`);
  }

  return normalizeRoomResponse(await response.json());
}

export async function setSimulationPaused(paused: boolean): Promise<RoomSnapshot | undefined> {
  const response = await fetch(`${API_BASE_URL}/simulation/${paused ? "pause" : "resume"}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify({ paused })
  });

  if (!response.ok) {
    throw new Error(`Pause request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined;
  }

  const body = await response.json();
  return normalizeRoomResponse(body);
}

export async function resetRoomToSeed(roomId = ROOM_ID): Promise<RoomSnapshot> {
  const response = await fetch(`${API_BASE_URL}/rooms/${encodeURIComponent(roomId)}/reset`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    throw new Error(`Reset request failed with ${response.status}`);
  }

  return normalizeRoomResponse(await response.json());
}

export async function triggerMeaningfulRoomEvent(roomId = ROOM_ID): Promise<RoomSnapshot> {
  const response = await fetch(`${API_BASE_URL}/rooms/${encodeURIComponent(roomId)}/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify({
      summary: "A developer posted a trace-polish task for the whole room.",
      significance: "high",
      metadata: {
        source: "placeholder-ui"
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Room event request failed with ${response.status}`);
  }

  return normalizeRoomResponse(await response.json());
}

export function connectRoomSocket(handlers: LiveHandlers, roomId = ROOM_ID): Socket {
  const socket = io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 600
  });

  socket.on("connect", handlers.onConnect);
  socket.on("disconnect", handlers.onDisconnect);
  socket.on("connect_error", (error) => handlers.onError(error.message));
  socket.on("exception", (error) => handlers.onError(readErrorMessage(error)));

  socket.on("connect", () => socket.emit("room:getSnapshot", { roomId }));

  socket.on("room:snapshot", (response) => handlers.onSnapshot(normalizeRoomResponse(response)));
  socket.on("room:update", (update) => handlers.onSnapshot(normalizeRoomUpdate(update)));
  socket.on("room:event", (event) => handlers.onEvent(normalizeEvent(event)));

  socket.on("snapshot", (response) => handlers.onSnapshot(normalizeRoomResponse(response)));
  socket.on("world:event", (event) => handlers.onEvent(normalizeEvent(event)));

  return socket;
}

function normalizeRoomResponse(value: unknown): RoomSnapshot {
  const response = value as Partial<RoomResponse> | Partial<SanctuaryContractSnapshot>;
  const snapshot = "snapshot" in response ? response.snapshot : response;

  return normalizeContractSnapshot(snapshot as SanctuaryContractSnapshot);
}

function normalizeRoomUpdate(value: unknown): RoomSnapshot {
  const update = value as RoomUpdate;
  return normalizeContractSnapshot(update.snapshot);
}

export function normalizeContractSnapshot(snapshot: SanctuaryContractSnapshot): RoomSnapshot {
  if (!snapshot?.room) {
    throw new Error("Snapshot response did not include a room");
  }

  const pets = Array.isArray(snapshot.pets) ? snapshot.pets : [];
  const objects = Array.isArray(snapshot.objects) ? snapshot.objects : [];
  const events = Array.isArray(snapshot.events) ? snapshot.events : [];

  return {
    roomId: snapshot.room.id,
    roomName: snapshot.room.name,
    grid: {
      width: snapshot.room.width,
      height: snapshot.room.height
    },
    paused: snapshot.room.paused,
    pets: pets.map(toViewPet),
    objects: objects.map(toViewObject),
    events: events.map(normalizeEvent).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    updatedAt: events.at(-1)?.timestamp ?? new Date().toISOString()
  };
}

/** Normalize a single contract event into the UI view-model event. */
export function normalizeContractEvent(event: SanctuaryContractEvent): WorldEvent {
  return normalizeEvent(event);
}

function normalizeEvent(value: unknown): WorldEvent {
  const event = value as SanctuaryContractEvent;
  const payload: WorldEvent["payload"] = {};
  if (typeof event.payload.message === "string") {
    payload.message = event.payload.message;
  }
  if (event.targetPetId) {
    payload.targetPetId = event.targetPetId;
  }
  if (event.targetId) {
    payload.objectId = event.targetId;
  }

  const normalized: WorldEvent = {
    id: event.id,
    type: event.type,
    summary: summarizeEvent(event),
    createdAt: event.timestamp,
    significance: event.significance
  };

  if (event.actorPetId) {
    normalized.actorPetId = event.actorPetId;
  }

  const responseLevel = readResponseLevel(event);
  if (responseLevel) {
    normalized.responseLevel = responseLevel;
  }

  if (Object.keys(payload).length > 0) {
    normalized.payload = payload;
  }

  return normalized;
}

function toViewPet(pet: SanctuaryContractPet): Pet {
  return {
    id: pet.id,
    name: pet.name,
    avatar: initialsFor(pet.name),
    accent: accentFor(pet.id),
    tagline: pet.tagline,
    traits: [
      pet.traits.temperament,
      pet.traits.workStyle,
      pet.traits.socialStyle,
      pet.traits.riskProfile,
      pet.traits.aesthetic
    ],
    personalitySummary: pet.personalitySummary,
    speakingStyle: pet.speakingStyle,
    status: pet.status,
    responseLevel: "observe_only",
    karma: pet.karma,
    permissions: Object.entries(pet.permissions)
      .filter(([, allowed]) => allowed)
      .map(([permission]) =>
        permission
          .replace(/^can/, "")
          .replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
          .replace(/^_/, "")
      ),
    position: pet.position,
    memoryStub: pet.memory.summary,
    currentSpeech: undefined
  };
}

function toViewObject(object: SanctuaryContractObject): RoomObject {
  const kind = object.type === "couch" ? "seat" : object.type === "lamp" ? "lamp" : object.type === "desk" ? "desk" : "notice";

  return {
    id: object.id,
    label: labelForObject(object),
    kind,
    type: object.type,
    position: object.position,
    width: kind === "desk" || kind === "seat" ? 2 : 1,
    height: 1,
    state: Object.values(object.state)
      .filter((value): value is string => typeof value === "string")
      .join(", ")
  };
}

function summarizeEvent(event: SanctuaryContractEvent) {
  if (typeof event.payload.summary === "string") {
    return event.payload.summary;
  }

  if (typeof event.payload.message === "string") {
    return event.payload.message;
  }

  return event.type.replaceAll(/([a-z])([A-Z])/g, "$1 $2");
}

function readResponseLevel(event: SanctuaryContractEvent): ResponseLevel | undefined {
  const value = event.payload.responseLevel;
  return isResponseLevel(value) ? value : undefined;
}

function isResponseLevel(value: unknown): value is ResponseLevel {
  return (
    value === "observe_only" ||
    value === "internal_reaction" ||
    value === "ambient_reaction" ||
    value === "social_response" ||
    value === "task_action"
  );
}

function labelForObject(object: SanctuaryContractObject) {
  return object.description.split(" ").slice(0, 3).join(" ");
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function accentFor(id: string) {
  const palette = ["#4fb286", "#f26d5b", "#f2c14e", "#4381c1"];
  const index = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;
  return palette[index] ?? palette[0];
}

function readErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return "Socket error";
}
