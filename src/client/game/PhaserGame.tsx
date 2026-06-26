/** React host for the Phaser game. Boots one game instance and resizes with its parent. */
import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { AgentCityScene } from "./AgentCityScene";

export function PhaserGame() {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || gameRef.current) return;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      backgroundColor: "#0a0e1a",
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.NO_CENTER,
        width: host.clientWidth || 800,
        height: host.clientHeight || 600,
      },
      // preserveDrawingBuffer keeps WebGL screenshots reliable.
      render: { antialias: true, pixelArt: false, preserveDrawingBuffer: true },
      fps: { target: 60 },
      scene: [AgentCityScene],
    });
    gameRef.current = game;

    // CSS-grid resizes don't fire window 'resize', so drive Phaser explicitly.
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) {
        game.scale.resize(rect.width, rect.height);
      }
    });
    ro.observe(host);

    return () => {
      ro.disconnect();
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={hostRef} className="phaser-host" aria-label="Agent City world view" role="img" />;
}
