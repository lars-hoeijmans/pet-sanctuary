import { describe, expect, it } from "vitest";
import {
  applyPetAction,
  applyTaskResult,
  classifyResponseLevel,
  composePetProfile,
  createPet,
  createSeedRoomSnapshot,
  createTask,
  karmaTrustLabel,
  classifySkillRisk,
  learnSkill,
  resolveSkillApproval,
  rollTraits
} from "./index.js";

const TS = "2026-06-26T12:00:00.000Z";

describe("pet generation", () => {
  it("rolls deterministic traits from a seed and varies across seeds", () => {
    expect(rollTraits("seed-a")).toEqual(rollTraits("seed-a"));
    const a = rollTraits("seed-a");
    const b = rollTraits("seed-zzz-different");
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("composes a full personality card that differs by traits", () => {
    const builder = composePetProfile(
      { temperament: "cheerful", workStyle: "builder", socialStyle: "helpful", riskProfile: "careful", aesthetic: "cozy wood" },
      { seed: "p1" }
    );
    const debugger_ = composePetProfile(
      { temperament: "bold", workStyle: "debugger", socialStyle: "competitive", riskProfile: "curious", aesthetic: "neon clutter" },
      { seed: "p2" }
    );
    expect(builder.name).toBeTruthy();
    expect(builder.startingSkills).toHaveLength(2);
    expect(builder.personalitySummary).not.toBe(debugger_.personalitySummary);
    expect(builder.initialKarma).toBeGreaterThanOrEqual(1);
  });

  it("spawns a pet with two active starting skills and a PetCreated event", () => {
    const snapshot = createSeedRoomSnapshot(TS);
    const result = createPet(snapshot, { seed: "newbie-1", traits: rollTraits("newbie-1") }, TS);

    expect(result.snapshot.pets).toHaveLength(snapshot.pets.length + 1);
    const newSkills = result.snapshot.skills.filter((skill) => skill.petId === result.petId);
    expect(newSkills).toHaveLength(2);
    expect(newSkills.every((skill) => skill.status === "active")).toBe(true);
    expect(result.events.some((event) => event.type === "PetCreated")).toBe(true);
    // existing entities are preserved
    expect(result.snapshot.skills.length).toBe(snapshot.skills.length + 2);
  });
});

describe("tasks & collaboration", () => {
  it("creates an open task with a high-significance TaskCreated event", () => {
    const snapshot = createSeedRoomSnapshot(TS);
    const { snapshot: next, task, event } = createTask(snapshot, { title: "Polish the trace", description: "", riskLevel: "low" }, "manager", TS);

    expect(task.status).toBe("open");
    expect(task.assignedPetId).toBeNull();
    expect(event).toMatchObject({ type: "TaskCreated", significance: "high" });
    expect(next.tasks).toHaveLength(1);
  });

  it("lets a pet claim a task, setting ownership and gaining karma", () => {
    const base = createSeedRoomSnapshot(TS);
    const { snapshot, task } = createTask(base, { title: "Build a helper", description: "", riskLevel: "low" }, "manager", TS);
    const mochiBefore = snapshot.pets.find((p) => p.id === "pet-mochi")!.karma;

    const result = applyPetAction(
      snapshot,
      "pet-mochi",
      { action: "claim_task", taskId: task.id, reasonVisible: "Mochi grabs it.", riskLevel: "low" },
      TS
    );

    expect(result.ok).toBe(true);
    const claimed = result.snapshot.tasks.find((t) => t.id === task.id)!;
    expect(claimed.status).toBe("claimed");
    expect(claimed.assignedPetId).toBe("pet-mochi");
    expect(result.snapshot.pets.find((p) => p.id === "pet-mochi")!.currentTaskId).toBe(task.id);
    expect(result.snapshot.events.some((e) => e.type === "TaskClaimed")).toBe(true);
    expect(result.snapshot.pets.find((p) => p.id === "pet-mochi")!.karma).toBe(mochiBefore + 1);
  });

  it("rejects claiming a task already owned by another pet", () => {
    const base = createSeedRoomSnapshot(TS);
    const { snapshot } = createTask(base, { title: "Owned task", description: "", riskLevel: "low", assignedPetId: "pet-byte" }, "manager", TS);
    const taskId = snapshot.tasks[0]!.id;

    const result = applyPetAction(
      snapshot,
      "pet-mochi",
      { action: "claim_task", taskId, reasonVisible: "Mochi tries to steal it.", riskLevel: "low" },
      TS
    );

    expect(result.ok).toBe(false);
    expect(result.event.type).toBe("ActionRejected");
  });

  it("applies a completed task result: progress, completion, learned skill, and karma", () => {
    const base = createSeedRoomSnapshot(TS);
    const created = createTask(base, { title: "Summarize logs", description: "", riskLevel: "low" }, "manager", TS);
    // assign + start work
    const claimed = applyPetAction(created.snapshot, "pet-nova", { action: "claim_task", taskId: created.task.id, reasonVisible: "x", riskLevel: "low" }, TS);
    const working = applyPetAction(claimed.snapshot, "pet-nova", { action: "work", taskId: created.task.id, reasonVisible: "y", riskLevel: "low" }, TS);
    const karmaBefore = working.snapshot.pets.find((p) => p.id === "pet-nova")!.karma;

    const result = applyTaskResult(
      working.snapshot,
      created.task.id,
      {
        status: "completed",
        summary: "Done.",
        outputRef: "artifact://x",
        steps: ["step one", "step two"],
        learnedSkill: { name: "Summarize before asking", description: "d", purpose: "p" }
      },
      TS
    );

    const types = result.events.map((e) => e.type);
    expect(types.filter((t) => t === "TaskProgressed")).toHaveLength(2);
    expect(types).toContain("TaskCompleted");
    expect(types).toContain("PetLearnedSkill");
    const task = result.snapshot.tasks.find((t) => t.id === created.task.id)!;
    expect(task.status).toBe("completed");
    expect(result.snapshot.pets.find((p) => p.id === "pet-nova")!.currentTaskId).toBeNull();
    // learned skill is virtual -> active
    expect(result.snapshot.skills.some((s) => s.name === "Summarize before asking" && s.status === "active")).toBe(true);
    // completion (+3) and learned skill (+1)
    expect(result.snapshot.pets.find((p) => p.id === "pet-nova")!.karma).toBe(karmaBefore + 4);
  });

  it("records relationship affinity when a pet offers help", () => {
    const snapshot = createSeedRoomSnapshot(TS);
    const result = applyPetAction(
      snapshot,
      "pet-mochi",
      { action: "offer_help", targetPetId: "pet-byte", taskId: "demo", message: "I can help", reasonVisible: "helpful", riskLevel: "low" },
      TS
    );
    expect(result.ok).toBe(true);
    expect(result.snapshot.relationships).toHaveLength(1);
    expect(result.snapshot.relationships[0]!.affinity).toBe(1);
  });
});

describe("skills, approvals & karma", () => {
  it("classifies virtual skills as low risk and tool skills as high risk", () => {
    expect(classifySkillRisk("Summarize before asking", "compress context")).toBe("low");
    expect(classifySkillRisk("Run shell command", "execute bash to install a package")).toBe("high");
  });

  it("auto-activates a virtual skill without an approval", () => {
    const snapshot = createSeedRoomSnapshot(TS);
    const result = learnSkill(snapshot, "pet-mochi", { name: "Tidy notes", purpose: "keep notes short", source: "requested" }, TS);
    const skill = result.snapshot.skills.find((s) => s.id === result.skill.id)!;
    expect(skill.status).toBe("active");
    expect(result.snapshot.approvals).toHaveLength(0);
    expect(result.events.some((e) => e.type === "PetLearnedSkill")).toBe(true);
  });

  it("stages a risky skill and creates a pending approval, then activates on approval", () => {
    const snapshot = createSeedRoomSnapshot(TS);
    const learned = learnSkill(
      snapshot,
      "pet-nova",
      { name: "Network fetch helper", purpose: "make http requests to install packages", source: "requested" },
      TS
    );
    const stagedSkill = learned.snapshot.skills.find((s) => s.id === learned.skill.id)!;
    expect(stagedSkill.status).toBe("staged");
    expect(stagedSkill.riskLevel).toBe("high");
    const approval = learned.snapshot.approvals.find((a) => a.targetId === stagedSkill.id)!;
    expect(approval.status).toBe("pending");
    expect(learned.events.some((e) => e.type === "ApprovalRequested")).toBe(true);

    const resolved = resolveSkillApproval(learned.snapshot, approval.id, "approve", "manager", TS);
    expect(resolved.snapshot.skills.find((s) => s.id === stagedSkill.id)!.status).toBe("active");
    expect(resolved.snapshot.approvals.find((a) => a.id === approval.id)!.status).toBe("approved");
    expect(resolved.events.some((e) => e.type === "SkillApproved")).toBe(true);
    expect(resolved.events.some((e) => e.type === "ApprovalResolved")).toBe(true);
  });

  it("rejecting an approval marks the skill rejected", () => {
    const snapshot = createSeedRoomSnapshot(TS);
    const learned = learnSkill(snapshot, "pet-nova", { name: "Delete files tool", purpose: "rm files on disk", source: "requested" }, TS);
    const approval = learned.snapshot.approvals[0]!;
    const resolved = resolveSkillApproval(learned.snapshot, approval.id, "reject", "manager", TS);
    expect(resolved.snapshot.skills.find((s) => s.id === approval.targetId)!.status).toBe("rejected");
    expect(resolved.events.some((e) => e.type === "SkillRejected")).toBe(true);
  });

  it("maps karma to trust labels", () => {
    expect(karmaTrustLabel(-1)).toBe("wary");
    expect(karmaTrustLabel(0)).toBe("neutral");
    expect(karmaTrustLabel(3)).toBe("neutral");
    expect(karmaTrustLabel(4)).toBe("trusted");
    expect(karmaTrustLabel(10)).toBe("revered");
  });

  it("request_skill action creates and auto-applies a virtual skill with karma", () => {
    const snapshot = createSeedRoomSnapshot(TS);
    const before = snapshot.pets.find((p) => p.id === "pet-byte")!.karma;
    const result = applyPetAction(
      snapshot,
      "pet-byte",
      { action: "request_skill", name: "Read recent events first", purpose: "inspect the room before acting", reasonVisible: "learning", riskLevel: "low" },
      TS
    );
    expect(result.ok).toBe(true);
    expect(result.events.some((e) => e.type === "PetRequestedSkill")).toBe(true);
    expect(result.events.some((e) => e.type === "PetLearnedSkill")).toBe(true);
    expect(result.snapshot.skills.some((s) => s.petId === "pet-byte" && s.name === "Read recent events first")).toBe(true);
    expect(result.snapshot.pets.find((p) => p.id === "pet-byte")!.karma).toBe(before + 1);
  });
});

describe("snapshot invariants with new entities", () => {
  it("keeps applyPetAction events in lockstep with the snapshot event log", () => {
    const snapshot = createSeedRoomSnapshot(TS);
    const result = applyPetAction(
      snapshot,
      "pet-mochi",
      { action: "offer_help", targetPetId: "pet-byte", taskId: "demo", reasonVisible: "help", riskLevel: "low" },
      TS
    );
    expect(result.snapshot.events.length).toBe(snapshot.events.length + result.events.length);
  });

  it("classifies a directly targeted high-significance event as a task action", () => {
    const base = createSeedRoomSnapshot(TS);
    const created = createTask(base, { title: "Targeted task", description: "", riskLevel: "low", assignedPetId: "pet-mochi" }, "manager", TS);
    const taskEvent = created.snapshot.events.find((e) => e.type === "TaskCreated")!;
    expect(classifyResponseLevel(created.snapshot, "pet-mochi", taskEvent)).toBe("task_action");
  });
});
