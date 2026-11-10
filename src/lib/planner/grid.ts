import { pointInPolygon, pointSegDist } from "./geometry";
import type { Corridor, Obstacle, Pt, RoutePrefs } from "./types";

export type Grid = {
  cols: number;
  rows: number;
  /** cell size in image pixels */
  cell: number;
  /** 1 = blocked */
  blocked: Uint8Array;
  /** traversal cost multiplier per cell (>= some positive minimum) */
  cost: Float32Array;
  /** 1 = inside a marked corridor */
  corridor: Uint8Array;
  clearancePx: number;
};

export function autoCellSize(width: number, height: number): number {
  return Math.max(3, Math.ceil(Math.max(width, height) / 320));
}

export function cellCenter(g: Grid, idx: number): Pt {
  const c = idx % g.cols;
  const r = Math.floor(idx / g.cols);
  return { x: (c + 0.5) * g.cell, y: (r + 0.5) * g.cell };
}

export function cellOf(g: Grid, p: Pt): number {
  const c = Math.min(g.cols - 1, Math.max(0, Math.floor(p.x / g.cell)));
  const r = Math.min(g.rows - 1, Math.max(0, Math.floor(p.y / g.cell)));
  return r * g.cols + c;
}

/**
 * Mark every cell whose square may be within `radius` of segment ab.
 * Conservative: uses centre distance <= radius + half-diagonal, so any cell the
 * thickened segment touches is guaranteed to be marked (it may over-mark slightly).
 */
function markSegment(
  out: Uint8Array,
  cols: number,
  rows: number,
  cell: number,
  a: Pt,
  b: Pt,
  radius: number,
) {
  const reach = radius + cell * Math.SQRT1_2;
  const minC = Math.max(0, Math.floor((Math.min(a.x, b.x) - reach) / cell));
  const maxC = Math.min(cols - 1, Math.floor((Math.max(a.x, b.x) + reach) / cell));
  const minR = Math.max(0, Math.floor((Math.min(a.y, b.y) - reach) / cell));
  const maxR = Math.min(rows - 1, Math.floor((Math.max(a.y, b.y) + reach) / cell));
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const p = { x: (c + 0.5) * cell, y: (r + 0.5) * cell };
      if (pointSegDist(p, a, b) <= reach) out[r * cols + c] = 1;
    }
  }
}

export type GridInput = {
  width: number;
  height: number;
  obstacles: Obstacle[];
  corridors: Corridor[];
  prefs: RoutePrefs;
  pxPerMeter: number | null;
};

