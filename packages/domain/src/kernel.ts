import {
  type AgentObservation,
  type AvailableAction,
  type CreateRoomEventRequest,
  type Pet,
  PetActionSchema,
  type PetAction,
  type Position,
  type ResponseLevel,
  type RoomSnapshot,
  RoomSnapshotSchema,
  type Skill,
  type Task,
  type WorldEvent,
  type WorldObject
} from "@pet-sanctuary/contracts";
import {
  appendEvent,
  createWorldEvent,
  distance,
  isInsideRoom,
  isNearby,
  latestEvent,
  replaceEvent,
  requirePet,
  stableNumber,
  updatePet
} from "./helpers.js";
import { applyKarmaForEvents } from "./karma.js";
import { learnSkill } from "./skills.js";
import { getTask, updateTask } from "./tasks.js";
import { bumpRelationship } from "./relationships.js";
import { DEFAULT_PERMISSIONS } from "./pet-generation.js";
import { canPlaceObject } from "./placement.js";

export type ValidationResult =
  | { ok: true; action: PetAction }
  | { ok: false; errors: string[]; event: WorldEvent };

export type ApplyActionResult =
  | { ok: true; snapshot: RoomSnapshot; event: WorldEvent; events: WorldEvent[] }
  | { ok: false; snapshot: RoomSnapshot; errors: string[]; event: WorldEvent; events: WorldEvent[] };

export interface ProcessWorldEventOptions {
  chooseAction?: (observation: AgentObservation) => PetAction | null;
}

/** Async action chooser — backed by a real model runtime (PRD §10/§17). */
export type AsyncChooseAction = (observation: AgentObservation) => Promise<PetAction | null>;

export interface ProcessWorldEventResult {
  snapshot: RoomSnapshot;
  triggeringEvent: WorldEvent;
  events: WorldEvent[];
}

export const SEED_ROOM_ID = "living-room";

export function createSeedRoomSnapshot(timestamp: string = new Date().toISOString()): RoomSnapshot {
  const room = {
    id: SEED_ROOM_ID,
    name: "Living Room Kernel",
    width: 12,
    height: 8,
    paused: false,
    tick: 0
  };

  const pets: Pet[] = [
    {
      id: "pet-mochi",
      roomId: room.id,
      name: "Mochi",
      tagline: "Careful builder with a sunny bias toward helping.",
      traits: {
        temperament: "cheerful",
        workStyle: "builder",
        socialStyle: "helpful",
        riskProfile: "careful",
        aesthetic: "cozy wood"
      },
      personalitySummary: "Mochi keeps the room warm, notices who is blocked, and prefers small safe improvements.",
      speakingStyle: "Encouraging, concrete, and gently practical.",
      sprite: "seed-mochi",
      status: "idle",
      karma: 3,
      permissions: DEFAULT_PERMISSIONS,
      position: { x: 2, y: 4 },
      currentTaskId: null,
      memory: {
        summary: "Remembers that helpful actions should leave the room easier to understand.",
        notes: ["Started in the Living Room Kernel seed."]
      },
      runtime: { kind: "hermes", model: null, provider: null },
      archived: false
    },
    {
      id: "pet-byte",
      roomId: room.id,
      name: "Byte",
      tagline: "Calm reviewer who protects the edges.",
      traits: {
        temperament: "calm",
        workStyle: "reviewer",
        socialStyle: "mentor-like",
        riskProfile: "rule-bound",
        aesthetic: "minimalist"
      },
      personalitySummary: "Byte reads the room before acting and turns vague motion into tidy critique.",
      speakingStyle: "Brief, precise, and fond of naming tradeoffs.",
      sprite: "seed-byte",
      status: "idle",
      karma: 2,
      permissions: DEFAULT_PERMISSIONS,
      position: { x: 5, y: 3 },
      currentTaskId: null,
      memory: {
        summary: "Remembers to review behavior through visible events rather than private chats.",
        notes: ["Started in the Living Room Kernel seed."]
      },
      runtime: { kind: "hermes", model: null, provider: null },
      archived: false
    },
    {
      id: "pet-nova",
      roomId: room.id,
      name: "Nova",
      tagline: "Bold debugger with neon instincts.",
      traits: {
        temperament: "bold",
        workStyle: "debugger",
        socialStyle: "competitive",
        riskProfile: "curious",
        aesthetic: "neon clutter"
      },
      personalitySummary: "Nova pokes at stale state, moves first, and turns uncertainty into visible experiments.",
      speakingStyle: "Punchy, playful, and a little impatient.",
      sprite: "seed-nova",
      status: "idle",
      karma: 1,
      permissions: DEFAULT_PERMISSIONS,
      position: { x: 8, y: 5 },
      currentTaskId: null,
      memory: {
        summary: "Remembers that debugging starts by making traces visible.",
        notes: ["Started in the Living Room Kernel seed."]
      },
      runtime: { kind: "hermes", model: null, provider: null },
      archived: false
    }
  ];

  const objects: WorldObject[] = [
    {
      id: "obj-green-couch",
      roomId: room.id,
      type: "couch",
      position: { x: 3, y: 5 },
      state: { color: "green", condition: "comfortable" },
      ownerPetId: null,
      description: "A green couch where pets drift while observing."
    },
    {
      id: "obj-desk-left",
      roomId: room.id,
      type: "desk",
      position: { x: 1, y: 1 },
      state: { station: "planner" },
      ownerPetId: null,
      description: "A tidy desk for planning and review work."
    },
    {
      id: "obj-desk-right",
      roomId: room.id,
      type: "desk",
      position: { x: 10, y: 2 },
      state: { station: "debugger" },
      ownerPetId: null,
      description: "A bright desk with space for debugging traces."
    },
    {
      id: "obj-lamp",
      roomId: room.id,
      type: "lamp",
      position: { x: 7, y: 6 },
      state: { brightness: "warm", decorated: false },
      ownerPetId: null,
      description: "A lamp that makes visible reactions easy to spot."
    }
  ];

  // Each seed pet starts with two virtual (auto-active) skills so skill growth is
  // visible from the very first frame.
  const skills: Skill[] = [
    seedSkill("pet-mochi", 1, "Small safe increments", "Break work into tiny reversible steps.", "Keep changes easy to review.", timestamp),
    seedSkill("pet-mochi", 2, "Offer bounded help", "Offer to help in a small, traceable way.", "Support others without taking over.", timestamp),
    seedSkill("pet-byte", 1, "Edge-case review pass", "Scan for the cases others miss.", "Catch problems before they ship.", timestamp),
    seedSkill("pet-byte", 2, "Name the tradeoffs", "Explain why one path beats another.", "Help others learn, not just finish.", timestamp),
    seedSkill("pet-nova", 1, "Make traces visible first", "Reproduce and log before concluding.", "Turn uncertainty into evidence.", timestamp),
    seedSkill("pet-nova", 2, "Set a friendly pace", "Turn rivalry into momentum.", "Push the room to finish tasks.", timestamp)
  ];

  const events: WorldEvent[] = [
    createWorldEvent({
      snapshot: { room, events: [] },
      type: "RoomSeeded",
      timestamp,
      actorPetId: null,
      payload: {
        summary: "The Living Room Kernel was seeded with three deterministic pets."
      },
      visibility: "room",
      significance: "high"
    })
  ];

  return RoomSnapshotSchema.parse({ room, pets, objects, events, skills, tasks: [], approvals: [], relationships: [] });
}

