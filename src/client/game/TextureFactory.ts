/**
 * Procedural textures generated at runtime — the app needs NO external art.
 * Floor tiles and shadows are generated once; furniture and agents are drawn
 * with Graphics directly (see ObjectRenderer / AgentSprite) for full per-item
 * color control.
 */
import Phaser from "phaser";
import { TILE_H, TILE_W } from "./IsoMath";

export const TEX = {
  tile: "tex-tile",
  tileHi: "tex-tile-hi",
  shadow: "tex-shadow",
  spark: "tex-spark",
} as const;

export function createTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(TEX.tile)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.lineStyle(1, 0x000000, 0.18);
    diamond(g, TILE_W, TILE_H);
    g.generateTexture(TEX.tile, TILE_W + 2, TILE_H + 2);
    g.destroy();
  }

  if (!scene.textures.exists(TEX.tileHi)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.lineStyle(2, 0xffffff, 0.9);
    diamond(g, TILE_W, TILE_H);
    g.generateTexture(TEX.tileHi, TILE_W + 2, TILE_H + 2);
    g.destroy();
  }

  if (!scene.textures.exists(TEX.shadow)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x000000, 1);
    g.fillEllipse(TILE_W / 2, TILE_H / 2, TILE_W * 0.62, TILE_H * 0.62);
    g.generateTexture(TEX.shadow, TILE_W, TILE_H);
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

function diamond(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
  const pts = [
    { x: w / 2, y: 0 },
    { x: w, y: h / 2 },
    { x: w / 2, y: h },
    { x: 0, y: h / 2 },
  ];
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  g.lineTo(pts[1].x, pts[1].y);
  g.lineTo(pts[2].x, pts[2].y);
  g.lineTo(pts[3].x, pts[3].y);
  g.closePath();
  g.fillPath();
  g.strokePath();
}
