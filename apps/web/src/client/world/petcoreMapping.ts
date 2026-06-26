/**
 * Pure mappers: pet-core `@pet-sanctuary/contracts` shapes → the agent-city
 * `src/protocol` world model the UI + Phaser scene already speak.
 *
 * This is the entire seam between the two domains. Keeping it pure (no I/O) makes
 * it trivially testable and keeps `PetCoreWorldSource` focused on transport.
 */
import type {
  Pet as ContractPet,
  PetStatus as ContractPetStatus,
  RoomSnapshot as ContractRoomSnapshot,
  Skill as ContractSkill,
  Task as ContractTask,
  WorldEvent as ContractWorldEvent,
  WorldObject as ContractWorldObject,
} from "@pet-sanctuary/contracts";
import type {
  AgentAvatar,
  AgentIdentity,
  AgentRuntime,
  AgentStatus,
  AgentTask,
  AgentView,
  GridPos,
  ObjectKind,
  TaskStatus,
  WorldEvent,
  WorldObject,
  WorldSnapshot,
} from "../../protocol/index";

const ROOM_NS = "main";

// --- enum + scalar maps ----------------------------------------------------

const STATUS_BY_PET_STATUS: Record<ContractPetStatus, AgentStatus> = {
  idle: "idle",
  observing: "thinking",
  reacting: "thinking",
  socializing: "talking",
  moving: "idle", // movement is shown via agent.move animation, not a status
  working: "coding",
  helping: "talking",
  decorating: "building",
  learning: "learning",
  paused: "offline",
};

export function petStatusToAgentStatus(status: ContractPetStatus): AgentStatus {
  return STATUS_BY_PET_STATUS[status] ?? "idle";
}

// pet-core object `type` is a free string; collapse it onto the 12 ObjectKinds.
const KIND_BY_TYPE: Record<string, ObjectKind> = {
  desk: "desk",
  chair: "chair",
  plant: "plant",
  pottedplant: "plant",
  serverrack: "server_rack",
  server_rack: "server_rack",
  fridge: "server_rack",
  kitchenfridgelarge: "server_rack",
  whiteboard: "whiteboard",
  terminal: "terminal",
  computer: "terminal",
  computerscreen: "terminal",
  television: "terminal",
  televisionmodern: "terminal",
  tv: "terminal",
  table: "meeting_table",
  tablecross: "meeting_table",
  meetingtable: "meeting_table",
  meeting_table: "meeting_table",
  lamp: "lamp",
  lampsquarefloor: "lamp",
  bookshelf: "bookshelf",
  bookcase: "bookshelf",
  bookcaseopen: "bookshelf",
  bookcaseclosedwide: "bookshelf",
  coffeemachine: "coffee_machine",
  coffee_machine: "coffee_machine",
  kitchencoffeemachine: "coffee_machine",
  sofa: "sofa",
  couch: "sofa",
  loungesofa: "sofa",
  notice: "notice_board",
  noticeboard: "notice_board",
  notice_board: "notice_board",
};

export function objectTypeToKind(type: string): ObjectKind {
  const norm = type.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const snake = type.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return KIND_BY_TYPE[norm] ?? KIND_BY_TYPE[snake] ?? "desk";
}

export function spriteToAvatar(sprite: string): AgentAvatar {
  const s = sprite.toLowerCase();
  if (s.includes("robot")) return "robot";
  if (s.includes("wizard")) return "wizard";
  if (s.includes("infra")) return "infra";
  if (s.includes("hoodie")) return "hoodie";
  return "default";
}

export function runtimeToAgentRuntime(kind: string | undefined): AgentRuntime {
  switch (kind) {
    case "hermes":
      return "hermes";
    case "ai_sdk":
    case "pi":
      return "custom";
    case "deterministic":
    default:
      return "mock";
  }
}

// Pet has no display color; derive a stable one from the id.
const PALETTE = ["#7c5cff", "#ff5c8a", "#22c55e", "#38bdf8", "#f59e0b", "#e879f9", "#34d399", "#fb7185"];
export function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length] ?? PALETTE[0];
}

const TASK_STATUS_BY_CONTRACT: Record<ContractTask["status"], TaskStatus> = {
  open: "open",
  claimed: "claimed",
  planned: "claimed",
  in_progress: "claimed",
  in_review: "claimed",
  completed: "completed",
  blocked: "failed",
  cancelled: "failed",
};

// --- entity mappers --------------------------------------------------------

