import { describe, expect, it } from "vitest";
import { digestEvents } from "./prompts.js";
import type { WorldEvent } from "@pet-sanctuary/contracts";

function makeEvent(overrides: Partial<WorldEvent> & { type: WorldEvent["type"] }): WorldEvent {
  return {
    id: "evt_1",
    roomId: "room_1",
    timestamp: new Date().toISOString(),
    actorPetId: "pet_1",
    targetPetId: null,
    targetId: null,
    payload: {},
    visibility: "room",
    significance: "low",
    ...overrides
  };
}

describe("digestEvents", () => {
  it("returns (quiet) for empty events", () => {
    expect(digestEvents([])).toBe("(quiet)");
  });

  it("groups identical event types with count", () => {
    const events = [
      makeEvent({ type: "PetSaid" }),
      makeEvent({ type: "PetSaid" }),
      makeEvent({ type: "PetMoved" }),
    ];
    expect(digestEvents(events)).toMatch(/PetSaid x2/);
    expect(digestEvents(events)).toMatch(/PetMoved x1/);
  });

  it("includes summary for single events with payload summary", () => {
    const events = [
      makeEvent({ type: "TaskCompleted", payload: { summary: "Fixed the bug" } }),
    ];
    expect(digestEvents(events)).toBe("TaskCompleted: Fixed the bug");
  });

  it("respects max limit", () => {
    const events = Array.from({ length: 20 }, (_, i) =>
      makeEvent({ type: "SimulationTick", timestamp: new Date(2025, 0, i).toISOString() })
    );
    expect(digestEvents(events, 3)).toMatch(/SimulationTick x3/);
  });

  it("sorts by timestamp descending", () => {
    const old = makeEvent({ type: "PetSaid", timestamp: "2025-01-01T00:00:00Z", payload: { summary: "old message" } });
    const recent = makeEvent({ type: "PetSaid", timestamp: "2025-06-01T00:00:00Z", payload: { summary: "recent message" } });
    const result = digestEvents([old, recent]);
    expect(result).toBe("PetSaid x2");
  });
});
