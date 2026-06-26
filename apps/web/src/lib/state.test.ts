import { describe, expect, it } from "vitest";
import { SEED_SNAPSHOT } from "./seed";
import { createInitialState, sanctuaryReducer } from "./state";
import { cloneSeedSnapshot } from "../test/fixtures";

describe("sanctuaryReducer", () => {
  it("keeps deterministic fallback ticks paused when the room is paused", () => {
    const state = sanctuaryReducer(createInitialState(cloneSeedSnapshot()), {
      type: "set_paused",
      paused: true,
      createdAt: "2026-06-26T09:10:00.000Z"
    });

    const ticked = sanctuaryReducer(state, {
      type: "local_tick",
      createdAt: "2026-06-26T09:10:06.000Z"
    });

    expect(ticked.localTick).toBe(0);
    expect(ticked.snapshot.events[0]?.type).toBe("SimulationPaused");
  });

  it("applies the deterministic local script when using seed fallback", () => {
    const state = sanctuaryReducer(createInitialState(cloneSeedSnapshot()), {
      type: "load_error",
      message: "offline"
    });

    const ticked = sanctuaryReducer(state, {
      type: "local_tick",
      createdAt: "2026-06-26T09:10:06.000Z"
    });

    expect(ticked.localTick).toBe(1);
    expect(ticked.snapshot.events[0]?.id).toBe("local-tick-1");
    expect(ticked.snapshot.pets.find((pet) => pet.id === "pet-pip")?.currentSpeech?.message).toBe(
      "Lamp flicker reproduced. Reversible, logged, suspicious."
    );
  });

  it("resets back to the canonical seed snapshot", () => {
    const ticked = sanctuaryReducer(createInitialState(cloneSeedSnapshot()), {
      type: "local_tick",
      createdAt: "2026-06-26T09:10:06.000Z"
    });

    const reset = sanctuaryReducer(ticked, { type: "reset_seed" });

    expect(reset.snapshot.events).toEqual(SEED_SNAPSHOT.events);
    expect(reset.localTick).toBe(0);
    expect(reset.source).toBe("seed-fallback");
  });
});
