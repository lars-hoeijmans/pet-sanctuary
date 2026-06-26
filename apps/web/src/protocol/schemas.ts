/**
 * Zod schemas — validate every inbound event before it touches the reducer.
 *
 * Rules (from the build spec):
 *  - Reject unknown event types.
 *  - Speech / message text limited to 240 chars.
 *  - Task titles limited to 100 chars.
 *  - Summaries limited to 500 chars.
 *  - Positions must sit within a reasonable grid.
 */
import { z } from "zod";
import { WORLD_HEIGHT, WORLD_WIDTH, type WorldEvent } from "./protocol";

const TEXT_MAX = 240;
const TITLE_MAX = 100;
const SUMMARY_MAX = 500;

// Allow a small margin outside the visible grid so agents can stage off-screen.
const POS_MARGIN = 4;

export const gridPosSchema = z.object({
  x: z.number().int().min(-POS_MARGIN).max(WORLD_WIDTH + POS_MARGIN),
  y: z.number().int().min(-POS_MARGIN).max(WORLD_HEIGHT + POS_MARGIN),
  z: z.number().optional(),
  roomId: z.string().max(64).optional(),
});

export const agentAvatarSchema = z.enum(["default", "robot", "hoodie", "wizard", "infra"]);

export const agentRuntimeSchema = z.enum(["mock", "hermes", "openclaw", "custom"]);

export const agentStatusSchema = z.enum([
  "offline",
  "idle",
  "thinking",
  "coding",
  "reviewing",
  "debugging",
  "testing",
  "blocked",
  "talking",
  "building",
  "shipping",
  "learning",
]);

export const agentMoodSchema = z.enum(["focused", "happy", "confused", "blocked", "excited"]);

export const artifactKindSchema = z.enum([
  "commit",
  "pull_request",
  "test_result",
  "deployment",
  "design_doc",
  "memory",
  "tool",
  "bug_report",
  "decision",
]);

export const objectKindSchema = z.enum([
  "desk",
  "chair",
  "plant",
  "server_rack",
  "whiteboard",
  "terminal",
  "meeting_table",
  "lamp",
  "bookshelf",
  "coffee_machine",
  "sofa",
  "notice_board",
]);

export const agentIdentitySchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  role: z.string().min(1).max(80),
  avatar: agentAvatarSchema,
  color: z.string().min(1).max(32),
  runtime: agentRuntimeSchema,
  workspace: z.string().max(256).optional(),
});

export const agentViewSchema = agentIdentitySchema.extend({
  position: gridPosSchema,
  status: agentStatusSchema,
  currentTask: z.string().max(TITLE_MAX).optional(),
  mood: agentMoodSchema.optional(),
  skills: z.array(z.string().max(64)).max(50),
  memorySummary: z.string().max(SUMMARY_MAX).optional(),
  lastHeartbeatAt: z.number().optional(),
});

export const worldObjectSchema = z.object({
  id: z.string().min(1).max(80),
  kind: objectKindSchema,
  position: gridPosSchema,
  ownerAgentId: z.string().max(64).optional(),
  label: z.string().max(60).optional(),
});

export const artifactSchema = z.object({
  id: z.string().min(1).max(80),
  agentId: z.string().min(1).max(64),
  kind: artifactKindSchema,
  title: z.string().min(1).max(TITLE_MAX),
  summary: z.string().max(SUMMARY_MAX).optional(),
  url: z.string().max(512).optional(),
  createdAt: z.number(),
});

export const agentMessageSchema = z.object({
  id: z.string().min(1).max(80),
  fromAgentId: z.string().min(1).max(64),
  toAgentId: z.string().min(1).max(64),
  message: z.string().min(1).max(TEXT_MAX),
  threadId: z.string().max(80).optional(),
  createdAt: z.number(),
  readAt: z.number().optional(),
});

export const agentTaskSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(TITLE_MAX),
  description: z.string().max(SUMMARY_MAX),
  status: z.enum(["open", "claimed", "completed", "failed"]),
  createdByAgentId: z.string().max(64).optional(),
  assignedAgentId: z.string().max(64).optional(),
  result: z.string().max(SUMMARY_MAX).optional(),
  artifactIds: z.array(z.string().max(80)).max(50).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const conversationSchema = z.object({
  id: z.string().min(1).max(80),
  agentIds: z.array(z.string().max(64)).min(1).max(20),
  topic: z.string().max(TITLE_MAX),
  summary: z.string().max(SUMMARY_MAX).optional(),
  startedAt: z.number(),
  endedAt: z.number().optional(),
});

