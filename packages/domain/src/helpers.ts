import {
  type Pet,
  type Position,
  type Relationship,
  type RoomSnapshot,
  RoomSnapshotSchema,
  type WorldEvent
} from "@pet-sanctuary/contracts";

/**
 * Shared, framework-free utilities used by the world engine modules
 * (kernel, tasks, karma, skills, relationships). Keeping them here avoids
 * duplicating the event-id scheme and snapshot bookkeeping across modules.
 */

export interface CreateWorldEventInput {
  snapshot: Pick<RoomSnapshot, "room" | "events">;
  type: WorldEvent["type"];
  timestamp: string;
  actorPetId: string | null;
  targetPetId?: string | null;
  targetId?: string | null;
  payload: Record<string, unknown>;
  visibility: WorldEvent["visibility"];
  significance: WorldEvent["significance"];
}

/**
 * Deterministic, collision-free event id as long as the caller appends each
 * event to the snapshot before creating the next one (every world-engine path
 * does this). The id encodes the tick and the running event count.
 */
export function createWorldEvent(input: CreateWorldEventInput): WorldEvent {
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

export function parseSnapshot(snapshot: RoomSnapshot): RoomSnapshot {
  return RoomSnapshotSchema.parse(snapshot);
}

export function appendEvent(snapshot: RoomSnapshot, event: WorldEvent): RoomSnapshot {
  return parseSnapshot({ ...snapshot, events: [...snapshot.events, event] });
}

export function replaceEvent(snapshot: RoomSnapshot, event: WorldEvent): RoomSnapshot {
  return parseSnapshot({
    ...snapshot,
    events: snapshot.events.map((existing) => (existing.id === event.id ? event : existing))
  });
}

export function latestEvent(snapshot: RoomSnapshot): WorldEvent | null {
  return snapshot.events.at(-1) ?? null;
}

export function requirePet(snapshot: RoomSnapshot, petId: string): Pet {
  const pet = snapshot.pets.find((candidate) => candidate.id === petId);
  if (!pet) {
    throw new Error(`Pet not found: ${petId}`);
  }
  return pet;
}

export function findPet(snapshot: RoomSnapshot, petId: string | null | undefined): Pet | undefined {
  if (!petId) {
    return undefined;
  }
  return snapshot.pets.find((candidate) => candidate.id === petId);
}

export function updatePet(pets: Pet[], petId: string, patch: Partial<Pet>): Pet[] {
  return pets.map((pet) => (pet.id === petId ? { ...pet, ...patch } : pet));
}

export function isInsideRoom(snapshot: RoomSnapshot, position: Position): boolean {
  return (
    position.x >= 0 &&
    position.y >= 0 &&
    position.x < snapshot.room.width &&
    position.y < snapshot.room.height
  );
}

export function distance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function positionKey(position: Position): string {
  return `${position.x},${position.y}`;
}

/**
 * Deterministic shortest-path on the room grid (4-connected BFS). Returns the
 * route from `from` to `to` **excluding** `from` and **including** `to`, so the
 * physics step can pop one tile per tick. Neighbours are explored x-before-y to
 * match the legacy `stepToward` ordering, keeping movement stable/replayable.
 *
 * `blocked` is a set of "x,y" tile keys to treat as impassable; it is currently
 * passed empty (object tiles are valid destinations) but kept as a seam for
 * future obstacle avoidance. Returns [] when `to` is unreachable or equals `from`.
 */
export function findPath(
  from: Position,
  to: Position,
  room: { width: number; height: number },
  blocked: Set<string> = new Set()
): Position[] {
  if (from.x === to.x && from.y === to.y) {
    return [];
  }

  const toKey = positionKey(to);
  const startKey = positionKey(from);
  const visited = new Set<string>([startKey]);
  const cameFrom = new Map<string, Position>();
  const queue: Position[] = [from];

  while (queue.length > 0) {
    const current = queue.shift() as Position;
    if (positionKey(current) === toKey) {
      // Reconstruct, then drop the start tile.
      const reversed: Position[] = [];
      let cursor: Position | undefined = current;
      while (cursor && positionKey(cursor) !== startKey) {
        reversed.push(cursor);
        cursor = cameFrom.get(positionKey(cursor));
      }
      return reversed.reverse();
    }

    // x-before-y neighbour order (matches stepToward: horizontal first).
    const neighbours: Position[] = [
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 }
    ];
    for (const neighbour of neighbours) {
      if (neighbour.x < 0 || neighbour.y < 0 || neighbour.x >= room.width || neighbour.y >= room.height) {
        continue;
      }
      const key = positionKey(neighbour);
      // The destination is always enterable even if otherwise "blocked".
      if (visited.has(key) || (blocked.has(key) && key !== toKey)) {
        continue;
      }
      visited.add(key);
      cameFrom.set(key, current);
      queue.push(neighbour);
    }
  }

  return [];
}

export function isNearby(snapshot: RoomSnapshot, petId: string, otherPetId: string, radius: number): boolean {
  const pet = requirePet(snapshot, petId);
  const other = requirePet(snapshot, otherPetId);
  return distance(pet.position, other.position) <= radius;
}

/** Stable, seed-derived pseudo-number for deterministic-but-varied behavior. */
export function stableNumber(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

/** Canonical, order-independent key for a pair of pets. */
export function relationshipKey(petAId: string, petBId: string): [string, string] {
  return petAId <= petBId ? [petAId, petBId] : [petBId, petAId];
}

export function findRelationship(
  relationships: Relationship[],
  petAId: string,
  petBId: string
): Relationship | undefined {
  const [a, b] = relationshipKey(petAId, petBId);
  return relationships.find((relationship) => relationship.petAId === a && relationship.petBId === b);
}