export function buildGrid({
  width,
  height,
  obstacles,
  corridors,
  prefs,
  pxPerMeter,
}: GridInput): Grid {
  const cell = prefs.cellPx > 0 ? prefs.cellPx : autoCellSize(width, height);
  const cols = Math.max(1, Math.ceil(width / cell));
  const rows = Math.max(1, Math.ceil(height / cell));
  const n = cols * rows;
  const blocked = new Uint8Array(n);
  const corridor = new Uint8Array(n);
  const cost = new Float32Array(n).fill(1);

  const clearancePx =
    pxPerMeter && pxPerMeter > 0
      ? Math.max(0, prefs.clearanceM) * pxPerMeter
      : Math.max(0, prefs.clearancePx);
  const wallR = Math.max(0.5, prefs.wallThicknessPx / 2) + clearancePx;

  for (const ob of obstacles) {
    if (ob.type === "rect") {
      const x0 = Math.min(ob.x, ob.x + ob.w) - clearancePx;
      const x1 = Math.max(ob.x, ob.x + ob.w) + clearancePx;
      const y0 = Math.min(ob.y, ob.y + ob.h) - clearancePx;
      const y1 = Math.max(ob.y, ob.y + ob.h) + clearancePx;
      // exact square/rect overlap test
      const c0 = Math.max(0, Math.floor(x0 / cell));
      const c1 = Math.min(cols - 1, Math.floor(x1 / cell));
      const r0 = Math.max(0, Math.floor(y0 / cell));
      const r1 = Math.min(rows - 1, Math.floor(y1 / cell));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) blocked[r * cols + c] = 1;
    } else if (ob.type === "wall") {
      for (let i = 1; i < ob.points.length; i++) {
        markSegment(blocked, cols, rows, cell, ob.points[i - 1], ob.points[i], wallR);
      }
    } else if (ob.type === "zone" && ob.points.length >= 3) {
      const pts = ob.points;
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const c0 = Math.max(0, Math.floor(Math.min(...xs) / cell));
      const c1 = Math.min(cols - 1, Math.floor(Math.max(...xs) / cell));
      const r0 = Math.max(0, Math.floor(Math.min(...ys) / cell));
      const r1 = Math.min(rows - 1, Math.floor(Math.max(...ys) / cell));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (pointInPolygon({ x: (c + 0.5) * cell, y: (r + 0.5) * cell }, pts)) {
            blocked[r * cols + c] = 1;
          }
        }
      }
      for (let i = 0; i < pts.length; i++) {
        markSegment(blocked, cols, rows, cell, pts[i], pts[(i + 1) % pts.length], clearancePx);
      }
    }
  }

  // corridors: band of ~2 cells (or clearance) around the marked centreline
  const corridorR = Math.max(cell * 1.5, clearancePx);
  for (const co of corridors) {
    for (let i = 1; i < co.points.length; i++) {
      markSegment(corridor, cols, rows, cell, co.points[i - 1], co.points[i], corridorR);
    }
  }
  if (prefs.preferCorridors && corridors.length > 0) {
    const pen = Math.max(1, prefs.corridorPenalty);
    for (let i = 0; i < n; i++) if (!corridor[i]) cost[i] = pen;
  }

  return { cols, rows, cell, blocked, cost, corridor, clearancePx };
}

/** Breadth-first search for the nearest free cell. Returns -1 if none within limit. */
export function nearestFree(g: Grid, idx: number, maxCells = 4000): number {
  if (!g.blocked[idx]) return idx;
  const seen = new Uint8Array(g.cols * g.rows);
  const queue = [idx];
  seen[idx] = 1;
  let head = 0;
  while (head < queue.length && head < maxCells) {
    const cur = queue[head++];
    const c = cur % g.cols;
    const r = Math.floor(cur / g.cols);
    const nbrs = [
      [c + 1, r],
      [c - 1, r],
      [c, r + 1],
      [c, r - 1],
    ];
    for (const [nc, nr] of nbrs) {
      if (nc < 0 || nr < 0 || nc >= g.cols || nr >= g.rows) continue;
      const ni = nr * g.cols + nc;
      if (seen[ni]) continue;
      if (!g.blocked[ni]) return ni;
      seen[ni] = 1;
      queue.push(ni);
    }
  }
  return -1;
}

/**
 * True if the straight segment ab passes only through free cells.
 * Conservative: checks every cell the segment could touch.
 */
export function lineOfSight(g: Grid, a: Pt, b: Pt): boolean {
  const reach = g.cell * Math.SQRT1_2 + 1e-6;
  const minC = Math.max(0, Math.floor((Math.min(a.x, b.x) - reach) / g.cell));
  const maxC = Math.min(g.cols - 1, Math.floor((Math.max(a.x, b.x) + reach) / g.cell));
  const minR = Math.max(0, Math.floor((Math.min(a.y, b.y) - reach) / g.cell));
  const maxR = Math.min(g.rows - 1, Math.floor((Math.max(a.y, b.y) + reach) / g.cell));
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const i = r * g.cols + c;
      if (!g.blocked[i]) continue;
      const p = { x: (c + 0.5) * g.cell, y: (r + 0.5) * g.cell };
      if (pointSegDist(p, a, b) <= reach) return false;
    }
  }
  return true;
}