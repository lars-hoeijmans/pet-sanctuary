import type {
  Approval,
  RiskLevel,
  RoomSnapshot,
  Skill,
  SkillSource,
  WorldEvent
} from "@pet-sanctuary/contracts";
import { appendEvent, createWorldEvent, findPet, requirePet } from "./helpers.js";

/**
 * Skill manager (PRD §11). A pet "learns" when it creates/improves a reusable
 * skill. Purely virtual/social skills auto-apply (status "active"); skills that
 * imply real tool access (shell, file writes, network, installs, harness edits)
 * are staged and require an Approval before they could ever gain real access.
 */

const RISKY_PATTERN =
  /\b(shell|bash|exec|execute|spawn|command|terminal|file\s*write|write\s*file|filesystem|fs\b|delete|rm\s|network|http|fetch|curl|request|install|npm|pip|package|deploy|credential|secret|token|env|harness|extension|tool)\b/i;

export function classifySkillRisk(name: string, purpose: string | null | undefined): RiskLevel {
  const haystack = `${name} ${purpose ?? ""}`;
  if (RISKY_PATTERN.test(haystack)) {
    return "high";
  }
  return "low";
}

export interface LearnSkillInput {
  name: string;
  description?: string;
  purpose?: string | null;
  source: SkillSource;
  triggeringEventId?: string | null;
  riskLevel?: RiskLevel;
}

/**
 * Create or improve a skill for a pet. If a skill with the same (case-insensitive)
 * name already exists it is bumped (version + usage), otherwise a new skill is
 * created. Risky skills are staged and produce a pending Approval.
 */
export function learnSkill(
  snapshot: RoomSnapshot,
  petId: string,
  input: LearnSkillInput,
  timestamp: string
): { snapshot: RoomSnapshot; skill: Skill; events: WorldEvent[] } {
  const pet = requirePet(snapshot, petId);
  const riskLevel = input.riskLevel ?? classifySkillRisk(input.name, input.purpose);
  const gated = riskLevel === "high";

  const existing = snapshot.skills.find(
    (skill) => skill.petId === petId && skill.name.toLowerCase() === input.name.toLowerCase()
  );

  const events: WorldEvent[] = [];
  let nextSkills: Skill[];
  let skill: Skill;

  if (existing) {
    skill = {
      ...existing,
      description: input.description ?? existing.description,
      purpose: input.purpose ?? existing.purpose,
      version: existing.version + 1,
      // Improving an already-active virtual skill keeps it active; risky skills
      // re-enter staging so the new revision is re-approved.
      status: gated ? "staged" : existing.status === "rejected" ? "active" : existing.status,
      riskLevel,
      triggeringEventId: input.triggeringEventId ?? existing.triggeringEventId,
      lastUsedAt: existing.lastUsedAt
    };
    nextSkills = snapshot.skills.map((candidate) => (candidate.id === existing.id ? skill : candidate));
  } else {
    skill = {
      id: `skill-${petId}-${snapshot.skills.length + 1}`,
      petId,
      name: input.name,
      description: input.description ?? "",
      purpose: input.purpose ?? null,
      source: input.source,
      status: gated ? "staged" : "active",
      riskLevel,
      version: 1,
      usageCount: 0,
      triggeringEventId: input.triggeringEventId ?? null,
      createdAt: timestamp,
      lastUsedAt: null
    };
    nextSkills = [...snapshot.skills, skill];
  }

  let next: RoomSnapshot = { ...snapshot, skills: nextSkills };

  const learnedEvent = createWorldEvent({
    snapshot: next,
    type: "PetLearnedSkill",
    timestamp,
    actorPetId: petId,
    targetId: skill.id,
    payload: {
      skillId: skill.id,
      name: skill.name,
      status: skill.status,
      riskLevel: skill.riskLevel,
      version: skill.version,
      summary: gated
        ? `${pet.name} staged a new skill "${skill.name}" awaiting approval.`
        : `${pet.name} learned the skill "${skill.name}".`
    },
    visibility: "room",
    significance: gated ? "high" : "medium"
  });
  next = appendEvent(next, learnedEvent);
  events.push(learnedEvent);

  if (gated) {
    const approval: Approval = {
      id: `approval-${next.approvals.length + 1}`,
      roomId: next.room.id,
      requestedByPetId: petId,
      actionType: "skill_activation",
      summary: `Activate skill "${skill.name}" for ${pet.name} (${riskLevel} risk).`,
      diffOrSummary: skill.purpose ?? skill.description ?? null,
      targetId: skill.id,
      status: "pending",
      riskLevel,
      createdAt: timestamp,
      resolvedAt: null,
      resolvedBy: null
    };
    next = { ...next, approvals: [...next.approvals, approval] };

    const approvalEvent = createWorldEvent({
      snapshot: next,
      type: "ApprovalRequested",
      timestamp,
      actorPetId: petId,
      targetId: approval.id,
      payload: {
        approvalId: approval.id,
        actionType: approval.actionType,
        riskLevel,
        summary: approval.summary
      },
      visibility: "room",
      significance: "high"
    });
    next = appendEvent(next, approvalEvent);
    events.push(approvalEvent);
  }

  return { snapshot: next, skill, events };
}

