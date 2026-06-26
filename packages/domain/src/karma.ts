import type { KarmaTrustLabel, RoomSnapshot, WorldEvent } from "@pet-sanctuary/contracts";
import { appendEvent, createWorldEvent, requirePet, updatePet } from "./helpers.js";

/**
 * Karma is a playful social score and a lightweight permission signal (PRD §12).
 * It never grants real shell/network access — that stays approval-gated server-side.
 */

export interface KarmaChange {
  petId: string;
  delta: number;
  reason: string;
}

/**
 * Karma rules keyed by the world event a pet just produced. The delta is applied
 * to the event's actor. Positive: prosocial / safe / completed work. Negative:
 * blocked attempts and virtual destruction.
 */
const KARMA_RULES: Partial<Record<WorldEvent["type"], number>> = {
  PetOfferedHelp: 1,
  TaskHelpAccepted: 1,
  TaskCompleted: 3,
  TaskClaimed: 1,
  TaskPlanProposed: 1,
  TaskReviewRequested: 1,
  PetBuiltObject: 1,
  PetDecoratedObject: 1,
  PetLearnedSkill: 1,
  PetReflected: 1,
  TaskHandedOff: 0,
  ActionRejected: -1
};

export function karmaDeltaForEvent(event: WorldEvent): number {
  // A pet decorating an object with a destructive style loses karma instead.
  if (event.type === "PetDecoratedObject" && isDestructiveStyle(event.payload.style)) {
    return -1;
  }
  return KARMA_RULES[event.type] ?? 0;
}

function isDestructiveStyle(style: unknown): boolean {
  if (typeof style !== "string") {
    return false;
  }
  return /broke|broken|smash|wreck|sabotage|trash/i.test(style);
}

export function karmaReasonForEvent(event: WorldEvent): string {
  switch (event.type) {
    case "PetOfferedHelp":
      return "Offered help to another pet.";
    case "TaskHelpAccepted":
      return "Accepted collaborative help.";
    case "TaskCompleted":
      return "Completed user-approved work.";
    case "TaskClaimed":
      return "Claimed an open task.";
    case "TaskPlanProposed":
      return "Proposed a plan before risky work.";
    case "TaskReviewRequested":
      return "Asked for review before completing.";
    case "PetBuiltObject":
      return "Built something useful in the room.";
    case "PetDecoratedObject":
      return isDestructiveStyle(event.payload.style)
        ? "Damaged a shared object."
        : "Improved a shared object.";
    case "PetLearnedSkill":
      return "Learned or improved a reusable skill.";
    case "PetReflected":
      return "Reflected to keep behavior inspectable.";
    case "ActionRejected":
      return "Attempted a blocked or invalid action.";
    default:
      return "Karma adjustment.";
  }
}

/**
 * Apply karma for a single just-created event and, when there is a delta, append
 * a visible KarmaChanged event. Returns the (possibly unchanged) snapshot plus
 * any karma events produced so callers can thread them into the cascade.
 */
export function applyKarmaForEvent(
  snapshot: RoomSnapshot,
  event: WorldEvent,
  timestamp: string
): { snapshot: RoomSnapshot; events: WorldEvent[] } {
  const petId = event.actorPetId;
  if (!petId) {
    return { snapshot, events: [] };
  }

  const delta = karmaDeltaForEvent(event);
  if (delta === 0) {
    return { snapshot, events: [] };
  }

  return applyKarma(snapshot, petId, delta, karmaReasonForEvent(event), timestamp, event.id);
}

/**
 * Apply karma for a batch of just-created events, in order. This is the single
 * place karma is applied so it can never be double-counted: callers append their
 * action events, then pass them here once. KarmaChanged events carry no rule and
 * are therefore inert if passed back in.
 */
export function applyKarmaForEvents(
  snapshot: RoomSnapshot,
  events: WorldEvent[],
  timestamp: string
): { snapshot: RoomSnapshot; events: WorldEvent[] } {
  let next = snapshot;
  const karmaEvents: WorldEvent[] = [];
  for (const event of events) {
    const result = applyKarmaForEvent(next, event, timestamp);
    next = result.snapshot;
    karmaEvents.push(...result.events);
  }
  return { snapshot: next, events: karmaEvents };
}

export function applyKarma(
  snapshot: RoomSnapshot,
  petId: string,
  delta: number,
  reason: string,
  timestamp: string,
  triggeringEventId: string | null = null
): { snapshot: RoomSnapshot; events: WorldEvent[] } {
  if (delta === 0) {
    return { snapshot, events: [] };
  }

  const pet = requirePet(snapshot, petId);
  const nextKarma = pet.karma + delta;
  const pets = updatePet(snapshot.pets, petId, { karma: nextKarma });

  const karmaEvent = createWorldEvent({
    snapshot,
    type: "KarmaChanged",
    timestamp,
    actorPetId: petId,
    targetId: triggeringEventId,
    payload: {
      delta,
      karma: nextKarma,
      reason,
      trust: karmaTrustLabel(nextKarma),
      summary: `${pet.name} ${delta > 0 ? "gained" : "lost"} ${Math.abs(delta)} karma — ${reason}`
    },
    visibility: "system",
    significance: "low"
  });

  const next = appendEvent({ ...snapshot, pets }, karmaEvent);
  return { snapshot: next, events: [karmaEvent] };
}

export function karmaTrustLabel(karma: number): KarmaTrustLabel {
  if (karma < 0) {
    return "wary";
  }
  if (karma >= 10) {
    return "revered";
  }
  if (karma >= 4) {
    return "trusted";
  }
  return "neutral";
}

/**
 * Karma effect: trusted pets may perform higher-risk *virtual* actions (build,
 * destructive-style decorate) without explicit user confirmation. This never
 * applies to real tool/skill access, which is always approval-gated.
 */
export function canActWithoutConfirmation(karma: number): boolean {
  return karmaTrustLabel(karma) === "trusted" || karmaTrustLabel(karma) === "revered";
}
