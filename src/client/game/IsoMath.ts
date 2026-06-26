/** Isometric <-> screen conversion. The scene adds a world origin offset on top. */
export const TILE_W = 64;
export const TILE_H = 32;

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

/** Stable depth value for painter's-algorithm sorting in screen space. */
export function screenDepth(x: number, y: number, z = 0): number {
  return (x + y) * 100 + z;
}

/** Inverse mapping — screen point back to fractional tile coords (for clicks). */
export function screenToIso(sx: number, sy: number): ScreenPoint {
  const x = (sx / (TILE_W / 2) + sy / (TILE_H / 2)) / 2;
  const y = (sy / (TILE_H / 2) - sx / (TILE_W / 2)) / 2;
  return { x, y };
}
