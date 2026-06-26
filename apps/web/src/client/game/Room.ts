/**
 * The room SHELL — the thing that makes it read as a Habbo room rather than
 * furniture floating in a void. Real Habbo walls are flat colored planes, so we
 * draw them procedurally: two continuous back walls meeting at a corner, with a
 * baseboard, top trim, windows and a door, plus a raised floor platform with a
 * thickness edge. Kenney sprites still supply the floor tiles, furniture and
 * characters; this just frames them.
 */
import Phaser from "phaser";
import { TILE_H, TILE_W } from "./IsoMath";

interface Pt {
  x: number;
  y: number;
}
type Proj = (x: number, y: number) => Pt;

// Dimensions scale with the tile size so the shell stays proportional.
const WALL_H = TILE_H * 4.6;
const BASEBOARD = WALL_H * 0.085;
const TOP_TRIM = WALL_H * 0.045;
const SKIRT = TILE_H * 0.55;

// Habbo-ish palette: cool light walls against the warm Kenney floor.
const C = {
  wallRight: 0xc6cfe0, // lit face (back-right)
  wallLeft: 0xa6b2c9, // shadow face (back-left)
  topTrim: 0xe7edf8,
  baseboard: 0x646f88,
  cornerHi: 0xd8dff9,
  pane: 0xc3e4f3,
  paneTop: 0xe9f6fc,
  paneFrame: 0x8295b6,
  mullion: 0xf4f8ff,
  doorFrame: 0x5d3c1f,
  doorPanel: 0x9a6a3f,
  doorPanelDark: 0x80552f,
  handle: 0xffd56b,
  platform: 0xa06a37,
  platformDark: 0x7d4f27,
};

const DEPTH_PLATFORM = -1_000_100;
const DEPTH_WALL = -1000;

export function buildRoom(scene: Phaser.Scene, proj: Proj, w: number, h: number): void {
  const topV: Pt = { x: proj(0, 0).x, y: proj(0, 0).y - TILE_H / 2 };
  const rightV: Pt = { x: proj(w - 1, 0).x + TILE_W / 2, y: proj(w - 1, 0).y };
  const leftV: Pt = { x: proj(0, h - 1).x - TILE_W / 2, y: proj(0, h - 1).y };
  const bottomV: Pt = { x: proj(w - 1, h - 1).x, y: proj(w - 1, h - 1).y + TILE_H / 2 };

  buildPlatform(scene, leftV, bottomV, rightV);

  const g = scene.add.graphics();
  g.setDepth(DEPTH_WALL);
  // back-right wall (lit), with windows + the door near the corner
  drawWall(g, topV, rightV, C.wallRight, { windows: [0.34, 0.58, 0.8], door: 0.13 });
  // back-left wall (shadow side), windows only
  drawWall(g, topV, leftV, C.wallLeft, { windows: [0.42, 0.7] });
  // inside-corner highlight where the two walls meet
  g.fillStyle(C.cornerHi, 0.5);
  g.fillRect(topV.x - 1.5, topV.y - WALL_H, 3, WALL_H);
}

// ---- platform -------------------------------------------------------------

function buildPlatform(scene: Phaser.Scene, leftV: Pt, bottomV: Pt, rightV: Pt): void {
  const g = scene.add.graphics();
  g.setDepth(DEPTH_PLATFORM);
  const down = (p: Pt): Pt => ({ x: p.x, y: p.y + SKIRT });
  // the two viewer-facing edges get a thickness skirt so the floor reads as a slab
  quad(g, C.platform, leftV, bottomV, down(bottomV), down(leftV));
  quad(g, C.platformDark, bottomV, rightV, down(rightV), down(bottomV));
}

// ---- walls ----------------------------------------------------------------

interface WallOpts {
  windows?: number[];
  door?: number;
}

