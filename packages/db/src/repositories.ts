import { asc, eq } from "drizzle-orm";
import {
  type Pet,
  PetSchema,
  RoomSchema,
  type RoomSnapshot,
  RoomSnapshotSchema,
  type WorldEvent,
  WorldEventSchema,
  WorldObjectSchema
} from "@pet-sanctuary/contracts";
import type { SanctuaryDb } from "./connection.js";
import { events, memories, pets, rooms, simulationState, worldObjects } from "./schema.js";

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
        memory: row.memory
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
    )
  });
}

export async function replaceRoomSnapshot(db: SanctuaryDb, snapshot: RoomSnapshot): Promise<RoomSnapshot> {
  const parsed = RoomSnapshotSchema.parse(snapshot);

  await db.transaction(async (tx) => {
    await tx.delete(events).where(eq(events.roomId, parsed.room.id));
    await tx.delete(worldObjects).where(eq(worldObjects.roomId, parsed.room.id));
    await tx.delete(simulationState).where(eq(simulationState.roomId, parsed.room.id));
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

    for (const object of parsed.objects) {
      await tx.insert(worldObjects).values({
        id: object.id,
        roomId: object.roomId,
        type: object.type,
        position: object.position,
        state: object.state,
        ownerPetId: object.ownerPetId,
        description: object.description,
        updatedAt: new Date()
      });
    }

    for (const event of parsed.events) {
      await tx.insert(events).values(toEventRow(event));
    }

    await tx.insert(simulationState).values({
      roomId: parsed.room.id,
      status: parsed.room.paused ? "paused" : "running",
      tick: parsed.room.tick,
      paused: parsed.room.paused,
      lastTickAt: parsed.events.at(-1)?.timestamp ? new Date(parsed.events.at(-1)?.timestamp ?? Date.now()) : null,
      metadata: {}
    });
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
          updatedAt: new Date()
        }
      });
    }

    for (const object of parsed.objects) {
      await tx
        .insert(worldObjects)
        .values({
          id: object.id,
          roomId: object.roomId,
          type: object.type,
          position: object.position,
          state: object.state,
          ownerPetId: object.ownerPetId,
          description: object.description,
          updatedAt: new Date()
        })
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

    for (const event of parsed.events) {
      await tx.insert(events).values(toEventRow(event)).onConflictDoNothing();
    }

    await tx
      .insert(simulationState)
      .values({
        roomId: parsed.room.id,
        status: parsed.room.paused ? "paused" : "running",
        tick: parsed.room.tick,
        paused: parsed.room.paused,
        lastTickAt: parsed.events.at(-1)?.timestamp ? new Date(parsed.events.at(-1)?.timestamp ?? Date.now()) : null,
        metadata: {}
      })
      .onConflictDoUpdate({
        target: simulationState.roomId,
        set: {
          status: parsed.room.paused ? "paused" : "running",
          tick: parsed.room.tick,
          paused: parsed.room.paused,
          lastTickAt: parsed.events.at(-1)?.timestamp ? new Date(parsed.events.at(-1)?.timestamp ?? Date.now()) : null,
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
    updatedAt: new Date()
  };
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
