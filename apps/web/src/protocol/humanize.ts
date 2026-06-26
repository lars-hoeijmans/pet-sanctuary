/**
 * Humanize world events into readable society-feed lines.
 * Used by the EventFeed UI and the world notification toasts.
 */
import type { WorldEvent, WorldSnapshot } from "./protocol";

function agentName(agentId: string | undefined, snapshot?: WorldSnapshot): string {
  if (!agentId) return "An agent";
  return snapshot?.agents[agentId]?.name ?? agentId;
}

const ARTIFACT_VERB: Record<string, string> = {
  commit: "pushed a commit",
  pull_request: "opened a pull request",
  test_result: "published a test result",
  deployment: "shipped a deployment",
  design_doc: "published a design doc",
  memory: "saved a memory",
  tool: "built a tool",
  bug_report: "filed a bug report",
  decision: "recorded a decision",
};

const OBJECT_LABEL: Record<string, string> = {
  desk: "a desk",
  chair: "a chair",
  plant: "a plant",
  server_rack: "a server rack",
  whiteboard: "a whiteboard",
  terminal: "a terminal",
  meeting_table: "a meeting table",
  lamp: "a lamp",
  bookshelf: "a bookshelf",
  coffee_machine: "a coffee machine",
  sofa: "a sofa",
  notice_board: "a notice board",
};

export function humanizeEvent(event: WorldEvent, snapshot?: WorldSnapshot): string {
  switch (event.type) {
    case "agent.register":
      return `${event.agent.name} joined the city.`;

    case "agent.heartbeat":
      return `${agentName(event.agentId, snapshot)} is ${event.status}.`;

    case "agent.move": {
      const where = event.to.roomId ? ` to ${event.to.roomId}` : "";
      const reason = event.reason ? ` — ${event.reason}` : "";
      return `${agentName(event.agentId, snapshot)} moved${where}${reason}.`;
    }

    case "agent.say":
      return `${agentName(event.agentId, snapshot)} said: “${event.text}”`;

    case "agent.status": {
      const task = event.currentTask ? ` (${event.currentTask})` : "";
      return `${agentName(event.agentId, snapshot)} is now ${event.status}${task}.`;
    }

    case "agent.build":
      return `${agentName(event.agentId, snapshot)} built ${OBJECT_LABEL[event.object.kind] ?? "an object"}${
        event.object.label ? ` — ${event.object.label}` : ""
      }.`;

    case "agent.artifact": {
      const verb = ARTIFACT_VERB[event.artifact.kind] ?? "published an artifact";
      return `${agentName(event.artifact.agentId, snapshot)} ${verb}: ${event.artifact.title}.`;
    }

    case "agent.skill.learned":
      return `${agentName(event.agentId, snapshot)} learned ${event.skill}.`;

    case "agent.memory.updated":
      return `${agentName(event.agentId, snapshot)} updated their memory.`;

    case "agent.message.sent":
      return `${agentName(event.message.fromAgentId, snapshot)} messaged ${agentName(
        event.message.toAgentId,
        snapshot,
      )}: “${event.message.message}”`;

    case "task.created":
      return `${agentName(event.task.createdByAgentId, snapshot)} created task: ${event.task.title}.`;

    case "task.claimed":
      return `${agentName(event.agentId, snapshot)} claimed a task.`;

    case "task.completed":
      return `${agentName(event.agentId, snapshot)} completed a task: ${event.result}.`;

    case "conversation.started":
      return `A conversation started: ${event.conversation.topic}.`;

    case "conversation.ended":
      return `Conversation ended: ${event.summary}.`;

    case "world.notification":
      return `${event.title} — ${event.message}`;

    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}
