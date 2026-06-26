import { describe, expect, it } from "vitest";
import { learnSkill } from "@pet-sanctuary/domain";
import { InMemoryLivingRoomRepository } from "./in-memory-living-room.repository.js";
import { LivingRoomService } from "./living-room.service.js";

const TS = "2026-06-26T12:00:00.000Z";

describe("LivingRoomService manager flows", () => {
  it("creates a task, drives it to completion, and grows a skill", async () => {
    const service = new LivingRoomService(new InMemoryLivingRoomRepository());
    const before = (await service.getMainRoom()).snapshot.skills.length;

    const response = await service.createTask({
      title: "Summarize the event log",
      description: "Build a helper to summarize room events.",
      riskLevel: "low"
    });

    expect(response.task.status).toBe("completed");
    expect(response.task.assignedPetId).toBeTruthy();
    expect(response.task.outputRef).toBeTruthy();

    const types = response.snapshot.events.map((event) => event.type);
    expect(types).toContain("TaskCreated");
    expect(types).toContain("PetStartedWork");
    expect(types).toContain("TaskCompleted");
    expect(types).toContain("PetLearnedSkill");
    expect(types).toContain("KarmaChanged");

    // a new learned skill was added and is active
    const learned = response.snapshot.skills.filter((skill) => skill.source === "learned");
    expect(learned.length).toBeGreaterThan(0);
    expect(learned.every((skill) => skill.status === "active")).toBe(true);
    expect(response.snapshot.skills.length).toBeGreaterThan(before);

    // the assignee gained karma from claiming + completing + learning
    const assignee = response.snapshot.pets.find((pet) => pet.id === response.task.assignedPetId)!;
    expect(assignee.karma).toBeGreaterThanOrEqual(7);

    // persisted
    const persisted = await service.getMainRoom();
    expect(persisted.snapshot.tasks.find((task) => task.id === response.task.id)?.status).toBe("completed");
  });

  it("rolls deterministic traits and spawns a generated pet", async () => {
    const service = new LivingRoomService(new InMemoryLivingRoomRepository());

    expect(service.rollTraits("seed-x").traits).toEqual(service.rollTraits("seed-x").traits);

    const before = (await service.getMainRoom()).snapshot.pets.length;
    const created = await service.createPet({ seed: "spawn-1" });

    expect(created.pet.name).toBeTruthy();
    expect(created.pet.personalitySummary).toBeTruthy();
    expect(created.snapshot.pets.length).toBe(before + 1);
    // starting skills came along
    expect(created.snapshot.skills.filter((skill) => skill.petId === created.pet.id)).toHaveLength(2);
    expect(created.snapshot.events.some((event) => event.type === "PetCreated")).toBe(true);
  });

  it("resolves a staged skill approval", async () => {
    const repository = new InMemoryLivingRoomRepository();
    const service = new LivingRoomService(repository);

    const snapshot = await repository.loadMainRoom();
    const learned = learnSkill(
      snapshot,
      "pet-nova",
      { name: "Shell runner", purpose: "execute bash commands to install packages", source: "requested" },
      TS
    );
    await repository.saveMainRoom(learned.snapshot);
    const approval = learned.snapshot.approvals[0]!;
    expect(approval.status).toBe("pending");

    const resolved = await service.resolveApproval(approval.id, { decision: "approve", resolvedBy: "tester" });

    expect(resolved.approval.status).toBe("approved");
    expect(resolved.snapshot.skills.find((skill) => skill.id === approval.targetId)?.status).toBe("active");
  });

  it("archives and resumes a pet", async () => {
    const service = new LivingRoomService(new InMemoryLivingRoomRepository());

    const archived = await service.setPetArchived("pet-nova", true);
    const nova = archived.snapshot.pets.find((pet) => pet.id === "pet-nova")!;
    expect(nova.archived).toBe(true);
    expect(nova.status).toBe("paused");

    const resumed = await service.setPetPaused("pet-nova", false);
    expect(resumed.snapshot.pets.find((pet) => pet.id === "pet-nova")!.status).toBe("idle");
  });

  it("lists tasks, skills, and approvals", async () => {
    const service = new LivingRoomService(new InMemoryLivingRoomRepository());
    await service.createTask({ title: "List me", description: "", riskLevel: "low" });

    expect((await service.listTasks()).length).toBeGreaterThan(0);
    expect((await service.listSkills()).length).toBeGreaterThan(0);
    expect(Array.isArray(await service.listApprovals())).toBe(true);
  });
});
