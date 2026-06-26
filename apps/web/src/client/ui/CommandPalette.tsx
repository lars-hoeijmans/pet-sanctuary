/** ⌘K command palette — keyboard-driven access to every world lever + agent. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useWorldStore } from "../state/useWorldStore";
import { sceneBus } from "../game/eventBus";

interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

export function CommandPalette() {
  const open = useWorldStore((s) => s.commandPaletteOpen);
  const setOpen = useWorldStore((s) => s.setCommandPaletteOpen);
  const agents = useWorldStore((s) => s.snapshot.agents);
  const selectedAgentId = useWorldStore((s) => s.selectedAgentId);
  const isDemoPlaying = useWorldStore((s) => s.isDemoPlaying);
  const sourceKind = useWorldStore((s) => s.sourceKind);
  const store = useWorldStore;

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const s = store.getState();
    const close = () => setOpen(false);
    const list: Command[] = [
      isDemoPlaying
        ? { id: "demo-stop", label: "Stop demo", run: () => { s.stopDemo(); close(); } }
        : { id: "demo-play", label: "Play demo", hint: "deterministic", run: () => { s.playDemo(); close(); } },
      { id: "reset", label: "Reset world", run: () => { s.reset(); close(); } },
      { id: "camera", label: "Reset camera", run: () => { sceneBus.emit("camera:reset", null); close(); } },
      { id: "spawn", label: "Spawn test agent", run: () => { s.spawnTestAgent(); close(); } },
    ];
    if (sourceKind === "mock") {
      list.push(
        { id: "message", label: "Send random message", run: () => { s.sendRandomMessage(); close(); } },
        { id: "build", label: "Build random object", run: () => { s.buildRandomObject(); close(); } },
      );
    }
    if (selectedAgentId) {
      const name = agents[selectedAgentId]?.name ?? selectedAgentId;
      list.push({
        id: "follow",
        label: `Follow ${name}`,
        run: () => { s.toggleFollow(selectedAgentId); close(); },
      });
    }
    for (const agent of Object.values(agents)) {
      list.push({
        id: `select-${agent.id}`,
        label: `Go to ${agent.name}`,
        hint: agent.role,
        run: () => { s.selectAgent(agent.id); sceneBus.emit("camera:focusAgent", agent.id); close(); },
      });
    }
    return list;
  }, [agents, selectedAgentId, isDemoPlaying, setOpen, store]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // focus after the modal paints
      const id = window.setTimeout(() => inputRef.current?.focus(), 20);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[activeIndex]?.run();
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKeyDown} role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="palette__input">
          <Search size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or agent…"
            aria-label="Command query"
          />
        </div>
        {filtered.length === 0 ? (
          <p className="empty">No matching commands.</p>
        ) : (
          <ul className="palette__list">
            {filtered.map((command, index) => (
              <li key={command.id}>
                <button
                  className={`palette__item ${index === activeIndex ? "is-active" : ""}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => command.run()}
                >
                  <span>{command.label}</span>
                  {command.hint && <span className="palette__hint">{command.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="palette__foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> run</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
