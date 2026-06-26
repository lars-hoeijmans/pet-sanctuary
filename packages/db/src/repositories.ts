import { asc, eq } from "drizzle-orm";
import {
  type Approval,
  ApprovalSchema,
  type Pet,
  PetSchema,
  type Relationship,
  RelationshipSchema,
  RoomSchema,
  type RoomSnapshot,
  RoomSnapshotSchema,
  type Skill,
  SkillSchema,
  type Task,
  TaskSchema,
  type WorldEvent,
  WorldEventSchema,
  WorldObjectSchema
} from "@pet-sanctuary/contracts";
import type { SanctuaryDb } from "./connection.js";
import {
  approvals,
  events,
  memories,
  pets,
  relationships,
  rooms,
  simulationState,
  skills,
  tasks,
  worldObjects
} from "./schema.js";

export async function appendWorldEvent(db: SanctuaryDb, event: WorldEvent): Promise<WorldEvent> {
  await db.insert(events).values(toEventRow(event)).onConflictDoNothing();
  return event;
}

export async function loadRoomSnapshot(db: SanctuaryDb, roomId: string): Promise<RoomSnapshot | null> {
  const [roomRow] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!roomRow) {
    return null;
  }

  const petRows = await db.select().from(pets).where(eq(pets.roomId, roomId)).orderBy(asc(pets.id));
  const objectRows = await db.select().from(worldObjects).where(eq(worldObjects.roomId, roomId)).orderBy(asc(worldObjects.id));
  const eventRows = await db.select().from(events).where(eq(events.roomId, roomId)).orderBy(asc(events.timestamp), asc(events.id));
  const taskRows = await db.select().from(tasks).where(eq(tasks.roomId, roomId)).orderBy(asc(tasks.id));
  const approvalRows = await db.select().from(approvals).where(eq(approvals.roomId, roomId)).orderBy(asc(approvals.id));
  const relationshipRows = await db.select().from(relationships).where(eq(relationships.roomId, roomId)).orderBy(asc(relationships.id));
  const petIds = new Set(petRows.map((row) => row.id));
  const skillRows = (await db.select().from(skills).orderBy(asc(skills.id))).filter((row) => petIds.has(row.petId));

  return RoomSnapshotSchema.parse({
    room: RoomSchema.parse({
      id: roomRow.id,
      name: roomRow.name,
      width: roomRow.width,
      height: roomRow.height,
      paused: roomRow.paused,
      tick: roomRow.tick
    }),
    pets: petRows.map((row) =>
      PetSchema.parse({
        id: row.id,
        roomId: row.roomId,
        name: row.name,
        tagline: row.tagline,
        traits: row.traits,
        personalitySummary: row.personalitySummary,
        speakingStyle: row.speakingStyle,
        sprite: row.sprite,
        status: row.status,
        karma: row.karma,
        permissions: row.permissions,
        position: row.position,
        currentTaskId: row.currentTaskId,
        memory: row.memory,
        runtime: row.runtime,
        archived: row.archived
      })
    ),
    objects: objectRows.map((row) =>
      WorldObjectSchema.parse({
        id: row.id,
        roomId: row.roomId,
        type: row.type,
        position: row.position,
        state: row.state,
        ownerPetId: row.ownerPetId,
        description: row.description
      })
    ),
    events: eventRows.map((row) =>
      WorldEventSchema.parse({
        id: row.id,
        roomId: row.roomId,
        type: row.type,
        timestamp: row.timestamp.toISOString(),
        actorPetId: row.actorPetId,
        targetPetId: row.targetPetId,
        targetId: row.targetId,
        payload: row.payload,
        visibility: row.visibility,
        significance: row.significance
      })
    ),
    tasks: taskRows.map((row) =>
      TaskSchema.parse({
        id: row.id,
        roomId: row.roomId,
        title: row.title,
        description: row.description,
        status: row.status,
        createdBy: row.createdBy,
        assignedPetId: row.assignedPetId,
        reviewerPetId: row.reviewerPetId,
        planSummary: row.planSummary,
        outputRef: row.outputRef,
        transcriptRef: row.transcriptRef,
        riskLevel: row.riskLevel,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString()
      })
    ),
    skills: skillRows.map((row) =>
      SkillSchema.parse({
        id: row.id,
        petId: row.petId,
        name: row.name,
        description: row.description,
        purpose: row.purpose,
        source: row.source,
        status: row.status,
        riskLevel: row.riskLevel,
        version: row.version,
        usageCount: row.usageCount,
        triggeringEventId: row.triggeringEventId,
        createdAt: row.createdAt.toISOString(),
        lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null
      })
    ),
    approvals: approvalRows.map((row) =>
      ApprovalSchema.parse({
        id: row.id,
        roomId: row.roomId,
        requestedByPetId: row.requestedByPetId,
        actionType: row.actionType,
        summary: row.summary,
        diffOrSummary: row.diffOrSummary,
        targetId: row.targetId,
        status: row.status,
        riskLevel: row.riskLevel,
        createdAt: row.createdAt.toISOString(),
        resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
        resolvedBy: row.resolvedBy
      })
    ),
    relationships: relationshipRows.map((row) =>
      RelationshipSchema.parse({
        petAId: row.petAId,
        petBId: row.petBId,
        affinity: row.affinity,
        trust: row.trust,
        notes: row.notes,
        updatedAt: row.updatedAt.toISOString()
      })
    )
  });
}

