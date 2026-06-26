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

/**
 * Per-pet agent runtime configuration. The runtime decides how a pet proposes
 * actions or runs tasks. Everything defaults to the deterministic policy so the
 * Living Room Kernel works with no model provider configured. `ai_sdk`, `hermes`,
 * and `pi` are staged adapters: selecting them never enables a paid API on its own
 * (see packages/agent-runtime), it only records intent.
 */
export const PetRuntimeKindSchema = z.enum(["deterministic", "ai_sdk", "hermes", "pi"]);
export type PetRuntimeKind = z.infer<typeof PetRuntimeKindSchema>;

export const PetRuntimeConfigSchema = z.object({
  kind: PetRuntimeKindSchema.default("deterministic"),
  model: z.string().min(1).nullable().default(null),
  provider: z.string().min(1).nullable().default(null)
});
export type PetRuntimeConfig = z.infer<typeof PetRuntimeConfigSchema>;

export const DEFAULT_PET_RUNTIME: PetRuntimeConfig = {
  kind: "deterministic",
  model: null,
  provider: null
};

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
  memory: PetMemorySchema,
  runtime: PetRuntimeConfigSchema.default(DEFAULT_PET_RUNTIME),
  archived: z.boolean().default(false)
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
  "RoomNotice",
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
  "SimulationResumed",
  // Pet lifecycle
  "PetCreated",
  "PetArchived",
  "PetUnpaused",
  "PetPaused",
  // Task & collaboration (Phase 2)
  "TaskCreated",
  "TaskClaimed",
  "TaskDeclined",
  "TaskPlanProposed",
  "TaskReviewRequested",
  "TaskHelpAccepted",
  "TaskHandedOff",
  "TaskProgressed",
  "TaskCompleted",
  "TaskBlocked",
  // Skills & approvals (Phase 6)
  "PetLearnedSkill",
  "SkillApproved",
  "SkillRejected",
  "ApprovalRequested",
  "ApprovalResolved",
  // Karma & relationships
  "KarmaChanged",
  "RelationshipChanged"
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

