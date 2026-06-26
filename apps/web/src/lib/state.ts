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
  | { type: "socket_status"; status: SocketConnectionState; message?: string };

export function createInitialState(snapshot: RoomSnapshot = SEED_SNAPSHOT): SanctuaryState {
  return {
    snapshot,
    selectedPetId: snapshot.pets[0]?.id ?? "",
    source: "seed-fallback",
    loading: true,
    socket: "idle"
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
      return withSnapshot(
        state,
        action.snapshot,
        action.source,
        { loading: false, error: undefined },
        true
      );
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
      return withSnapshot(
        state,
        action.snapshot,
        action.source ?? state.source,
        { loading: false, error: undefined },
        true
      );
    case "apply_event":
      return applyWorldEvent(state, action.event);
    case "set_paused":
      return setPaused(state, action.paused, action.createdAt);
    case "reset_seed":
      return withSnapshot(state, SEED_SNAPSHOT, "seed-fallback", {
        loading: false,
        error: undefined
      });
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
  overrides: Partial<SanctuaryState> = {},
  // Live updates (socket/api) carry no per-pet responseLevel or speech (the
  // contract Pet has neither); those are event-derived. Preserve the prior
  // values for still-present pets so an unrelated snapshot doesn't reset a
  // working pet's response or wipe its active speech bubble. A fresh seed/reset
  // deliberately does NOT preserve (it should restore defaults).
  preservePetView = false
): SanctuaryState {
  const selectedPetStillExists = snapshot.pets.some((pet) => pet.id === state.selectedPetId);

  let nextSnapshot = snapshot;
  if (preservePetView) {
    const priorById = new Map(state.snapshot.pets.map((pet) => [pet.id, pet]));
    nextSnapshot = {
      ...snapshot,
      pets: snapshot.pets.map((pet) => {
        const prior = priorById.get(pet.id);
        return prior
          ? { ...pet, responseLevel: prior.responseLevel, currentSpeech: prior.currentSpeech }
          : pet;
      })
    };
  }

  return {
    ...state,
    snapshot: nextSnapshot,
    source,
    selectedPetId: selectedPetStillExists ? state.selectedPetId : nextSnapshot.pets[0]?.id ?? "",
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
