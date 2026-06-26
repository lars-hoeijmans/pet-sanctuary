/**
 * Placement ruleset — the SINGLE authority that decides whether a piece of
 * furniture may exist at a given tile. It is enforced for:
 *   - the seed layout (buildInitialObjects)
 *   - every dynamic mock build (MockWorldSource.dispatch)
 *   - and, by the same chokepoint, future real-agent builds
 *
 * Because the rules live here (not in a hand-tuned layout), the world can't
 * become an overcrowded mess or a row of six fridges — and when agents start
 * building their own environment, they inherit exactly these constraints.
 */
import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type GridPos,
  type ObjectKind,
  type WorldObject,
} from "../../protocol/index";
import { footprint } from "../game/assets";
import { baseWorldObjects, zoneAt } from "./zones";

/** Max number of a given kind allowed within one zone. */
export const KIND_CAP_PER_ZONE: Record<ObjectKind, number> = {
  desk: 2,
  chair: 3,
  plant: 2,
  server_rack: 2,
  whiteboard: 2,
  terminal: 2,
  meeting_table: 1,
  lamp: 1,
  bookshelf: 1,
  coffee_machine: 1,
  sofa: 1,
  notice_board: 1,
};

/** No zone may have more than this fraction of its tiles covered by furniture. */
export const MAX_ZONE_DENSITY = 0.24;

export type PlaceResult = { ok: true } | { ok: false; reason: string };

function tilesOf(kind: ObjectKind, pos: GridPos): Array<{ x: number; y: number }> {
  const { w, d } = footprint(kind);
  const out: Array<{ x: number; y: number }> = [];
  for (let dx = 0; dx < w; dx += 1) {
    for (let dy = 0; dy < d; dy += 1) out.push({ x: pos.x + dx, y: pos.y + dy });
  }
  return out;
}

/** Tile indices covered by every object's footprint (overlap + density checks). */
export function occupiedTileSet(objects: WorldObject[]): Set<number> {
  const s = new Set<number>();
  for (const o of objects) {
    for (const t of tilesOf(o.kind, o.position)) s.add(t.y * WORLD_WIDTH + t.x);
  }
  return s;
}

/** The authoritative rule: may `kind` be placed with its anchor at `pos`? */
export function canPlace(objects: WorldObject[], kind: ObjectKind, pos: GridPos): PlaceResult {
  const cells = tilesOf(kind, pos);

  // 1) in-bounds, and off the back walls (x=0 / y=0 columns are walls)
  for (const c of cells) {
    if (c.x < 1 || c.y < 1 || c.x >= WORLD_WIDTH || c.y >= WORLD_HEIGHT) {
      return { ok: false, reason: "out-of-bounds" };
    }
  }

  // 2) no overlap with existing furniture
  const occ = occupiedTileSet(objects);
  for (const c of cells) {
    if (occ.has(c.y * WORLD_WIDTH + c.x)) return { ok: false, reason: "overlap" };
  }

  // 3) must sit within a zone
  const zone = zoneAt(pos.x, pos.y);
  if (!zone) return { ok: false, reason: "no-zone" };

  // 4) per-kind cap within that zone (prevents e.g. six fridges in a row)
  const sameKind = objects.filter(
    (o) => o.kind === kind && zoneAt(o.position.x, o.position.y)?.id === zone.id,
  ).length;
  if (sameKind >= KIND_CAP_PER_ZONE[kind]) return { ok: false, reason: "kind-cap" };

  // 5) zone density cap (hard ceiling on overall clutter)
  let covered = 0;
  for (const o of objects) {
    if (zoneAt(o.position.x, o.position.y)?.id !== zone.id) continue;
    const f = footprint(o.kind);
    covered += f.w * f.d;
  }
  const f = footprint(kind);
  const zoneTiles = zone.rect.w * zone.rect.h;
  if ((covered + f.w * f.d) / zoneTiles > MAX_ZONE_DENSITY) {
    return { ok: false, reason: "density" };
  }

  return { ok: true };
}

/** Build the seed objects, dropping any candidate the ruleset would reject. */
export function buildInitialObjects(): WorldObject[] {
  const placed: WorldObject[] = [];
  for (const candidate of baseWorldObjects()) {
    if (canPlace(placed, candidate.kind, candidate.position).ok) placed.push(candidate);
  }
  return placed;
}
