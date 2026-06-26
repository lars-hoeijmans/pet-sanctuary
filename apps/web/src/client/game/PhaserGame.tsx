/** React host for the Phaser game. Boots one game instance and resizes with its parent. */
import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { PreloadScene } from "./PreloadScene";
import { AgentCityScene } from "./AgentCityScene";
import { renderScale } from "./assets";

export function PhaserGame() {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || gameRef.current) return;

    // Render the WebGL buffer at the display's native pixel density. The canvas
    // is then shown at logical (CSS) size via a `width:100%` rule, so the browser
    // never upscales a low-res buffer — the world stays crisp on Retina screens.
    const dpr = renderScale();
    const w = host.clientWidth || 800;
    const h = host.clientHeight || 600;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      backgroundColor: "#0c1330",
      scale: {
        // NONE: we own sizing. RESIZE would auto-fit the buffer to the parent in
        // CSS pixels and fight the manual device-resolution sizing below.
        mode: Phaser.Scale.NONE,
        autoCenter: Phaser.Scale.NO_CENTER,
        width: w * dpr,
        height: h * dpr,
      },
      // preserveDrawingBuffer keeps WebGL screenshots reliable.
      render: { antialias: true, pixelArt: false, preserveDrawingBuffer: true },
      fps: { target: 60 },
      scene: [PreloadScene, AgentCityScene],
    });
    gameRef.current = game;

    // CSS-grid resizes don't fire window 'resize', so drive Phaser explicitly.
    // Size the backing buffer in physical pixels; CSS keeps the display logical.
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) {
        game.scale.resize(rect.width * dpr, rect.height * dpr);
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
