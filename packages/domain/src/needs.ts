import type { Pet, PetNeeds, RoomSnapshot } from "@pet-sanctuary/contracts";
import { updatePet } from "./helpers.js";

/**
 * Intrinsic drives (PRD §"feels alive"). Needs decay every tick and, when low,
 * bias a pet toward a restoring action on otherwise-quiet ticks. This module is
 * pure and deterministic — no model calls, no events — so it runs identically
 * whether or not the AI route is enabled.
 */

/** Below this, a need is "wanting" — enough to motivate action on a quiet tick. */
export const NEED_WANT_THRESHOLD = 35;
/** Below this, a need is critical — it can outrank ordinary task pull. */
export const NEED_CRITICAL_THRESHOLD = 12;
/**
 * Hysteresis: once a pet starts satisfying a need it keeps at it until the need
 * climbs back above this (higher than the entry threshold) so goals don't flip
 * every tick. Consumed by the goal arbitration in Slice 3.
 */
export const NEED_SATISFIED_EXIT = 60;

type NeedKey = keyof PetNeeds;

/** Per-tick baseline decay for each need (clamped at 0). */
const BASE_DECAY: PetNeeds = { energy: 2, focus: 1, social: 1, curiosity: 1 };

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * Decay (and, for the pet's current activity, partially restore) every active
 * pet's needs by one tick. Returns a new snapshot; intentionally emits no world
 * events (need changes are surfaced via the snapshot, not the public feed).
 */
export function decayNeeds(snapshot: RoomSnapshot): RoomSnapshot {
  if (snapshot.room.paused) {
    return snapshot;
  }

  let next = snapshot;
  for (const pet of snapshot.pets) {
    if (pet.archived || pet.status === "paused") {
      continue;
    }
    next = { ...next, pets: updatePet(next.pets, pet.id, { needs: stepNeeds(pet) }) };
  }
  return next;
}

/** Pure: the next-tick needs for one pet, given what it is currently doing. */
export function stepNeeds(pet: Pet): PetNeeds {
  const n = pet.needs;
  const next: PetNeeds = {
    energy: clamp(n.energy - BASE_DECAY.energy + activityDelta(pet.status, "energy")),
    focus: clamp(n.focus - BASE_DECAY.focus + activityDelta(pet.status, "focus")),
    social: clamp(n.social - BASE_DECAY.social + activityDelta(pet.status, "social")),
    curiosity: clamp(n.curiosity - BASE_DECAY.curiosity + activityDelta(pet.status, "curiosity"))
  };
  return next;
}

/**
 * How the pet's current activity modulates a need on top of the baseline decay.
 * Working drains energy/focus harder; socializing restores social; resting
 * (idle/observing) restores energy; learning/observing feeds curiosity.
 */
function activityDelta(status: Pet["status"], need: NeedKey): number {
  switch (status) {
    case "working":
      return need === "energy" ? -3 : need === "focus" ? -2 : 0;
    case "socializing":
    case "helping":
      return need === "social" ? +6 : 0;
    case "learning":
      return need === "curiosity" ? +6 : need === "focus" ? +1 : 0;
    case "idle":
    case "observing":
      return need === "energy" ? +4 : need === "curiosity" ? +2 : 0;
    case "moving":
      return need === "energy" ? -1 : 0;
    default:
      return 0;
  }
}

/** The lowest need and its value, for goal/action arbitration. */
export function lowestNeed(needs: PetNeeds): { key: NeedKey; value: number } {
  const entries = Object.entries(needs) as [NeedKey, number][];
  return entries.reduce(
    (lowest, [key, value]) => (value < lowest.value ? { key, value } : lowest),
    { key: "energy" as NeedKey, value: needs.energy }
  );
}

/** True when any need is low enough to motivate a quiet-tick action. */
export function hasWantingNeed(needs: PetNeeds): boolean {
  return lowestNeed(needs).value < NEED_WANT_THRESHOLD;
}
