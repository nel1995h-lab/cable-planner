import { describe, expect, it } from "vitest";

import { astar } from "./astar";
import { defaultFeeder, defaultPrefs, createEmptyProject } from "./defaults";
import { computeFeeder, voltageDrop } from "./electrical";
import { buildGrid, cellCenter, lineOfSight, type Grid } from "./grid";
import { computeRoutes } from "./routing";
import { sampleProject } from "./sample";

function gridFrom(rows: string[]): Grid {
  const cols = rows[0].length;
  const blocked = new Uint8Array(cols * rows.length);
  rows.forEach((row, r) => [...row].forEach((ch, c) => (blocked[r * cols + c] = ch === "#" ? 1 : 0)));
  return {
    cols,
    rows: rows.length,
    cell: 1,
    blocked,
    cost: new Float32Array(cols * rows.length).fill(1),
    corridor: new Uint8Array(cols * rows.length),
    clearancePx: 0,
  };
}

describe("A* routing", () => {
  it("never steps through blocked cells and never cuts corners diagonally", () => {
    const g = gridFrom([
      "....",
      ".#..",
      "..#.",
      "....",
    ]);
    const path = astar(g, 0, 15, { neighbors: 8 })!;
    expect(path).not.toBeNull();
    for (const c of path) expect(g.blocked[c]).toBe(0);
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      const dc = (b % 4) - (a % 4);
      const dr = Math.floor(b / 4) - Math.floor(a / 4);
      if (dc !== 0 && dr !== 0) {
        expect(g.blocked[Math.floor(a / 4) * 4 + (a % 4) + dc]).toBe(0);
        expect(g.blocked[(Math.floor(a / 4) + dr) * 4 + (a % 4)]).toBe(0);
      }
    }
  });

  it("returns null when the goal is walled off", () => {
    const g = gridFrom(["..#..", "..#..", "..#.."]);
    expect(astar(g, 0, 4, { neighbors: 8 })).toBeNull();
  });

  it("does not squeeze diagonally between two touching corners", () => {
    const g = gridFrom([".#", "#."]);
    expect(astar(g, 0, 3, { neighbors: 8 })).toBeNull();
  });

  it("is deterministic", () => {
    const g = gridFrom(["......", "......", "......", "......"]);
    const a = astar(g, 0, 23, { neighbors: 8 });
    const b = astar(g, 0, 23, { neighbors: 8 });
    expect(a).toEqual(b);
  });

  it("4-neighbour path length equals Manhattan distance in open space", () => {
    const g = gridFrom(["....", "....", "...."]);
    const p = astar(g, 0, 11, { neighbors: 4 })!;
    expect(p.length - 1).toBe(3 + 2);
  });
});

describe("wall blocking", () => {
  it("routes around a drawn wall instead of across it", () => {
    const p = createEmptyProject();
    p.image = { source: "upload", name: "t", width: 200, height: 200 };
    p.prefs = { ...defaultPrefs(), cellPx: 4, clearancePx: 0, showAlternatives: false };
    // vertical wall with a gap only at the bottom
    p.obstacles = [{ id: "w", type: "wall", points: [{ x: 100, y: 0 }, { x: 100, y: 170 }] }];
    p.panels = { main: { x: 30, y: 30 }, offices: { x: 170, y: 30 } };
    const g = buildGrid({ width: 200, height: 200, obstacles: p.obstacles, corridors: [], prefs: p.prefs, pxPerMeter: null });
    const r = computeRoutes(p, g).byKind.offices.A;
    expect(r.status).toBe("ok");
    // every leg of the polyline stays in free cells
    for (let i = 1; i < r.points.length; i++) expect(lineOfSight(g, r.points[i - 1], r.points[i])).toBe(true);
    // must detour below the wall end (y > 170)
    expect(Math.max(...r.points.map((q) => q.y))).toBeGreaterThan(170);
  });

  it("reports blocked when the wall fully separates the panels", () => {
    const p = createEmptyProject();
    p.image = { source: "upload", name: "t", width: 200, height: 200 };
    p.prefs = { ...defaultPrefs(), cellPx: 4, clearancePx: 0 };
    p.obstacles = [{ id: "w", type: "wall", points: [{ x: 100, y: -10 }, { x: 100, y: 210 }] }];
    p.panels = { main: { x: 30, y: 30 }, offices: { x: 170, y: 30 } };
    const g = buildGrid({ width: 200, height: 200, obstacles: p.obstacles, corridors: [], prefs: p.prefs, pxPerMeter: null });
    expect(computeRoutes(p, g).byKind.offices.A.status).toBe("blocked");
  });

  it("finds all three sample feeder routes with no leg crossing a blocked cell", () => {
    const p = sampleProject();
    const g = buildGrid({ width: p.image.width, height: p.image.height, obstacles: p.obstacles, corridors: p.corridors, prefs: p.prefs, pxPerMeter: null });
    const out = computeRoutes(p, g);
    for (const k of ["offices", "warehouse", "production"] as const) {
      const r = out.byKind[k].A;
      expect(r.status).toBe("ok");
      for (const c of r.cells) expect(g.blocked[c]).toBe(0);
      for (let i = 1; i < r.points.length; i++) expect(lineOfSight(g, r.points[i - 1], r.points[i])).toBe(true);
    }
    expect(cellCenter(g, 0)).toEqual({ x: g.cell / 2, y: g.cell / 2 });
  });
});