export function mapPet(pet: ContractPet, skills: readonly ContractSkill[] = []): AgentView {
  return {
    id: pet.id,
    name: pet.name,
    role: pet.tagline,
    avatar: spriteToAvatar(pet.sprite),
    color: colorForId(pet.id),
    runtime: runtimeToAgentRuntime(pet.runtime?.kind),
    position: { x: pet.position.x, y: pet.position.y, roomId: ROOM_NS },
    status: pet.archived ? "offline" : petStatusToAgentStatus(pet.status),
    currentTask: pet.currentTaskId ?? undefined,
    skills: skills.filter((s) => s.petId === pet.id && s.status === "active").map((s) => s.name),
    memorySummary: pet.memory?.summary,
  };
}

export function mapObject(object: ContractWorldObject): WorldObject {
  return {
    id: object.id,
    kind: objectTypeToKind(object.type),
    position: { x: object.position.x, y: object.position.y, roomId: ROOM_NS },
    ownerAgentId: object.ownerPetId ?? undefined,
    label: object.description,
  };
}

export function mapTask(task: ContractTask): AgentTask {
  const completed = task.status === "completed";
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: TASK_STATUS_BY_CONTRACT[task.status] ?? "open",
    createdByAgentId: task.createdBy === "manager" ? undefined : task.createdBy,
    assignedAgentId: task.assignedPetId ?? undefined,
    result: completed ? (task.planSummary ?? task.outputRef ?? undefined) : undefined,
    artifactIds: [],
    createdAt: Date.parse(task.createdAt) || 0,
    updatedAt: Date.parse(task.updatedAt) || 0,
  };
}

export function mapSnapshot(snapshot: ContractRoomSnapshot): WorldSnapshot {
  const skills = snapshot.skills ?? [];
  const agents: Record<string, AgentView> = {};
  for (const pet of snapshot.pets ?? []) agents[pet.id] = mapPet(pet, skills);

  const objects: Record<string, WorldObject> = {};
  for (const object of snapshot.objects ?? []) objects[object.id] = mapObject(object);

  const events: WorldEvent[] = [];
  for (const event of snapshot.events ?? []) {
    const mapped = mapEvent(event, snapshot);
    if (mapped) events.push(mapped);
  }
  events.sort((a, b) => b.ts - a.ts);

  return {
    seq: snapshot.room?.tick ?? 0,
    agents,
    objects,
    artifacts: [], // pet-core has no artifact concept (yet)
    messages: [],
    tasks: (snapshot.tasks ?? []).map(mapTask),
    conversations: {},
    events: events.slice(0, 300),
  };
}

// --- event mapper ----------------------------------------------------------

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asGridPos(value: unknown): GridPos | undefined {
  if (value && typeof value === "object") {
    const candidate = value as { x?: unknown; y?: unknown };
    if (typeof candidate.x === "number" && typeof candidate.y === "number") {
      return { x: candidate.x, y: candidate.y, roomId: ROOM_NS };
    }
  }
  return undefined;
}

function titleCase(eventType: string): string {
  return eventType.replace(/([a-z])([A-Z])/g, "$1 $2");
}

/**
 * Map a pet-core WorldEvent to an agent-city WorldEvent. Returns null for events
 * that have no meaningful representation in the redesign (simulation ticks, seed,
 * pure-data karma/relationship churn with no summary).
 */
