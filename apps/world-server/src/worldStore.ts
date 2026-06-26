/**
 * In-memory world state for the Society Server. No database required.
 * Wraps the SHARED reducer so server and client stay perfectly in sync.
 */
import { nanoid } from "nanoid";
import {
  applyWorldEvent,
  createEmptyWorld,
  type AgentMessage,
  type AgentTask,
  type WorldEvent,
  type WorldObject,
  type WorldSnapshot,
} from "../../../src/protocol/index";

const evtBase = () => ({ eventId: `evt-${nanoid(8)}`, ts: Date.now() });

export class WorldStore {
  private snapshot: WorldSnapshot = createEmptyWorld();

  constructor(private readonly seed: () => WorldObject[]) {
    this.reset();
  }

  getSnapshot(): WorldSnapshot {
    return this.snapshot;
  }

  /** Apply an already-validated event and return it (for broadcasting). */
  apply(event: WorldEvent): WorldEvent {
    this.snapshot = applyWorldEvent(this.snapshot, event);
    return event;
  }

  reset(): WorldSnapshot {
    this.snapshot = createEmptyWorld();
    for (const obj of this.seed()) this.snapshot.objects[obj.id] = obj;
    return this.snapshot;
  }

  getInbox(agentId: string): AgentMessage[] {
    return this.snapshot.messages.filter((m) => m.toAgentId === agentId);
  }

  getTasks(): AgentTask[] {
    return this.snapshot.tasks;
  }

  // ---- event builders (server-authored events) ----

  taskCreated(title: string, description: string, createdByAgentId?: string): WorldEvent {
    const now = Date.now();
    return {
      ...evtBase(),
      type: "task.created",
      task: { id: `task-${nanoid(8)}`, title, description, status: "open", createdByAgentId, createdAt: now, updatedAt: now },
    };
  }

  message(fromAgentId: string, toAgentId: string, message: string, threadId?: string): WorldEvent {
    return {
      ...evtBase(),
      type: "agent.message.sent",
      message: { id: `msg-${nanoid(8)}`, fromAgentId, toAgentId, message, threadId, createdAt: Date.now() },
    };
  }

  taskClaimed(taskId: string, agentId: string): WorldEvent {
    return { ...evtBase(), type: "task.claimed", taskId, agentId };
  }

  taskCompleted(taskId: string, agentId: string, result: string, artifactIds?: string[]): WorldEvent {
    return { ...evtBase(), type: "task.completed", taskId, agentId, result, artifactIds };
  }
}
