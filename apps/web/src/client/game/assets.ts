/**
 * Asset manifest for the isometric city.
 *
 * Every sprite is a CC0 Kenney asset vendored under `public/assets/kenney/`:
 *   - Furniture Kit (floor / walls / door / rugs / furniture), one coherent style
 *   - Miniature Prototype "Human" character (8 facing directions, idle/run/pickup)
 *
 * These are deliberately swappable placeholders: the renderer only references the
 * logical keys + mappings below, so dropping in a different (e.g. licensed) art
 * pack later is a matter of replacing files + the constants here.
 */
import type { ObjectKind } from "../../protocol/index";

export const ASSET_BASE = "/assets/kenney";

/**
 * Display size of one floor-tile diamond (its top face). Drives all iso math.
 * The Kenney `floorFull` sprite is 208px wide, so ENV_SCALE shrinks it until the
 * diamond top is exactly TILE_W — that makes the tiles tessellate cleanly.
 */
export const TILE_W = 64;
export const TILE_H = 32;
export const ENV_SCALE = TILE_W / 208; // floor sprite -> one tile diamond
export const CHAR_SCALE = 0.4;

/**
 * Device pixel ratio we render the WebGL buffer at. Drawing at the display's
 * native pixel density (instead of CSS pixels) is what keeps the world crisp on
 * HiDPI / Retina screens; capped at 2 so 3x phones don't quadruple the fill cost.
 * The camera zoom, zoom clamps and in-scene text resolution all scale by this.
 */
export function renderScale(): number {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return Math.min(Math.max(dpr, 1), 2);
}

/**
 * Placement tuning (dialled in visually against the Kenney sprite geometry).
 * The floor sprite carries thickness below its diamond, so its visual origin is
 * above centre; a hair of overlap hides seams between tiles.
 */
export const FLOOR_ORIGIN_Y = 0.34;
export const FLOOR_OVERLAP = 1.02;
/** Wall sprites are anchored at their bottom; this lifts them onto the floor. */
export const WALL_ORIGIN_Y = 0.86;
export const WALL_LIFT = 6;

/** Native pixel size of a character frame + the figure's foot anchor within it. */
export const CHAR_FRAME_W = 256;
export const CHAR_FRAME_H = 512;
export const CHAR_ANCHOR_X = 0.5;
export const CHAR_ANCHOR_Y = 0.9;

/**
 * Logical room textures -> vendored file stems (folder `room`).
 * Screen geometry: the back-right wall runs along the y=0 row (a "/" plane,
 * wall_NE); the back-left wall runs along the x=0 column ("\" plane, wall_NW).
 */
export const ROOM = {
  floor: "floorFull_NE",
  wallLeft: "wall_NW",
  wallRight: "wall_NE",
  windowLeft: "wallWindow_NW",
  windowRight: "wallWindow_NE",
  doorLeft: "wallDoorway_NW",
  doorRight: "wallDoorway_NE",
} as const;

/** Rug textures used as soft zone markers on the floor. */
export const RUGS: readonly string[] = ["rugRound_SE", "rugSquare_SE", "rugRectangle_SE", "rugRounded_SE"];

export interface ObjectSpriteSpec {
  /** Vendored file stem in `public/assets/kenney/furni/`. */
  tex: string;
  /** Grid footprint in tiles: `w` along +x, `d` along +y. Drives placement,
   *  scale and pathfinding blocking so furniture sits squarely on the grid. */
  w: number;
  d: number;
  /** Fraction of the footprint's diamond width the sprite's base should span
   *  (thin/tall pieces like a lamp use a low value; sofas/tables nearly fill). */
  fill: number;
}

/** Default facing for furniture (faces toward the viewer). Tuned visually. */
const D = "SE";

/** Maps every protocol ObjectKind to a real Kenney furniture sprite + footprint. */
export const OBJECT_SPRITE: Record<ObjectKind, ObjectSpriteSpec> = {
  desk: { tex: `desk_${D}`, w: 2, d: 1, fill: 0.8 },
  chair: { tex: `chairModernFrameCushion_${D}`, w: 1, d: 1, fill: 0.52 },
  plant: { tex: `pottedPlant_${D}`, w: 1, d: 1, fill: 0.42 },
  server_rack: { tex: `kitchenFridgeLarge_${D}`, w: 1, d: 1, fill: 0.58 },
  whiteboard: { tex: `televisionModern_${D}`, w: 1, d: 1, fill: 0.5 },
  terminal: { tex: `computerScreen_${D}`, w: 1, d: 1, fill: 0.42 },
  meeting_table: { tex: `tableCross_${D}`, w: 2, d: 2, fill: 0.82 },
  lamp: { tex: `lampSquareFloor_${D}`, w: 1, d: 1, fill: 0.18 },
  bookshelf: { tex: `bookcaseOpen_${D}`, w: 2, d: 1, fill: 0.68 },
  coffee_machine: { tex: `kitchenCoffeeMachine_${D}`, w: 1, d: 1, fill: 0.44 },
  sofa: { tex: `loungeSofa_${D}`, w: 2, d: 1, fill: 0.82 },
  notice_board: { tex: `bookcaseClosedWide_${D}`, w: 2, d: 1, fill: 0.68 },
};

