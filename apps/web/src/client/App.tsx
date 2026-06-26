/** App shell: header, left panel, Phaser stage, right panel, overlays. */
import { useEffect } from "react";
import { useWorldStore } from "./state/useWorldStore";
import { audioManager } from "./audio/AudioManager";
import { PhaserGame } from "./game/PhaserGame";
import { HeaderBar } from "./ui/HeaderBar";
import { Sidebar } from "./ui/Sidebar";
import { DemoControls } from "./ui/DemoControls";
import { InspectorDrawer } from "./ui/InspectorDrawer";
import { CommandPalette } from "./ui/CommandPalette";

export function App() {
  const init = useWorldStore((s) => s.init);
  const teardown = useWorldStore((s) => s.teardown);
  const setCommandPaletteOpen = useWorldStore((s) => s.setCommandPaletteOpen);

  useEffect(() => {
    init();
    void audioManager.init();
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      audioManager.teardown();
      teardown();
    };
  }, [init, teardown, setCommandPaletteOpen]);

  return (
    <div className="app">
      <HeaderBar />
      <Sidebar />
      <main className="stage">
        <PhaserGame />
        <DemoControls />
      </main>
      <InspectorDrawer />
      <CommandPalette />
    </div>
  );
}
