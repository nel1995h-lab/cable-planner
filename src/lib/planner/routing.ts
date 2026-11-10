import { astar } from "./astar";
import { cellCenter, cellOf, lineOfSight, nearestFree, type Grid } from "./grid";
import { dist, polylineLength } from "./geometry";
import { SUB_KINDS, type Pt, type Project, type SubKind } from "./types";

export type RouteStatus = "ok" | "blocked" | "missing" | "no-free-cell";

export type RouteResult = {
  kind: SubKind;
  variant: "A" | "B";
  status: RouteStatus;
  message: string;
  /** routed polyline (free cells only), from main panel side to subpanel side */
  points: Pt[];
  /** connector from the actual panel position to the snapped free cell (may cross the blocked margin) */
  startConnector: Pt[] | null;
  endConnector: Pt[] | null;
  cells: number[];
  lengthPx: number;
  lengthM: number | null;
  snapPx: number;
  method: string;
};

export type RoutesOutput = {
  byKind: Record<SubKind, { A: RouteResult; B: RouteResult | null }>;
  shared: { segments: Pt[][]; lengthPx: number; lengthM: number | null };
};

export function pxPerMeterOf(p: Project): number | null {
  const c = p.calibration;
  if (!c || !(c.meters > 0)) return null;
  const d = dist(c.a, c.b);
  return d > 0 ? d / c.meters : null;
}

function removeCollinear(pts: Pt[]): Pt[] {
  if (pts.length < 3) return pts;
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) > 1e-6) out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Any-angle smoothing: keeps a shortcut only if every touched cell is free. */
function smooth(g: Grid, pts: Pt[]): Pt[] {
  if (pts.length < 3) return pts;
  const out: Pt[] = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let next = i + 1;
    for (let j = pts.length - 1; j > i + 1; j--) {
      if (lineOfSight(g, pts[i], pts[j])) {
        next = j;
        break;
      }
    }
    out.push(pts[next]);
    i = next;
  }
  return out;
}

function emptyResult(kind: SubKind, variant: "A" | "B", status: RouteStatus, message: string) {
  return {
    kind,
    variant,
    status,
    message,
    points: [],
    startConnector: null,
    endConnector: null,
    cells: [],
    lengthPx: 0,
    lengthM: null,
    snapPx: 0,
    method: "",
  } satisfies RouteResult;
}

function routeOne(
  g: Grid,
  kind: SubKind,
  variant: "A" | "B",
  from: Pt,
  to: Pt,
  neighbors: 4 | 8,
  doSmooth: boolean,
  extra: Float32Array | null,
  ppm: number | null,
  method: string,
): RouteResult {
  const s0 = cellOf(g, from);
  const e0 = cellOf(g, to);
  const s = nearestFree(g, s0);
  const e = nearestFree(g, e0);
  if (s < 0 || e < 0) {
    return emptyResult(kind, variant, "no-free-cell", "לא נמצא תא פנוי ליד הלוח — הזיזו את הלוח");
  }
  const cells = astar(g, s, e, { neighbors, extraCost: extra });
  if (!cells) {
    return emptyResult(
      kind,
      variant,
      "blocked",
      "אין תוואי אפשרי לפי המכשולים שסומנו (הנקודות מנותקות)",
    );
  }
  const startSnapped = s !== s0;
  const endSnapped = e !== e0;
  const sc = cellCenter(g, s);
  const ec = cellCenter(g, e);
  const centers = cells.map((c) => cellCenter(g, c));
  // replace the endpoint cell centres with the actual panel points when the panel cell is free
  if (!startSnapped) centers[0] = from;
  if (!endSnapped) centers[centers.length - 1] = to;
  let pts = removeCollinear(centers);
  if (doSmooth) pts = smooth(g, pts);
  const startConnector = startSnapped ? [from, sc] : null;
  const endConnector = endSnapped ? [ec, to] : null;
  const snapPx = (startSnapped ? dist(from, sc) : 0) + (endSnapped ? dist(ec, to) : 0);
  const lengthPx = polylineLength(pts) + snapPx;
  return {
    kind,
    variant,
    status: "ok",
    message:
      startSnapped || endSnapped
        ? "נקודת קצה נמצאת באזור חסום — הוצמדה לתא הפנוי הקרוב (קטע החיבור מסומן במקווקו)"
        : "",
    points: pts,
    startConnector,
    endConnector,
    cells,
    lengthPx,
    lengthM: ppm ? lengthPx / ppm : null,
    snapPx,
    method,
  };
}

