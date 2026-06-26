/** Slide-over inspector for the selected agent: identity, state, skills, activity. */
import { useMemo } from "react";
import { Crosshair, LocateFixed, X } from "lucide-react";
import { humanizeEvent } from "../../protocol/index";
import { useWorldStore } from "../state/useWorldStore";
import { sceneBus } from "../game/eventBus";
import { involvesAgent, isHeartbeatFresh, relativeTime, STATUS_CSS } from "./format";

export function InspectorDrawer() {
  const selectedAgentId = useWorldStore((s) => s.selectedAgentId);
  const agent = useWorldStore((s) => (s.selectedAgentId ? s.snapshot.agents[s.selectedAgentId] : undefined));
  const snapshot = useWorldStore((s) => s.snapshot);
  const recentEvents = useWorldStore((s) => s.recentEvents);
  const followAgentId = useWorldStore((s) => s.followAgentId);
  const selectAgent = useWorldStore((s) => s.selectAgent);
  const toggleFollow = useWorldStore((s) => s.toggleFollow);

  const activity = useMemo(() => {
    if (!selectedAgentId) return [];
    return recentEvents
      .filter((e) => e.type !== "agent.heartbeat" && involvesAgent(e, selectedAgentId))
      .slice(0, 10);
  }, [recentEvents, selectedAgentId]);

  if (!selectedAgentId || !agent) return null;

  const isFollowing = followAgentId === selectedAgentId;
  const fresh = isHeartbeatFresh(agent.lastHeartbeatAt);

  return (
    <aside className="inspector" aria-label={`Inspector: ${agent.name}`}>
      <header className="inspector__head" style={{ ["--agent-color" as string]: agent.color }}>
        <span className="inspector__avatar" style={{ background: agent.color }} aria-hidden="true" />
        <div className="inspector__id">
          <h2 className="inspector__name">{agent.name}</h2>
          <p className="inspector__role">{agent.role}</p>
        </div>
        <button className="icon-btn" onClick={() => selectAgent(null)} aria-label="Close inspector">
          <X size={16} />
        </button>
      </header>

      <div className="inspector__statusline">
        <span className="status-chip" style={{ ["--c" as string]: STATUS_CSS[agent.status] }}>
          {agent.status}
        </span>
        {agent.mood && <span className="runtime-chip">{agent.mood}</span>}
        <span className="runtime-chip">{agent.runtime}</span>
        <span className="inspector__heartbeat" style={{ color: fresh ? "#34d399" : "#94a3b8" }}>
          ● {agent.lastHeartbeatAt ? relativeTime(agent.lastHeartbeatAt) : "no heartbeat"}
        </span>
      </div>

      <div className="inspector__actions">
        <button className={`btn ${isFollowing ? "btn--active" : ""}`} onClick={() => toggleFollow(agent.id)}>
          <Crosshair size={14} /> {isFollowing ? "Following" : "Follow"}
        </button>
        <button className="btn" onClick={() => sceneBus.emit("camera:focusAgent", agent.id)}>
          <LocateFixed size={14} /> Focus
        </button>
      </div>

      <dl className="inspector__facts">
        <div>
          <dt>Current task</dt>
          <dd>{agent.currentTask ?? "—"}</dd>
        </div>
        <div>
          <dt>Position</dt>
          <dd>
            ({agent.position.x}, {agent.position.y}){agent.position.roomId ? ` · ${agent.position.roomId}` : ""}
          </dd>
        </div>
        <div>
          <dt>Memory</dt>
          <dd>{agent.memorySummary ?? "No memory yet."}</dd>
        </div>
      </dl>

      <div className="inspector__block">
        <h3>Skills</h3>
        {agent.skills.length === 0 ? (
          <p className="empty">No skills learned yet.</p>
        ) : (
          <div className="chip-wrap">
            {agent.skills.map((skill) => (
              <span key={skill} className="skill-chip">
                {skill}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="inspector__block">
        <h3>Recent activity</h3>
        {activity.length === 0 ? (
          <p className="empty">No recent activity.</p>
        ) : (
          <ul className="inspector__activity">
            {activity.map((event) => (
              <li key={event.eventId}>
                <span>{humanizeEvent(event, snapshot)}</span>
                <span className="inspector__activity-time">{relativeTime(event.ts)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
