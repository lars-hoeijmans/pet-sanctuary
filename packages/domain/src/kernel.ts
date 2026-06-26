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
  type WorldEvent,
  type WorldObject
} from "@pet-sanctuary/contracts";

export type ValidationResult =
  | { ok: true; action: PetAction }
  | { ok: false; errors: string[]; event: WorldEvent };

export type ApplyActionResult =
  | { ok: true; snapshot: RoomSnapshot; event: WorldEvent }
  | { ok: false; snapshot: RoomSnapshot; errors: string[]; event: WorldEvent };

export interface ProcessWorldEventOptions {
  chooseAction?: (observation: AgentObservation) => PetAction | null;
}

export interface ProcessWorldEventResult {
  snapshot: RoomSnapshot;
  triggeringEvent: WorldEvent;
  events: WorldEvent[];
}

export const SEED_ROOM_ID = "living-room";

const defaultPermissions = {
  canSpeak: true,
  canMove: true,
  canWork: true,
  canAskHelp: true,
  canOfferHelp: true,
  canBuild: true,
  canDecorate: true,
  canRequestSkill: true,
  canReflect: true
};

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
      permissions: defaultPermissions,
      position: { x: 2, y: 4 },
      currentTaskId: null,
      memory: {
        summary: "Remembers that helpful actions should leave the room easier to understand.",
        notes: ["Started in the Living Room Kernel seed."]
      }
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
      permissions: defaultPermissions,
      position: { x: 5, y: 3 },
      currentTaskId: null,
      memory: {
        summary: "Remembers to review behavior through visible events rather than private chats.",
        notes: ["Started in the Living Room Kernel seed."]
      }
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
      permissions: defaultPermissions,
      position: { x: 8, y: 5 },
      currentTaskId: null,
      memory: {
        summary: "Remembers that debugging starts by making traces visible.",
        notes: ["Started in the Living Room Kernel seed."]
      }
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

  const events: WorldEvent[] = [
    createEvent({
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

  return RoomSnapshotSchema.parse({ room, pets, objects, events });
}

export function createRoomNoticeEvent(
  snapshot: RoomSnapshot,
  request: CreateRoomEventRequest,
  timestamp: string = new Date().toISOString()
): WorldEvent {
  return createEvent({
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

  for (const pet of next.pets.filter((candidate) => candidate.status !== "paused")) {
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
    const annotatedEvent = annotateTriggeredResponse(result.event, event, observation.responseLevel);
    next = replaceEvent(result.snapshot, annotatedEvent);
    events.push(annotatedEvent);
  }

  return {
    snapshot: RoomSnapshotSchema.parse(next),
    triggeringEvent: event,
    events
  };
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
    nearbyPets: snapshot.pets.filter((candidate) => candidate.id !== pet.id && distance(candidate.position, pet.position) <= radius),
    objectsNearby: snapshot.objects.filter((object) => distance(object.position, pet.position) <= radius),
    recentEvents: snapshot.events.slice(-8),
    availableActions: availableActionsForPet(pet),
    responseLevel
  };
}

export function classifyResponseLevel(
  snapshot: RoomSnapshot,
  petId: string,
  event: WorldEvent | null = latestEvent(snapshot)
): ResponseLevel {
  const pet = requirePet(snapshot, petId);

  if (snapshot.room.paused || pet.status === "paused") {
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

  const cadence = stableNumber(`${snapshot.room.tick}:${pet.id}:${event.id}`) % 5;
  if (cadence === 0 && pet.permissions.canMove) {
    return "ambient_reaction";
  }
  if (cadence === 1) {
    return "internal_reaction";
  }

  return "observe_only";
}

export function chooseDeterministicPetAction(observation: AgentObservation): PetAction | null {
  const { pet, room, responseLevel } = observation;

  if (responseLevel === "observe_only" || responseLevel === "internal_reaction") {
    return null;
  }

  if (responseLevel === "task_action" && pet.permissions.canWork) {
    return {
      action: "work",
      taskId: pet.currentTaskId ?? "demo-trace-polish",
      reasonVisible: `${pet.name} turns the visible trace into a small work loop.`,
      riskLevel: "low"
    };
  }

  if (responseLevel === "social_response" && pet.permissions.canOfferHelp && pet.traits.socialStyle === "helpful") {
    const target = observation.nearbyPets[0] ?? observation.recentEvents.map((event) => event.actorPetId).filter(Boolean).find((id) => id !== pet.id);
    if (target) {
      return {
        action: "offer_help",
        targetPetId: typeof target === "string" ? target : target.id,
        taskId: pet.currentTaskId ?? "demo-trace-polish",
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
    case "work":
      if (!pet.permissions.canWork) errors.push(`${pet.name} cannot work.`);
      break;
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
      if (!isInsideRoom(snapshot, action.location)) errors.push("Build location is outside the room bounds.");
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
    return {
      ok: false,
      snapshot: appendEvent(snapshot, validation.event),
      errors: validation.errors,
      event: validation.event
    };
  }

  const action = validation.action;
  const actor = requirePet(snapshot, petId);
  let nextPets = snapshot.pets;
  let nextObjects = snapshot.objects;
  let event: WorldEvent;

  switch (action.action) {
    case "say":
      nextPets = updatePet(nextPets, petId, { status: "socializing" });
      event = createEvent({
        snapshot,
        type: "PetSaid",
        timestamp,
        actorPetId: petId,
        targetPetId: action.targetPetId ?? null,
        payload: { message: action.message, reasonVisible: action.reasonVisible },
        visibility: "room",
        significance: action.targetPetId ? "medium" : "low"
      });
      break;
    case "move":
      nextPets = updatePet(nextPets, petId, { status: "moving", position: { x: action.x, y: action.y } });
      event = createEvent({
        snapshot,
        type: "PetMoved",
        timestamp,
        actorPetId: petId,
        payload: { from: actor.position, to: { x: action.x, y: action.y }, reasonVisible: action.reasonVisible },
        visibility: "room",
        significance: "low"
      });
      break;
    case "work":
      nextPets = updatePet(nextPets, petId, { status: "working", currentTaskId: action.taskId });
      event = createEvent({
        snapshot,
        type: "PetStartedWork",
        timestamp,
        actorPetId: petId,
        targetId: action.taskId,
        payload: { taskId: action.taskId, reasonVisible: action.reasonVisible },
        visibility: "room",
        significance: "high"
      });
      break;
    case "ask_help":
      nextPets = updatePet(nextPets, petId, { status: "helping", currentTaskId: action.taskId });
      event = createEvent({
        snapshot,
        type: "PetAskedHelp",
        timestamp,
        actorPetId: petId,
        targetPetId: action.targetPetId,
        targetId: action.taskId,
        payload: { taskId: action.taskId, message: action.message ?? null, reasonVisible: action.reasonVisible },
        visibility: "room",
        significance: "medium"
      });
      break;
    case "offer_help":
      nextPets = updatePet(nextPets, petId, { status: "helping", currentTaskId: action.taskId });
      event = createEvent({
        snapshot,
        type: "PetOfferedHelp",
        timestamp,
        actorPetId: petId,
        targetPetId: action.targetPetId,
        targetId: action.taskId,
        payload: { taskId: action.taskId, message: action.message ?? null, reasonVisible: action.reasonVisible },
        visibility: "room",
        significance: "medium"
      });
      break;
    case "build": {
      const object: WorldObject = {
        id: `obj-${action.objectType.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${snapshot.events.length + 1}`,
        roomId: snapshot.room.id,
        type: action.objectType,
        position: action.location,
        state: { builtBy: petId },
        ownerPetId: petId,
        description: `${actor.name} built a ${action.objectType}.`
      };
      nextObjects = [...snapshot.objects, object];
      nextPets = updatePet(nextPets, petId, { status: "decorating" });
      event = createEvent({
        snapshot,
        type: "PetBuiltObject",
        timestamp,
        actorPetId: petId,
        targetId: object.id,
        payload: { object, reasonVisible: action.reasonVisible },
        visibility: "room",
        significance: "medium"
      });
      break;
    }
    case "decorate":
      nextObjects = snapshot.objects.map((object) =>
        object.id === action.objectId
          ? { ...object, state: { ...object.state, style: action.style, decoratedBy: petId } }
          : object
      );
      nextPets = updatePet(nextPets, petId, { status: "decorating" });
      event = createEvent({
        snapshot,
        type: "PetDecoratedObject",
        timestamp,
        actorPetId: petId,
        targetId: action.objectId,
        payload: { style: action.style, reasonVisible: action.reasonVisible },
        visibility: "room",
        significance: "medium"
      });
      break;
    case "request_skill":
      nextPets = updatePet(nextPets, petId, { status: "learning" });
      event = createEvent({
        snapshot,
        type: "PetRequestedSkill",
        timestamp,
        actorPetId: petId,
        payload: { name: action.name, purpose: action.purpose, reasonVisible: action.reasonVisible },
        visibility: "room",
        significance: "high"
      });
      break;
    case "reflect":
      nextPets = snapshot.pets.map((candidate) =>
        candidate.id === petId
          ? {
              ...candidate,
              status: "observing",
              memory: { ...candidate.memory, notes: [...candidate.memory.notes.slice(-7), action.memoryNote] }
            }
          : candidate
      );
      event = createEvent({
        snapshot,
        type: "PetReflected",
        timestamp,
        actorPetId: petId,
        payload: { memoryNote: action.memoryNote, reasonVisible: action.reasonVisible },
        visibility: "system",
        significance: "low"
      });
      break;
  }

  return {
    ok: true,
    snapshot: RoomSnapshotSchema.parse({
      room: snapshot.room,
      pets: nextPets,
      objects: nextObjects,
      events: [...snapshot.events, event]
    }),
    event
  };
}

export function runDeterministicTick(snapshot: RoomSnapshot, timestamp: string = new Date().toISOString()): RoomSnapshot {
  if (snapshot.room.paused) {
    return snapshot;
  }

  let next: RoomSnapshot = {
    ...snapshot,
    room: { ...snapshot.room, tick: snapshot.room.tick + 1 },
    events: [
      ...snapshot.events,
      createEvent({
        snapshot,
        type: "SimulationTick",
        timestamp,
        actorPetId: null,
        payload: { tick: snapshot.room.tick + 1 },
        visibility: "system",
        significance: "low"
      })
    ]
  };

  const tickEvent = latestEvent(next);
  for (const pet of next.pets) {
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
    createEvent({
      snapshot,
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
    createEvent({
      snapshot,
      type: "SimulationResumed",
      timestamp,
      actorPetId: null,
      payload: {},
      visibility: "system",
      significance: "medium"
    })
  );
}

function createEvent(input: {
  snapshot: Pick<RoomSnapshot, "room" | "events">;
  type: WorldEvent["type"];
  timestamp: string;
  actorPetId: string | null;
  targetPetId?: string | null;
  targetId?: string | null;
  payload: Record<string, unknown>;
  visibility: WorldEvent["visibility"];
  significance: WorldEvent["significance"];
}): WorldEvent {
  return {
    id: `evt-${input.snapshot.room.tick}-${input.snapshot.events.length + 1}-${input.type}`,
    roomId: input.snapshot.room.id,
    type: input.type,
    timestamp: input.timestamp,
    actorPetId: input.actorPetId,
    targetPetId: input.targetPetId ?? null,
    targetId: input.targetId ?? null,
    payload: input.payload,
    visibility: input.visibility,
    significance: input.significance
  };
}

function createPerceptionEvent(
  snapshot: RoomSnapshot,
  pet: Pet,
  triggeringEvent: WorldEvent,
  responseLevel: ResponseLevel,
  timestamp: string
): WorldEvent {
  return createEvent({
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

function replaceEvent(snapshot: RoomSnapshot, event: WorldEvent): RoomSnapshot {
  return RoomSnapshotSchema.parse({
    ...snapshot,
    events: snapshot.events.map((existing) => (existing.id === event.id ? event : existing))
  });
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
  return [
    pet.permissions.canSpeak ? "say" : null,
    pet.permissions.canMove ? "move" : null,
    pet.permissions.canWork ? "work" : null,
    pet.permissions.canAskHelp ? "ask_help" : null,
    pet.permissions.canOfferHelp ? "offer_help" : null,
    pet.permissions.canBuild ? "build" : null,
    pet.permissions.canDecorate ? "decorate" : null,
    pet.permissions.canRequestSkill ? "request_skill" : null,
    pet.permissions.canReflect ? "reflect" : null
  ].filter((action): action is AvailableAction => action !== null);
}

function appendEvent(snapshot: RoomSnapshot, event: WorldEvent): RoomSnapshot {
  return RoomSnapshotSchema.parse({ ...snapshot, events: [...snapshot.events, event] });
}

function latestEvent(snapshot: RoomSnapshot): WorldEvent | null {
  return snapshot.events.at(-1) ?? null;
}

function requirePet(snapshot: RoomSnapshot, petId: string): Pet {
  const pet = snapshot.pets.find((candidate) => candidate.id === petId);
  if (!pet) {
    throw new Error(`Pet not found: ${petId}`);
  }
  return pet;
}

function updatePet(pets: Pet[], petId: string, patch: Partial<Pet>): Pet[] {
  return pets.map((pet) => (pet.id === petId ? { ...pet, ...patch } : pet));
}

function isInsideRoom(snapshot: RoomSnapshot, position: Position): boolean {
  return position.x < snapshot.room.width && position.y < snapshot.room.height;
}

function validateOtherPet(snapshot: RoomSnapshot, actorPetId: string, targetPetId: string, errors: string[]): void {
  if (actorPetId === targetPetId) {
    errors.push("Target pet must be different from actor pet.");
  }

  if (!snapshot.pets.some((pet) => pet.id === targetPetId)) {
    errors.push("Target pet does not exist.");
  }
}

function rejected(snapshot: RoomSnapshot, petId: string, errors: string[]): ValidationResult {
  return {
    ok: false,
    errors,
    event: createEvent({
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

function distance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function isNearby(snapshot: RoomSnapshot, petId: string, otherPetId: string, radius: number): boolean {
  const pet = requirePet(snapshot, petId);
  const other = requirePet(snapshot, otherPetId);
  return distance(pet.position, other.position) <= radius;
}

function stableNumber(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
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