export function computeRoutes(project: Project, g: Grid | null): RoutesOutput {
  const ppm = pxPerMeterOf(project);
  const prefs = project.prefs;
  const main = project.panels.main;
  const byKind = {} as RoutesOutput["byKind"];
  const n = g ? g.cols * g.rows : 0;
  const shareExtra = g && prefs.shareTrunk ? new Float32Array(n).fill(1) : null;
  const smoothA = prefs.smoothing && !prefs.shareTrunk;

  for (const kind of SUB_KINDS) {
    const sub = project.panels[kind];
    if (!g) {
      byKind[kind] = { A: emptyResult(kind, "A", "missing", "אין תוכנית"), B: null };
      continue;
    }
    if (!main || !sub) {
      byKind[kind] = {
        A: emptyResult(kind, "A", "missing", !main ? "לא סומן לוח ראשי" : "לא סומן לוח משנה"),
        B: null,
      };
      continue;
    }
    const A = routeOne(
      g,
      kind,
      "A",
      main,
      sub,
      prefs.neighbors,
      smoothA,
      shareExtra,
      ppm,
      prefs.neighbors === 8
        ? smoothA
          ? "A* 8 שכנים + החלקה בקו ראייה"
          : "A* 8 שכנים"
        : "A* 4 שכנים (אורתוגונלי)",
    );
    if (shareExtra && A.status === "ok") {
      for (const c of A.cells) shareExtra[c] = 0.6;
    }
    let B: RouteResult | null = null;
    if (prefs.showAlternatives && A.status === "ok") {
      if (prefs.neighbors === 8) {
        B = routeOne(g, kind, "B", main, sub, 4, false, null, ppm, "חלופה: אורתוגונלי בלבד (4 שכנים)");
      } else {
        // a geometrically different corridor: penalise the cells around route A
        const pen = new Float32Array(n).fill(1);
        for (const c of A.cells) {
          const cc = c % g.cols;
          const rr = Math.floor(c / g.cols);
          for (let dr = -2; dr <= 2; dr++)
            for (let dc = -2; dc <= 2; dc++) {
              const x = cc + dc;
              const y = rr + dr;
              if (x >= 0 && y >= 0 && x < g.cols && y < g.rows) pen[y * g.cols + x] = 4;
            }
        }
        B = routeOne(g, kind, "B", main, sub, 4, false, pen, ppm, "חלופה: מסלול נבדל (ענישת תוואי A)");
      }
    }
    byKind[kind] = { A, B };
  }

  // shared trunk detection on raw grid paths of variant A
  const shared: RoutesOutput["shared"] = { segments: [], lengthPx: 0, lengthM: null };
  if (g) {
    const count = new Uint8Array(n);
    for (const k of SUB_KINDS) {
      const r = byKind[k].A;
      if (r.status !== "ok") continue;
      const seen = new Set<number>();
      for (const c of r.cells) if (!seen.has(c)) (seen.add(c), count[c]++);
    }
    const emitted = new Set<string>();
    for (const k of SUB_KINDS) {
      const r = byKind[k].A;
      if (r.status !== "ok") continue;
      let run: Pt[] = [];
      for (let i = 1; i < r.cells.length; i++) {
        const a = r.cells[i - 1];
        const b = r.cells[i];
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (count[a] >= 2 && count[b] >= 2 && !emitted.has(key)) {
          emitted.add(key);
          if (run.length === 0) run.push(cellCenter(g, a));
          run.push(cellCenter(g, b));
        } else if (run.length) {
          shared.segments.push(run);
          run = [];
        }
      }
      if (run.length) shared.segments.push(run);
    }
    shared.lengthPx = shared.segments.reduce((s, seg) => s + polylineLength(seg), 0);
    shared.lengthM = ppm ? shared.lengthPx / ppm : null;
  }

  return { byKind, shared };
}