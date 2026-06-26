import type { Position, RoomSnapshot } from "@pet-sanctuary/contracts";

/**
 * Placement ruleset — the authoritative guard on where (and how much) furniture
 * may exist in a room. It lives in the domain so EVERY build path is bound by it:
 * deterministic ticks, mock builds, and real-agent builds alike. This is what
 * keeps a room from becoming a wall of six fridges or an unwalkable clutter —
 * and gives agents that build their own environment a consistent contract.
 */

/** Max objects of a given (normalized) type allowed in one room. */
export const TYPE_CAPS: Record<string, number> = {
  desk: 3,
  chair: 6,
  seat: 6,
  stool: 6,
  couch: 2,
  sofa: 2,
  lounge: 2,
  plant: 4,
  lamp: 3,
  table: 2,
  meeting_table: 2,
  bookshelf: 2,
  bookcase: 2,
  cabinet: 2,
  notice: 2,
  notice_board: 2,
  whiteboard: 2,
  board: 2,
  tv: 2,
  television: 2,
  terminal: 3,
  computer: 3,
  server_rack: 2,
  server: 2,
  fridge: 2,
  coffee_machine: 1,
  rug: 3
};

/** Cap applied to any type without an explicit entry above. */
export const DEFAULT_TYPE_CAP = 4;

/** No room may have more than this fraction of its tiles covered by objects. */
export const MAX_ROOM_DENSITY = 0.35;

export type PlacementResult = { ok: true } | { ok: false; reason: string };

function normalizeType(type: string): string {
  return type.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function capFor(type: string): number {
  return TYPE_CAPS[normalizeType(type)] ?? DEFAULT_TYPE_CAP;
}

/**
 * The authoritative rule: may an object of `type` be placed at `position`?
 * Assumes bounds were already checked by the caller; enforces overlap, per-type
 * caps, and an overall density ceiling.
 */
export function canPlaceObject(
  snapshot: RoomSnapshot,
  type: string,
  position: Position
): PlacementResult {
  // One object per tile — no stacking on the same anchor.
  if (snapshot.objects.some((object) => object.position.x === position.x && object.position.y === position.y)) {
    return { ok: false, reason: "That tile is already occupied." };
  }

  // Never build on top of a pet (which would occlude or trap it).
  if (snapshot.pets.some((pet) => pet.position.x === position.x && pet.position.y === position.y)) {
    return { ok: false, reason: "A pet is standing on that tile." };
  }

  // Per-type cap (prevents e.g. six fridges in a row).
  const sameType = snapshot.objects.filter((object) => normalizeType(object.type) === normalizeType(type)).length;
  if (sameType >= capFor(type)) {
    return { ok: false, reason: `The room already has the maximum number of "${type}" objects.` };
  }

  // Density ceiling (hard cap on overall clutter).
  const capacity = snapshot.room.width * snapshot.room.height;
  if (capacity > 0 && (snapshot.objects.length + 1) / capacity > MAX_ROOM_DENSITY) {
    return { ok: false, reason: "The room is too crowded to build another object." };
  }

  return { ok: true };
}
