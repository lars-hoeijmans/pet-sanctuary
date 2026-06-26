import type {
  Pet,
  RoomSnapshot,
  SnapshotSource,
  SocketConnectionState,
  WorldEvent
} from "./contracts";
import { SEED_SNAPSHOT } from "./seed";

export type SanctuaryState = {
  snapshot: RoomSnapshot;
  selectedPetId: string;
  source: SnapshotSource;
  loading: boolean;
  error?: string;
  socket: SocketConnectionState;
  localTick: number;
};

export type SanctuaryAction =
  | { type: "load_start" }
  | { type: "load_success"; snapshot: RoomSnapshot; source: SnapshotSource }
  | { type: "load_error"; message: string }
  | { type: "select_pet"; petId: string }
  | { type: "apply_snapshot"; snapshot: RoomSnapshot; source?: SnapshotSource }
  | { type: "apply_event"; event: WorldEvent }
  | { type: "set_paused"; paused: boolean; createdAt: string }
  | { type: "reset_seed" }
  | { type: "local_tick"; createdAt: string }
  | { type: "socket_status"; status: SocketConnectionState; message?: string };

export function createInitialState(snapshot: RoomSnapshot = SEED_SNAPSHOT): SanctuaryState {
  return {
    snapshot,
    selectedPetId: snapshot.pets[0]?.id ?? "",
    source: "seed-fallback",
    loading: true,
    socket: "idle",
    localTick: 0
  };
}

export function sanctuaryReducer(
  state: SanctuaryState,
  action: SanctuaryAction
): SanctuaryState {
  switch (action.type) {
    case "load_start":
      return { ...state, loading: true, error: undefined };
    case "load_success":
      return withSnapshot(state, action.snapshot, action.source, {
        loading: false,
        error: undefined
      });
    case "load_error":
      return {
        ...state,
        loading: false,
        source: "seed-fallback",
        error: action.message
      };
    case "select_pet":
      return { ...state, selectedPetId: action.petId };
    case "apply_snapshot":
      return withSnapshot(state, action.snapshot, action.source ?? state.source, {
        loading: false,
        error: undefined
      });
    case "apply_event":
      return applyWorldEvent(state, action.event);
    case "set_paused":
      return setPaused(state, action.paused, action.createdAt);
    case "reset_seed":
      return withSnapshot(state, SEED_SNAPSHOT, "seed-fallback", {
        loading: false,
        error: undefined,
        localTick: 0
      });
    case "local_tick":
      return applyLocalTick(state, action.createdAt);
    case "socket_status":
      return {
        ...state,
        socket: action.status,
        error: action.message ?? state.error
      };
    default:
      return state;
  }
}

function withSnapshot(
  state: SanctuaryState,
  snapshot: RoomSnapshot,
  source: SnapshotSource,
  overrides: Partial<SanctuaryState> = {}
): SanctuaryState {
  const selectedPetStillExists = snapshot.pets.some((pet) => pet.id === state.selectedPetId);

  return {
    ...state,
    snapshot,
    source,
    selectedPetId: selectedPetStillExists ? state.selectedPetId : snapshot.pets[0]?.id ?? "",
    ...overrides
  };
}

function applyWorldEvent(state: SanctuaryState, event: WorldEvent): SanctuaryState {
  const pets = state.snapshot.pets.map((pet) => applyEventToPet(pet, event));
  const events = [event, ...state.snapshot.events.filter((item) => item.id !== event.id)].slice(
    0,
    80
  );

  return {
    ...state,
    snapshot: {
      ...state.snapshot,
      pets,
      events,
      updatedAt: event.createdAt
    }
  };
}

function setPaused(state: SanctuaryState, paused: boolean, createdAt: string): SanctuaryState {
  const event: WorldEvent = {
    id: `local-pause-${paused ? "on" : "off"}-${createdAt}`,
    type: paused ? "SimulationPaused" : "SimulationResumed",
    summary: paused ? "Simulation paused." : "Simulation resumed.",
    createdAt,
    significance: "medium"
  };

  const pets: Pet[] = state.snapshot.pets.map((pet) => ({
    ...pet,
    status: paused ? "paused" : pet.status === "paused" ? "observing" : pet.status
  }));

  return {
    ...state,
    snapshot: {
      ...state.snapshot,
      paused,
      pets,
      events: [event, ...state.snapshot.events].slice(0, 80),
      updatedAt: createdAt
    }
  };
}

