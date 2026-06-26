import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp
} from "drizzle-orm/pg-core";
import type { Pet, PetMemory, PetPermissions, PetTraits, Position, WorldEvent } from "@pet-sanctuary/contracts";

export const rooms = pgTable("rooms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  paused: boolean("paused").notNull().default(false),
  tick: integer("tick").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const pets = pgTable(
  "pets",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tagline: text("tagline").notNull(),
    traits: jsonb("traits").$type<PetTraits>().notNull(),
    personalitySummary: text("personality_summary").notNull(),
    speakingStyle: text("speaking_style").notNull(),
    sprite: text("sprite").notNull(),
    status: text("status").$type<Pet["status"]>().notNull(),
    karma: integer("karma").notNull().default(0),
    permissions: jsonb("permissions").$type<PetPermissions>().notNull(),
    position: jsonb("position").$type<Position>().notNull(),
    currentTaskId: text("current_task_id"),
    memory: jsonb("memory").$type<PetMemory>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    roomIdx: index("pets_room_idx").on(table.roomId)
  })
);

export const worldObjects = pgTable(
  "world_objects",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    position: jsonb("position").$type<Position>().notNull(),
    state: jsonb("state").$type<Record<string, unknown>>().notNull().default({}),
    ownerPetId: text("owner_pet_id").references(() => pets.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    roomIdx: index("world_objects_room_idx").on(table.roomId)
  })
);

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    type: text("type").$type<WorldEvent["type"]>().notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    actorPetId: text("actor_pet_id").references(() => pets.id, { onDelete: "set null" }),
    targetPetId: text("target_pet_id").references(() => pets.id, { onDelete: "set null" }),
    targetId: text("target_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    visibility: text("visibility").$type<WorldEvent["visibility"]>().notNull(),
    significance: text("significance").$type<WorldEvent["significance"]>().notNull()
  },
  (table) => ({
    roomTimestampIdx: index("events_room_timestamp_idx").on(table.roomId, table.timestamp)
  })
);

export const memories = pgTable(
  "memories",
  {
    id: text("id").primaryKey(),
    petId: text("pet_id").notNull().references(() => pets.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    content: text("content").notNull(),
    confidence: doublePrecision("confidence").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    petIdx: index("memories_pet_idx").on(table.petId)
  })
);

export const simulationState = pgTable("simulation_state", {
  roomId: text("room_id").primaryKey().references(() => rooms.id, { onDelete: "cascade" }),
  status: text("status").$type<"running" | "paused">().notNull().default("running"),
  tick: integer("tick").notNull().default(0),
  paused: boolean("paused").notNull().default(false),
  lastTickAt: timestamp("last_tick_at", { withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const schema = {
  rooms,
  pets,
  worldObjects,
  events,
  memories,
  simulationState
};
