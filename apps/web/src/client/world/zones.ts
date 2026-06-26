/**
 * City layout — zones, base furniture and walkability.
 * Grid is WORLD_WIDTH x WORLD_HEIGHT (22 x 15).
 */
import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type GridPos,
  type ObjectKind,
  type WorldObject,
} from "../../protocol/index";

export interface ZoneRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Zone {
  id: string;
  name: string;
  rect: ZoneRect;
  /** Floor tint as a 0xRRGGBB number for Phaser. */
  color: number;
  /** Label tint for the UI / scene. */
  accent: string;
}

// Zones sit on a 28x18 grid with deliberate GAPS between them (open walkways
// at x=7, x=17, y=6, y=13), so the city has room to breathe. Top-row + left-
// column zones hug the back walls (y=0 / x=0) so their furniture anchors there.
export const ZONES: Zone[] = [
  { id: "frontend-studio", name: "Frontend Studio", rect: { x: 0, y: 0, w: 7, h: 6 }, color: 0x1e3a5f, accent: "#60a5fa" },
  { id: "product-room", name: "Product Room", rect: { x: 8, y: 0, w: 9, h: 6 }, color: 0x4a1f3d, accent: "#fb7185" },
  { id: "backend-lab", name: "Backend Lab", rect: { x: 18, y: 0, w: 10, h: 7 }, color: 0x14392f, accent: "#34d399" },
  { id: "central-plaza", name: "Central Plaza", rect: { x: 8, y: 7, w: 9, h: 6 }, color: 0x2a2f45, accent: "#cbd5f5" },
  { id: "review-lounge", name: "Review Lounge", rect: { x: 0, y: 7, w: 7, h: 11 }, color: 0x4a3a14, accent: "#f59e0b" },
  { id: "build-yard", name: "Build Yard", rect: { x: 8, y: 14, w: 9, h: 4 }, color: 0x2f2540, accent: "#c4b5fd" },
  { id: "infra-corner", name: "Infra Corner", rect: { x: 18, y: 8, w: 10, h: 10 }, color: 0x2e2548, accent: "#a78bfa" },
];

const ZONE_BY_ID = new Map(ZONES.map((zone) => [zone.id, zone]));

export function getZone(id: string): Zone | undefined {
  return ZONE_BY_ID.get(id);
}

export function zoneAt(x: number, y: number): Zone | undefined {
  return ZONES.find(
    (z) => x >= z.rect.x && x < z.rect.x + z.rect.w && y >= z.rect.y && y < z.rect.y + z.rect.h,
  );
}

/** A roughly central, walkable tile for a zone — agents head here by default. */
export function zoneCenter(zoneId: string): GridPos {
  const zone = getZone(zoneId);
  if (!zone) return { x: Math.floor(WORLD_WIDTH / 2), y: Math.floor(WORLD_HEIGHT / 2) };
  return {
    x: zone.rect.x + Math.floor(zone.rect.w / 2),
    y: zone.rect.y + Math.floor(zone.rect.h / 2),
    roomId: zone.name,
  };
}

export function isInsideGrid(x: number, y: number): boolean {
  return x >= 0 && x < WORLD_WIDTH && y >= 0 && y < WORLD_HEIGHT;
}

/** Pick a pseudo-random walkable tile within a zone (used for wandering). */
export function randomTileInZone(zoneId: string, rng: () => number): GridPos {
  const zone = getZone(zoneId);
  if (!zone) return { x: 11, y: 7 };
  const x = zone.rect.x + Math.floor(rng() * zone.rect.w);
  const y = zone.rect.y + Math.floor(rng() * zone.rect.h);
  return { x, y, roomId: zone.name };
}

/**
 * Base furniture seeded on every reset. Intentionally sparse so the map stays
 * readable. Object ids are stable so reset is idempotent.
 */
export function baseWorldObjects(): WorldObject[] {
  const o = (id: string, kind: ObjectKind, x: number, y: number, label?: string): WorldObject => ({
    id,
    kind,
    position: { x, y },
    label,
  });

  // Lean, sensible, grid-aligned layout — each zone gets one clear "station"
  // and breathing room. The placement ruleset (see placement.ts) is the real
  // guard against clutter; this seed is authored to sit well within it.
  // Footprints: desk/sofa/bookshelf/notice_board = 2x1, meeting_table = 2x2.
  return [
    // Frontend Studio (x0-6, y0-5) — a workstation against the back wall
    o("base-fe-desk", "desk", 1, 1),
    o("base-fe-terminal", "terminal", 3, 1),
    o("base-fe-whiteboard", "whiteboard", 4, 1, "Design Board"),
    o("base-fe-chair", "chair", 2, 2),
    o("base-fe-plant", "plant", 6, 4),

    // Product Room (x8-16, y0-5) — a meeting table with two chairs
    o("base-pr-table", "meeting_table", 10, 1),
    o("base-pr-whiteboard", "whiteboard", 8, 1, "Roadmap"),
    o("base-pr-chair-1", "chair", 9, 2),
    o("base-pr-chair-2", "chair", 12, 2),
    o("base-pr-plant", "plant", 15, 2),

    // Backend Lab (x18-27, y0-6) — a pair of racks + an ops desk
    o("base-be-rack-1", "server_rack", 19, 1),
    o("base-be-rack-2", "server_rack", 20, 1),
    o("base-be-whiteboard", "whiteboard", 22, 1, "API Contract"),
    o("base-be-desk", "desk", 19, 3),
    o("base-be-chair", "chair", 19, 4),
    o("base-be-terminal", "terminal", 22, 3),
    o("base-be-plant", "plant", 26, 5),

    // Central Plaza (x8-16, y7-12) — a lounge + notices, open in the middle
    o("base-plaza-notice", "notice_board", 9, 7, "City Notices"),
    o("base-plaza-coffee", "coffee_machine", 13, 7),
    o("base-plaza-sofa", "sofa", 9, 10),
    o("base-plaza-chair-1", "chair", 11, 10),
    o("base-plaza-chair-2", "chair", 12, 10),
    o("base-plaza-plant", "plant", 15, 11),

    // Review Lounge (x0-6, y7-17) — a cozy lounge against the left wall
    o("base-rl-sofa", "sofa", 1, 8),
    o("base-rl-table", "meeting_table", 1, 10),
    o("base-rl-chair-1", "chair", 3, 9),
    o("base-rl-chair-2", "chair", 3, 11),
    o("base-rl-bookshelf", "bookshelf", 1, 14),
    o("base-rl-lamp", "lamp", 4, 8),
    o("base-rl-plant", "plant", 5, 14),

    // Build Yard (x8-16, y14-17) — two workbenches
    o("base-by-desk-1", "desk", 9, 15),
    o("base-by-terminal", "terminal", 11, 15),
    o("base-by-chair-1", "chair", 9, 16),
    o("base-by-desk-2", "desk", 13, 15),
    o("base-by-chair-2", "chair", 13, 16),
    o("base-by-plant", "plant", 15, 16),

    // Infra Corner (x18-27, y8-17) — a rack + an ops desk (room for one more)
    o("base-infra-rack-1", "server_rack", 19, 9),
    o("base-infra-terminal", "terminal", 22, 9),
    o("base-infra-desk", "desk", 19, 11),
    o("base-infra-chair", "chair", 19, 12),
    o("base-infra-plant", "plant", 26, 16),
  ];
}