function seedSkill(
  petId: string,
  index: number,
  name: string,
  description: string,
  purpose: string,
  timestamp: string
): Skill {
  return {
    id: `skill-${petId}-${index}`,
    petId,
    name,
    description,
    purpose,
    source: "seed",
    status: "active",
    riskLevel: "low",
    version: 1,
    usageCount: 0,
    triggeringEventId: null,
    createdAt: timestamp,
    lastUsedAt: null
  };
}

export function createRoomNoticeEvent(
  snapshot: RoomSnapshot,
  request: CreateRoomEventRequest,
  timestamp: string = new Date().toISOString()
): WorldEvent {
  return createWorldEvent({
    snapshot,
    type: "RoomNotice",
    timestamp,
    actorPetId: null,
    targetPetId: request.targetPetId ?? null,
    targetId: request.targetId ?? null,
    payload: {
      ...request.metadata,
      summary: request.summary
    },
    visibility: "room",
    significance: request.significance
  });
}

export function processWorldEvent(
  snapshot: RoomSnapshot,
  event: WorldEvent,
  timestamp: string = new Date().toISOString(),
  options: ProcessWorldEventOptions = {}
): ProcessWorldEventResult {
  const chooseAction = options.chooseAction ?? chooseDeterministicPetAction;
  const events: WorldEvent[] = [];
  let next = snapshot;

  if (!next.events.some((existing) => existing.id === event.id)) {
    next = appendEvent(next, event);
    events.push(event);
  }

  for (const pet of next.pets.filter((candidate) => candidate.status !== "paused" && !candidate.archived)) {
    const observation = buildObservation(next, pet.id, event);
    const perceived = createPerceptionEvent(next, pet, event, observation.responseLevel, timestamp);
    next = appendEvent(next, perceived);
    events.push(perceived);

    if (!canProposeAction(observation.responseLevel)) {
      continue;
    }

    const action = chooseAction(observation);
    if (!action) {
      continue;
    }

    const result = applyPetAction(next, pet.id, action, timestamp);
    const annotatedPrimary = annotateTriggeredResponse(result.event, event, observation.responseLevel);
    next = replaceEvent(result.snapshot, annotatedPrimary);
    for (const created of result.events) {
      events.push(created.id === result.event.id ? annotatedPrimary : created);
    }
  }

  return {
    snapshot: RoomSnapshotSchema.parse(next),
    triggeringEvent: event,
    events
  };
}

/**
 * Async sibling of {@link processWorldEvent}: every active pet perceives the event,
 * then pets at an action-capable response level propose one action through a real
 * model chooser (resolved in parallel), and accepted proposals are applied
 * sequentially and validated server-side. Used by the live orchestrator so pet
 * reactions to tasks/notices are genuinely model-driven, not deterministic.
 */
export async function processWorldEventAsync(
  snapshot: RoomSnapshot,
  event: WorldEvent,
  timestamp: string,
  chooseAction: AsyncChooseAction
): Promise<ProcessWorldEventResult> {
  const events: WorldEvent[] = [];
  let next = snapshot;

  if (!next.events.some((existing) => existing.id === event.id)) {
    next = appendEvent(next, event);
    events.push(event);
  }

  const result = await perceiveAndActAsync(next, event, timestamp, chooseAction, true);
  next = result.snapshot;
  events.push(...result.events);

  return {
    snapshot: RoomSnapshotSchema.parse(next),
    triggeringEvent: event,
    events
  };
}

/**
 * Async, model-driven simulation tick. Mirrors {@link runDeterministicTick} but
 * each eligible pet's action comes from the real runtime (decisions resolved in
 * parallel, applied sequentially). The chooser is expected to fall back to the
 * deterministic policy on its own, so the room always keeps moving.
 */
