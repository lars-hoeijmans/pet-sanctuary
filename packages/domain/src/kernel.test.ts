import { describe, expect, it } from "vitest";
import {
  applyPetAction,
  buildObservation,
  classifyResponseLevel,
  createSeedRoomSnapshot,
  runDeterministicTick
} from "./kernel.js";

describe("Living Room Kernel domain", () => {
  it("seeds one persistent room with distinct pets, objects, and an initial trace", () => {
    const snapshot = createSeedRoomSnapshot("2026-06-26T12:00:00.000Z");

    expect(snapshot.room.id).toBe("living-room");
    expect(snapshot.pets).toHaveLength(3);
    expect(new Set(snapshot.pets.map((pet) => pet.traits.workStyle)).size).toBe(3);
    expect(snapshot.objects.some((object) => object.type === "desk")).toBe(true);
    expect(snapshot.events[0]).toMatchObject({
      type: "RoomSeeded",
      significance: "high",
      visibility: "room"
    });
  });

  it("builds observations and assigns different response levels for the same significant event", () => {
    const snapshot = createSeedRoomSnapshot("2026-06-26T12:00:00.000Z");
    const levels = snapshot.pets.map((pet) => classifyResponseLevel(snapshot, pet.id, snapshot.events[0] ?? null));

    expect(levels).toContain("social_response");
    expect(levels).toContain("ambient_reaction");
    expect(new Set(levels).size).toBeGreaterThan(1);

    const observation = buildObservation(snapshot, "pet-mochi");
    expect(observation.availableActions).toContain("offer_help");
    expect(observation.nearbyPets.map((pet) => pet.id)).toContain("pet-byte");
  });

  it("rejects invalid actions and records a persistent rejection event without moving the pet", () => {
    const snapshot = createSeedRoomSnapshot("2026-06-26T12:00:00.000Z");
    const result = applyPetAction(
      snapshot,
      "pet-mochi",
      {
        action: "move",
        x: 99,
        y: 99,
        reasonVisible: "Try to leave the room.",
        riskLevel: "low"
      },
      "2026-06-26T12:01:00.000Z"
    );

    expect(result.ok).toBe(false);
    expect(result.snapshot.pets.find((pet) => pet.id === "pet-mochi")?.position).toEqual({ x: 2, y: 4 });
    expect(result.event).toMatchObject({
      type: "ActionRejected",
      actorPetId: "pet-mochi",
      significance: "medium"
    });
  });

  it("runs a deterministic tick that applies validated pet actions and appends visible traces", () => {
    const snapshot = createSeedRoomSnapshot("2026-06-26T12:00:00.000Z");
    const next = runDeterministicTick(snapshot, "2026-06-26T12:01:00.000Z");

    expect(next.room.tick).toBe(1);
    expect(next.events.length).toBeGreaterThan(snapshot.events.length);
    expect(next.events.some((event) => event.type === "SimulationTick")).toBe(true);
    expect(next.events.every((event) => event.roomId === snapshot.room.id)).toBe(true);
  });
});
