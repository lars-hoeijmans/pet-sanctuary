/** Shared, JSX-free formatting helpers and color maps for the UI. */
import type {
  AgentStatus,
  ArtifactKind,
  NotificationSeverity,
  WorldEvent,
} from "../../protocol/index";

/** Whether an event references a given agent (for per-agent filtering). */
export function involvesAgent(event: WorldEvent, id: string): boolean {
  switch (event.type) {
    case "agent.register":
      return event.agent.id === id;
    case "agent.heartbeat":
    case "agent.move":
    case "agent.say":
    case "agent.status":
    case "agent.build":
    case "agent.skill.learned":
    case "agent.memory.updated":
    case "task.claimed":
    case "task.completed":
      return event.agentId === id;
    case "agent.artifact":
      return event.artifact.agentId === id;
    case "agent.message.sent":
      return event.message.fromAgentId === id || event.message.toAgentId === id;
    case "task.created":
      return event.task.createdByAgentId === id;
    case "conversation.started":
      return event.conversation.agentIds.includes(id);
    default:
      return false;
  }
}

export function relativeTime(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const s = Math.floor(diff / 1000);
  if (s < 3) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function isHeartbeatFresh(lastHeartbeatAt: number | undefined, now: number = Date.now()): boolean {
  if (!lastHeartbeatAt) return false;
  return now - lastHeartbeatAt < 15_000;
}

// Vivid, solid color blocks designed for BLACK text on top (neo-brutalist UI).
export const STATUS_CSS: Record<AgentStatus, string> = {
  offline: "#cfc6b2",
  idle: "#cdd6e8",
  thinking: "#b98cf7",
  coding: "#5c8df6",
  reviewing: "#ffcf3a",
  debugging: "#ff7aa8",
  testing: "#54d6e0",
  blocked: "#ff6151",
  talking: "#92e05a",
  building: "#c4a2ff",
  shipping: "#ff7fb6",
  learning: "#ffd23f",
};

export const ARTIFACT_LABEL: Record<ArtifactKind, string> = {
  commit: "Commit",
  pull_request: "Pull Request",
  test_result: "Test Result",
  deployment: "Deployment",
  design_doc: "Design Doc",
  memory: "Memory",
  tool: "Tool",
  bug_report: "Bug Report",
  decision: "Decision",
};

export const ARTIFACT_CSS: Record<ArtifactKind, string> = {
  commit: "#cdd6e8",
  pull_request: "#5c8df6",
  test_result: "#54d6e0",
  deployment: "#92e05a",
  design_doc: "#b98cf7",
  memory: "#ffd23f",
  tool: "#c4a2ff",
  bug_report: "#ff7aa8",
  decision: "#ff9347",
};

export const SEVERITY_CSS: Record<NotificationSeverity, string> = {
  info: "#5c8df6",
  success: "#92e05a",
  warning: "#ffcf3a",
  error: "#ff6151",
};
