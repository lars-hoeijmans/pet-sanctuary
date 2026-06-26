import type {
  CreateTaskRequest,
  RoomSnapshot,
  Task,
  WorldEvent
} from "@pet-sanctuary/contracts";
import { appendEvent, createWorldEvent, findPet, updatePet } from "./helpers.js";
import { applyKarmaForEvents } from "./karma.js";
import { learnSkill } from "./skills.js";

/**
 * Task lifecycle + collaboration (PRD §10, Phase 2) and the application of agent
 * task-run outcomes (Phase 5). All functions are pure: they take a snapshot and
 * return a new snapshot plus the world events they produced.
 */

export function getTask(snapshot: RoomSnapshot, taskId: string): Task | undefined {
  return snapshot.tasks.find((task) => task.id === taskId);
}

export function updateTask(tasks: Task[], taskId: string, patch: Partial<Task>, timestamp: string): Task[] {
  return tasks.map((task) => (task.id === taskId ? { ...task, ...patch, updatedAt: timestamp } : task));
}

/**
 * Create a user/manager task. Emits a high-significance, room-visible TaskCreated
 * event so the perception pass lets every active pet notice it and some claim it.
 */
export function createTask(
  snapshot: RoomSnapshot,
  request: CreateTaskRequest,
  createdBy: string,
  timestamp: string
): { snapshot: RoomSnapshot; task: Task; event: WorldEvent } {
  const task: Task = {
    id: `task-${snapshot.tasks.length + 1}`,
    roomId: snapshot.room.id,
    title: request.title,
    description: request.description ?? "",
    status: request.assignedPetId ? "claimed" : "open",
    createdBy,
    assignedPetId: request.assignedPetId ?? null,
    reviewerPetId: null,
    planSummary: null,
    outputRef: null,
    transcriptRef: null,
    riskLevel: request.riskLevel ?? "low",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  // When a task is created already assigned to a pet, link that pet to it so the
  // assignee can actually drive it (otherwise it is "claimed" with no owner state).
  let next: RoomSnapshot = {
    ...snapshot,
    tasks: [...snapshot.tasks, task],
    pets: task.assignedPetId ? updatePet(snapshot.pets, task.assignedPetId, { currentTaskId: task.id }) : snapshot.pets
  };

  const event = createWorldEvent({
    snapshot: next,
    type: "TaskCreated",
    timestamp,
    actorPetId: null,
    targetPetId: task.assignedPetId,
    targetId: task.id,
    payload: {
      taskId: task.id,
      title: task.title,
      riskLevel: task.riskLevel,
      assignedPetId: task.assignedPetId,
      summary: `A new task was posted: "${task.title}".`
    },
    visibility: "room",
    significance: "high"
  });
  next = appendEvent(next, event);

  return { snapshot: next, task, event };
}

/** Outcome shape returned by an agent task runtime (kept domain-local to avoid a
 * dependency cycle with the agent-runtime package). */
export interface TaskRunOutcome {
  status: "completed" | "needs_review" | "blocked";
  summary: string;
  outputRef?: string | null;
  steps?: string[];
  learnedSkill?: {
    name: string;
    description?: string;
    purpose?: string | null;
  } | null;
}

/**
 * Apply the result of running a task at a pet's desk. Streams TaskProgressed
 * events for each step, then completes / requests review / blocks the task. On
 * completion a learned skill may be created (auto-applied if virtual, staged if
 * it implies real tool access).
 */
export function applyTaskResult(
  snapshot: RoomSnapshot,
  taskId: string,
  outcome: TaskRunOutcome,
  timestamp: string
): { snapshot: RoomSnapshot; events: WorldEvent[] } {
  const task = getTask(snapshot, taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const petId = task.assignedPetId;
  const pet = findPet(snapshot, petId);
  const events: WorldEvent[] = [];
  let next = snapshot;

  for (const step of outcome.steps ?? []) {
    const progressEvent = createWorldEvent({
      snapshot: next,
      type: "TaskProgressed",
      timestamp,
      actorPetId: petId ?? null,
      targetId: taskId,
      payload: { taskId, note: step, summary: `${pet?.name ?? "A pet"}: ${step}` },
      visibility: "room",
      significance: "low"
    });
    next = appendEvent(next, progressEvent);
    events.push(progressEvent);
  }

  if (outcome.status === "completed") {
    next = {
      ...next,
      tasks: updateTask(next.tasks, taskId, { status: "completed", outputRef: outcome.outputRef ?? null }, timestamp)
    };
    if (petId) {
      next = { ...next, pets: updatePet(next.pets, petId, { status: "idle", currentTaskId: null }) };
    }
    const completedEvent = createWorldEvent({
      snapshot: next,
      type: "TaskCompleted",
      timestamp,
      actorPetId: petId ?? null,
      targetId: taskId,
      payload: { taskId, summary: outcome.summary, outputRef: outcome.outputRef ?? null },
      visibility: "room",
      significance: "high"
    });
    next = appendEvent(next, completedEvent);
    events.push(completedEvent);

    if (outcome.learnedSkill && petId) {
      const learned = learnSkill(
        next,
        petId,
        {
          name: outcome.learnedSkill.name,
          description: outcome.learnedSkill.description ?? "",
          purpose: outcome.learnedSkill.purpose ?? null,
          source: "learned",
          triggeringEventId: completedEvent.id
        },
        timestamp
      );
      next = learned.snapshot;
      events.push(...learned.events);
    }
  } else if (outcome.status === "needs_review") {
    next = {
      ...next,
      tasks: updateTask(next.tasks, taskId, { status: "in_review", outputRef: outcome.outputRef ?? null }, timestamp)
    };
    // Free the pet so it is not stuck "working" on a task awaiting review.
    if (petId) {
      next = { ...next, pets: updatePet(next.pets, petId, { status: "observing", currentTaskId: null }) };
    }
    const reviewEvent = createWorldEvent({
      snapshot: next,
      type: "TaskProgressed",
      timestamp,
      actorPetId: petId ?? null,
      targetId: taskId,
      payload: { taskId, note: outcome.summary, summary: `${pet?.name ?? "A pet"} submitted "${task.title}" for review.` },
      visibility: "room",
      significance: "medium"
    });
    next = appendEvent(next, reviewEvent);
    events.push(reviewEvent);
  } else {
    next = { ...next, tasks: updateTask(next.tasks, taskId, { status: "blocked" }, timestamp) };
    if (petId) {
      next = { ...next, pets: updatePet(next.pets, petId, { status: "idle", currentTaskId: null }) };
    }
    const blockedEvent = createWorldEvent({
      snapshot: next,
      type: "TaskBlocked",
      timestamp,
      actorPetId: petId ?? null,
      targetId: taskId,
      payload: { taskId, summary: outcome.summary },
      visibility: "room",
      significance: "medium"
    });
    next = appendEvent(next, blockedEvent);
    events.push(blockedEvent);
  }

  // Apply karma for the task events once (e.g. TaskCompleted +3, learned skill +1).
  const karma = applyKarmaForEvents(next, events, timestamp);
  next = karma.snapshot;
  events.push(...karma.events);

  return { snapshot: next, events };
}

/** Find the next open, unassigned task a pet could claim. */
export function nextClaimableTask(snapshot: RoomSnapshot): Task | undefined {
  return snapshot.tasks.find((task) => task.status === "open" && !task.assignedPetId);
}

/** Tasks that are assigned and ready for the runtime to execute. */
export function runnableTasks(snapshot: RoomSnapshot): Task[] {
  return snapshot.tasks.filter(
    (task) => task.status === "in_progress" && task.assignedPetId && !task.outputRef
  );
}
