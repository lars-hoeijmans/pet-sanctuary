import { describe, expect, it } from "vitest";
import {
  applyPetAction,
  buildObservation,
  classifyResponseLevel,
  createRoomNoticeEvent,
  createSeedRoomSnapshot,
  processWorldEvent,
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

  it("moves a pet fully to an object with move_to action", () => {
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
        reasonVisible: "Mochi moves fully to the green couch.",
        riskLevel: "low"
      },
      "2026-06-26T12:05:00.000Z"
    );

    expect(result.ok).toBe(true);
    expect(result.snapshot.pets.find((pet) => pet.id === "pet-mochi")?.position).toEqual({ x: 3, y: 5 });
    expect(result.event.type).toBe("PetMoved");
    expect(result.event.payload.targetObjectId).toBe("obj-green-couch");
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