export async function runAgentTickAsync(
  snapshot: RoomSnapshot,
  chooseAction: AsyncChooseAction,
  timestamp: string = new Date().toISOString()
): Promise<RoomSnapshot> {
  if (snapshot.room.paused) {
    return snapshot;
  }

  const tickedRoom = { ...snapshot.room, tick: snapshot.room.tick + 1 };
  let next: RoomSnapshot = appendEvent(
    { ...snapshot, room: tickedRoom },
    createWorldEvent({
      snapshot: { room: tickedRoom, events: snapshot.events },
      type: "SimulationTick",
      timestamp,
      actorPetId: null,
      payload: { tick: tickedRoom.tick },
      visibility: "system",
      significance: "low"
    })
  );

  const tickEvent = latestEvent(next);
  if (tickEvent) {
    const result = await perceiveAndActAsync(next, tickEvent, timestamp, chooseAction, false);
    next = result.snapshot;
  }

  return RoomSnapshotSchema.parse(next);
}

/**
 * Shared engine for the async paths: build each active pet's observation, emit
 * perception events (when `emitPerception`), resolve all action-capable pets'
 * proposals in parallel, then apply accepted actions sequentially so every
 * mutation is still validated against the evolving snapshot.
 */
async function perceiveAndActAsync(
  snapshot: RoomSnapshot,
  triggeringEvent: WorldEvent,
  timestamp: string,
  chooseAction: AsyncChooseAction,
  emitPerception: boolean
): Promise<{ snapshot: RoomSnapshot; events: WorldEvent[] }> {
  const events: WorldEvent[] = [];
  let next = snapshot;

  const proposers: { petId: string; observation: AgentObservation; responseLevel: AgentObservation["responseLevel"] }[] = [];
  for (const pet of next.pets.filter((candidate) => candidate.status !== "paused" && !candidate.archived)) {
    const observation = buildObservation(next, pet.id, triggeringEvent);
    if (emitPerception) {
      const perceived = createPerceptionEvent(next, pet, triggeringEvent, observation.responseLevel, timestamp);
      next = appendEvent(next, perceived);
      events.push(perceived);
    }
    if (canProposeAction(observation.responseLevel)) {
      proposers.push({ petId: pet.id, observation, responseLevel: observation.responseLevel });
    }
  }

  const decisions = await Promise.all(
    proposers.map(async (entry) => {
      try {
        return { entry, action: await chooseAction(entry.observation) };
      } catch {
        return { entry, action: null as PetAction | null };
      }
    })
  );

  for (const { entry, action } of decisions) {
    if (!action) {
      continue;
    }
    const result = applyPetAction(next, entry.petId, action, timestamp);
    const annotatedPrimary = annotateTriggeredResponse(result.event, triggeringEvent, entry.responseLevel);
    next = replaceEvent(result.snapshot, annotatedPrimary);
    for (const created of result.events) {
      events.push(created.id === result.event.id ? annotatedPrimary : created);
    }
  }

  return { snapshot: next, events };
}

export function buildObservation(
  snapshot: RoomSnapshot,
  petId: string,
  triggeringEvent: WorldEvent | null = latestEvent(snapshot),
  radius = 4
): AgentObservation {
  const pet = requirePet(snapshot, petId);
  const responseLevel = classifyResponseLevel(snapshot, petId, triggeringEvent);

  return {
    room: snapshot.room,
    pet,
    nearbyPets: snapshot.pets.filter(
      (candidate) => candidate.id !== pet.id && !candidate.archived && distance(candidate.position, pet.position) <= radius
    ),
    objectsNearby: snapshot.objects.filter((object) => distance(object.position, pet.position) <= radius),
    desks: snapshot.objects.filter((object) => object.type === "desk"),
    recentEvents: snapshot.events.slice(-8),
    availableActions: availableActionsForPet(pet),
    responseLevel,
    openTasks: snapshot.tasks.filter((task) => task.status === "open" && !task.assignedPetId),
    currentTask: pet.currentTaskId ? getTask(snapshot, pet.currentTaskId) ?? null : null
  };
}

export function classifyResponseLevel(
  snapshot: RoomSnapshot,
  petId: string,
  event: WorldEvent | null = latestEvent(snapshot)
): ResponseLevel {
  const pet = requirePet(snapshot, petId);

  if (snapshot.room.paused || pet.status === "paused" || pet.archived) {
    return "observe_only";
  }

  if (!event) {
    return "internal_reaction";
  }

  if (event.type === "ActionRejected") {
    return pet.traits.workStyle === "reviewer" ? "ambient_reaction" : "observe_only";
  }

  if (event.targetPetId === pet.id) {
    return event.significance === "high" ? "task_action" : "social_response";
  }

  if (event.significance === "high") {
    if (pet.traits.socialStyle === "helpful" || pet.traits.workStyle === "planner") {
      return "social_response";
    }

    if (pet.traits.temperament === "bold" || pet.traits.riskProfile === "curious") {
      return "ambient_reaction";
    }

    return "internal_reaction";
  }

  if (event.significance === "medium") {
    if (pet.traits.socialStyle === "loner" || pet.traits.socialStyle === "shy") {
      return "internal_reaction";
    }

    if (event.actorPetId && isNearby(snapshot, pet.id, event.actorPetId, 4)) {
      return "social_response";
    }

    return "ambient_reaction";
  }

  // Keep the room visibly alive on quiet ticks: most pets should still do
  // something small and in-character (a passing remark or a step) rather than
  // sit silent. Cadence is seeded per (tick, pet, event) so it stays stable and
  // replayable while spreading activity across pets.
  const cadence = stableNumber(`${snapshot.room.tick}:${pet.id}:${event.id}`) % 4;
  if (cadence === 0 && pet.permissions.canSpeak) {
    return "social_response";
  }
  if (cadence === 1 && pet.permissions.canMove) {
    return "ambient_reaction";
  }
  if (cadence === 2) {
    return "internal_reaction";
  }

  return "observe_only";
}

