import { describe, expect, it } from "vitest";
import { applyPetAction, buildObservation, createSeedRoomSnapshot } from "./kernel.js";
import { createTask } from "./tasks.js";
import { deriveActionFromGoal, goalStillValid } from "./goals.js";
import { updatePet } from "./helpers.js";

const TS = "2026-06-26T12:00:00.000Z";

describe("goal-based cognition", () => {
  it("set_goal persists a goal on the pet and emits PetGoalSet", () => {
    const snapshot = createSeedRoomSnapshot(TS);
    const result = applyPetAction(
      snapshot,
      "pet-nova",
      { action: "set_goal", kind: "explore", reasonVisible: "Nova wants a look around.", riskLevel: "low" },
      TS
    );
    expect(result.ok).toBe(true);
    const nova = result.snapshot.pets.find((pet) => pet.id === "pet-nova")!;
    expect(nova.goal?.kind).toBe("explore");
    expect(result.events.some((event) => event.type === "PetGoalSet")).toBe(true);
  });

  it("rejects a work_task goal that targets a non-task", () => {
    const snapshot = createSeedRoomSnapshot(TS);
    const result = applyPetAction(
      snapshot,
      "pet-nova",
      { action: "set_goal", kind: "work_task", targetId: "pet-mochi", reasonVisible: "bad target", riskLevel: "low" },
      TS
    );
    expect(result.ok).toBe(false);
  });

  it("decomposes a work_task goal: walk to a desk, then work", () => {
    let snapshot = createSeedRoomSnapshot(TS);
    const created = createTask(snapshot, { title: "Tidy the logs", description: "", riskLevel: "low" }, "manager", TS);
    snapshot = created.snapshot;
    // Assign the task to Nova and give Nova the matching goal.
    snapshot = {
      ...snapshot,
      pets: updatePet(snapshot.pets, "pet-nova", {
        currentTaskId: created.task.id,
        goal: { kind: "work_task", targetId: created.task.id, targetPosition: null, createdTick: 0 }
      }),
      tasks: snapshot.tasks.map((task) =>
        task.id === created.task.id ? { ...task, status: "claimed" as const, assignedPetId: "pet-nova" } : task
      )
    };

    const observation = buildObservation(snapshot, "pet-nova");
    expect(goalStillValid(observation)).toBe(true);
    const action = deriveActionFromGoal(observation);
    // Nova is not at a desk yet, so the first derived step heads for one.
    expect(action?.action === "move_to" || action?.action === "work").toBe(true);
  });

  it("invalidates a work_task goal once the task is gone/owned by another pet", () => {
    let snapshot = createSeedRoomSnapshot(TS);
    const created = createTask(snapshot, { title: "Owned elsewhere", description: "", riskLevel: "low" }, "manager", TS);
    snapshot = {
      ...created.snapshot,
      pets: updatePet(created.snapshot.pets, "pet-nova", {
        goal: { kind: "work_task", targetId: created.task.id, targetPosition: null, createdTick: 0 }
        // note: no currentTaskId — the task is not Nova's
      }),
      tasks: created.snapshot.tasks.map((task) =>
        task.id === created.task.id ? { ...task, assignedPetId: "pet-mochi" } : task
      )
    };
    const observation = buildObservation(snapshot, "pet-nova");
    expect(goalStillValid(observation)).toBe(false);
    expect(deriveActionFromGoal(observation)).toBeNull();
  });
});
