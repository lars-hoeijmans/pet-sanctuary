/**
 * Asset manifest for the isometric sanctuary room.
 *
 * Every sprite is a CC0 Kenney asset vendored under `apps/web/public/assets/kenney`:
 *   - Furniture Kit (floor / rugs / furniture), one coherent style
 *   - Miniature Prototype "Human" character (8 facing directions, idle/run/pickup)
 *
 * Furniture is mapped from the *raw world-object type string* the server emits
 * (e.g. "couch", "desk", "lamp"), not a fixed client enum — so any type an agent
 * builds still resolves to a sprite (unknown types fall back gracefully). The
 * renderer references only the logical keys here, so swapping the art pack later
 * is just replacing files + these constants.
 */
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
 * Placement tuning (dialled in visually against the Kenney sprite geometry).
 * The floor sprite carries thickness below its diamond, so its visual origin is
 * above centre; a hair of overlap hides seams between tiles.
 */
export const FLOOR_ORIGIN_Y = 0.34;
export const FLOOR_OVERLAP = 1.02;

/** Character figure anchor within its native frame (foot point). */
export const CHAR_ANCHOR_X = 0.5;
export const CHAR_ANCHOR_Y = 0.9;

/** Logical room textures -> vendored file stems (folder `room`). */
export const ROOM = {
  floor: "floorFull_NE",
} as const;

/** Rug textures (folder `room`) used to render `rug` world-objects as decals. */
export const RUGS: readonly string[] = [
  "rugRound_SE",
  "rugSquare_SE",
  "rugRectangle_SE",
  "rugRounded_SE",
];

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

/**
 * Maps a normalized world-object type -> a real Kenney furniture sprite + footprint.
 * Keys are lowercased/underscored; synonyms point at the same sprite so both the
 * server's vocabulary ("couch") and richer agent vocabularies ("sofa") resolve.
 */
const SPRITE_BY_TYPE: Record<string, ObjectSpriteSpec> = {
  desk: { tex: `desk_${D}`, w: 2, d: 1, fill: 0.8 },
  chair: { tex: `chairModernFrameCushion_${D}`, w: 1, d: 1, fill: 0.52 },
  seat: { tex: `chairModernFrameCushion_${D}`, w: 1, d: 1, fill: 0.52 },
  stool: { tex: `chairModernFrameCushion_${D}`, w: 1, d: 1, fill: 0.5 },
  plant: { tex: `pottedPlant_${D}`, w: 1, d: 1, fill: 0.42 },
  pottedplant: { tex: `pottedPlant_${D}`, w: 1, d: 1, fill: 0.42 },
  couch: { tex: `loungeSofa_${D}`, w: 2, d: 1, fill: 0.82 },
  sofa: { tex: `loungeSofa_${D}`, w: 2, d: 1, fill: 0.82 },
  lounge: { tex: `loungeSofa_${D}`, w: 2, d: 1, fill: 0.82 },
  lamp: { tex: `lampSquareFloor_${D}`, w: 1, d: 1, fill: 0.18 },
  table: { tex: `tableCross_${D}`, w: 2, d: 2, fill: 0.82 },
  meeting_table: { tex: `tableCross_${D}`, w: 2, d: 2, fill: 0.82 },
  bookshelf: { tex: `bookcaseOpen_${D}`, w: 2, d: 1, fill: 0.68 },
  bookcase: { tex: `bookcaseOpen_${D}`, w: 2, d: 1, fill: 0.68 },
  shelf: { tex: `bookcaseOpen_${D}`, w: 2, d: 1, fill: 0.68 },
  cabinet: { tex: `bookcaseClosedWide_${D}`, w: 2, d: 1, fill: 0.68 },
  notice: { tex: `bookcaseClosedWide_${D}`, w: 2, d: 1, fill: 0.68 },
  notice_board: { tex: `bookcaseClosedWide_${D}`, w: 2, d: 1, fill: 0.68 },
  whiteboard: { tex: `televisionModern_${D}`, w: 1, d: 1, fill: 0.5 },
  board: { tex: `televisionModern_${D}`, w: 1, d: 1, fill: 0.5 },
  tv: { tex: `televisionModern_${D}`, w: 1, d: 1, fill: 0.5 },
  television: { tex: `televisionModern_${D}`, w: 1, d: 1, fill: 0.5 },
  monitor: { tex: `televisionModern_${D}`, w: 1, d: 1, fill: 0.5 },
  terminal: { tex: `computerScreen_${D}`, w: 1, d: 1, fill: 0.42 },
  computer: { tex: `computerScreen_${D}`, w: 1, d: 1, fill: 0.42 },
  workstation: { tex: `computerScreen_${D}`, w: 1, d: 1, fill: 0.42 },
  server_rack: { tex: `kitchenFridgeLarge_${D}`, w: 1, d: 1, fill: 0.58 },
  server: { tex: `kitchenFridgeLarge_${D}`, w: 1, d: 1, fill: 0.58 },
  fridge: { tex: `kitchenFridgeLarge_${D}`, w: 1, d: 1, fill: 0.58 },
  coffee_machine: { tex: `kitchenCoffeeMachine_${D}`, w: 1, d: 1, fill: 0.44 },
  coffee: { tex: `kitchenCoffeeMachine_${D}`, w: 1, d: 1, fill: 0.44 },
};

/** Sprite used when a type has no explicit mapping (so agent builds never blank). */
export const DEFAULT_OBJECT_SPRITE: ObjectSpriteSpec = {
  tex: `bookcaseClosedWide_${D}`,
  w: 1,
  d: 1,
  fill: 0.62,
};

/** Normalize a free-form type string to a lookup key. */
function normalizeType(type: string): string {
  return type.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/** Rugs are floor decals, not upright furniture — the renderer treats them apart. */
export function isRugType(type: string): boolean {
  const key = normalizeType(type);
  return key === "rug" || key === "carpet" || key === "mat";
}

/** Resolve any world-object type to a furniture sprite spec (with fallback). */
export function resolveObjectSprite(type: string): ObjectSpriteSpec {
  return SPRITE_BY_TYPE[normalizeType(type)] ?? DEFAULT_OBJECT_SPRITE;
}

/** Footprint accessor used by the scene for placement + blocking. */
export function footprint(type: string): { w: number; d: number } {
  const spec = resolveObjectSprite(type);
  return { w: spec.w, d: spec.d };
}

/** Pick a stable rug texture for a rug object id (so rugs vary but are stable). */
export function rugTexForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return RUGS[hash % RUGS.length] ?? RUGS[0];
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

/** Every texture the PreloadScene must fetch before the room can render. */
export function buildLoadList(): LoadEntry[] {
  const list: LoadEntry[] = [];

  // room: floor tile + rugs are real sprites; walls are procedural.
  const roomStems = new Set<string>([ROOM.floor, ...RUGS]);
  for (const stem of roomStems) list.push(entry("room", stem));

  // furniture: every sprite any type can resolve to, plus the fallback.
  const furniStems = new Set<string>([
    ...Object.values(SPRITE_BY_TYPE).map((s) => s.tex),
    DEFAULT_OBJECT_SPRITE.tex,
  ]);
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
