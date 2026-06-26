import type { AgentObservation, PetAction, Position, WorldObject } from "@pet-sanctuary/contracts";
import { distance, stableNumber } from "./helpers.js";

/**
 * Goal decomposition: turn a pet's persistent intention into ONE concrete action
 * for this tick. This is what lets a goal survive across ticks — the engine walks
 * the pet to a desk over several ticks and only then works, without re-deciding.
 *
 * Pure and deterministic (operates on the observation), so it backs both the
 * deterministic policy and the live runtime's "pursue goal without a model call"
 * fast path. Returns null when the goal is finished, blocked, or invalid — the
 * signal to re-consult the model for a fresh goal.
 */

const TERMINAL_TASK_STATUSES = ["completed", "cancelled", "in_review"];

/** Whether the pet's current goal still refers to something it can act on. */
export function goalStillValid(observation: AgentObservation): boolean {
  const goal = observation.pet.goal;
  if (!goal) {
    return false;
  }
  switch (goal.kind) {
    case "work_task": {
      const task = observation.currentTask;
      if (!task || (goal.targetId && task.id !== goal.targetId)) {
        return false;
      }
      if (TERMINAL_TASK_STATUSES.includes(task.status)) {
        return false;
      }
      return !task.assignedPetId || task.assignedPetId === observation.pet.id;
    }
    case "socialize":
      // Valid while the target is still in view (or an untargeted "mingle" goal).
      return goal.targetId == null || observation.nearbyPets.some((pet) => pet.id === goal.targetId);
    case "rest":
    case "explore":
    case "reflect":
    case "idle":
      return true;
    default:
      return false;
  }
}

export function deriveActionFromGoal(observation: AgentObservation): PetAction | null {
  const { pet } = observation;
  const goal = pet.goal;
  if (!goal || !goalStillValid(observation)) {
    return null;
  }

  switch (goal.kind) {
    case "work_task":
      return driveWorkGoal(observation);
    case "socialize":
      return driveSocializeGoal(observation);
    case "rest":
      return driveRestGoal(observation);
    case "explore":
      return driveExploreGoal(observation);
    case "reflect":
      return pet.permissions.canReflect
        ? {
            action: "reflect",
            memoryNote: `${pet.name} takes a beat to reflect on the room.`,
            reasonVisible: `${pet.name} pauses to reflect.`,
            riskLevel: "low"
          }
        : null;
    case "idle":
    default:
      return null;
  }
}

function driveWorkGoal(observation: AgentObservation): PetAction | null {
  const { pet } = observation;
  const task = observation.currentTask;
  if (!task || !pet.permissions.canWork) {
    return null;
  }

  // Planners sketch a plan before settling in.
  if (task.status === "claimed" && pet.traits.workStyle === "planner" && !task.planSummary) {
    return {
      action: "propose_plan",
      taskId: task.id,
      summary: `${pet.name} will tackle "${task.title}" in small, reviewable steps.`,
      reasonVisible: `${pet.name} plans before acting.`,
      riskLevel: "low"
    };
  }

  const desk = nearest(observation.desks, pet.position);
  if (desk && distance(pet.position, desk.position) > 1) {
    // Already walking? Let the physics step carry the pet there.
    if (pet.status === "moving" && pet.path.length > 0) {
      return null;
    }
    return {
      action: "move_to",
      targetObjectId: desk.id,
      reasonVisible: `${pet.name} heads to a desk before working.`,
      riskLevel: "low"
    };
  }

  if (["claimed", "planned", "in_progress"].includes(task.status)) {
    return {
      action: "work",
      taskId: task.id,
      reasonVisible: `${pet.name} settles in and works on "${task.title}".`,
      riskLevel: task.riskLevel
    };
  }
  return null;
}

function driveSocializeGoal(observation: AgentObservation): PetAction | null {
  const { pet } = observation;
  const target = goalTarget(observation) ?? observation.nearbyPets[0];
  if (!target) {
    return null;
  }

  if (distance(pet.position, target.position) > 1 && pet.permissions.canMove) {
    if (pet.status === "moving" && pet.path.length > 0) {
      return null;
    }
    return {
      action: "move",
      x: target.position.x,
      y: target.position.y,
      reasonVisible: `${pet.name} drifts over toward ${target.name}.`,
      riskLevel: "low"
    };
  }

  if (pet.permissions.canSpeak) {
    return {
      action: "say",
      message: "Mind if I keep you company for a bit?",
      targetPetId: target.id,
      reasonVisible: `${pet.name} strikes up a friendly chat.`,
      riskLevel: "low"
    };
  }
  return null;
}

function driveRestGoal(observation: AgentObservation): PetAction | null {
  const { pet } = observation;
  const couch = observation.objectsNearby.find((object) => object.type === "couch");
  if (!couch || !pet.permissions.canMove) {
    return null;
  }
  if (distance(pet.position, couch.position) > 0) {
    if (pet.status === "moving" && pet.path.length > 0) {
      return null;
    }
    return {
      action: "move_to",
      targetObjectId: couch.id,
      reasonVisible: `${pet.name} settles toward the couch to recharge.`,
      riskLevel: "low"
    };
  }
  return null; // already resting
}

function driveExploreGoal(observation: AgentObservation): PetAction | null {
  const { pet, room } = observation;
  if (!pet.permissions.canMove) {
    return null;
  }
  if (pet.status === "moving" && pet.path.length > 0) {
    return null;
  }
  // Deterministic wander target seeded by tick+pet so it varies but replays.
  const seed = stableNumber(`${room.tick}:${pet.id}:explore`);
  const target: Position = {
    x: seed % room.width,
    y: Math.floor(seed / room.width) % room.height
  };
  if (target.x === pet.position.x && target.y === pet.position.y) {
    return null;
  }
  return {
    action: "move",
    x: target.x,
    y: target.y,
    reasonVisible: `${pet.name} wanders to take a fresh look around.`,
    riskLevel: "low"
  };
}

function goalTarget(observation: AgentObservation) {
  const id = observation.pet.goal?.targetId;
  return id ? observation.nearbyPets.find((pet) => pet.id === id) : undefined;
}

function nearest(objects: WorldObject[], position: Position): WorldObject | undefined {
  let best: WorldObject | undefined;
  let bestDistance = Infinity;
  for (const object of objects) {
    const d = distance(object.position, position);
    if (d < bestDistance) {
      best = object;
      bestDistance = d;
    }
  }
  return best;
}