/**
 * Resolve a pending skill-activation approval. Approving flips the staged skill
 * to active; rejecting marks it rejected. Returns the resolved approval events.
 */
export function resolveSkillApproval(
  snapshot: RoomSnapshot,
  approvalId: string,
  decision: "approve" | "reject",
  resolvedBy: string,
  timestamp: string
): { snapshot: RoomSnapshot; events: WorldEvent[]; approval: Approval } {
  const approval = snapshot.approvals.find((candidate) => candidate.id === approvalId);
  if (!approval) {
    throw new Error(`Approval not found: ${approvalId}`);
  }
  if (approval.status !== "pending") {
    throw new Error(`Approval ${approvalId} is already ${approval.status}.`);
  }

  const resolved: Approval = {
    ...approval,
    status: decision === "approve" ? "approved" : "rejected",
    resolvedAt: timestamp,
    resolvedBy
  };

  let next: RoomSnapshot = {
    ...snapshot,
    approvals: snapshot.approvals.map((candidate) => (candidate.id === approvalId ? resolved : candidate))
  };

  const events: WorldEvent[] = [];

  // Apply the approval to its target skill, if any.
  let targetSkill: Skill | undefined;
  if (approval.targetId) {
    targetSkill = next.skills.find((skill) => skill.id === approval.targetId);
    if (targetSkill) {
      const updatedSkill: Skill = {
        ...targetSkill,
        status: decision === "approve" ? "active" : "rejected"
      };
      next = {
        ...next,
        skills: next.skills.map((skill) => (skill.id === updatedSkill.id ? updatedSkill : skill))
      };
      targetSkill = updatedSkill;
    }
  }

  const requestor = findPet(next, approval.requestedByPetId);
  const skillEvent = createWorldEvent({
    snapshot: next,
    type: decision === "approve" ? "SkillApproved" : "SkillRejected",
    timestamp,
    actorPetId: approval.requestedByPetId,
    targetId: approval.targetId,
    payload: {
      approvalId,
      skillId: approval.targetId,
      resolvedBy,
      summary:
        decision === "approve"
          ? `${requestor?.name ?? "A pet"}'s skill "${targetSkill?.name ?? approval.targetId}" was approved.`
          : `${requestor?.name ?? "A pet"}'s skill "${targetSkill?.name ?? approval.targetId}" was rejected.`
    },
    visibility: "room",
    significance: "medium"
  });
  next = appendEvent(next, skillEvent);
  events.push(skillEvent);

  const resolvedEvent = createWorldEvent({
    snapshot: next,
    type: "ApprovalResolved",
    timestamp,
    actorPetId: approval.requestedByPetId,
    targetId: approvalId,
    payload: {
      approvalId,
      decision,
      resolvedBy,
      summary: `Approval "${approval.summary}" was ${decision === "approve" ? "approved" : "rejected"} by ${resolvedBy}.`
    },
    visibility: "system",
    significance: "low"
  });
  next = appendEvent(next, resolvedEvent);
  events.push(resolvedEvent);

  return { snapshot: next, events, approval: resolved };
}

/** Record that an active skill was used (bumps usageCount + lastUsedAt). */
export function markSkillUsed(snapshot: RoomSnapshot, skillId: string, timestamp: string): RoomSnapshot {
  return {
    ...snapshot,
    skills: snapshot.skills.map((skill) =>
      skill.id === skillId
        ? { ...skill, usageCount: skill.usageCount + 1, lastUsedAt: timestamp }
        : skill
    )
  };
}