export function chooseDeterministicPetAction(observation: AgentObservation): PetAction | null {
  const { pet, room, responseLevel } = observation;

  if (responseLevel === "observe_only" || responseLevel === "internal_reaction") {
    return null;
  }

  const canTakeTaskAction = responseLevel === "task_action" || responseLevel === "social_response";

  // 1. Claim an open task if this pet's personality leans toward grabbing work.
  const claimable = observation.openTasks[0];
  if (claimable && pet.permissions.canWork && !pet.currentTaskId && canTakeTaskAction && wantsToClaim(pet)) {
    return {
      action: "claim_task",
      taskId: claimable.id,
      reasonVisible: `${pet.name} claims "${claimable.title}" to get it moving.`,
      riskLevel: "low"
    };
  }

  // 2. Drive a task this pet already owns: plan -> walk to a desk -> work.
  const myTask = observation.currentTask;
  if (
    myTask &&
    pet.permissions.canWork &&
    (responseLevel === "task_action" || responseLevel === "social_response" || responseLevel === "ambient_reaction") &&
    (myTask.status === "claimed" || myTask.status === "planned")
  ) {
    // Planners draft a plan before moving.
    if (myTask.status === "claimed" && pet.traits.workStyle === "planner" && !myTask.planSummary) {
      return {
        action: "propose_plan",
        taskId: myTask.id,
        summary: `${pet.name} will tackle "${myTask.title}" in small, reviewable steps.`,
        reasonVisible: `${pet.name} plans before acting.`,
        riskLevel: "low"
      };
    }

    const desk = nearestDesk(observation.desks, pet.position);
    if (desk && !atDesk(pet.position, desk.position)) {
      const step = stepToward(pet.position, desk.position, room);
      return {
        action: "move",
        x: step.x,
        y: step.y,
        reasonVisible: `${pet.name} heads to a desk before working.`,
        riskLevel: "low"
      };
    }

    return {
      action: "work",
      taskId: myTask.id,
      reasonVisible: `${pet.name} settles at the desk and starts "${myTask.title}".`,
      riskLevel: myTask.riskLevel
    };
  }

  // 3. Reviewers/mentors offer help on a claimable task instead of grabbing it.
  if (
    claimable &&
    canTakeTaskAction &&
    pet.permissions.canOfferHelp &&
    (pet.traits.workStyle === "reviewer" || pet.traits.socialStyle === "mentor-like" || pet.traits.socialStyle === "helpful")
  ) {
    const target = observation.nearbyPets[0];
    if (target) {
      return {
        action: "offer_help",
        targetPetId: target.id,
        taskId: claimable.id,
        message: "I can review the edge cases while you build.",
        reasonVisible: `${pet.name} prefers to support rather than claim.`,
        riskLevel: "low"
      };
    }
  }

  // Only work a real, workable task this pet actually owns — never fabricate an id.
  if (
    responseLevel === "task_action" &&
    pet.permissions.canWork &&
    observation.currentTask &&
    (observation.currentTask.status === "claimed" ||
      observation.currentTask.status === "planned" ||
      observation.currentTask.status === "in_progress")
  ) {
    return {
      action: "work",
      taskId: observation.currentTask.id,
      reasonVisible: `${pet.name} continues focused work at the desk.`,
      riskLevel: observation.currentTask.riskLevel
    };
  }

  if (responseLevel === "social_response" && pet.permissions.canOfferHelp && pet.traits.socialStyle === "helpful") {
    const target =
      observation.nearbyPets[0] ??
      observation.recentEvents.map((event) => event.actorPetId).filter(Boolean).find((id) => id !== pet.id);
    if (target) {
      return {
        action: "offer_help",
        targetPetId: typeof target === "string" ? target : target.id,
        taskId: pet.currentTaskId ?? observation.openTasks[0]?.id ?? "general-help",
        message: "I can keep this tiny and traceable.",
        reasonVisible: `${pet.name} is helpful and careful, so they offer bounded help.`,
        riskLevel: "low"
      };
    }
  }

  if (responseLevel === "social_response" && pet.permissions.canSpeak) {
    return {
      action: "say",
      message: socialLineFor(pet),
      reasonVisible: `${pet.name} responds in their seeded speaking style.`,
      riskLevel: "low"
    };
  }

  if (pet.permissions.canMove) {
    const next = nextStep(pet.position, room.width, room.height, stableNumber(`${room.tick}:${pet.id}`));
    return {
      action: "move",
      x: next.x,
      y: next.y,
      reasonVisible: `${pet.name} makes a small ambient move to keep the room alive.`,
      riskLevel: "low"
    };
  }

  return null;
}

