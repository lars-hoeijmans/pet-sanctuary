/** App shell: header, left panel, Phaser stage, right panel, overlays. */
import { useEffect } from "react";
import { useWorldStore } from "./state/useWorldStore";
import { PhaserGame } from "./game/PhaserGame";
import { HeaderBar } from "./ui/HeaderBar";
import { AgentPanel } from "./ui/AgentPanel";
import { TaskBoard } from "./ui/TaskBoard";
import { EventFeed } from "./ui/EventFeed";
import { ArtifactDrawer } from "./ui/ArtifactDrawer";
import { DemoControls } from "./ui/DemoControls";
import { InspectorDrawer } from "./ui/InspectorDrawer";
import { CommandPalette } from "./ui/CommandPalette";

export function App() {
  const init = useWorldStore((s) => s.init);
  const teardown = useWorldStore((s) => s.teardown);
  const setCommandPaletteOpen = useWorldStore((s) => s.setCommandPaletteOpen);

  useEffect(() => {
    init();
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      teardown();
    };
  }, [init, teardown, setCommandPaletteOpen]);

  return (
    <div className="app">
      <HeaderBar />
      <aside className="panel panel--left">
        <AgentPanel />
        <TaskBoard />
      </aside>
      <main className="stage">
        <PhaserGame />
        <DemoControls />
      </main>
      <aside className="panel panel--right">
        <EventFeed />
        <ArtifactDrawer />
      </aside>
      <InspectorDrawer />
      <CommandPalette />
    </div>
  );
}
