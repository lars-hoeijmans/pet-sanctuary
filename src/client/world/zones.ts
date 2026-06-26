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

export const ZONES: Zone[] = [
  { id: "frontend-studio", name: "Frontend Studio", rect: { x: 0, y: 0, w: 7, h: 6 }, color: 0x1e3a5f, accent: "#60a5fa" },
  { id: "product-room", name: "Product Room", rect: { x: 7, y: 0, w: 8, h: 5 }, color: 0x4a1f3d, accent: "#fb7185" },
  { id: "backend-lab", name: "Backend Lab", rect: { x: 15, y: 0, w: 7, h: 7 }, color: 0x14392f, accent: "#34d399" },
  { id: "central-plaza", name: "Central Plaza", rect: { x: 7, y: 5, w: 8, h: 5 }, color: 0x2a2f45, accent: "#cbd5f5" },
  { id: "review-lounge", name: "Review Lounge", rect: { x: 0, y: 6, w: 7, h: 9 }, color: 0x4a3a14, accent: "#f59e0b" },
  { id: "build-yard", name: "Build Yard", rect: { x: 7, y: 10, w: 8, h: 5 }, color: 0x2f2540, accent: "#c4b5fd" },
  { id: "infra-corner", name: "Infra Corner", rect: { x: 15, y: 7, w: 7, h: 8 }, color: 0x2e2548, accent: "#a78bfa" },
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

  return [
    // Central Plaza
    o("base-plaza-notice", "notice_board", 10, 7, "City Notices"),
    o("base-plaza-coffee", "coffee_machine", 12, 6),
    o("base-plaza-plant-1", "plant", 8, 5),
    o("base-plaza-plant-2", "plant", 13, 9),

    // Frontend Studio
    o("base-fe-desk-1", "desk", 1, 1),
    o("base-fe-terminal-1", "terminal", 2, 1),
    o("base-fe-whiteboard", "whiteboard", 4, 1, "Design Board"),
    o("base-fe-plant", "plant", 1, 4),

    // Product Room
    o("base-pr-table", "meeting_table", 10, 1),
    o("base-pr-whiteboard", "whiteboard", 12, 1, "Roadmap"),

    // Backend Lab
    o("base-be-rack", "server_rack", 16, 1),
    o("base-be-terminal", "terminal", 18, 1),
    o("base-be-whiteboard", "whiteboard", 20, 2, "API Contract"),

    // Review Lounge
    o("base-rl-sofa", "sofa", 1, 8),
    o("base-rl-table", "meeting_table", 3, 9),
    o("base-rl-bookshelf", "bookshelf", 1, 11),

    // Infra Corner
    o("base-infra-rack-1", "server_rack", 16, 8),
    o("base-infra-rack-2", "server_rack", 18, 8),
    o("base-infra-terminal", "terminal", 20, 10),

    // Build Yard
    o("base-by-lamp", "lamp", 8, 11),
    o("base-by-bookshelf", "bookshelf", 13, 11),
  ];
}