function drawWall(g: Phaser.GameObjects.Graphics, b1: Pt, b2: Pt, color: number, opts: WallOpts): void {
  const len = Math.hypot(b2.x - b1.x, b2.y - b1.y);
  const dir: Pt = { x: (b2.x - b1.x) / len, y: (b2.y - b1.y) / len };
  const along = (f: number): Pt => ({ x: b1.x + dir.x * len * f, y: b1.y + dir.y * len * f });
  const up = (p: Pt, y: number): Pt => ({ x: p.x, y: p.y - y });

  // main plane
  quad(g, color, b1, b2, up(b2, WALL_H), up(b1, WALL_H));
  // top trim (lighter strip running along the top edge)
  quad(g, C.topTrim, up(b1, WALL_H), up(b2, WALL_H), up(b2, WALL_H - TOP_TRIM), up(b1, WALL_H - TOP_TRIM));
  // baseboard (darker strip at the floor line)
  quad(g, C.baseboard, b1, b2, up(b2, BASEBOARD), up(b1, BASEBOARD));

  for (const f of opts.windows ?? []) drawWindow(g, along, up, len, f);
  if (opts.door !== undefined) drawDoor(g, along, up, len, opts.door);
}

function drawWindow(
  g: Phaser.GameObjects.Graphics,
  along: (f: number) => Pt,
  up: (p: Pt, y: number) => Pt,
  len: number,
  f: number,
): void {
  const halfW = (TILE_W * 0.52) / len; // window half-width as a fraction of the wall length
  const yb = WALL_H * 0.34;
  const yt = WALL_H * 0.8;
  const m = WALL_H * 0.03; // inset margin
  const f0 = f - halfW;
  const f1 = f + halfW;

  // frame
  quad(g, C.paneFrame, up(along(f0), yb), up(along(f1), yb), up(along(f1), yt), up(along(f0), yt));
  // glass (inset), with a lighter top band for a glassy gradient feel
  const i = halfW * 0.16;
  const g0 = f0 + i;
  const g1 = f1 - i;
  quad(g, C.pane, up(along(g0), yb + m), up(along(g1), yb + m), up(along(g1), yt - m), up(along(g0), yt - m));
  const bandY = yt - (yt - yb) * 0.34;
  quad(g, C.paneTop, up(along(g0), bandY), up(along(g1), bandY), up(along(g1), yt - m), up(along(g0), yt - m));
  // mullions: one vertical (down the middle), one horizontal (mid height)
  const mid = (f0 + f1) / 2;
  thickLine(g, C.mullion, up(along(mid), yb + m), up(along(mid), yt - m), 2);
  const ym = (yb + yt) / 2;
  thickLine(g, C.mullion, up(along(g0), ym), up(along(g1), ym), 2);
}

function drawDoor(
  g: Phaser.GameObjects.Graphics,
  along: (f: number) => Pt,
  up: (p: Pt, y: number) => Pt,
  len: number,
  f: number,
): void {
  const halfW = (TILE_W * 0.5) / len;
  const yTop = WALL_H * 0.88;
  const m = WALL_H * 0.04;
  const f0 = f - halfW;
  const f1 = f + halfW;
  // frame
  quad(g, C.doorFrame, along(f0), along(f1), up(along(f1), yTop), up(along(f0), yTop));
  // panel (inset)
  const i = halfW * 0.16;
  const d0 = f0 + i;
  const d1 = f1 - i;
  quad(g, C.doorPanel, along(d0), along(d1), up(along(d1), yTop - m), up(along(d0), yTop - m));
  // inner shadow panel
  quad(
    g,
    C.doorPanelDark,
    up(along(d0), m * 2),
    up(along(d1), m * 2),
    up(along(d1), yTop - m * 3),
    up(along(d0), yTop - m * 3),
  );
  // handle
  const hx = along(d1 - (d1 - d0) * 0.18);
  g.fillStyle(C.handle, 1);
  g.fillCircle(hx.x, hx.y - yTop * 0.45, Math.max(2, TILE_W * 0.045));
}

// ---- primitives -----------------------------------------------------------

function quad(g: Phaser.GameObjects.Graphics, color: number, a: Pt, b: Pt, c: Pt, d: Pt): void {
  g.fillStyle(color, 1);
  g.beginPath();
  g.moveTo(a.x, a.y);
  g.lineTo(b.x, b.y);
  g.lineTo(c.x, c.y);
  g.lineTo(d.x, d.y);
  g.closePath();
  g.fillPath();
}

function thickLine(g: Phaser.GameObjects.Graphics, color: number, a: Pt, b: Pt, width: number): void {
  g.lineStyle(width, color, 1);
  g.beginPath();
  g.moveTo(a.x, a.y);
  g.lineTo(b.x, b.y);
  g.strokePath();
}
