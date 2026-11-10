export type Pt = { x: number; y: number };

export type PanelKind = "main" | "offices" | "warehouse" | "production";
export type SubKind = Exclude<PanelKind, "main">;
export const SUB_KINDS: SubKind[] = ["offices", "warehouse", "production"];
export const PANEL_KINDS: PanelKind[] = ["main", ...SUB_KINDS];

export type RectObstacle = {
  id: string;
  type: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
};
export type WallObstacle = { id: string; type: "wall"; points: Pt[]; label?: string };
export type ZoneObstacle = { id: string; type: "zone"; points: Pt[]; label?: string };
export type Obstacle = RectObstacle | WallObstacle | ZoneObstacle;

export type Corridor = { id: string; points: Pt[]; label?: string };

export type Calibration = { a: Pt; b: Pt; meters: number };

export type Mounting = "unspecified" | "ceiling" | "wall" | "floor";

export type RoutePrefs = {
  neighbors: 4 | 8;
  /** grid cell size in image pixels; 0 = automatic */
  cellPx: number;
  /** clearance from obstacles: meters when calibrated */
  clearanceM: number;
  /** clearance from obstacles: pixels when not calibrated */
  clearancePx: number;
  /** drawn wall thickness in image pixels (used for blocking) */
  wallThicknessPx: number;
  preferCorridors: boolean;
  /** cost multiplier for cells outside marked corridors (>= 1) */
  corridorPenalty: number;
  shareTrunk: boolean;
  smoothing: boolean;
  showAlternatives: boolean;
  mounting: Mounting;
};

export type SystemType = "3ph" | "1ph";

/** All numeric engineering inputs are strings so an empty field means "not entered". */
export type FeederInputs = {
  system: SystemType;
  voltage: string;
  ib: string;
  inom: string;
  iz: string;
  kTemp: string;
  kGroup: string;
  kOther: string;
  i2: string;
  cosPhi: string;
  rPerKm: string;
  xPerKm: string;
  verticalM: string;
  reservePct: string;
  useLengthOverride: boolean;
  lengthOverrideM: string;
  upstreamPct: string;
  downstreamPct: string;
  routeChoice: "A" | "B";
  cableNote: string;
};

export type Layers = {
  obstacles: boolean;
  corridors: boolean;
  routes: boolean;
  grid: boolean;
  labels: boolean;
  calibration: boolean;
};

export type ImageMeta = {
  source: "none" | "sample" | "upload";
  name: string;
  width: number;
  height: number;
};

export type Project = {
  version: 1;
  image: ImageMeta;
  calibration: Calibration | null;
  panels: Partial<Record<PanelKind, Pt>>;
  obstacles: Obstacle[];
  corridors: Corridor[];
  prefs: RoutePrefs;
  feeders: Record<SubKind, FeederInputs>;
  dropLimitPct: string;
  layers: Layers;
  obstaclesConfirmed: boolean;
  persistImage: boolean;
};

export type Tool =
  | "select"
  | "pan"
  | "calibrate"
  | "panel"
  | "rect"
  | "wall"
  | "zone"
  | "corridor";

export type Selection =
  | { kind: "obstacle"; id: string }
  | { kind: "corridor"; id: string }
  | { kind: "panel"; id: PanelKind }
  | null;