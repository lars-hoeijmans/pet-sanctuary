/**
 * Pure world reducer — the single source of truth for how events mutate state.
 *
 * Constraints:
 *  - Pure function, no side effects, no network.
 *  - No Phaser / React imports.
 *  - Used identically by the client and (later) the server, so both stay in sync.
 */
import type {
  AgentView,
  GridPos,
  WorldEvent,
  WorldSnapshot,
} from "./protocol";

const MAX_EVENTS = 300;
const MAX_ARTIFACTS = 80;
const MAX_MESSAGES = 200;

const DEFAULT_POSITION: GridPos = { x: 11, y: 7 };

export function createEmptyWorld(): WorldSnapshot {
  return {
    seq: 0,
    agents: {},
    objects: {},
    artifacts: [],
    messages: [],
    tasks: [],
    conversations: {},
    events: [],
  };
}

function clampList<T>(list: T[], max: number): T[] {
  return list.length > max ? list.slice(0, max) : list;
}

/**
 * Apply a single event to a snapshot, returning a NEW snapshot.
 * The previous snapshot is never mutated.
 */
export function applyWorldEvent(
  snapshot: WorldSnapshot,
  event: WorldEvent,
): WorldSnapshot {
  const next: WorldSnapshot = {
    seq: snapshot.seq + 1,
    agents: { ...snapshot.agents },
    objects: { ...snapshot.objects },
    artifacts: snapshot.artifacts,
    messages: snapshot.messages,
    tasks: snapshot.tasks,
    conversations: { ...snapshot.conversations },
    events: [event, ...snapshot.events].slice(0, MAX_EVENTS),
  };

  switch (event.type) {
    case "agent.register": {
      const existing = next.agents[event.agent.id];
      const position = event.initialPosition ?? existing?.position ?? DEFAULT_POSITION;
      const merged: AgentView = {
        ...event.agent,
        position,
        status: existing?.status ?? "idle",
        currentTask: existing?.currentTask,
        mood: existing?.mood,
        skills: existing?.skills ?? [],
        memorySummary: existing?.memorySummary,
        lastHeartbeatAt: event.ts,
      };
      next.agents[event.agent.id] = merged;
      break;
    }

    case "agent.heartbeat": {
      const agent = next.agents[event.agentId];
      if (agent) {
        next.agents[event.agentId] = {
          ...agent,
          status: event.status,
          currentTask: event.currentTask ?? agent.currentTask,
          lastHeartbeatAt: event.ts,
        };
      }
      break;
    }

    case "agent.move": {
      const agent = next.agents[event.agentId];
      if (agent) {
        next.agents[event.agentId] = { ...agent, position: event.to };
      }
      break;
    }

    case "agent.status": {
      const agent = next.agents[event.agentId];
      if (agent) {
        next.agents[event.agentId] = {
          ...agent,
          status: event.status,
          currentTask: event.currentTask ?? agent.currentTask,
          mood: event.mood ?? agent.mood,
          memorySummary: event.summary ?? agent.memorySummary,
        };
      }
      break;
    }

    case "agent.build": {
      next.objects[event.object.id] = event.object;
      break;
    }

    case "agent.artifact": {
      next.artifacts = clampList([event.artifact, ...next.artifacts], MAX_ARTIFACTS);
      break;
    }

    case "agent.skill.learned": {
      const agent = next.agents[event.agentId];
      if (agent && !agent.skills.includes(event.skill)) {
        next.agents[event.agentId] = {
          ...agent,
          skills: [...agent.skills, event.skill],
        };
      }
      break;
    }

    case "agent.memory.updated": {
      const agent = next.agents[event.agentId];
      if (agent) {
        next.agents[event.agentId] = { ...agent, memorySummary: event.memorySummary };
      }
      break;
    }

    case "agent.message.sent": {
      next.messages = clampList([event.message, ...next.messages], MAX_MESSAGES);
      break;
    }

    case "agent.say": {
      // Speech is purely visual (rendered as a bubble). No snapshot mutation
      // beyond the event log, but mark the speaker as talking for clarity.
      const agent = next.agents[event.agentId];
      if (agent && agent.status === "idle") {
        next.agents[event.agentId] = { ...agent, status: "talking" };
      }
      break;
    }

    case "task.created": {
      next.tasks = [event.task, ...next.tasks];
      break;
    }

    case "task.claimed": {
      next.tasks = next.tasks.map((task) =>
        task.id === event.taskId
          ? { ...task, status: "claimed", assignedAgentId: event.agentId, updatedAt: event.ts }
          : task,
      );
      break;
    }

    case "task.completed": {
      next.tasks = next.tasks.map((task) =>
        task.id === event.taskId
          ? {
              ...task,
              status: "completed",
              result: event.result,
              artifactIds: event.artifactIds ?? task.artifactIds,
              updatedAt: event.ts,
            }
          : task,
      );
      break;
    }

    case "conversation.started": {
      next.conversations[event.conversation.id] = event.conversation;
      break;
    }

    case "conversation.ended": {
      const conversation = next.conversations[event.conversationId];
      if (conversation) {
        next.conversations[event.conversationId] = {
          ...conversation,
          summary: event.summary,
          endedAt: event.ts,
        };
      }
      break;
    }

    case "world.notification": {
      // Notifications live only in the event log / toast layer.
      break;
    }

    default: {
      // Exhaustiveness guard — a new event type without a case is a compile error.
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }

  return next;
}

/** Convenience: fold an ordered list of events onto an empty world. */
export function reduceEvents(events: WorldEvent[]): WorldSnapshot {
  return events.reduce(applyWorldEvent, createEmptyWorld());
}
