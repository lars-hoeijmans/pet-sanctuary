/** Left panel: roster of live agents. Click a card to select + focus it. */
import { useMemo } from "react";
import type { AgentView } from "../../protocol/index";
import { useWorldStore } from "../state/useWorldStore";
import { sceneBus } from "../game/eventBus";
import { isHeartbeatFresh, STATUS_CSS } from "./format";

export function AgentPanel() {
  const agents = useWorldStore((s) => s.snapshot.agents);
  const selectedAgentId = useWorldStore((s) => s.selectedAgentId);
  const connectionStatus = useWorldStore((s) => s.connectionStatus);
  const selectAgent = useWorldStore((s) => s.selectAgent);

  const list = useMemo<AgentView[]>(
    () => Object.values(agents).sort((a, b) => a.name.localeCompare(b.name)),
    [agents],
  );

  const onSelect = (id: string): void => {
    selectAgent(id);
    sceneBus.emit("camera:focusAgent", id);
  };

  return (
    <section className="section" aria-label="Live agents">
      <header className="section__head">
        <h2 className="section__title">Live agents</h2>
        <span className="section__count">{list.length}</span>
      </header>

      {list.length === 0 ? (
        <p className="empty">
          {connectionStatus === "connecting" ? "Connecting to the city…" : "No agents have joined yet."}
        </p>
      ) : (
        <ul className="agent-list">
          {list.map((agent) => {
            const fresh = isHeartbeatFresh(agent.lastHeartbeatAt);
            return (
              <li key={agent.id}>
                <button
                  className={`agent-card ${selectedAgentId === agent.id ? "agent-card--selected" : ""}`}
                  onClick={() => onSelect(agent.id)}
                  style={{ ["--agent-color" as string]: agent.color }}
                >
                  <span className="agent-card__avatar" style={{ background: agent.color }} aria-hidden="true" />
                  <span className="agent-card__body">
                    <span className="agent-card__top">
                      <span className="agent-card__name">{agent.name}</span>
                      <span
                        className="agent-card__heartbeat"
                        title={fresh ? "Heartbeat healthy" : "No recent heartbeat"}
                        style={{ background: fresh ? "#34d399" : "#475569" }}
                      />
                    </span>
                    <span className="agent-card__role">{agent.role}</span>
                    <span className="agent-card__meta">
                      <span className="status-chip" style={{ ["--c" as string]: STATUS_CSS[agent.status] }}>
                        {agent.status}
                      </span>
                      <span className="runtime-chip">{agent.runtime}</span>
                    </span>
                    {agent.currentTask && <span className="agent-card__task">↳ {agent.currentTask}</span>}
                    {agent.skills.length > 0 && (
                      <span className="agent-card__skills">
                        {agent.skills.slice(0, 4).map((skill) => (
                          <span key={skill} className="skill-chip">
                            {skill}
                          </span>
                        ))}
                        {agent.skills.length > 4 && <span className="skill-chip">+{agent.skills.length - 4}</span>}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
