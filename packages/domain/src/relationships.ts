import type { Relationship, RoomSnapshot } from "@pet-sanctuary/contracts";
import { relationshipKey } from "./helpers.js";

/**
 * Lightweight relationship/affinity state (PRD §10 collaboration model). Stored
 * once per unordered pair of pets. Updated silently as a side effect of
 * collaboration so the inspector can show who works well together.
 */

export interface RelationshipBump {
  affinity?: number;
  trust?: number;
  note?: string;
}

export function bumpRelationship(
  snapshot: RoomSnapshot,
  petAId: string,
  petBId: string,
  bump: RelationshipBump,
  timestamp: string
): RoomSnapshot {
  if (petAId === petBId) {
    return snapshot;
  }

  const [a, b] = relationshipKey(petAId, petBId);
  const existing = snapshot.relationships.find(
    (relationship) => relationship.petAId === a && relationship.petBId === b
  );

  const notes = existing ? [...existing.notes] : [];
  if (bump.note) {
    notes.push(bump.note);
  }

  const next: Relationship = {
    petAId: a,
    petBId: b,
    affinity: (existing?.affinity ?? 0) + (bump.affinity ?? 0),
    trust: (existing?.trust ?? 0) + (bump.trust ?? 0),
    notes: notes.slice(-8),
    updatedAt: timestamp
  };

  const relationships = existing
    ? snapshot.relationships.map((relationship) =>
        relationship.petAId === a && relationship.petBId === b ? next : relationship
      )
    : [...snapshot.relationships, next];

  return { ...snapshot, relationships };
}

export function affinityBetween(snapshot: RoomSnapshot, petAId: string, petBId: string): number {
  const [a, b] = relationshipKey(petAId, petBId);
  const relationship = snapshot.relationships.find(
    (candidate) => candidate.petAId === a && candidate.petBId === b
  );
  return relationship?.affinity ?? 0;
}