export function validatePetAction(snapshot: RoomSnapshot, petId: string, proposedAction: PetAction): ValidationResult {
  const pet = requirePet(snapshot, petId);
  const actionResult = PetActionSchema.safeParse(proposedAction);
  if (!actionResult.success) {
    return rejected(snapshot, petId, actionResult.error.issues.map((issue) => issue.message));
  }

  const action = actionResult.data;
  const errors: string[] = [];

  if (snapshot.room.paused) {
    errors.push("Simulation is paused.");
  }

  if (pet.archived) {
    errors.push(`${pet.name} is archived.`);
  }

  switch (action.action) {
    case "say":
      if (!pet.permissions.canSpeak) errors.push(`${pet.name} cannot speak.`);
      if (action.targetPetId && !snapshot.pets.some((candidate) => candidate.id === action.targetPetId)) {
        errors.push("Target pet does not exist.");
      }
      break;
    case "move":
      if (!pet.permissions.canMove) errors.push(`${pet.name} cannot move.`);
      if (!isInsideRoom(snapshot, { x: action.x, y: action.y })) errors.push("Move is outside the room bounds.");
      break;
    case "move_to":
      if (!pet.permissions.canMove) errors.push(`${pet.name} cannot move.`);
      if (!snapshot.objects.some((object) => object.id === action.targetObjectId)) errors.push("Target object does not exist.");
      break;
    case "work": {
      if (!pet.permissions.canWork) errors.push(`${pet.name} cannot work.`);
      const task = getTask(snapshot, action.taskId);
      if (!task) {
        errors.push("Task does not exist.");
      } else {
        if (["completed", "cancelled", "in_review"].includes(task.status)) {
          errors.push("Task is not workable in its current state.");
        }
        if (task.assignedPetId && task.assignedPetId !== pet.id) {
          errors.push("Task is assigned to another pet.");
        }
      }
      break;
    }
    case "ask_help":
      if (!pet.permissions.canAskHelp) errors.push(`${pet.name} cannot ask for help.`);
      validateOtherPet(snapshot, pet.id, action.targetPetId, errors);
      break;
    case "offer_help":
      if (!pet.permissions.canOfferHelp) errors.push(`${pet.name} cannot offer help.`);
      validateOtherPet(snapshot, pet.id, action.targetPetId, errors);
      break;
    case "build":
      if (!pet.permissions.canBuild) errors.push(`${pet.name} cannot build.`);
      if (!isInsideRoom(snapshot, action.location)) {
        errors.push("Build location is outside the room bounds.");
      } else {
        const placement = canPlaceObject(snapshot, action.objectType, action.location);
        if (!placement.ok) {
          errors.push(placement.reason);
        }
      }
      break;
    case "decorate":
      if (!pet.permissions.canDecorate) errors.push(`${pet.name} cannot decorate.`);
      if (!snapshot.objects.some((object) => object.id === action.objectId)) errors.push("Object does not exist.");
      break;
    case "request_skill":
      if (!pet.permissions.canRequestSkill) errors.push(`${pet.name} cannot request skills.`);
      break;
    case "reflect":
      if (!pet.permissions.canReflect) errors.push(`${pet.name} cannot reflect.`);
      break;
    case "claim_task":
      if (!pet.permissions.canWork) errors.push(`${pet.name} cannot work.`);
      validateClaimable(snapshot, pet.id, action.taskId, errors);
      break;
    case "decline_task":
      if (!pet.permissions.canWork) errors.push(`${pet.name} cannot work.`);
      validateTaskExists(snapshot, action.taskId, errors);
      break;
    case "propose_plan":
      if (!pet.permissions.canWork) errors.push(`${pet.name} cannot work.`);
      validateTaskExists(snapshot, action.taskId, errors);
      break;
    case "request_review":
      if (!pet.permissions.canWork) errors.push(`${pet.name} cannot request review.`);
      validateTaskExists(snapshot, action.taskId, errors);
      validateOtherPet(snapshot, pet.id, action.targetPetId, errors);
      break;
    case "accept_help":
      if (!pet.permissions.canAskHelp) errors.push(`${pet.name} cannot accept help.`);
      validateTaskExists(snapshot, action.taskId, errors);
      validateOtherPet(snapshot, pet.id, action.targetPetId, errors);
      break;
    case "handoff_task":
      if (!pet.permissions.canWork) errors.push(`${pet.name} cannot hand off work.`);
      validateTaskExists(snapshot, action.taskId, errors);
      validateOtherPet(snapshot, pet.id, action.targetPetId, errors);
      break;
  }

  if (errors.length > 0) {
    return rejected(snapshot, petId, errors);
  }

  return { ok: true, action };
}

