/** Top bar: brand, connection status, live counts, and primary world controls. */
import { Activity, Boxes, Command, Crosshair, Play, RotateCcw, Square, Users } from "lucide-react";
import { useWorldStore } from "../state/useWorldStore";
import { StatusPill } from "./StatusPill";

export function HeaderBar() {
  const connectionStatus = useWorldStore((s) => s.connectionStatus);
  const isDemoPlaying = useWorldStore((s) => s.isDemoPlaying);
  const selectedAgentId = useWorldStore((s) => s.selectedAgentId);
  const followAgentId = useWorldStore((s) => s.followAgentId);
  const sourceKind = useWorldStore((s) => s.sourceKind);
  const agentCount = useWorldStore((s) => Object.keys(s.snapshot.agents).length);
  const eventCount = useWorldStore((s) => s.snapshot.seq);

  const playDemo = useWorldStore((s) => s.playDemo);
  const stopDemo = useWorldStore((s) => s.stopDemo);
  const reset = useWorldStore((s) => s.reset);
  const toggleFollow = useWorldStore((s) => s.toggleFollow);
  const setCommandPaletteOpen = useWorldStore((s) => s.setCommandPaletteOpen);

  const isFollowing = Boolean(selectedAgentId && followAgentId === selectedAgentId);

  return (
    <header className="header">
      <div className="header__brand">
        <span className="header__logo" aria-hidden="true">
          <Boxes size={22} />
        </span>
        <div className="header__titles">
          <h1 className="header__title">Agent City</h1>
          <p className="header__subtitle">a living society for coding agents</p>
        </div>
        {sourceKind && (
          <span className={`source-tag source-tag--${sourceKind}`}>
            {sourceKind === "mock" ? "mock runtime" : "live server"}
          </span>
        )}
      </div>

      <div className="header__stats">
        <StatusPill status={connectionStatus} />
        <span className="header__stat" title="Live agents">
          <Users size={14} /> {agentCount}
        </span>
        <span className="header__stat" title="World events">
          <Activity size={14} /> {eventCount}
        </span>
      </div>

      <div className="header__actions">
        {isDemoPlaying ? (
          <button className="btn btn--warn" onClick={stopDemo}>
            <Square size={15} /> Stop Demo
          </button>
        ) : (
          <button className="btn btn--primary" onClick={playDemo}>
            <Play size={15} /> Play Demo
          </button>
        )}
        <button className="btn" onClick={reset}>
          <RotateCcw size={15} /> Reset
        </button>
        <button
          className={`btn ${isFollowing ? "btn--active" : ""}`}
          onClick={() => selectedAgentId && toggleFollow(selectedAgentId)}
          disabled={!selectedAgentId}
          title={selectedAgentId ? "Follow the selected agent" : "Select an agent first"}
        >
          <Crosshair size={15} /> {isFollowing ? "Following" : "Follow"}
        </button>
        <button className="btn btn--ghost" onClick={() => setCommandPaletteOpen(true)} title="Command palette (⌘K)">
          <Command size={15} /> <kbd>⌘K</kbd>
        </button>
      </div>
    </header>
  );
}