export const MoveToActionSchema = ActionBaseSchema.extend({
  action: z.literal("move_to"),
  targetObjectId: z.string().min(1)
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

// --- Collaboration actions (Phase 2) -------------------------------------

export const ClaimTaskActionSchema = ActionBaseSchema.extend({
  action: z.literal("claim_task"),
  taskId: z.string().min(1)
});

export const DeclineTaskActionSchema = ActionBaseSchema.extend({
  action: z.literal("decline_task"),
  taskId: z.string().min(1),
  message: z.string().min(1).max(240).optional()
});

export const ProposePlanActionSchema = ActionBaseSchema.extend({
  action: z.literal("propose_plan"),
  taskId: z.string().min(1),
  summary: z.string().min(1).max(240)
});

export const RequestReviewActionSchema = ActionBaseSchema.extend({
  action: z.literal("request_review"),
  targetPetId: z.string().min(1),
  taskId: z.string().min(1),
  message: z.string().min(1).max(240).optional()
});

export const AcceptHelpActionSchema = ActionBaseSchema.extend({
  action: z.literal("accept_help"),
  targetPetId: z.string().min(1),
  taskId: z.string().min(1)
});

export const HandoffTaskActionSchema = ActionBaseSchema.extend({
  action: z.literal("handoff_task"),
  targetPetId: z.string().min(1),
  taskId: z.string().min(1),
  reason: z.string().min(1).max(240)
});

export const PetActionSchema = z.discriminatedUnion("action", [
  SayActionSchema,
  MoveActionSchema,
  MoveToActionSchema,
  WorkActionSchema,
  AskHelpActionSchema,
  OfferHelpActionSchema,
  BuildActionSchema,
  DecorateActionSchema,
  RequestSkillActionSchema,
  ReflectActionSchema,
  ClaimTaskActionSchema,
  DeclineTaskActionSchema,
  ProposePlanActionSchema,
  RequestReviewActionSchema,
  AcceptHelpActionSchema,
  HandoffTaskActionSchema
]);
export type PetAction = z.infer<typeof PetActionSchema>;

export const AvailableActionSchema = z.enum([
  "say",
  "move",
  "move_to",
  "work",
  "ask_help",
  "offer_help",
  "build",
  "decorate",
  "request_skill",
  "reflect",
  "claim_task",
  "decline_task",
  "propose_plan",
  "request_review",
  "accept_help",
  "handoff_task"
]);
export type AvailableAction = z.infer<typeof AvailableActionSchema>;

export const RiskLevelSchema = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

// --- Task (Phase 2) ------------------------------------------------------

export const TaskStatusSchema = z.enum([
  "open",
  "claimed",
  "planned",
  "in_progress",
  "in_review",
  "completed",
  "blocked",
  "cancelled"
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  title: z.string().min(1).max(160),
  description: z.string().max(2000).default(""),
  status: TaskStatusSchema,
  createdBy: z.string().min(1), // "manager" or a pet id
  assignedPetId: z.string().min(1).nullable().default(null),
  reviewerPetId: z.string().min(1).nullable().default(null),
  planSummary: z.string().max(2000).nullable().default(null),
  outputRef: z.string().nullable().default(null),
  transcriptRef: z.string().nullable().default(null),
  riskLevel: RiskLevelSchema.default("low"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type Task = z.infer<typeof TaskSchema>;

// --- Skill (Phase 6) -----------------------------------------------------

export const SkillSourceSchema = z.enum(["seed", "learned", "requested"]);
export type SkillSource = z.infer<typeof SkillSourceSchema>;

export const SkillStatusSchema = z.enum(["proposed", "staged", "active", "rejected"]);
export type SkillStatus = z.infer<typeof SkillStatusSchema>;

export const SkillSchema = z.object({
  id: z.string().min(1),
  petId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).default(""),
  purpose: z.string().max(500).nullable().default(null),
  source: SkillSourceSchema,
  status: SkillStatusSchema,
  riskLevel: RiskLevelSchema.default("low"),
  version: z.number().int().positive().default(1),
  usageCount: z.number().int().nonnegative().default(0),
  triggeringEventId: z.string().min(1).nullable().default(null),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().nullable().default(null)
});
export type Skill = z.infer<typeof SkillSchema>;

// --- Approval (Phase 6 / Safety §13) -------------------------------------

export const ApprovalStatusSchema = z.enum(["pending", "approved", "rejected"]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  requestedByPetId: z.string().min(1).nullable().default(null),
  actionType: z.string().min(1),
  summary: z.string().min(1).max(500),
  diffOrSummary: z.string().max(4000).nullable().default(null),
  targetId: z.string().min(1).nullable().default(null), // e.g. the skill id awaiting approval
  status: ApprovalStatusSchema,
  riskLevel: RiskLevelSchema.default("medium"),
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable().default(null),
  resolvedBy: z.string().min(1).nullable().default(null)
});
export type Approval = z.infer<typeof ApprovalSchema>;

// --- Relationship (Phase 2) ----------------------------------------------

export const RelationshipSchema = z.object({
  petAId: z.string().min(1),
  petBId: z.string().min(1),
  affinity: z.number().int().default(0),
  trust: z.number().int().default(0),
  notes: z.array(z.string()).default([]),
  updatedAt: z.string().datetime()
});
export type Relationship = z.infer<typeof RelationshipSchema>;

export const RoomSnapshotSchema = z.object({
  room: RoomSchema,
  pets: z.array(PetSchema),
  objects: z.array(WorldObjectSchema),
  events: z.array(WorldEventSchema),
  tasks: z.array(TaskSchema).default([]),
  skills: z.array(SkillSchema).default([]),
  approvals: z.array(ApprovalSchema).default([]),
  relationships: z.array(RelationshipSchema).default([])
});
export type RoomSnapshot = z.infer<typeof RoomSnapshotSchema>;

export const KarmaTrustLabelSchema = z.enum(["wary", "neutral", "trusted", "revered"]);
export type KarmaTrustLabel = z.infer<typeof KarmaTrustLabelSchema>;

export const AgentObservationSchema = z.object({
  room: RoomSchema,
  pet: PetSchema,
  nearbyPets: z.array(PetSchema),
  objectsNearby: z.array(WorldObjectSchema),
  desks: z.array(WorldObjectSchema).default([]),
  recentEvents: z.array(WorldEventSchema),
  availableActions: z.array(AvailableActionSchema),
  responseLevel: ResponseLevelSchema,
  openTasks: z.array(TaskSchema).default([]),
  currentTask: TaskSchema.nullable().default(null)
});
export type AgentObservation = z.infer<typeof AgentObservationSchema>;

// --- WebSocket wire protocol (matches the NestJS gateway) -----------------
//
// The gateway uses Socket.IO *named* events, not a discriminated union, so these
// schemas describe the actual payloads carried by each named event.

export const SimulationStatusSchema = z.object({
  paused: z.boolean(),
  tick: z.number().int().nonnegative(),
  tickIntervalMs: z.number().int().positive()
});
export type SimulationStatus = z.infer<typeof SimulationStatusSchema>;

export const RoomResponseSchema = z.object({
  snapshot: RoomSnapshotSchema,
  simulation: SimulationStatusSchema
});
export type RoomResponse = z.infer<typeof RoomResponseSchema>;

export const RoomUpdateSchema = z.object({
  snapshot: RoomSnapshotSchema,
  event: WorldEventSchema.optional(),
  simulation: SimulationStatusSchema
});
export type RoomUpdate = z.infer<typeof RoomUpdateSchema>;

/** Server → client Socket.IO event names and the payload each carries. */
export const SERVER_SOCKET_EVENTS = {
  snapshot: "room:snapshot", // RoomResponse
  update: "room:update", // RoomUpdate
  event: "room:event" // WorldEvent
} as const;

/** Client → server Socket.IO event names. */
export const CLIENT_SOCKET_EVENTS = {
  getSnapshot: "room:getSnapshot" // { roomId }
} as const;

export const CreateRoomEventRequestSchema = z.object({
  summary: z
    .string()
    .min(1)
    .max(240)
    .default("A meaningful room notice asks every active pet to respond."),
  significance: z.enum(["low", "medium", "high"]).default("high"),
  targetPetId: z.string().min(1).nullable().optional(),
  targetId: z.string().min(1).nullable().optional(),
  metadata: z.record(z.unknown()).default({})
});
export type CreateRoomEventRequest = z.infer<typeof CreateRoomEventRequestSchema>;

export const RoomGetSnapshotMessageSchema = z.object({ roomId: z.string().min(1) });
export type RoomGetSnapshotMessage = z.infer<typeof RoomGetSnapshotMessageSchema>;

// --- Manager console / REST request DTOs ---------------------------------

export const CreateTaskRequestSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(2000).default(""),
  riskLevel: RiskLevelSchema.default("low"),
  assignedPetId: z.string().min(1).nullable().optional()
});
export type CreateTaskRequest = z.infer<typeof CreateTaskRequestSchema>;

/**
 * Pet creation request. If `traits` is omitted the server rolls them (the spinner
 * back-end). `seed` makes the roll + personality deterministic for tests/demos.
 */
export const CreatePetRequestSchema = z.object({
  traits: PetTraitsSchema.optional(),
  name: z.string().min(1).max(80).optional(),
  seed: z.string().min(1).optional(),
  position: PositionSchema.optional(),
  runtime: PetRuntimeConfigSchema.optional()
});
export type CreatePetRequest = z.infer<typeof CreatePetRequestSchema>;

export const RollTraitsRequestSchema = z.object({
  seed: z.string().min(1).optional()
});
export type RollTraitsRequest = z.infer<typeof RollTraitsRequestSchema>;

export const RollTraitsResultSchema = z.object({
  rollId: z.string().min(1),
  traits: PetTraitsSchema
});
export type RollTraitsResult = z.infer<typeof RollTraitsResultSchema>;

export const ResolveApprovalRequestSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().max(500).optional(),
  resolvedBy: z.string().min(1).default("manager")
});
export type ResolveApprovalRequest = z.infer<typeof ResolveApprovalRequestSchema>;

export const TRAIT_POOLS = {
  temperament: ["chaotic", "calm", "anxious", "bold", "stubborn", "cheerful"],
  workStyle: ["builder", "reviewer", "planner", "debugger", "refactorer", "researcher"],
  socialStyle: ["helpful", "competitive", "shy", "mentor-like", "prankster", "loner"],
  riskProfile: ["careful", "impulsive", "curious", "pessimistic", "overconfident", "rule-bound"],
  aesthetic: ["minimalist", "neon clutter", "cozy wood", "cyberpunk", "messy lab", "garden room"]
} as const satisfies Record<keyof PetTraits, readonly PetTraits[keyof PetTraits][]>;