function applyLocalTick(state: SanctuaryState, createdAt: string): SanctuaryState {
  if (state.snapshot.paused || state.source !== "seed-fallback") {
    return state;
  }

  const nextTick = state.localTick + 1;
  const script = LOCAL_TICK_SCRIPT[(nextTick - 1) % LOCAL_TICK_SCRIPT.length];
  const event: WorldEvent = {
    id: `local-tick-${nextTick}`,
    type: script.type,
    summary: script.summary,
    createdAt,
    actorPetId: script.petId,
    responseLevel: script.responseLevel,
    significance: script.significance,
    payload: script.message ? { message: script.message } : undefined
  };

  const pets = state.snapshot.pets.map((pet) => {
    if (pet.id !== script.petId) {
      return pet;
    }

    return {
      ...pet,
      status: script.status,
      responseLevel: script.responseLevel,
      position: clampPosition(
        {
          x: pet.position.x + script.move.x,
          y: pet.position.y + script.move.y
        },
        state.snapshot.grid.width,
        state.snapshot.grid.height
      ),
      currentSpeech: script.message
        ? {
            message: script.message,
            createdAt
          }
        : pet.currentSpeech
    };
  });

  return {
    ...state,
    localTick: nextTick,
    snapshot: {
      ...state.snapshot,
      pets,
      events: [event, ...state.snapshot.events].slice(0, 80),
      updatedAt: createdAt
    }
  };
}

function applyEventToPet(pet: Pet, event: WorldEvent): Pet {
  if (event.actorPetId !== pet.id) {
    return pet;
  }

  if (event.type === "PetSaid" && event.payload?.message) {
    return {
      ...pet,
      status: "socializing",
      responseLevel: event.responseLevel ?? pet.responseLevel,
      currentSpeech: {
        message: event.payload.message,
        createdAt: event.createdAt
      }
    };
  }

  if (event.type === "PetStartedWork") {
    return {
      ...pet,
      status: "working",
      responseLevel: event.responseLevel ?? "task_action"
    };
  }

  if (event.type === "PetMoved") {
    return {
      ...pet,
      status: "moving",
      responseLevel: event.responseLevel ?? "ambient_reaction"
    };
  }

  return {
    ...pet,
    responseLevel: event.responseLevel ?? pet.responseLevel
  };
}

function clampPosition(position: { x: number; y: number }, width: number, height: number) {
  return {
    x: Math.max(0, Math.min(width - 1, position.x)),
    y: Math.max(0, Math.min(height - 1, position.y))
  };
}

const LOCAL_TICK_SCRIPT: Array<{
  petId: string;
  type: WorldEvent["type"];
  summary: string;
  message?: string;
  status: Pet["status"];
  responseLevel: Pet["responseLevel"];
  significance: WorldEvent["significance"];
  move: { x: number; y: number };
}> = [
  {
    petId: "pet-pip",
    type: "PetSaid",
    summary: "Pip flagged the flickering lamp as a reversible object event.",
    message: "Lamp flicker reproduced. Reversible, logged, suspicious.",
    status: "reacting",
    responseLevel: "ambient_reaction",
    significance: "low",
    move: { x: 1, y: -1 }
  },
  {
    petId: "pet-mochi",
    type: "PetSaid",
    summary: "Mochi summarized the latest room activity for the pets.",
    message: "Three events, no unsafe actions, state is still tidy.",
    status: "observing",
    responseLevel: "social_response",
    significance: "medium",
    move: { x: 1, y: 0 }
  },
  {
    petId: "pet-nova",
    type: "PetStartedWork",
    summary: "Nova moved closer to the build desk and continued deterministic work.",
    message: "I am keeping this deterministic until the API takes over.",
    status: "working",
    responseLevel: "task_action",
    significance: "medium",
    move: { x: -1, y: 0 }
  },
  {
    petId: "pet-pip",
    type: "PetOfferedHelp",
    summary: "Pip offered Mochi a compact event-feed check.",
    message: "Mochi, I can watch for duplicate event IDs.",
    status: "helping",
    responseLevel: "social_response",
    significance: "medium",
    move: { x: 0, y: 1 }
  }
];
