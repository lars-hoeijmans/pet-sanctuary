/**
 * worldClient — a small HTTP client an agent container uses to act in the world.
 *
 * Every method posts a valid protocol event (or a REST command) to the Society
 * Server. A runtime adapter only ever talks to the world through this client, so
 * the city always "sees" what an agent did and can visualize it.
 *
 * Uses the global fetch (Node 18+). No third-party deps.
 */
import { nanoid } from "nanoid";
import type {
  AgentAvatar,
  AgentMessage,
  AgentStatus,
  AgentTask,
  ArtifactKind,
  GridPos,
  NotificationSeverity,
  ObjectKind,
  WorldEvent,
} from "../../../src/protocol/index";

export interface WorldClientConfig {
  baseUrl: string;
  agentId: string;
  name: string;
  role: string;
  avatar: AgentAvatar;
  color: string;
  workspace?: string;
}

const evtBase = () => ({ eventId: `evt-${nanoid(8)}`, ts: Date.now() });

export class WorldClient {
  constructor(private readonly cfg: WorldClientConfig) {}

  private async postEvent(event: WorldEvent): Promise<void> {
    await this.post("/api/world/events", event);
  }

  private async post<T = unknown>(path: string, body?: unknown): Promise<T | null> {
    try {
      const res = await fetch(`${this.cfg.baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch (err) {
      console.warn(`[worldClient:${this.cfg.agentId}] POST ${path} failed`, err);
      return null;
    }
  }

  register(initialPosition?: GridPos): Promise<void> {
    return this.postEvent({
      ...evtBase(),
      type: "agent.register",
      agent: {
        id: this.cfg.agentId,
        name: this.cfg.name,
        role: this.cfg.role,
        avatar: this.cfg.avatar,
        color: this.cfg.color,
        runtime: "mock",
        workspace: this.cfg.workspace,
      },
      initialPosition,
    });
  }

  heartbeat(status: AgentStatus, currentTask?: string): Promise<void> {
    return this.postEvent({ ...evtBase(), type: "agent.heartbeat", agentId: this.cfg.agentId, status, currentTask });
  }

  moveTo(to: GridPos, reason?: string): Promise<void> {
    return this.postEvent({ ...evtBase(), type: "agent.move", agentId: this.cfg.agentId, to, reason });
  }

  say(text: string, toAgentIds?: string[]): Promise<void> {
    return this.postEvent({ ...evtBase(), type: "agent.say", agentId: this.cfg.agentId, text, toAgentIds });
  }

  status(status: AgentStatus, currentTask?: string, summary?: string): Promise<void> {
    return this.postEvent({ ...evtBase(), type: "agent.status", agentId: this.cfg.agentId, status, currentTask, summary });
  }

  build(kind: ObjectKind, position: GridPos, label?: string): Promise<void> {
    return this.postEvent({
      ...evtBase(),
      type: "agent.build",
      agentId: this.cfg.agentId,
      object: { id: `obj-${nanoid(8)}`, kind, position, ownerAgentId: this.cfg.agentId, label },
    });
  }

  publishArtifact(kind: ArtifactKind, title: string, summary?: string, url?: string): Promise<void> {
    return this.postEvent({
      ...evtBase(),
      type: "agent.artifact",
      artifact: { id: `art-${nanoid(8)}`, agentId: this.cfg.agentId, kind, title, summary, url, createdAt: Date.now() },
    });
  }

  learnSkill(skill: string, reason?: string): Promise<void> {
    return this.postEvent({ ...evtBase(), type: "agent.skill.learned", agentId: this.cfg.agentId, skill, reason });
  }

  updateMemory(memorySummary: string): Promise<void> {
    return this.postEvent({ ...evtBase(), type: "agent.memory.updated", agentId: this.cfg.agentId, memorySummary });
  }

  sendMessage(toAgentId: string, message: string, threadId?: string): Promise<void> {
    return this.post(`/api/agents/${toAgentId}/messages`, {
      fromAgentId: this.cfg.agentId,
      message,
      threadId,
    }).then(() => undefined);
  }

  getInbox(): Promise<AgentMessage[] | null> {
    return this.get<AgentMessage[]>(`/api/agents/${this.cfg.agentId}/inbox`);
  }

  getTasks(): Promise<AgentTask[] | null> {
    return this.get<AgentTask[]>("/api/tasks");
  }

  createTask(title: string, description: string): Promise<void> {
    return this.post("/api/tasks", { title, description, createdByAgentId: this.cfg.agentId }).then(() => undefined);
  }

  claimTask(taskId: string): Promise<void> {
    return this.post(`/api/tasks/${taskId}/claim`, { agentId: this.cfg.agentId }).then(() => undefined);
  }

  completeTask(taskId: string, result: string, artifactIds?: string[]): Promise<void> {
    return this.post(`/api/tasks/${taskId}/complete`, { agentId: this.cfg.agentId, result, artifactIds }).then(() => undefined);
  }

  notify(title: string, message: string, severity: NotificationSeverity): Promise<void> {
    return this.postEvent({ ...evtBase(), type: "world.notification", title, message, severity });
  }

  private async get<T>(path: string): Promise<T | null> {
    try {
      const res = await fetch(`${this.cfg.baseUrl}${path}`);
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }
}
