/**
 * Helpers that build well-formed WorldEvents. Centralizing construction keeps
 * eventId / timestamp generation consistent and the call sites readable.
 */
import { nanoid } from "nanoid";
import type {
  AgentIdentity,
  AgentMessage,
  AgentMood,
  AgentStatus,
  AgentTask,
  Artifact,
  ArtifactKind,
  Conversation,
  GridPos,
  NotificationSeverity,
  ObjectKind,
  WorldEvent,
  WorldObject,
} from "../../protocol/index";

const base = (): { eventId: string; ts: number } => ({ eventId: `evt-${nanoid(8)}`, ts: Date.now() });

export const ev = {
  register(agent: AgentIdentity, initialPosition?: GridPos): WorldEvent {
    return { ...base(), type: "agent.register", agent, initialPosition };
  },
  heartbeat(agentId: string, status: AgentStatus, currentTask?: string): WorldEvent {
    return { ...base(), type: "agent.heartbeat", agentId, status, currentTask };
  },
  move(agentId: string, to: GridPos, reason?: string): WorldEvent {
    return { ...base(), type: "agent.move", agentId, to, reason };
  },
  say(agentId: string, text: string, toAgentIds?: string[]): WorldEvent {
    return { ...base(), type: "agent.say", agentId, text, toAgentIds };
  },
  status(
    agentId: string,
    status: AgentStatus,
    opts: { currentTask?: string; mood?: AgentMood; summary?: string } = {},
  ): WorldEvent {
    return { ...base(), type: "agent.status", agentId, status, ...opts };
  },
  build(agentId: string, kind: ObjectKind, position: GridPos, label?: string, durationMs?: number): WorldEvent {
    const object: WorldObject = { id: `obj-${nanoid(8)}`, kind, position, ownerAgentId: agentId, label };
    return { ...base(), type: "agent.build", agentId, object, durationMs };
  },
  artifact(agentId: string, kind: ArtifactKind, title: string, summary?: string, url?: string): WorldEvent {
    const artifact: Artifact = { id: `art-${nanoid(8)}`, agentId, kind, title, summary, url, createdAt: Date.now() };
    return { ...base(), type: "agent.artifact", artifact };
  },
  skillLearned(agentId: string, skill: string, reason?: string): WorldEvent {
    return { ...base(), type: "agent.skill.learned", agentId, skill, reason };
  },
  memoryUpdated(agentId: string, memorySummary: string): WorldEvent {
    return { ...base(), type: "agent.memory.updated", agentId, memorySummary };
  },
  message(fromAgentId: string, toAgentId: string, message: string, threadId?: string): WorldEvent {
    const msg: AgentMessage = {
      id: `msg-${nanoid(8)}`,
      fromAgentId,
      toAgentId,
      message,
      threadId,
      createdAt: Date.now(),
    };
    return { ...base(), type: "agent.message.sent", message: msg };
  },
  taskCreated(title: string, description: string, createdByAgentId?: string): WorldEvent {
    const now = Date.now();
    const task: AgentTask = {
      id: `task-${nanoid(8)}`,
      title,
      description,
      status: "open",
      createdByAgentId,
      createdAt: now,
      updatedAt: now,
    };
    return { ...base(), type: "task.created", task };
  },
  taskClaimed(taskId: string, agentId: string): WorldEvent {
    return { ...base(), type: "task.claimed", taskId, agentId };
  },
  taskCompleted(taskId: string, agentId: string, result: string, artifactIds?: string[]): WorldEvent {
    return { ...base(), type: "task.completed", taskId, agentId, result, artifactIds };
  },
  conversationStarted(agentIds: string[], topic: string): WorldEvent {
    const conversation: Conversation = {
      id: `conv-${nanoid(8)}`,
      agentIds,
      topic,
      startedAt: Date.now(),
    };
    return { ...base(), type: "conversation.started", conversation };
  },
  conversationEnded(conversationId: string, summary: string): WorldEvent {
    return { ...base(), type: "conversation.ended", conversationId, summary };
  },
  notification(title: string, message: string, severity: NotificationSeverity): WorldEvent {
    return { ...base(), type: "world.notification", title, message, severity };
  },
};
