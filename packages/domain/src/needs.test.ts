import { describe, expect, it } from "vitest";
import { createSeedRoomSnapshot, classifyResponseLevel } from "./kernel.js";
import { decayNeeds, lowestNeed, stepNeeds, NEED_WANT_THRESHOLD } from "./needs.js";
import { updatePet, latestEvent } from "./helpers.js";

const TS = "2026-06-26T12:00:00.000Z";

describe("needs / drives", () => {
  it("decays needs each tick and clamps at zero", () => {
    const snapshot = createSeedRoomSnapshot(TS);
    const drained = updatePet(snapshot.pets, "pet-mochi", {
      status: "observing",
      needs: { energy: 1, focus: 0, social: 50, curiosity: 50 }
    });
    const next = decayNeeds({ ...snapshot, pets: drained });
    const mochi = next.pets.find((pet) => pet.id === "pet-mochi")!;
    expect(mochi.needs.focus).toBe(0); // already 0, stays clamped
    expect(mochi.needs.social).toBeLessThan(50);
    expect(mochi.needs.energy).toBeGreaterThanOrEqual(0);
    expect(mochi.needs.energy).toBeLessThanOrEqual(100);
  });

  it("modulates decay by activity: working drains focus, socializing restores social", () => {
    const base = { energy: 50, focus: 50, social: 20, curiosity: 50 };
    const working = stepNeeds({ status: "working", needs: base } as never);
    const socializing = stepNeeds({ status: "socializing", needs: base } as never);
    expect(working.focus).toBeLessThan(base.focus);
    expect(socializing.social).toBeGreaterThan(base.social);
  });

  it("lowestNeed reports the minimum drive", () => {
    expect(lowestNeed({ energy: 80, focus: 30, social: 90, curiosity: 70 })).toEqual({ key: "focus", value: 30 });
  });

  it("a low drive makes a pet action-capable on an otherwise-quiet tick", () => {
    const snapshot = createSeedRoomSnapshot(TS);
    const quietEvent = latestEvent(snapshot); // RoomSeeded is high-sig; use a low-sig synthetic instead
    expect(quietEvent).not.toBeNull();

    // Full needs, no task, low-significance event → observe_only (room stays calm).
    const calm = {
      ...snapshot,
      pets: updatePet(snapshot.pets, "pet-mochi", {
        needs: { energy: 100, focus: 100, social: 100, curiosity: 100 }
      })
    };
    const lowSig = { ...quietEvent!, significance: "low" as const, targetPetId: null };
    expect(classifyResponseLevel(calm, "pet-mochi", lowSig)).toBe("observe_only");

    // Drop a need below the want threshold → the pet now wants to act.
    const hungry = {
      ...snapshot,
      pets: updatePet(snapshot.pets, "pet-mochi", {
        needs: { energy: NEED_WANT_THRESHOLD - 5, focus: 100, social: 100, curiosity: 100 }
      })
    };
    expect(classifyResponseLevel(hungry, "pet-mochi", lowSig)).not.toBe("observe_only");
  });
});
