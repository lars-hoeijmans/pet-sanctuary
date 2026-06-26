import { describe, expect, it } from "vitest";
import {
  advanceLocomotion,
  applyPetAction,
  buildObservation,
  classifyResponseLevel,
  createRoomNoticeEvent,
  createSeedRoomSnapshot,
  processWorldEvent,
  runDeterministicTick
} from "./kernel.js";
import { findPath } from "./helpers.js";

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

  it("processes a high-significance room event through every active pet perception", () => {
    const snapshot = createSeedRoomSnapshot("2026-06-26T12:00:00.000Z");
    const notice = createRoomNoticeEvent(
      snapshot,
      {
        summary: "A developer dropped a trace-polish task into the room.",
        significance: "high",
        metadata: { source: "test" }
      },
      "2026-06-26T12:02:00.000Z"
    );

    const result = processWorldEvent(snapshot, notice, "2026-06-26T12:02:00.000Z");

    const perceptions = result.events.filter((event) => event.type === "PetObserved");
    const actionEvents = result.events.filter((event) =>
      ["PetMoved", "PetSaid", "PetOfferedHelp", "PetStartedWork"].includes(event.type)
    );

    expect(result.events[0]).toMatchObject({
      id: notice.id,
      type: "RoomNotice",
      significance: "high"
    });
    expect(perceptions).toHaveLength(snapshot.pets.length);
    expect(new Set(perceptions.map((event) => event.actorPetId))).toEqual(
      new Set(snapshot.pets.map((pet) => pet.id))
    );
    expect(perceptions.map((event) => event.payload.responseLevel)).toEqual(
      expect.arrayContaining(["social_response", "ambient_reaction", "internal_reaction"])
    );
    expect(actionEvents.length).toBeGreaterThan(0);
    expect(result.snapshot.events).toHaveLength(snapshot.events.length + result.events.length);
  });

  it("does not ask observe-only or internal reactions to mutate world state", () => {
    const snapshot = createSeedRoomSnapshot("2026-06-26T12:00:00.000Z");
    const notice = createRoomNoticeEvent(
      snapshot,
      {
        summary: "A developer asked pets to inspect the event cascade.",
        significance: "high"
      },
      "2026-06-26T12:03:00.000Z"
    );
    const proposedByPet: string[] = [];

    processWorldEvent(snapshot, notice, "2026-06-26T12:03:00.000Z", {
      chooseAction: (observation) => {
        proposedByPet.push(observation.pet.id);
        return null;
      }
    });

    expect(proposedByPet).toEqual(["pet-mochi", "pet-nova"]);
    expect(proposedByPet).not.toContain("pet-byte");
  });

  it("move_to sets a destination + path without teleporting, then physics walks it tile by tile", () => {
    const snapshot = createSeedRoomSnapshot("2026-06-26T12:00:00.000Z");
    const mochi = snapshot.pets.find((pet) => pet.id === "pet-mochi")!;
    const greenCouch = snapshot.objects.find((obj) => obj.id === "obj-green-couch")!;

    expect(mochi.position).toEqual({ x: 2, y: 4 });
    expect(greenCouch.position).toEqual({ x: 3, y: 5 });

    const result = applyPetAction(
      snapshot,
      "pet-mochi",
      {
        action: "move_to",
        targetObjectId: "obj-green-couch",
        reasonVisible: "Mochi heads for the green couch.",
        riskLevel: "low"
      },
      "2026-06-26T12:05:00.000Z"
    );

    expect(result.ok).toBe(true);
    const heading = result.snapshot.pets.find((pet) => pet.id === "pet-mochi")!;
    // Course is set; position is unchanged this tick (no teleport).
    expect(heading.position).toEqual({ x: 2, y: 4 });
    expect(heading.destination).toEqual({ x: 3, y: 5 });
    expect(heading.path.length).toBe(2); // (2,4) -> (3,4) -> (3,5)
    expect(heading.status).toBe("moving");
    expect(result.event.type).toBe("PetMoved");
    expect(result.event.payload.targetObjectId).toBe("obj-green-couch");

    // Tick 1 of physics: one tile closer, still en route.
    const step1 = advanceLocomotion(result.snapshot, "2026-06-26T12:05:10.000Z");
    const afterStep1 = step1.snapshot.pets.find((pet) => pet.id === "pet-mochi")!;
    expect(afterStep1.position).toEqual({ x: 3, y: 4 });
    expect(afterStep1.path.length).toBe(1);
    expect(afterStep1.destination).toEqual({ x: 3, y: 5 });
    expect(step1.events.some((event) => event.type === "PetMoved")).toBe(true);
    expect(step1.events.some((event) => event.type === "PetArrived")).toBe(false);

    // Tick 2 of physics: arrival — position reached, destination cleared, event fired.
    const step2 = advanceLocomotion(step1.snapshot, "2026-06-26T12:05:20.000Z");
    const arrived = step2.snapshot.pets.find((pet) => pet.id === "pet-mochi")!;
    expect(arrived.position).toEqual({ x: 3, y: 5 });
    expect(arrived.path).toEqual([]);
    expect(arrived.destination).toBeNull();
    expect(arrived.status).toBe("idle");
    expect(step2.events.some((event) => event.type === "PetArrived")).toBe(true);
  });

  it("findPath returns a deterministic route excluding the start and including the target", () => {
    const room = { width: 12, height: 8 };
    const path = findPath({ x: 2, y: 4 }, { x: 3, y: 5 }, room);
    expect(path).toEqual([
      { x: 3, y: 4 },
      { x: 3, y: 5 }
    ]);
    // Manhattan distance = path length.
    expect(findPath({ x: 0, y: 0 }, { x: 5, y: 3 }, room).length).toBe(8);
    // Same tile => empty path.
    expect(findPath({ x: 1, y: 1 }, { x: 1, y: 1 }, room)).toEqual([]);
  });

  it("keeps invalid proposed actions non-mutating and visible in the event cascade", () => {
    const snapshot = createSeedRoomSnapshot("2026-06-26T12:00:00.000Z");
    const notice = createRoomNoticeEvent(
      snapshot,
      {
        summary: "A developer asked for an intentionally risky move proposal.",
        significance: "high"
      },
      "2026-06-26T12:04:00.000Z"
    );

    const result = processWorldEvent(snapshot, notice, "2026-06-26T12:04:00.000Z", {
      chooseAction: (observation) =>
        observation.pet.id === "pet-mochi"
          ? {
              action: "move",
              x: 999,
              y: 999,
              reasonVisible: "This move should be rejected by room bounds.",
              riskLevel: "low"
            }
          : null
    });

    expect(result.snapshot.pets.find((pet) => pet.id === "pet-mochi")?.position).toEqual({
      x: 2,
      y: 4
    });
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "ActionRejected",
          actorPetId: "pet-mochi",
          payload: expect.objectContaining({
            triggeringEventId: notice.id,
            responseLevel: "social_response"
          })
        })
      ])
    );
  });
});