/** Footprint accessor used by the scene for placement + blocking. */
export function footprint(kind: ObjectKind): { w: number; d: number } {
  const s = OBJECT_SPRITE[kind];
  return { w: s.w, d: s.d };
}

// ---- characters ----------------------------------------------------------

export const CHAR_DIRECTIONS = [0, 1, 2, 3, 4, 5, 6, 7] as const;
export type CharAnim = "idle" | "run" | "pickup";

const ANIM_FRAMES: Record<CharAnim, number> = { idle: 1, run: 10, pickup: 10 };

/** Texture key for a single character frame (matches the vendored file stem). */
export function charFrameKey(dir: number, anim: CharAnim, frame: number): string {
  const name = anim === "idle" ? "Idle" : anim === "run" ? "Run" : "Pickup";
  return `Human_${dir}_${name}${frame}`;
}

/** Animation key registered in Phaser, e.g. `run_3`. */
export function charAnimKey(dir: number, anim: CharAnim): string {
  return `${anim}_${dir}`;
}

/**
 * Map a grid-space movement delta to one of the 8 character facing indices.
 * Tunable offset/handedness because Kenney's index→facing convention is opaque;
 * these were dialled in visually.
 */
const HUMAN_DIR_OFFSET = 0;
const HUMAN_DIR_CW = 1; // +1 clockwise, -1 counter-clockwise
export function facingFromGridDelta(dx: number, dy: number): number | null {
  if (dx === 0 && dy === 0) return null;
  // Convert grid delta to screen-space delta (2:1 iso).
  const sx = dx - dy;
  const sy = (dx + dy) / 2;
  const ang = Math.atan2(sy, sx); // screen space, y-down
  const step = (Math.PI * 2) / 8;
  const idx = Math.round((ang / step) * HUMAN_DIR_CW) + HUMAN_DIR_OFFSET;
  return ((idx % 8) + 8) % 8;
}

// ---- load list -----------------------------------------------------------

export interface LoadEntry {
  key: string;
  path: string;
}

function entry(folder: string, stem: string): LoadEntry {
  return { key: stem, path: `${ASSET_BASE}/${folder}/${stem}.png` };
}

/** Every texture the PreloadScene must fetch before the city can render. */
export function buildLoadList(): LoadEntry[] {
  const list: LoadEntry[] = [];

  // room: only the floor tile + rugs are real sprites; walls are procedural.
  const roomStems = new Set<string>([ROOM.floor, ...RUGS]);
  for (const stem of roomStems) list.push(entry("room", stem));

  // furniture
  const furniStems = new Set<string>(Object.values(OBJECT_SPRITE).map((s) => s.tex));
  for (const stem of furniStems) list.push(entry("furni", stem));

  // characters: 8 dirs × (idle/run/pickup)
  for (const dir of CHAR_DIRECTIONS) {
    (Object.keys(ANIM_FRAMES) as CharAnim[]).forEach((anim) => {
      for (let f = 0; f < ANIM_FRAMES[anim]; f += 1) {
        list.push(entry("char", charFrameKey(dir, anim, f)));
      }
    });
  }

  return list;
}

/** All character texture keys (used by the grayscale pre-pass at boot). */
export function allCharKeys(): string[] {
  const keys: string[] = [];
  for (const dir of CHAR_DIRECTIONS) {
    (Object.keys(ANIM_FRAMES) as CharAnim[]).forEach((anim) => {
      for (let f = 0; f < ANIM_FRAMES[anim]; f += 1) keys.push(charFrameKey(dir, anim, f));
    });
  }
  return keys;
}

/** Frame keys for one character animation, in order. */
export function animFrameKeys(dir: number, anim: CharAnim): string[] {
  const keys: string[] = [];
  for (let f = 0; f < ANIM_FRAMES[anim]; f += 1) keys.push(charFrameKey(dir, anim, f));
  return keys;
}
