import { describe, expect, it } from "vitest";
import type { RoomSnapshot, WorldObject } from "@pet-sanctuary/contracts";
import { applyPetAction, createSeedRoomSnapshot } from "./kernel.js";
import { MAX_ROOM_DENSITY, TYPE_CAPS, canPlaceObject } from "./placement.js";

const base = createSeedRoomSnapshot("2026-06-26T12:00:00.000Z");

function testObject(type: string, x: number, y: number, index: number): WorldObject {
  return {
    id: `test-${type}-${index}`,
    roomId: base.room.id,
    type,
    position: { x, y },
    state: {},
    ownerPetId: null,
    description: `A test ${type}.`
  };
}

function withExtraObjects(extra: WorldObject[]): RoomSnapshot {
  return { ...base, objects: [...base.objects, ...extra] };
}

describe("canPlaceObject", () => {
  it("allows a fresh object on an empty, uncrowded tile", () => {
    expect(canPlaceObject(base, "plant", { x: 5, y: 5 })).toEqual({ ok: true });
  });

  it("rejects placing on an already-occupied tile (the seed couch sits at 3,5)", () => {
    const result = canPlaceObject(base, "plant", { x: 3, y: 5 });
    expect(result.ok).toBe(false);
  });

  it("rejects placing on a tile a pet is standing on (pet-byte sits at 5,3)", () => {
    const result = canPlaceObject(base, "plant", { x: 5, y: 3 });
    expect(result.ok).toBe(false);
  });

  it("enforces the per-type cap so a room cannot fill up with one type", () => {
    const cap = TYPE_CAPS.couch ?? 0;
    // The seed already has one couch; add (cap - 1) more to reach the cap.
    const fillers = Array.from({ length: cap - 1 }, (_, i) => testObject("couch", 5 + i, 7, i));
    const result = canPlaceObject(withExtraObjects(fillers), "couch", { x: 9, y: 7 });

    expect(result.ok).toBe(false);
  });

  it("enforces the density ceiling regardless of type or tile", () => {
    // A 2x2 room (4 tiles) with one object: a second object is 2/4 = 50% > 35%.
    const tinyRoom: RoomSnapshot = {
      ...base,
      room: { ...base.room, width: 2, height: 2 },
      objects: [testObject("desk", 0, 0, 0)]
    };

    expect(MAX_ROOM_DENSITY).toBeLessThan(0.5);
    expect(canPlaceObject(tinyRoom, "plant", { x: 1, y: 1 }).ok).toBe(false);
  });
});

describe("validatePetAction build path", () => {
  it("rejects a build that violates the placement ruleset", () => {
    // pet-mochi may build, but (1,1) holds the seed planning desk.
    const result = applyPetAction(
      base,
      "pet-mochi",
      {
        action: "build",
        objectType: "plant",
        location: { x: 1, y: 1 },
        reasonVisible: "Try to build on top of the desk.",
        riskLevel: "low"
      },
      "2026-06-26T12:05:00.000Z"
    );

    expect(result.ok).toBe(false);
    expect(result.event).toMatchObject({ type: "ActionRejected", actorPetId: "pet-mochi" });
    // No new object was added.
    expect(result.snapshot.objects).toHaveLength(base.objects.length);
  });

  it("allows a valid build on an empty tile", () => {
    const result = applyPetAction(
      base,
      "pet-mochi",
      {
        action: "build",
        objectType: "plant",
        location: { x: 6, y: 4 },
        reasonVisible: "Add a small plant in an open corner.",
        riskLevel: "low"
      },
      "2026-06-26T12:06:00.000Z"
    );

    expect(result.ok).toBe(true);
    expect(result.event.type).toBe("PetBuiltObject");
    expect(result.snapshot.objects).toHaveLength(base.objects.length + 1);
  });
});
