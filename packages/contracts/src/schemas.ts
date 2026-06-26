import { z } from "zod";

export const PositionSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative()
});
export type Position = z.infer<typeof PositionSchema>;

export const ResponseLevelSchema = z.enum([
  "observe_only",
  "internal_reaction",
  "ambient_reaction",
  "social_response",
  "task_action"
]);
export type ResponseLevel = z.infer<typeof ResponseLevelSchema>;

export const PetStatusSchema = z.enum([
  "idle",
  "observing",
  "reacting",
  "socializing",
  "moving",
  "working",
  "helping",
  "decorating",
  "learning",
  "paused"
]);
export type PetStatus = z.infer<typeof PetStatusSchema>;

export const PetTraitsSchema = z.object({
  temperament: z.enum(["chaotic", "calm", "anxious", "bold", "stubborn", "cheerful"]),
  workStyle: z.enum(["builder", "reviewer", "planner", "debugger", "refactorer", "researcher"]),
  socialStyle: z.enum(["helpful", "competitive", "shy", "mentor-like", "prankster", "loner"]),
  riskProfile: z.enum(["careful", "impulsive", "curious", "pessimistic", "overconfident", "rule-bound"]),
  aesthetic: z.enum(["minimalist", "neon clutter", "cozy wood", "cyberpunk", "messy lab", "garden room"])
});
export type PetTraits = z.infer<typeof PetTraitsSchema>;

export const PetPermissionsSchema = z.object({
  canSpeak: z.boolean(),
  canMove: z.boolean(),
  canWork: z.boolean(),
  canAskHelp: z.boolean(),
  canOfferHelp: z.boolean(),
  canBuild: z.boolean(),
  canDecorate: z.boolean(),
  canRequestSkill: z.boolean(),
  canReflect: z.boolean()
});
export type PetPermissions = z.infer<typeof PetPermissionsSchema>;

export const PetMemorySchema = z.object({
  summary: z.string(),
  notes: z.array(z.string()).default([])
});
export type PetMemory = z.infer<typeof PetMemorySchema>;

export const PetSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  name: z.string().min(1),
  tagline: z.string().min(1),
  traits: PetTraitsSchema,
  personalitySummary: z.string().min(1),
  speakingStyle: z.string().min(1),
  sprite: z.string().min(1),
  status: PetStatusSchema,
  karma: z.number().int(),
  permissions: PetPermissionsSchema,
  position: PositionSchema,
  currentTaskId: z.string().min(1).nullable(),
  memory: PetMemorySchema
});
export type Pet = z.infer<typeof PetSchema>;

export const RoomSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  paused: z.boolean(),
  tick: z.number().int().nonnegative()
});
export type Room = z.infer<typeof RoomSchema>;

export const WorldObjectSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  type: z.string().min(1),
  position: PositionSchema,
  state: z.record(z.unknown()).default({}),
  ownerPetId: z.string().min(1).nullable(),
  description: z.string().min(1)
});
export type WorldObject = z.infer<typeof WorldObjectSchema>;

export const WorldEventTypeSchema = z.enum([
  "RoomSeeded",
  "SimulationTick",
  "PetObserved",
  "PetMoved",
  "PetSaid",
  "PetAskedHelp",
  "PetOfferedHelp",
  "PetStartedWork",
  "PetBuiltObject",
  "PetDecoratedObject",
  "PetRequestedSkill",
  "PetReflected",
  "ActionRejected",
  "SimulationPaused",
  "SimulationResumed"
]);
export type WorldEventType = z.infer<typeof WorldEventTypeSchema>;

export const WorldEventSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  type: WorldEventTypeSchema,
  timestamp: z.string().datetime(),
  actorPetId: z.string().min(1).nullable(),
  targetPetId: z.string().min(1).nullable(),
  targetId: z.string().min(1).nullable(),
  payload: z.record(z.unknown()).default({}),
  visibility: z.enum(["room", "private", "system"]),
  significance: z.enum(["low", "medium", "high"])
});
export type WorldEvent = z.infer<typeof WorldEventSchema>;

const ActionBaseSchema = z.object({
  reasonVisible: z.string().min(1).max(240),
  riskLevel: z.enum(["low", "medium", "high"]).default("low")
});

