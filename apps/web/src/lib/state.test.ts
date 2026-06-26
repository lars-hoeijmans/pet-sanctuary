import { describe, expect, it } from "vitest";
import { SEED_SNAPSHOT } from "./seed";
import { createInitialState, sanctuaryReducer } from "./state";
import { cloneSeedSnapshot } from "../test/fixtures";

describe("sanctuaryReducer", () => {
  it("pauses every pet and records a pause event", () => {
    const state = sanctuaryReducer(createInitialState(cloneSeedSnapshot()), {
      type: "set_paused",
      paused: true,
      createdAt: "2026-06-26T09:10:00.000Z"
    });

    expect(state.snapshot.paused).toBe(true);
    expect(state.snapshot.pets.every((pet) => pet.status === "paused")).toBe(true);
    expect(state.snapshot.events[0]?.type).toBe("SimulationPaused");
  });

  it("applies a spoken event to the acting pet", () => {
    const seed = cloneSeedSnapshot();
    const actor = seed.pets[0];

    const state = sanctuaryReducer(createInitialState(seed), {
      type: "apply_event",
      event: {
        id: "evt-say-1",
        type: "PetSaid",
        summary: `${actor.name} said hello.`,
        createdAt: "2026-06-26T09:10:06.000Z",
        actorPetId: actor.id,
        significance: "low",
        payload: { message: "Hello, room." }
      }
    });

    const updated = state.snapshot.pets.find((pet) => pet.id === actor.id);
    expect(updated?.currentSpeech?.message).toBe("Hello, room.");
    expect(updated?.status).toBe("socializing");
    expect(state.snapshot.events[0]?.id).toBe("evt-say-1");
  });

  it("swaps in a live snapshot while keeping a still-present selection", () => {
    const initial = createInitialState(cloneSeedSnapshot());
    const selected = initial.selectedPetId;

    const next = sanctuaryReducer(initial, {
      type: "apply_snapshot",
      snapshot: cloneSeedSnapshot(),
      source: "socket"
    });

    expect(next.source).toBe("socket");
    expect(next.selectedPetId).toBe(selected);
    expect(next.loading).toBe(false);
  });

  it("resets back to the canonical seed snapshot", () => {
    const dirtied = sanctuaryReducer(createInitialState(cloneSeedSnapshot()), {
      type: "set_paused",
      paused: true,
      createdAt: "2026-06-26T09:10:06.000Z"
    });

    const reset = sanctuaryReducer(dirtied, { type: "reset_seed" });

    expect(reset.snapshot.events).toEqual(SEED_SNAPSHOT.events);
    expect(reset.snapshot.paused).toBe(false);
    expect(reset.source).toBe("seed-fallback");
  });
});
