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

export const STATUS_CSS: Record<AgentStatus, string> = {
  offline: "#64748b",
  idle: "#94a3b8",
  thinking: "#a78bfa",
  coding: "#60a5fa",
  reviewing: "#f59e0b",
  debugging: "#fb7185",
  testing: "#22d3ee",
  blocked: "#ef4444",
  talking: "#34d399",
  building: "#c4b5fd",
  shipping: "#f472b6",
  learning: "#facc15",
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
  commit: "#94a3b8",
  pull_request: "#60a5fa",
  test_result: "#22d3ee",
  deployment: "#34d399",
  design_doc: "#a78bfa",
  memory: "#facc15",
  tool: "#c4b5fd",
  bug_report: "#fb7185",
  decision: "#f59e0b",
};

export const SEVERITY_CSS: Record<NotificationSeverity, string> = {
  info: "#60a5fa",
  success: "#34d399",
  warning: "#f59e0b",
  error: "#ef4444",
};