export async function replaceRoomSnapshot(db: SanctuaryDb, snapshot: RoomSnapshot): Promise<RoomSnapshot> {
  const parsed = RoomSnapshotSchema.parse(snapshot);

  await db.transaction(async (tx) => {
    await tx.delete(events).where(eq(events.roomId, parsed.room.id));
    await tx.delete(worldObjects).where(eq(worldObjects.roomId, parsed.room.id));
    await tx.delete(tasks).where(eq(tasks.roomId, parsed.room.id));
    await tx.delete(approvals).where(eq(approvals.roomId, parsed.room.id));
    await tx.delete(relationships).where(eq(relationships.roomId, parsed.room.id));
    await tx.delete(simulationState).where(eq(simulationState.roomId, parsed.room.id));
    // Deleting the room's pets cascades to their skills and memories.
    await tx.delete(pets).where(eq(pets.roomId, parsed.room.id));
    await tx.delete(rooms).where(eq(rooms.id, parsed.room.id));

    await tx.insert(rooms).values({
      id: parsed.room.id,
      name: parsed.room.name,
      width: parsed.room.width,
      height: parsed.room.height,
      paused: parsed.room.paused,
      tick: parsed.room.tick,
      updatedAt: new Date()
    });

    for (const pet of parsed.pets) {
      await tx.insert(pets).values(toPetRow(pet));
      for (const [index, note] of pet.memory.notes.entries()) {
        await tx.insert(memories).values({
          id: `${pet.id}-seed-memory-${index}`,
          petId: pet.id,
          type: "seed_note",
          content: note,
          confidence: 1
        });
      }
    }

    for (const skill of parsed.skills) {
      await tx.insert(skills).values(toSkillRow(skill));
    }

    for (const object of parsed.objects) {
      await tx.insert(worldObjects).values(toObjectRow(object));
    }

    for (const task of parsed.tasks) {
      await tx.insert(tasks).values(toTaskRow(task));
    }

    for (const approval of parsed.approvals) {
      await tx.insert(approvals).values(toApprovalRow(approval));
    }

    for (const relationship of parsed.relationships) {
      await tx.insert(relationships).values(toRelationshipRow(parsed.room.id, relationship));
    }

    for (const event of parsed.events) {
      await tx.insert(events).values(toEventRow(event));
    }

    await tx.insert(simulationState).values(toSimulationStateRow(parsed));
  });

  return parsed;
}

