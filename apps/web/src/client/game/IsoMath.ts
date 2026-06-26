/**
 * Isometric <-> screen conversion + depth helpers. TILE_W/TILE_H are owned by
 * the asset manifest (they're derived from the real floor-sprite size) and
 * re-exported here so the rest of the scene can keep importing them from IsoMath.
 */
import { TILE_W, TILE_H } from "./assets";

export { TILE_W, TILE_H };

export interface ScreenPoint {
  x: number;
  y: number;
}

export function isoToScreen(x: number, y: number, z = 0): ScreenPoint {
  return {
    x: (x - y) * (TILE_W / 2),
    y: (x + y) * (TILE_H / 2) - z,
  };
}

/** Inverse mapping — screen point back to fractional tile coords (for clicks). */
export function screenToIso(sx: number, sy: number): ScreenPoint {
  const x = (sx / (TILE_W / 2) + sy / (TILE_H / 2)) / 2;
  const y = (sy / (TILE_H / 2) - sx / (TILE_W / 2)) / 2;
  return { x, y };
}

/**
 * Painter's-algorithm depth. Everything sorts front-to-back by (x + y); the
 * layer bias keeps things on the SAME tile ordered: wall < furniture < agent.
 */
export const DEPTH = {
  floor: (x: number, y: number): number => -1_000_000 + (x + y),
  rug: (x: number, y: number): number => -500_000 + (x + y),
  wall: (x: number, y: number): number => (x + y) * 100 + 0,
  object: (x: number, y: number): number => (x + y) * 100 + 1,
  agent: (x: number, y: number): number => (x + y) * 100 + 2,
} as const;
