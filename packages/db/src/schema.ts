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
import type {
  Approval,
  Pet,
  PetMemory,
  PetPermissions,
  PetRuntimeConfig,
  PetTraits,
  Position,
  Task,
  WorldEvent
} from "@pet-sanctuary/contracts";

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
    runtime: jsonb("runtime").$type<PetRuntimeConfig>().notNull().default({ kind: "deterministic", model: null, provider: null }),
    archived: boolean("archived").notNull().default(false),
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

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").$type<Task["status"]>().notNull(),
    createdBy: text("created_by").notNull(),
    assignedPetId: text("assigned_pet_id"),
    reviewerPetId: text("reviewer_pet_id"),
    planSummary: text("plan_summary"),
    outputRef: text("output_ref"),
    transcriptRef: text("transcript_ref"),
    riskLevel: text("risk_level").$type<Task["riskLevel"]>().notNull().default("low"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => ({
    roomIdx: index("tasks_room_idx").on(table.roomId)
  })
);

export const skills = pgTable(
  "skills",
  {
    id: text("id").primaryKey(),
    petId: text("pet_id").notNull().references(() => pets.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    purpose: text("purpose"),
    source: text("source").$type<"seed" | "learned" | "requested">().notNull(),
    status: text("status").$type<"proposed" | "staged" | "active" | "rejected">().notNull(),
    riskLevel: text("risk_level").$type<Task["riskLevel"]>().notNull().default("low"),
    version: integer("version").notNull().default(1),
    usageCount: integer("usage_count").notNull().default(0),
    triggeringEventId: text("triggering_event_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true })
  },
  (table) => ({
    petIdx: index("skills_pet_idx").on(table.petId)
  })
);

export const approvals = pgTable(
  "approvals",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    requestedByPetId: text("requested_by_pet_id"),
    actionType: text("action_type").notNull(),
    summary: text("summary").notNull(),
    diffOrSummary: text("diff_or_summary"),
    targetId: text("target_id"),
    status: text("status").$type<Approval["status"]>().notNull(),
    riskLevel: text("risk_level").$type<Approval["riskLevel"]>().notNull().default("medium"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by")
  },
  (table) => ({
    roomIdx: index("approvals_room_idx").on(table.roomId)
  })
);

export const relationships = pgTable(
  "relationships",
  {
    id: text("id").primaryKey(), // canonical "<petAId>::<petBId>"
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    petAId: text("pet_a_id").notNull(),
    petBId: text("pet_b_id").notNull(),
    affinity: integer("affinity").notNull().default(0),
    trust: integer("trust").notNull().default(0),
    notes: jsonb("notes").$type<string[]>().notNull().default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => ({
    roomIdx: index("relationships_room_idx").on(table.roomId)
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
  tasks,
  skills,
  approvals,
  relationships,
  simulationState
};