export async function upsertRoomSnapshot(db: SanctuaryDb, snapshot: RoomSnapshot): Promise<RoomSnapshot> {
  const parsed = RoomSnapshotSchema.parse(snapshot);

  await db.transaction(async (tx) => {
    await tx
      .insert(rooms)
      .values({
        id: parsed.room.id,
        name: parsed.room.name,
        width: parsed.room.width,
        height: parsed.room.height,
        paused: parsed.room.paused,
        tick: parsed.room.tick,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: rooms.id,
        set: {
          name: parsed.room.name,
          width: parsed.room.width,
          height: parsed.room.height,
          paused: parsed.room.paused,
          tick: parsed.room.tick,
          updatedAt: new Date()
        }
      });

    for (const pet of parsed.pets) {
      await tx.insert(pets).values(toPetRow(pet)).onConflictDoUpdate({
        target: pets.id,
        set: {
          roomId: pet.roomId,
          name: pet.name,
          tagline: pet.tagline,
          traits: pet.traits,
          personalitySummary: pet.personalitySummary,
          speakingStyle: pet.speakingStyle,
          sprite: pet.sprite,
          status: pet.status,
          karma: pet.karma,
          permissions: pet.permissions,
          position: pet.position,
          currentTaskId: pet.currentTaskId,
          memory: pet.memory,
          runtime: pet.runtime,
          archived: pet.archived,
          updatedAt: new Date()
        }
      });
    }

    for (const skill of parsed.skills) {
      await tx.insert(skills).values(toSkillRow(skill)).onConflictDoUpdate({
        target: skills.id,
        set: {
          petId: skill.petId,
          name: skill.name,
          description: skill.description,
          purpose: skill.purpose,
          source: skill.source,
          status: skill.status,
          riskLevel: skill.riskLevel,
          version: skill.version,
          usageCount: skill.usageCount,
          triggeringEventId: skill.triggeringEventId,
          lastUsedAt: skill.lastUsedAt ? new Date(skill.lastUsedAt) : null
        }
      });
    }

    for (const object of parsed.objects) {
      await tx
        .insert(worldObjects)
        .values(toObjectRow(object))
        .onConflictDoUpdate({
          target: worldObjects.id,
          set: {
            roomId: object.roomId,
            type: object.type,
            position: object.position,
            state: object.state,
            ownerPetId: object.ownerPetId,
            description: object.description,
            updatedAt: new Date()
          }
        });
    }

    for (const task of parsed.tasks) {
      await tx.insert(tasks).values(toTaskRow(task)).onConflictDoUpdate({
        target: tasks.id,
        set: {
          title: task.title,
          description: task.description,
          status: task.status,
          assignedPetId: task.assignedPetId,
          reviewerPetId: task.reviewerPetId,
          planSummary: task.planSummary,
          outputRef: task.outputRef,
          transcriptRef: task.transcriptRef,
          riskLevel: task.riskLevel,
          updatedAt: new Date(task.updatedAt)
        }
      });
    }

    for (const approval of parsed.approvals) {
      await tx.insert(approvals).values(toApprovalRow(approval)).onConflictDoUpdate({
        target: approvals.id,
        set: {
          status: approval.status,
          diffOrSummary: approval.diffOrSummary,
          resolvedAt: approval.resolvedAt ? new Date(approval.resolvedAt) : null,
          resolvedBy: approval.resolvedBy
        }
      });
    }

    for (const relationship of parsed.relationships) {
      await tx
        .insert(relationships)
        .values(toRelationshipRow(parsed.room.id, relationship))
        .onConflictDoUpdate({
          target: relationships.id,
          set: {
            affinity: relationship.affinity,
            trust: relationship.trust,
            notes: relationship.notes,
            updatedAt: new Date(relationship.updatedAt)
          }
        });
    }

    for (const event of parsed.events) {
      await tx.insert(events).values(toEventRow(event)).onConflictDoNothing();
    }

    await tx
      .insert(simulationState)
      .values(toSimulationStateRow(parsed))
      .onConflictDoUpdate({
        target: simulationState.roomId,
        set: {
          status: parsed.room.paused ? "paused" : "running",
          tick: parsed.room.tick,
          paused: parsed.room.paused,
          lastTickAt: lastTickAt(parsed),
          updatedAt: new Date()
        }
      });
  });

  return parsed;
}

