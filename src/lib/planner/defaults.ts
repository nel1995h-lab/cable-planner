import type { FeederInputs, PanelKind, Project, RoutePrefs, SubKind } from "./types";

export const PANEL_META: Record<
  PanelKind,
  { label: string; short: string; colorVar: string; textClass: string; bgClass: string }
> = {
  main: {
    label: "לוח ראשי",
    short: "ראשי",
    colorVar: "--panel-main",
    textClass: "text-panel-main",
    bgClass: "bg-panel-main",
  },
  offices: {
    label: "לוח משנה – משרדים",
    short: "משרדים",
    colorVar: "--panel-offices",
    textClass: "text-panel-offices",
    bgClass: "bg-panel-offices",
  },
  warehouse: {
    label: "לוח משנה – מחסן",
    short: "מחסן",
    colorVar: "--panel-warehouse",
    textClass: "text-panel-warehouse",
    bgClass: "bg-panel-warehouse",
  },
  production: {
    label: "לוח משנה – ייצור",
    short: "ייצור",
    colorVar: "--panel-production",
    textClass: "text-panel-production",
    bgClass: "bg-panel-production",
  },
};

export const FEEDER_LABEL: Record<SubKind, string> = {
  offices: "מזין משרדים",
  warehouse: "מזין מחסן",
  production: "מזין ייצור",
};

export function defaultPrefs(): RoutePrefs {
  return {
    neighbors: 8,
    cellPx: 0,
    clearanceM: 0.2,
    clearancePx: 6,
    wallThicknessPx: 6,
    preferCorridors: false,
    corridorPenalty: 2,
    shareTrunk: false,
    smoothing: true,
    showAlternatives: true,
    mounting: "unspecified",
  };
}

export function defaultFeeder(): FeederInputs {
  return {
    system: "3ph",
    voltage: "",
    ib: "",
    inom: "",
    iz: "",
    kTemp: "",
    kGroup: "",
    kOther: "",
    i2: "",
    cosPhi: "",
    rPerKm: "",
    xPerKm: "",
    verticalM: "",
    reservePct: "",
    useLengthOverride: false,
    lengthOverrideM: "",
    upstreamPct: "",
    downstreamPct: "",
    routeChoice: "A",
    cableNote: "",
  };
}

export function createEmptyProject(): Project {
  return {
    version: 1,
    image: { source: "none", name: "", width: 0, height: 0 },
    calibration: null,
    panels: {},
    obstacles: [],
    corridors: [],
    prefs: defaultPrefs(),
    feeders: { offices: defaultFeeder(), warehouse: defaultFeeder(), production: defaultFeeder() },
    dropLimitPct: "3",
    layers: {
      obstacles: true,
      corridors: true,
      routes: true,
      grid: false,
      labels: true,
      calibration: true,
    },
    obstaclesConfirmed: false,
    persistImage: true,
  };
}

/** Merge an imported / stored object onto defaults so older or partial files still load. */
export function normalizeProject(raw: unknown): Project {
  const base = createEmptyProject();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<Project>;
  return {
    ...base,
    ...r,
    version: 1,
    image: { ...base.image, ...(r.image ?? {}) },
    prefs: { ...base.prefs, ...(r.prefs ?? {}) },
    layers: { ...base.layers, ...(r.layers ?? {}) },
    panels: { ...(r.panels ?? {}) },
    obstacles: Array.isArray(r.obstacles) ? r.obstacles : [],
    corridors: Array.isArray(r.corridors) ? r.corridors : [],
    feeders: {
      offices: { ...defaultFeeder(), ...(r.feeders?.offices ?? {}) },
      warehouse: { ...defaultFeeder(), ...(r.feeders?.warehouse ?? {}) },
      production: { ...defaultFeeder(), ...(r.feeders?.production ?? {}) },
    },
  };
}