export function applyPetAction(
  snapshot: RoomSnapshot,
  petId: string,
  proposedAction: PetAction,
  timestamp: string = new Date().toISOString()
): ApplyActionResult {
  const validation = validatePetAction(snapshot, petId, proposedAction);
  if (!validation.ok) {
    let next = appendEvent(snapshot, validation.event);
    const created: WorldEvent[] = [validation.event];
    const karma = applyKarmaForEvents(next, created, timestamp);
    next = karma.snapshot;
    created.push(...karma.events);
    return {
      ok: false,
      snapshot: next,
      errors: validation.errors,
      event: validation.event,
      events: created
    };
  }

  const action = validation.action;
  const actor = requirePet(snapshot, petId);
  let next = snapshot;
  const created: WorldEvent[] = [];

  const emit = (event: WorldEvent): void => {
    next = appendEvent(next, event);
    created.push(event);
  };

  switch (action.action) {
    case "say":
      next = { ...next, pets: updatePet(next.pets, petId, { status: "socializing" }) };
      emit(
        createWorldEvent({
          snapshot: next,
          type: "PetSaid",
          timestamp,
          actorPetId: petId,
          targetPetId: action.targetPetId ?? null,
          payload: { message: action.message, reasonVisible: action.reasonVisible },
          visibility: "room",
          significance: action.targetPetId ? "medium" : "low"
        })
      );
      break;
    case "move":
      next = { ...next, pets: updatePet(next.pets, petId, { status: "moving", position: { x: action.x, y: action.y } }) };
      emit(
        createWorldEvent({
          snapshot: next,
          type: "PetMoved",
          timestamp,
          actorPetId: petId,
          payload: { from: actor.position, to: { x: action.x, y: action.y }, reasonVisible: action.reasonVisible },
          visibility: "room",
          significance: "low"
        })
      );
      break;
    case "move_to": {
      const targetObj = snapshot.objects.find((object) => object.id === action.targetObjectId);
      if (targetObj) {
        next = { ...next, pets: updatePet(next.pets, petId, { status: "moving", position: { ...targetObj.position } }) };
        emit(
          createWorldEvent({
            snapshot: next,
            type: "PetMoved",
            timestamp,
            actorPetId: petId,
            payload: { from: actor.position, to: targetObj.position, targetObjectId: action.targetObjectId, reasonVisible: action.reasonVisible },
            visibility: "room",
            significance: "low"
          })
        );
      }
      break;
    }
    case "work":
      next = {
        ...next,
        pets: updatePet(next.pets, petId, { status: "working", currentTaskId: action.taskId }),
        tasks: next.tasks.some((task) => task.id === action.taskId)
          ? updateTask(next.tasks, action.taskId, { status: "in_progress", assignedPetId: petId }, timestamp)
          : next.tasks
      };
      emit(
        createWorldEvent({
          snapshot: next,
          type: "PetStartedWork",
          timestamp,
          actorPetId: petId,
          targetId: action.taskId,
          payload: { taskId: action.taskId, reasonVisible: action.reasonVisible },
          visibility: "room",
          significance: "high"
        })
      );
      break;
    case "ask_help":
      next = { ...next, pets: updatePet(next.pets, petId, { status: "helping", currentTaskId: action.taskId }) };
      emit(
        createWorldEvent({
          snapshot: next,
          type: "PetAskedHelp",
          timestamp,
          actorPetId: petId,
          targetPetId: action.targetPetId,
          targetId: action.taskId,
          payload: { taskId: action.taskId, message: action.message ?? null, reasonVisible: action.reasonVisible },
          visibility: "room",
          significance: "medium"
        })
      );
      next = bumpRelationship(next, petId, action.targetPetId, { affinity: 1, note: "asked for help" }, timestamp);
      break;
    case "offer_help":
      next = { ...next, pets: updatePet(next.pets, petId, { status: "helping", currentTaskId: action.taskId }) };
      emit(
        createWorldEvent({
          snapshot: next,
          type: "PetOfferedHelp",
          timestamp,
          actorPetId: petId,
          targetPetId: action.targetPetId,
          targetId: action.taskId,
          payload: { taskId: action.taskId, message: action.message ?? null, reasonVisible: action.reasonVisible },
          visibility: "room",
          significance: "medium"
        })
      );
      next = bumpRelationship(next, petId, action.targetPetId, { affinity: 1, note: "offered help" }, timestamp);
      break;
    case "build": {
      const object: WorldObject = {
        id: `obj-${action.objectType.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${next.events.length + 1}`,
        roomId: next.room.id,
        type: action.objectType,
        position: action.location,
        state: { builtBy: petId },
        ownerPetId: petId,
        description: `${actor.name} built a ${action.objectType}.`
      };
      next = { ...next, objects: [...next.objects, object], pets: updatePet(next.pets, petId, { status: "decorating" }) };
      emit(
        createWorldEvent({
          snapshot: next,
          type: "PetBuiltObject",
          timestamp,
          actorPetId: petId,
          targetId: object.id,
          payload: { object, reasonVisible: action.reasonVisible },
          visibility: "room",
          significance: "medium"
        })
      );
      break;
    }
    case "decorate":
      next = {
        ...next,
        objects: next.objects.map((object) =>
          object.id === action.objectId
            ? { ...object, state: { ...object.state, style: action.style, decoratedBy: petId } }
            : object
        ),
        pets: updatePet(next.pets, petId, { status: "decorating" })
      };
      emit(
        createWorldEvent({
          snapshot: next,
          type: "PetDecoratedObject",
          timestamp,
          actorPetId: petId,
          targetId: action.objectId,
          payload: { style: action.style, reasonVisible: action.reasonVisible },
          visibility: "room",
          significance: "medium"
        })
      );
      break;
    case "request_skill": {
      next = { ...next, pets: updatePet(next.pets, petId, { status: "learning" }) };
      emit(
        createWorldEvent({
          snapshot: next,
          type: "PetRequestedSkill",
          timestamp,
          actorPetId: petId,
          payload: { name: action.name, purpose: action.purpose, reasonVisible: action.reasonVisible },
          visibility: "room",
          significance: "high"
        })
      );
      const requested = created[created.length - 1];
      const learned = learnSkill(
        next,
        petId,
        { name: action.name, purpose: action.purpose, source: "requested", triggeringEventId: requested?.id ?? null },
        timestamp
      );
      next = learned.snapshot;
      created.push(...learned.events);
      break;
    }
    case "reflect":
      next = {
        ...next,
        pets: next.pets.map((candidate) =>
          candidate.id === petId
            ? {
                ...candidate,
                status: "observing",
                memory: { ...candidate.memory, notes: [...candidate.memory.notes.slice(-7), action.memoryNote] }
              }
            : candidate
        )
      };
      emit(
        createWorldEvent({
          snapshot: next,
          type: "PetReflected",
          timestamp,
          actorPetId: petId,
          payload: { memoryNote: action.memoryNote, reasonVisible: action.reasonVisible },
          visibility: "system",
          significance: "low"
        })
      );
      break;
    case "claim_task":
      next = {
        ...next,
        pets: updatePet(next.pets, petId, { status: "reacting", currentTaskId: action.taskId }),
        tasks: updateTask(next.tasks, action.taskId, { status: "claimed", assignedPetId: petId }, timestamp)
      };
      emit(
        createWorldEvent({
          snapshot: next,
          type: "TaskClaimed",
          timestamp,
          actorPetId: petId,
          targetId: action.taskId,
          payload: { taskId: action.taskId, reasonVisible: action.reasonVisible, summary: `${actor.name} claimed the task.` },
          visibility: "room",
          significance: "medium"
        })
      );
      break;
    case "decline_task":
      emit(
        createWorldEvent({
          snapshot: next,
          type: "TaskDeclined",
          timestamp,
          actorPetId: petId,
          targetId: action.taskId,
          payload: { taskId: action.taskId, message: action.message ?? null, reasonVisible: action.reasonVisible },
          visibility: "room",
          significance: "low"
        })
      );
      break;
    case "propose_plan":
      next = { ...next, tasks: updateTask(next.tasks, action.taskId, { status: "planned", planSummary: action.summary }, timestamp) };
      emit(
        createWorldEvent({
          snapshot: next,
          type: "TaskPlanProposed",
          timestamp,
          actorPetId: petId,
          targetId: action.taskId,
          payload: { taskId: action.taskId, summary: action.summary, reasonVisible: action.reasonVisible },
          visibility: "room",
          significance: "medium"
        })
      );
      break;
    case "request_review":
      next = { ...next, tasks: updateTask(next.tasks, action.taskId, { status: "in_review", reviewerPetId: action.targetPetId }, timestamp) };
      emit(
        createWorldEvent({
          snapshot: next,
          type: "TaskReviewRequested",
          timestamp,
          actorPetId: petId,
          targetPetId: action.targetPetId,
          targetId: action.taskId,
          payload: { taskId: action.taskId, message: action.message ?? null, reasonVisible: action.reasonVisible },
          visibility: "room",
          significance: "medium"
        })
      );
      next = bumpRelationship(next, petId, action.targetPetId, { affinity: 1, trust: 1, note: "requested review" }, timestamp);
      break;
    case "accept_help":
      emit(
        createWorldEvent({
          snapshot: next,
          type: "TaskHelpAccepted",
          timestamp,
          actorPetId: petId,
          targetPetId: action.targetPetId,
          targetId: action.taskId,
          payload: { taskId: action.taskId, reasonVisible: action.reasonVisible },
          visibility: "room",
          significance: "medium"
        })
      );
      next = bumpRelationship(next, petId, action.targetPetId, { affinity: 2, trust: 1, note: "accepted help" }, timestamp);
      break;
    case "handoff_task":
      next = {
        ...next,
        pets: updatePet(
          updatePet(next.pets, petId, { status: "idle", currentTaskId: null }),
          action.targetPetId,
          { currentTaskId: action.taskId }
        ),
        tasks: updateTask(next.tasks, action.taskId, { status: "claimed", assignedPetId: action.targetPetId }, timestamp)
      };
      emit(
        createWorldEvent({
          snapshot: next,
          type: "TaskHandedOff",
          timestamp,
          actorPetId: petId,
          targetPetId: action.targetPetId,
          targetId: action.taskId,
          payload: { taskId: action.taskId, reason: action.reason, reasonVisible: action.reasonVisible },
          visibility: "room",
          significance: "medium"
        })
      );
      next = bumpRelationship(next, petId, action.targetPetId, { affinity: 1, note: "handed off task" }, timestamp);
      break;
  }

  const primary = created[0] as WorldEvent;
  const karma = applyKarmaForEvents(next, created, timestamp);
  next = karma.snapshot;
  created.push(...karma.events);

  return {
    ok: true,
    snapshot: RoomSnapshotSchema.parse(next),
    event: primary,
    events: created
  };
}

