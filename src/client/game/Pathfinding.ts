/**
 * Lightweight BFS pathfinding over the tile grid.
 * Uniform cost, 4-directional. The grid is tiny (22x15) so BFS is plenty fast.
 * Blocked tiles (furniture) are avoided when a path exists; otherwise we fall
 * back to a straight march so an agent never gets permanently stuck.
 */
import { WORLD_HEIGHT, WORLD_WIDTH } from "../../protocol/index";

export interface Tile {
  x: number;
  y: number;
}

function key(x: number, y: number): number {
  return y * WORLD_WIDTH + x;
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < WORLD_WIDTH && y >= 0 && y < WORLD_HEIGHT;
}

/**
 * Find a path from start to goal. `blocked` is the set of occupied tile keys.
 * The goal is always allowed even if blocked (so agents can walk up to objects).
 */
export function findPath(start: Tile, goal: Tile, blocked: Set<number>): Tile[] {
  if (start.x === goal.x && start.y === goal.y) return [];
  if (!inBounds(goal.x, goal.y)) return [];

  const goalKey = key(goal.x, goal.y);
  const queue: Tile[] = [start];
  const cameFrom = new Map<number, number>();
  const visited = new Set<number>([key(start.x, start.y)]);
  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  let found = false;
  while (queue.length > 0) {
    const current = queue.shift() as Tile;
    if (current.x === goal.x && current.y === goal.y) {
      found = true;
      break;
    }
    for (const { dx, dy } of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (!inBounds(nx, ny)) continue;
      const nk = key(nx, ny);
      if (visited.has(nk)) continue;
      if (blocked.has(nk) && nk !== goalKey) continue;
      visited.add(nk);
      cameFrom.set(nk, key(current.x, current.y));
      queue.push({ x: nx, y: ny });
    }
  }

  if (!found) return straightLine(start, goal);

  // Reconstruct.
  const path: Tile[] = [];
  let currentKey = goalKey;
  const startKey = key(start.x, start.y);
  while (currentKey !== startKey) {
    const x = currentKey % WORLD_WIDTH;
    const y = Math.floor(currentKey / WORLD_WIDTH);
    path.push({ x, y });
    const prev = cameFrom.get(currentKey);
    if (prev === undefined) break;
    currentKey = prev;
  }
  return path.reverse();
}

/** Bresenham-ish fallback so movement always resolves to something. */
function straightLine(start: Tile, goal: Tile): Tile[] {
  const path: Tile[] = [];
  let { x, y } = start;
  let guard = 0;
  while ((x !== goal.x || y !== goal.y) && guard < WORLD_WIDTH + WORLD_HEIGHT) {
    if (x < goal.x) x += 1;
    else if (x > goal.x) x -= 1;
    if (y < goal.y) y += 1;
    else if (y > goal.y) y -= 1;
    path.push({ x, y });
    guard += 1;
  }
  return path;
}
