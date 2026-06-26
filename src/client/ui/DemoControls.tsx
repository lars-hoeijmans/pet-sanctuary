/**
 * Bottom dock: demo + world controls. These call server-style command methods
 * on the store (which delegate to the WorldSource) — never mutating state directly.
 */
import { useState } from "react";
import { Hammer, LocateFixed, Play, Plus, RotateCcw, Send, Square, UserPlus, X } from "lucide-react";
import { useWorldStore } from "../state/useWorldStore";
import { sceneBus } from "../game/eventBus";

export function DemoControls() {
  const isDemoPlaying = useWorldStore((s) => s.isDemoPlaying);
  const playDemo = useWorldStore((s) => s.playDemo);
  const stopDemo = useWorldStore((s) => s.stopDemo);
  const reset = useWorldStore((s) => s.reset);
  const spawnTestAgent = useWorldStore((s) => s.spawnTestAgent);
  const sendRandomMessage = useWorldStore((s) => s.sendRandomMessage);
  const buildRandomObject = useWorldStore((s) => s.buildRandomObject);
  const createTask = useWorldStore((s) => s.createTask);

  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const submitTask = (event: React.FormEvent): void => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    createTask(trimmed, description.trim() || "Created from the demo controls.");
    setTitle("");
    setDescription("");
    setComposerOpen(false);
  };

  return (
    <div className="dock">
      {composerOpen && (
        <form className="composer" onSubmit={submitTask}>
          <div className="composer__head">
            <span>New task</span>
            <button type="button" className="icon-btn" onClick={() => setComposerOpen(false)} aria-label="Close">
              <X size={14} />
            </button>
          </div>
          <label className="composer__field">
            <span>Title</span>
            <input
              autoFocus
              value={title}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Define auth flow"
            />
          </label>
          <label className="composer__field">
            <span>Description</span>
            <input
              value={description}
              maxLength={240}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details"
            />
          </label>
          <button type="submit" className="btn btn--primary" disabled={!title.trim()}>
            Create task
          </button>
        </form>
      )}

      <div className="dock__bar">
        {isDemoPlaying ? (
          <button className="btn btn--warn" onClick={stopDemo}>
            <Square size={15} /> Stop
          </button>
        ) : (
          <button className="btn btn--primary" onClick={playDemo}>
            <Play size={15} /> Play Demo
          </button>
        )}
        <span className="dock__divider" />
        <button className="btn" onClick={spawnTestAgent}>
          <UserPlus size={15} /> Spawn agent
        </button>
        <button className="btn" onClick={sendRandomMessage}>
          <Send size={15} /> Message
        </button>
        <button className="btn" onClick={buildRandomObject}>
          <Hammer size={15} /> Build
        </button>
        <button className={`btn ${composerOpen ? "btn--active" : ""}`} onClick={() => setComposerOpen((v) => !v)}>
          <Plus size={15} /> Task
        </button>
        <span className="dock__divider" />
        <button className="btn btn--ghost" onClick={() => sceneBus.emit("camera:reset", null)} title="Reset camera">
          <LocateFixed size={15} /> Camera
        </button>
        <button className="btn btn--ghost" onClick={reset} title="Reset the world">
          <RotateCcw size={15} /> Reset
        </button>
      </div>
    </div>
  );
}
