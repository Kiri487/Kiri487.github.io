import type { WorldMap } from "./map";

/* Signs of wear: now and then a ceiling tile gone, showing the dark above. */

/** The ceiling's tiles are half a cell across: four over each cell. Of them, this many are gone. */
const HOLE_CHANCE = 0.005;

/** Whether tile (tx, ty) of the ceiling is gone; tiles count in halves of a cell. Light panels are never drawn as gone. */
export function tileGone(map: WorldMap, tx: number, ty: number): boolean {
  return map.noise(tx, ty, 500) < HOLE_CHANCE;
}

/** Whether any of the four tiles over cell (cx, cy) is gone. */
export function cellHasHole(map: WorldMap, cx: number, cy: number): boolean {
  return (
    tileGone(map, cx * 2, cy * 2) ||
    tileGone(map, cx * 2 + 1, cy * 2) ||
    tileGone(map, cx * 2, cy * 2 + 1) ||
    tileGone(map, cx * 2 + 1, cy * 2 + 1)
  );
}