const baseEventSchema = {
  eventId: z.string().min(1).max(80),
  ts: z.number(),
};

export const worldEventSchema: z.ZodType<WorldEvent> = z.discriminatedUnion("type", [
  z.object({
    ...baseEventSchema,
    type: z.literal("agent.register"),
    agent: agentIdentitySchema,
    initialPosition: gridPosSchema.optional(),
  }),
  z.object({
    ...baseEventSchema,
    type: z.literal("agent.heartbeat"),
    agentId: z.string().min(1).max(64),
    status: agentStatusSchema,
    currentTask: z.string().max(TITLE_MAX).optional(),
  }),
  z.object({
    ...baseEventSchema,
    type: z.literal("agent.move"),
    agentId: z.string().min(1).max(64),
    to: gridPosSchema,
    reason: z.string().max(SUMMARY_MAX).optional(),
  }),
  z.object({
    ...baseEventSchema,
    type: z.literal("agent.say"),
    agentId: z.string().min(1).max(64),
    text: z.string().min(1).max(TEXT_MAX),
    toAgentIds: z.array(z.string().max(64)).max(20).optional(),
  }),
  z.object({
    ...baseEventSchema,
    type: z.literal("agent.status"),
    agentId: z.string().min(1).max(64),
    status: agentStatusSchema,
    currentTask: z.string().max(TITLE_MAX).optional(),
    mood: agentMoodSchema.optional(),
    summary: z.string().max(SUMMARY_MAX).optional(),
  }),
  z.object({
    ...baseEventSchema,
    type: z.literal("agent.build"),
    agentId: z.string().min(1).max(64),
    object: worldObjectSchema,
    durationMs: z.number().optional(),
  }),
  z.object({
    ...baseEventSchema,
    type: z.literal("agent.artifact"),
    artifact: artifactSchema,
  }),
  z.object({
    ...baseEventSchema,
    type: z.literal("agent.skill.learned"),
    agentId: z.string().min(1).max(64),
    skill: z.string().min(1).max(64),
    reason: z.string().max(SUMMARY_MAX).optional(),
  }),
  z.object({
    ...baseEventSchema,
    type: z.literal("agent.memory.updated"),
    agentId: z.string().min(1).max(64),
    memorySummary: z.string().max(SUMMARY_MAX),
  }),
  z.object({
    ...baseEventSchema,
    type: z.literal("agent.message.sent"),
    message: agentMessageSchema,
  }),
  z.object({
    ...baseEventSchema,
    type: z.literal("task.created"),
    task: agentTaskSchema,
  }),
  z.object({
    ...baseEventSchema,
    type: z.literal("task.claimed"),
    taskId: z.string().min(1).max(80),
    agentId: z.string().min(1).max(64),
  }),
  z.object({
    ...baseEventSchema,
    type: z.literal("task.completed"),
    taskId: z.string().min(1).max(80),
    agentId: z.string().min(1).max(64),
    result: z.string().max(SUMMARY_MAX),
    artifactIds: z.array(z.string().max(80)).max(50).optional(),
  }),
  z.object({
    ...baseEventSchema,
    type: z.literal("conversation.started"),
    conversation: conversationSchema,
  }),
  z.object({
    ...baseEventSchema,
    type: z.literal("conversation.ended"),
    conversationId: z.string().min(1).max(80),
    summary: z.string().max(SUMMARY_MAX),
  }),
  z.object({
    ...baseEventSchema,
    type: z.literal("world.notification"),
    title: z.string().min(1).max(TITLE_MAX),
    message: z.string().max(SUMMARY_MAX),
    severity: z.enum(["info", "success", "warning", "error"]),
  }),
]);

/**
 * Parse + validate an unknown payload into a WorldEvent.
 * Throws a ZodError if the payload is invalid.
 */
export function parseWorldEvent(input: unknown): WorldEvent {
  return worldEventSchema.parse(input);
}

/** Non-throwing variant — returns null on invalid input. */
export function safeParseWorldEvent(input: unknown): WorldEvent | null {
  const result = worldEventSchema.safeParse(input);
  return result.success ? result.data : null;
}