describe("feeder checker", () => {
  it("3-phase drop uses √3·I·L·(R cosφ + X sinφ)", () => {
    // I=100A, L=0.1km, R=0.5, X=0.08, cos=0.8 (sin=0.6)
    const r = voltageDrop("3ph", 100, 0.1, 0.5, 0.08, 0.8, 400);
    expect(r.volts).toBeCloseTo(Math.sqrt(3) * 100 * 0.1 * (0.4 + 0.048), 6);
    expect(r.pct).toBeCloseTo((r.volts / 400) * 100, 6);
  });

  it("1-phase drop uses 2·I·L·(R cosφ + X sinφ)", () => {
    const r = voltageDrop("1ph", 10, 0.05, 2, 0, 1, 230);
    expect(r.volts).toBeCloseTo(2 * 10 * 0.05 * 2, 6);
  });

  it("I'z = Iz × temperature × grouping factors and Ib ≤ In ≤ I'z", () => {
    const f = { ...defaultFeeder(), ib: "40", inom: "50", iz: "70", kTemp: "0.9", kGroup: "0.8" };
    const res = computeFeeder(f, 30, "3");
    expect(res.izCorrected).toBeCloseTo(50.4, 6);
    expect(res.izCheck.status).toBe("pass");
    const bad = computeFeeder({ ...f, kGroup: "0.7" }, 30, "3"); // I'z = 44.1 < In
    expect(bad.izCheck.status).toBe("fail");
  });

  it("does not check I2 unless it is entered explicitly", () => {
    const f = { ...defaultFeeder(), ib: "40", inom: "50", iz: "70", kTemp: "1", kGroup: "1" };
    expect(computeFeeder(f, 30, "3").i2Check.status).toBe("missing");
    expect(computeFeeder({ ...f, i2: "100" }, 30, "3").i2Check.status).toBe("pass"); // 100 ≤ 101.5
    expect(computeFeeder({ ...f, i2: "102" }, 30, "3").i2Check.status).toBe("fail");
  });

  it("flags combined drop above the 3% baseline", () => {
    const f = {
      ...defaultFeeder(),
      voltage: "400",
      ib: "100",
      cosPhi: "1",
      rPerKm: "1",
      xPerKm: "0",
      upstreamPct: "1",
      downstreamPct: "1",
    };
    // feeder ΔU = √3·100·0.05·1 = 8.66V = 2.165% → total 4.165% > 3%
    const res = computeFeeder(f, 50, "3");
    expect(res.drop.pct).toBeCloseTo(2.165, 2);
    expect(res.totalDrop.status).toBe("fail");
    expect(res.overall).toBe("issues");
  });

  it("adds vertical allowance and reserve to the route length", () => {
    const f = { ...defaultFeeder(), verticalM: "6", reservePct: "10" };
    expect(computeFeeder(f, 44, "3").length.totalM).toBeCloseTo(55, 6);
  });

  it("never reports a complete result when fields are empty", () => {
    expect(computeFeeder(defaultFeeder(), 30, "3").overall).toBe("incomplete");
  });
});