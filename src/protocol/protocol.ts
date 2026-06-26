/**
 * Agent City — shared world protocol.
 *
 * This is the single most important file in the project. It is runtime-agnostic:
 * mock agents, Hermes, OpenClaw, or any future runtime all speak this protocol.
 * Agents emit semantic events; the frontend decides how to render them.
 *
 * No imports here on purpose — these types are shared by client, (future) server,
 * and the agent-runner placeholders.
 */

export type AgentStatus =
  | "offline"
  | "idle"
  | "thinking"
  | "coding"
  | "reviewing"
  | "debugging"
  | "testing"
  | "blocked"
  | "talking"
  | "building"
  | "shipping"
  | "learning";

export type AgentMood = "focused" | "happy" | "confused" | "blocked" | "excited";

export type AgentAvatar = "default" | "robot" | "hoodie" | "wizard" | "infra";

export type AgentRuntime = "mock" | "hermes" | "openclaw" | "custom";

export type ArtifactKind =
  | "commit"
  | "pull_request"
  | "test_result"
  | "deployment"
  | "design_doc"
  | "memory"
  | "tool"
  | "bug_report"
  | "decision";

export type ObjectKind =
  | "desk"
  | "chair"
  | "plant"
  | "server_rack"
  | "whiteboard"
  | "terminal"
  | "meeting_table"
  | "lamp"
  | "bookshelf"
  | "coffee_machine"
  | "sofa"
  | "notice_board";

export type TaskStatus = "open" | "claimed" | "completed" | "failed";

export type NotificationSeverity = "info" | "success" | "warning" | "error";

export interface GridPos {
  x: number;
  y: number;
  z?: number;
  roomId?: string;
}

export interface AgentIdentity {
  id: string;
  name: string;
  role: string;
  avatar: AgentAvatar;
  color: string;
  runtime: AgentRuntime;
  workspace?: string;
}

export interface AgentView extends AgentIdentity {
  position: GridPos;
  status: AgentStatus;
  currentTask?: string;
  mood?: AgentMood;
  skills: string[];
  memorySummary?: string;
  lastHeartbeatAt?: number;
}

export interface WorldObject {
  id: string;
  kind: ObjectKind;
  position: GridPos;
  ownerAgentId?: string;
  label?: string;
}

export interface Artifact {
  id: string;
  agentId: string;
  kind: ArtifactKind;
  title: string;
  summary?: string;
  url?: string;
  createdAt: number;
}

export interface AgentMessage {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  message: string;
  threadId?: string;
  createdAt: number;
  readAt?: number;
}

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  createdByAgentId?: string;
  assignedAgentId?: string;
  result?: string;
  artifactIds?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Conversation {
  id: string;
  agentIds: string[];
  topic: string;
  summary?: string;
  startedAt: number;
  endedAt?: number;
}

export interface BaseEvent {
  eventId: string;
  ts: number;
}

/**
 * The full discriminated union of world events. Kept as a `type` (not interface)
 * because TypeScript discriminated unions require it.
 */
export type WorldEvent =
  | (BaseEvent & {
      type: "agent.register";
      agent: AgentIdentity;
      initialPosition?: GridPos;
    })
  | (BaseEvent & {
      type: "agent.heartbeat";
      agentId: string;
      status: AgentStatus;
      currentTask?: string;
    })
  | (BaseEvent & {
      type: "agent.move";
      agentId: string;
      to: GridPos;
      reason?: string;
    })
  | (BaseEvent & {
      type: "agent.say";
      agentId: string;
      text: string;
      toAgentIds?: string[];
    })
  | (BaseEvent & {
      type: "agent.status";
      agentId: string;
      status: AgentStatus;
      currentTask?: string;
      mood?: AgentMood;
      summary?: string;
    })
  | (BaseEvent & {
      type: "agent.build";
      agentId: string;
      object: WorldObject;
      durationMs?: number;
    })
  | (BaseEvent & {
      type: "agent.artifact";
      artifact: Artifact;
    })
  | (BaseEvent & {
      type: "agent.skill.learned";
      agentId: string;
      skill: string;
      reason?: string;
    })
  | (BaseEvent & {
      type: "agent.memory.updated";
      agentId: string;
      memorySummary: string;
    })
  | (BaseEvent & {
      type: "agent.message.sent";
      message: AgentMessage;
    })
  | (BaseEvent & {
      type: "task.created";
      task: AgentTask;
    })
  | (BaseEvent & {
      type: "task.claimed";
      taskId: string;
      agentId: string;
    })
  | (BaseEvent & {
      type: "task.completed";
      taskId: string;
      agentId: string;
      result: string;
      artifactIds?: string[];
    })
  | (BaseEvent & {
      type: "conversation.started";
      conversation: Conversation;
    })
  | (BaseEvent & {
      type: "conversation.ended";
      conversationId: string;
      summary: string;
    })
  | (BaseEvent & {
      type: "world.notification";
      title: string;
      message: string;
      severity: NotificationSeverity;
    });

export type WorldEventType = WorldEvent["type"];

export interface WorldSnapshot {
  seq: number;
  agents: Record<string, AgentView>;
  objects: Record<string, WorldObject>;
  artifacts: Artifact[];
  messages: AgentMessage[];
  tasks: AgentTask[];
  conversations: Record<string, Conversation>;
  events: WorldEvent[];
}

/** World grid dimensions, shared by mock world, pathfinding and the scene. */
export const WORLD_WIDTH = 22;
export const WORLD_HEIGHT = 15;