export function mapEvent(event: ContractWorldEvent, snapshot?: ContractRoomSnapshot): WorldEvent | null {
  const base = { eventId: event.id, ts: Date.parse(event.timestamp) || 0 };
  const actor = event.actorPetId ?? undefined;
  const payload = (event.payload ?? {}) as Record<string, unknown>;

  switch (event.type) {
    case "PetMoved": {
      const to = asGridPos(payload.to);
      if (!actor || !to) return null;
      return { ...base, type: "agent.move", agentId: actor, to, reason: asString(payload.reasonVisible) };
    }
    case "PetSaid": {
      const text = asString(payload.message);
      if (!actor || !text) return null;
      const toId = event.targetPetId ?? undefined;
      if (toId) {
        return {
          ...base,
          type: "agent.message.sent",
          message: { id: event.id, fromAgentId: actor, toAgentId: toId, message: text, createdAt: base.ts },
        };
      }
      return { ...base, type: "agent.say", agentId: actor, text };
    }
    case "PetAskedHelp":
    case "PetOfferedHelp": {
      if (!actor) return null;
      const text =
        asString(payload.message) ?? (event.type === "PetAskedHelp" ? "Can someone help with this?" : "I can help with that.");
      return { ...base, type: "agent.say", agentId: actor, text };
    }
    case "PetStartedWork": {
      if (!actor) return null;
      return { ...base, type: "agent.status", agentId: actor, status: "coding", currentTask: asString(payload.taskId) };
    }
    case "PetBuiltObject": {
      const object = payload.object;
      if (!actor || !object || typeof object !== "object") return null;
      return { ...base, type: "agent.build", agentId: actor, object: mapObject(object as ContractWorldObject) };
    }
    case "PetDecoratedObject": {
      if (!actor) return null;
      return { ...base, type: "agent.status", agentId: actor, status: "building" };
    }
    case "PetReflected": {
      const note = asString(payload.memoryNote);
      if (!actor || !note) return null;
      return { ...base, type: "agent.memory.updated", agentId: actor, memorySummary: note };
    }
    case "PetLearnedSkill": {
      const name = asString(payload.name);
      if (!actor || !name) return null;
      return { ...base, type: "agent.skill.learned", agentId: actor, skill: name };
    }
    case "PetObserved": {
      if (!actor) return null;
      return { ...base, type: "agent.heartbeat", agentId: actor, status: "thinking" };
    }
    case "PetCreated": {
      const id = event.targetId ?? actor;
      const pet = snapshot?.pets?.find((p) => p.id === id);
      if (!pet) return null;
      const view = mapPet(pet, snapshot?.skills ?? []);
      const identity: AgentIdentity = {
        id: view.id,
        name: view.name,
        role: view.role,
        avatar: view.avatar,
        color: view.color,
        runtime: view.runtime,
        workspace: view.workspace,
      };
      return { ...base, type: "agent.register", agent: identity, initialPosition: view.position };
    }
    case "PetArchived":
    case "PetPaused": {
      const id = event.targetId ?? actor;
      if (!id) return null;
      return { ...base, type: "agent.status", agentId: id, status: "offline" };
    }
    case "PetUnpaused": {
      const id = event.targetId ?? actor;
      if (!id) return null;
      return { ...base, type: "agent.status", agentId: id, status: "idle" };
    }
    case "TaskCreated": {
      const id = event.targetId ?? asString(payload.taskId);
      if (!id) return null;
      const task = snapshot?.tasks?.find((t) => t.id === id);
      if (task) return { ...base, type: "task.created", task: mapTask(task) };
      return {
        ...base,
        type: "task.created",
        task: {
          id,
          title: asString(payload.title) ?? asString(payload.summary) ?? "New task",
          description: asString(payload.description) ?? "",
          status: "open",
          createdByAgentId: actor,
          createdAt: base.ts,
          updatedAt: base.ts,
        },
      };
    }
    case "TaskClaimed": {
      const id = event.targetId ?? asString(payload.taskId);
      if (!id || !actor) return null;
      return { ...base, type: "task.claimed", taskId: id, agentId: actor };
    }
    case "TaskCompleted": {
      const id = event.targetId ?? asString(payload.taskId);
      if (!id || !actor) return null;
      return { ...base, type: "task.completed", taskId: id, agentId: actor, result: asString(payload.summary) ?? "" };
    }
    case "TaskProgressed": {
      if (!actor) return null;
      return {
        ...base,
        type: "agent.status",
        agentId: actor,
        status: "coding",
        currentTask: event.targetId ?? asString(payload.taskId),
      };
    }
    case "TaskBlocked": {
      if (!actor) return null;
      return { ...base, type: "agent.status", agentId: actor, status: "blocked" };
    }
    case "RoomNotice":
    case "ActionRejected": {
      const message =
        asString(payload.summary) ??
        asString(payload.message) ??
        (Array.isArray(payload.errors) ? (payload.errors as unknown[]).join(", ") : undefined) ??
        titleCase(event.type);
      const rejected = event.type === "ActionRejected";
      return {
        ...base,
        type: "world.notification",
        title: rejected ? "Action rejected" : "Room notice",
        message,
        severity: rejected ? "warning" : event.significance === "high" ? "warning" : "info",
      };
    }
    // Phase-6 / collaboration churn with no dedicated redesign UI: surface only
    // when the backend gave us a human summary, otherwise drop as noise.
    case "TaskDeclined":
    case "TaskPlanProposed":
    case "TaskReviewRequested":
    case "TaskHelpAccepted":
    case "TaskHandedOff":
    case "PetRequestedSkill":
    case "SkillApproved":
    case "SkillRejected":
    case "ApprovalRequested":
    case "ApprovalResolved":
    case "KarmaChanged":
    case "RelationshipChanged": {
      const message = asString(payload.summary) ?? asString(payload.message);
      if (!message) return null;
      return {
        ...base,
        type: "world.notification",
        title: titleCase(event.type),
        message,
        severity: event.significance === "high" ? "warning" : "info",
      };
    }
    // Lifecycle / housekeeping handled via snapshots + demo-state, not the feed.
    case "RoomSeeded":
    case "SimulationTick":
    case "SimulationPaused":
    case "SimulationResumed":
    default:
      return null;
  }
}