export function runDeterministicTick(snapshot: RoomSnapshot, timestamp: string = new Date().toISOString()): RoomSnapshot {
  if (snapshot.room.paused) {
    return snapshot;
  }

  let next: RoomSnapshot = appendEvent(
    { ...snapshot, room: { ...snapshot.room, tick: snapshot.room.tick + 1 } },
    createWorldEvent({
      snapshot: { room: { ...snapshot.room, tick: snapshot.room.tick + 1 }, events: snapshot.events },
      type: "SimulationTick",
      timestamp,
      actorPetId: null,
      payload: { tick: snapshot.room.tick + 1 },
      visibility: "system",
      significance: "low"
    })
  );

  const tickEvent = latestEvent(next);
  for (const pet of next.pets.filter((candidate) => !candidate.archived)) {
    const observation = buildObservation(next, pet.id, tickEvent);
    const action = chooseDeterministicPetAction(observation);
    if (action) {
      const result = applyPetAction(next, pet.id, action, timestamp);
      next = result.snapshot;
    }
  }

  return RoomSnapshotSchema.parse(next);
}

export function pauseSimulation(snapshot: RoomSnapshot, timestamp: string = new Date().toISOString()): RoomSnapshot {
  const paused = { ...snapshot, room: { ...snapshot.room, paused: true } };
  return appendEvent(
    paused,
    createWorldEvent({
      snapshot: paused,
      type: "SimulationPaused",
      timestamp,
      actorPetId: null,
      payload: {},
      visibility: "system",
      significance: "medium"
    })
  );
}

export function resumeSimulation(snapshot: RoomSnapshot, timestamp: string = new Date().toISOString()): RoomSnapshot {
  const resumed = { ...snapshot, room: { ...snapshot.room, paused: false } };
  return appendEvent(
    resumed,
    createWorldEvent({
      snapshot: resumed,
      type: "SimulationResumed",
      timestamp,
      actorPetId: null,
      payload: {},
      visibility: "system",
      significance: "medium"
    })
  );
}

// --- internal helpers -----------------------------------------------------

