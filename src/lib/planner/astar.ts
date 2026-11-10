import type { Grid } from "./grid";

/** Min-heap keyed by (f, h, seq) for deterministic tie-breaking. */
class Heap {
  private f: number[] = [];
  private h: number[] = [];
  private s: number[] = [];
  private v: number[] = [];
  private seq = 0;
  get size() {
    return this.v.length;
  }
  private less(i: number, j: number) {
    if (this.f[i] !== this.f[j]) return this.f[i] < this.f[j];
    if (this.h[i] !== this.h[j]) return this.h[i] < this.h[j];
    return this.s[i] < this.s[j];
  }
  private swap(i: number, j: number) {
    [this.f[i], this.f[j]] = [this.f[j], this.f[i]];
    [this.h[i], this.h[j]] = [this.h[j], this.h[i]];
    [this.s[i], this.s[j]] = [this.s[j], this.s[i]];
    [this.v[i], this.v[j]] = [this.v[j], this.v[i]];
  }
  push(value: number, f: number, h: number) {
    this.f.push(f);
    this.h.push(h);
    this.s.push(this.seq++);
    this.v.push(value);
    let i = this.v.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.v[0];
    const last = this.v.length - 1;
    this.swap(0, last);
    this.f.pop();
    this.h.pop();
    this.s.pop();
    this.v.pop();
    let i = 0;
    const n = this.v.length;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < n && this.less(l, m)) m = l;
      if (r < n && this.less(r, m)) m = r;
      if (m === i) break;
      this.swap(i, m);
      i = m;
    }
    return top;
  }
}

export type AStarOptions = {
  neighbors: 4 | 8;
  /** optional per-cell multiplier applied on top of grid.cost */
  extraCost?: Float32Array | null;
};

// Fixed neighbour order => deterministic results.
const N4: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const NDIAG: [number, number][] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/**
 * Deterministic A* over the occupancy grid.
 * Step cost = geometric step length (1 or √2) × cost multiplier of the destination cell.
 * Diagonal moves are only allowed when both adjacent orthogonal cells are free (no corner cutting).
 * Returns the list of cell indices from start to goal, or null when no path exists.
 */
export function astar(g: Grid, start: number, goal: number, opts: AStarOptions): number[] | null {
  const n = g.cols * g.rows;
  if (start < 0 || goal < 0 || start >= n || goal >= n) return null;
  if (g.blocked[start] || g.blocked[goal]) return null;

  const extra = opts.extraCost ?? null;
  let minMult = Infinity;
  for (let i = 0; i < n; i++) {
    const m = g.cost[i] * (extra ? extra[i] : 1);
    if (m < minMult) minMult = m;
  }
  if (!isFinite(minMult) || minMult <= 0) minMult = 1;

  const gc = goal % g.cols;
  const gr = Math.floor(goal / g.cols);
  const heur = (idx: number) => {
    const dx = Math.abs((idx % g.cols) - gc);
    const dy = Math.abs(Math.floor(idx / g.cols) - gr);
    const octile =
      opts.neighbors === 8 ? Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy) : dx + dy;
    return octile * minMult; // admissible
  };

  const gScore = new Float64Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const heap = new Heap();
  gScore[start] = 0;
  heap.push(start, heur(start), heur(start));

  const free = (c: number, r: number) =>
    c >= 0 && r >= 0 && c < g.cols && r < g.rows && !g.blocked[r * g.cols + c];

  while (heap.size > 0) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    if (cur === goal) {
      const path: number[] = [];
      let p = cur;
      while (p !== -1) {
        path.push(p);
        p = came[p];
      }
      return path.reverse();
    }
    closed[cur] = 1;
    const c = cur % g.cols;
    const r = Math.floor(cur / g.cols);

    const tryMove = (dc: number, dr: number, step: number) => {
      const nc = c + dc;
      const nr = r + dr;
      if (!free(nc, nr)) return;
      if (dc !== 0 && dr !== 0) {
        // prevent corner cutting: both orthogonal neighbours must be free
        if (!free(c + dc, r) || !free(c, r + dr)) return;
      }
      const ni = nr * g.cols + nc;
      if (closed[ni]) return;
      const mult = g.cost[ni] * (extra ? extra[ni] : 1);
      const t = gScore[cur] + step * mult;
      if (t < gScore[ni] - 1e-9) {
        gScore[ni] = t;
        came[ni] = cur;
        const h = heur(ni);
        heap.push(ni, t + h, h);
      }
    };

    for (const [dc, dr] of N4) tryMove(dc, dr, 1);
    if (opts.neighbors === 8) for (const [dc, dr] of NDIAG) tryMove(dc, dr, Math.SQRT2);
  }
  return null;
}