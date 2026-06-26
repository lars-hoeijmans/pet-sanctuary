/**
 * The only procedural textures left after the move to real sprite art:
 *   - a soft contact shadow placed under pets + furniture
 *   - a round spark used by particle effects
 * Floor, rugs, furniture and characters are all real CC0 Kenney sprites now.
 */
import Phaser from "phaser";

export const TEX = {
  shadow: "tex-shadow",
  spark: "tex-spark",
} as const;

export function createTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(TEX.shadow)) {
    // Feathered ellipse: a few concentric ellipses with falling alpha.
    const w = 128;
    const h = 64;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const rings = 6;
    for (let i = rings; i >= 1; i -= 1) {
      const t = i / rings;
      g.fillStyle(0x000000, 0.16 * (1 - t) + 0.04);
      g.fillEllipse(w / 2, h / 2, w * t, h * t);
    }
    g.generateTexture(TEX.shadow, w, h);
    g.destroy();
  }

  if (!scene.textures.exists(TEX.spark)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 6);
    g.generateTexture(TEX.spark, 16, 16);
    g.destroy();
  }
}