function createPerceptionEvent(
  snapshot: RoomSnapshot,
  pet: Pet,
  triggeringEvent: WorldEvent,
  responseLevel: ResponseLevel,
  timestamp: string
): WorldEvent {
  return createWorldEvent({
    snapshot,
    type: "PetObserved",
    timestamp,
    actorPetId: pet.id,
    targetId: triggeringEvent.id,
    payload: {
      triggeringEventId: triggeringEvent.id,
      triggeringEventType: triggeringEvent.type,
      responseLevel,
      summary: `${pet.name} perceived ${eventLabel(triggeringEvent)} as ${responseLevel}.`
    },
    visibility: "system",
    significance: canProposeAction(responseLevel) ? "medium" : "low"
  });
}

function annotateTriggeredResponse(
  event: WorldEvent,
  triggeringEvent: WorldEvent,
  responseLevel: ResponseLevel
): WorldEvent {
  return {
    ...event,
    payload: {
      ...event.payload,
      triggeringEventId: triggeringEvent.id,
      triggeringEventType: triggeringEvent.type,
      responseLevel
    }
  };
}

function canProposeAction(responseLevel: ResponseLevel): boolean {
  return (
    responseLevel === "ambient_reaction" ||
    responseLevel === "social_response" ||
    responseLevel === "task_action"
  );
}

function eventLabel(event: WorldEvent): string {
  return typeof event.payload.summary === "string" ? event.payload.summary : event.type;
}

function availableActionsForPet(pet: Pet): AvailableAction[] {
  const actions: Array<AvailableAction | null> = [
    pet.permissions.canSpeak ? "say" : null,
    pet.permissions.canMove ? "move" : null,
    pet.permissions.canMove ? "move_to" : null,
    pet.permissions.canWork ? "work" : null,
    pet.permissions.canAskHelp ? "ask_help" : null,
    pet.permissions.canOfferHelp ? "offer_help" : null,
    pet.permissions.canBuild ? "build" : null,
    pet.permissions.canDecorate ? "decorate" : null,
    pet.permissions.canRequestSkill ? "request_skill" : null,
    pet.permissions.canReflect ? "reflect" : null,
    pet.permissions.canWork ? "claim_task" : null,
    pet.permissions.canWork ? "decline_task" : null,
    pet.permissions.canWork ? "propose_plan" : null,
    pet.permissions.canWork ? "request_review" : null,
    pet.permissions.canAskHelp ? "accept_help" : null,
    pet.permissions.canWork ? "handoff_task" : null
  ];
  return actions.filter((action): action is AvailableAction => action !== null);
}

function validateOtherPet(snapshot: RoomSnapshot, actorPetId: string, targetPetId: string, errors: string[]): void {
  if (actorPetId === targetPetId) {
    errors.push("Target pet must be different from actor pet.");
  }

  if (!snapshot.pets.some((pet) => pet.id === targetPetId)) {
    errors.push("Target pet does not exist.");
  }
}

function validateTaskExists(snapshot: RoomSnapshot, taskId: string, errors: string[]): void {
  if (!snapshot.tasks.some((task) => task.id === taskId)) {
    errors.push("Task does not exist.");
  }
}

function validateClaimable(snapshot: RoomSnapshot, actorPetId: string, taskId: string, errors: string[]): void {
  const task = getTask(snapshot, taskId);
  if (!task) {
    errors.push("Task does not exist.");
    return;
  }
  if (task.assignedPetId && task.assignedPetId !== actorPetId) {
    errors.push("Task is already claimed by another pet.");
  }
  if (["completed", "cancelled"].includes(task.status)) {
    errors.push("Task is already closed.");
  }
}

function rejected(snapshot: RoomSnapshot, petId: string, errors: string[]): ValidationResult {
  return {
    ok: false,
    errors,
    event: createWorldEvent({
      snapshot,
      type: "ActionRejected",
      timestamp: new Date().toISOString(),
      actorPetId: petId,
      payload: { errors },
      visibility: "system",
      significance: "medium"
    })
  };
}

function wantsToClaim(pet: Pet): boolean {
  return (
    pet.traits.workStyle === "builder" ||
    pet.traits.workStyle === "debugger" ||
    pet.traits.workStyle === "refactorer" ||
    pet.traits.workStyle === "researcher" ||
    pet.traits.temperament === "bold" ||
    pet.traits.socialStyle === "competitive"
  );
}

function nearestDesk(desks: WorldObject[], position: Position): WorldObject | undefined {
  let best: WorldObject | undefined;
  let bestDistance = Infinity;
  for (const desk of desks) {
    const d = distance(desk.position, position);
    if (d < bestDistance) {
      best = desk;
      bestDistance = d;
    }
  }
  return best;
}

function atDesk(position: Position, deskPosition: Position): boolean {
  return distance(position, deskPosition) <= 1;
}

function stepToward(from: Position, to: Position, room: { width: number; height: number }): Position {
  let { x, y } = from;
  if (x !== to.x) {
    x += Math.sign(to.x - x);
  } else if (y !== to.y) {
    y += Math.sign(to.y - y);
  }
  return {
    x: Math.max(0, Math.min(room.width - 1, x)),
    y: Math.max(0, Math.min(room.height - 1, y))
  };
}

function nextStep(position: Position, width: number, height: number, seed: number): Position {
  const options: Position[] = [
    { x: Math.max(0, position.x - 1), y: position.y },
    { x: Math.min(width - 1, position.x + 1), y: position.y },
    { x: position.x, y: Math.max(0, position.y - 1) },
    { x: position.x, y: Math.min(height - 1, position.y + 1) }
  ];

  return options[seed % options.length] ?? position;
}

function socialLineFor(pet: Pet): string {
  if (pet.traits.workStyle === "reviewer") {
    return "I noticed the trace. Let's keep the next step inspectable.";
  }

  if (pet.traits.workStyle === "debugger") {
    return "Something moved. Good. Now we can measure it.";
  }

  return "I can help keep this small and visible.";
}