export const SayActionSchema = ActionBaseSchema.extend({
  action: z.literal("say"),
  message: z.string().min(1).max(240),
  targetPetId: z.string().min(1).optional()
});

export const MoveActionSchema = ActionBaseSchema.extend({
  action: z.literal("move"),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative()
});

export const WorkActionSchema = ActionBaseSchema.extend({
  action: z.literal("work"),
  taskId: z.string().min(1)
});

export const AskHelpActionSchema = ActionBaseSchema.extend({
  action: z.literal("ask_help"),
  targetPetId: z.string().min(1),
  taskId: z.string().min(1),
  message: z.string().min(1).max(240).optional()
});

export const OfferHelpActionSchema = ActionBaseSchema.extend({
  action: z.literal("offer_help"),
  targetPetId: z.string().min(1),
  taskId: z.string().min(1),
  message: z.string().min(1).max(240).optional()
});

export const BuildActionSchema = ActionBaseSchema.extend({
  action: z.literal("build"),
  objectType: z.string().min(1).max(80),
  location: PositionSchema
});

export const DecorateActionSchema = ActionBaseSchema.extend({
  action: z.literal("decorate"),
  objectId: z.string().min(1),
  style: z.string().min(1).max(80)
});

export const RequestSkillActionSchema = ActionBaseSchema.extend({
  action: z.literal("request_skill"),
  name: z.string().min(1).max(80),
  purpose: z.string().min(1).max(240)
});

export const ReflectActionSchema = ActionBaseSchema.extend({
  action: z.literal("reflect"),
  memoryNote: z.string().min(1).max(240)
});

export const PetActionSchema = z.discriminatedUnion("action", [
  SayActionSchema,
  MoveActionSchema,
  WorkActionSchema,
  AskHelpActionSchema,
  OfferHelpActionSchema,
  BuildActionSchema,
  DecorateActionSchema,
  RequestSkillActionSchema,
  ReflectActionSchema
]);
export type PetAction = z.infer<typeof PetActionSchema>;

export const AvailableActionSchema = z.enum([
  "say",
  "move",
  "work",
  "ask_help",
  "offer_help",
  "build",
  "decorate",
  "request_skill",
  "reflect"
]);
export type AvailableAction = z.infer<typeof AvailableActionSchema>;

export const RoomSnapshotSchema = z.object({
  room: RoomSchema,
  pets: z.array(PetSchema),
  objects: z.array(WorldObjectSchema),
  events: z.array(WorldEventSchema)
});
export type RoomSnapshot = z.infer<typeof RoomSnapshotSchema>;

export const AgentObservationSchema = z.object({
  room: RoomSchema,
  pet: PetSchema,
  nearbyPets: z.array(PetSchema),
  objectsNearby: z.array(WorldObjectSchema),
  recentEvents: z.array(WorldEventSchema),
  availableActions: z.array(AvailableActionSchema),
  responseLevel: ResponseLevelSchema
});
export type AgentObservation = z.infer<typeof AgentObservationSchema>;

export const ServerWebSocketEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("snapshot"), snapshot: RoomSnapshotSchema }),
  z.object({ type: z.literal("world_event"), event: WorldEventSchema }),
  z.object({ type: z.literal("pet_updated"), pet: PetSchema }),
  z.object({ type: z.literal("object_updated"), object: WorldObjectSchema }),
  z.object({ type: z.literal("simulation_state"), room: RoomSchema }),
  z.object({
    type: z.literal("action_rejected"),
    petId: z.string().min(1),
    errors: z.array(z.string()),
    event: WorldEventSchema
  })
]);
export type ServerWebSocketEvent = z.infer<typeof ServerWebSocketEventSchema>;

export const ClientWebSocketEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("request_snapshot"), roomId: z.string().min(1) }),
  z.object({ type: z.literal("pause_simulation"), roomId: z.string().min(1) }),
  z.object({ type: z.literal("resume_simulation"), roomId: z.string().min(1) }),
  z.object({ type: z.literal("reset_to_seed"), roomId: z.string().min(1) }),
  z.object({ type: z.literal("propose_pet_action"), roomId: z.string().min(1), petId: z.string().min(1), action: PetActionSchema })
]);
export type ClientWebSocketEvent = z.infer<typeof ClientWebSocketEventSchema>;