function toPetRow(pet: Pet) {
  return {
    id: pet.id,
    roomId: pet.roomId,
    name: pet.name,
    tagline: pet.tagline,
    traits: pet.traits,
    personalitySummary: pet.personalitySummary,
    speakingStyle: pet.speakingStyle,
    sprite: pet.sprite,
    status: pet.status,
    karma: pet.karma,
    permissions: pet.permissions,
    position: pet.position,
    currentTaskId: pet.currentTaskId,
    memory: pet.memory,
    runtime: pet.runtime,
    archived: pet.archived,
    updatedAt: new Date()
  };
}

function toObjectRow(object: RoomSnapshot["objects"][number]) {
  return {
    id: object.id,
    roomId: object.roomId,
    type: object.type,
    position: object.position,
    state: object.state,
    ownerPetId: object.ownerPetId,
    description: object.description,
    updatedAt: new Date()
  };
}

function toTaskRow(task: Task) {
  return {
    id: task.id,
    roomId: task.roomId,
    title: task.title,
    description: task.description,
    status: task.status,
    createdBy: task.createdBy,
    assignedPetId: task.assignedPetId,
    reviewerPetId: task.reviewerPetId,
    planSummary: task.planSummary,
    outputRef: task.outputRef,
    transcriptRef: task.transcriptRef,
    riskLevel: task.riskLevel,
    createdAt: new Date(task.createdAt),
    updatedAt: new Date(task.updatedAt)
  };
}

function toSkillRow(skill: Skill) {
  return {
    id: skill.id,
    petId: skill.petId,
    name: skill.name,
    description: skill.description,
    purpose: skill.purpose,
    source: skill.source,
    status: skill.status,
    riskLevel: skill.riskLevel,
    version: skill.version,
    usageCount: skill.usageCount,
    triggeringEventId: skill.triggeringEventId,
    createdAt: new Date(skill.createdAt),
    lastUsedAt: skill.lastUsedAt ? new Date(skill.lastUsedAt) : null
  };
}

function toApprovalRow(approval: Approval) {
  return {
    id: approval.id,
    roomId: approval.roomId,
    requestedByPetId: approval.requestedByPetId,
    actionType: approval.actionType,
    summary: approval.summary,
    diffOrSummary: approval.diffOrSummary,
    targetId: approval.targetId,
    status: approval.status,
    riskLevel: approval.riskLevel,
    createdAt: new Date(approval.createdAt),
    resolvedAt: approval.resolvedAt ? new Date(approval.resolvedAt) : null,
    resolvedBy: approval.resolvedBy
  };
}

function toRelationshipRow(roomId: string, relationship: Relationship) {
  return {
    id: `${relationship.petAId}::${relationship.petBId}`,
    roomId,
    petAId: relationship.petAId,
    petBId: relationship.petBId,
    affinity: relationship.affinity,
    trust: relationship.trust,
    notes: relationship.notes,
    updatedAt: new Date(relationship.updatedAt)
  };
}

function toSimulationStateRow(parsed: RoomSnapshot) {
  return {
    roomId: parsed.room.id,
    status: (parsed.room.paused ? "paused" : "running") as "paused" | "running",
    tick: parsed.room.tick,
    paused: parsed.room.paused,
    lastTickAt: lastTickAt(parsed),
    metadata: {}
  };
}

function lastTickAt(parsed: RoomSnapshot): Date | null {
  const timestamp = parsed.events.at(-1)?.timestamp;
  return timestamp ? new Date(timestamp) : null;
}

function toEventRow(event: WorldEvent) {
  return {
    id: event.id,
    roomId: event.roomId,
    type: event.type,
    timestamp: new Date(event.timestamp),
    actorPetId: event.actorPetId,
    targetPetId: event.targetPetId,
    targetId: event.targetId,
    payload: event.payload,
    visibility: event.visibility,
    significance: event.significance
  };
}
