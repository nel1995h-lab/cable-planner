import { createEmptyProject } from "./defaults";
import type { Obstacle, Project } from "./types";

export const SAMPLE_W = 1600;
export const SAMPLE_H = 1020;

/**
 * A fully synthetic schematic generated in code. It does not represent any real
 * building or the user's drawing; its scale bar is a demo value only.
 */
export function sampleSvg(): string {
  const wall = "#9fb3c8";
  const thin = "#55708c";
  const txt = "#c9d6e3";
  const muted = "#7f95ab";
  const hatch = `<pattern id="h" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="14" stroke="${thin}" stroke-width="3"/></pattern>`;
  const lines: [number, number, number, number][] = [
    // outer
    [80, 80, 1520, 80],
    [1520, 80, 1520, 940],
    [1520, 940, 80, 940],
    [80, 940, 80, 80],
    // offices/warehouse | corridor (doors 360-440, 1000-1080)
    [80, 500, 360, 500],
    [440, 500, 1000, 500],
    [1080, 500, 1520, 500],
    // offices / warehouse
    [650, 80, 650, 500],
    // corridor | bottom (doors 200-280, 900-980)
    [80, 650, 200, 650],
    [280, 650, 900, 650],
    [980, 650, 1520, 650],
    // electrical room / production
    [380, 650, 380, 940],
  ];
  const wallSvg = lines
    .map(
      ([x1, y1, x2, y2]) =>
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${wall}" stroke-width="8" stroke-linecap="square"/>`,
    )
    .join("");
  // office partitions (drawn only, intentionally NOT pre-marked as obstacles)
  const partitions = [
    [80, 300, 260, 300],
    [340, 300, 650, 300],
    [360, 80, 360, 300],
  ]
    .map(
      ([x1, y1, x2, y2]) =>
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${thin}" stroke-width="4"/>`,
    )
    .join("");
  const label = (x: number, y: number, t: string, size = 26, color = txt) =>
    `<text x="${x}" y="${y}" fill="${color}" font-family="sans-serif" font-size="${size}" text-anchor="middle">${t}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SAMPLE_W}" height="${SAMPLE_H}" viewBox="0 0 ${SAMPLE_W} ${SAMPLE_H}">
<defs>${hatch}<pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#1d2c40" stroke-width="1"/></pattern></defs>
<rect width="100%" height="100%" fill="#0f1a2a"/>
<rect width="100%" height="100%" fill="url(#g)"/>
<rect x="80" y="80" width="1440" height="860" fill="#132236"/>
<rect x="80" y="500" width="1440" height="150" fill="#16293f"/>
<rect x="760" y="180" width="640" height="70" fill="url(#h)" stroke="${thin}" stroke-width="3"/>
<rect x="760" y="330" width="640" height="70" fill="url(#h)" stroke="${thin}" stroke-width="3"/>
<rect x="700" y="720" width="500" height="140" fill="url(#h)" stroke="${thin}" stroke-width="3"/>
${partitions}
${wallSvg}
${label(365, 460, "משרדים")}
${label(1085, 460, "מחסן")}
${label(1080, 300, "מדפים", 20, muted)}
${label(800, 585, "מסדרון")}
${label(230, 900, "חדר חשמל", 22)}
${label(1000, 915, "אולם ייצור")}
${label(950, 798, "אזור מכונות", 20, muted)}
<line x1="100" y1="985" x2="500" y2="985" stroke="${txt}" stroke-width="4"/>
<line x1="100" y1="972" x2="100" y2="998" stroke="${txt}" stroke-width="4"/>
<line x1="500" y1="972" x2="500" y2="998" stroke="${txt}" stroke-width="4"/>
${label(300, 970, "סרגל דוגמה: 20 מ׳ (ערך סינתטי לבדיקה בלבד)", 18)}
${label(1180, 1000, "שרטוט סכמטי סינתטי לדוגמה — אינו תוכנית אמיתית", 18, muted)}
</svg>`;
  return svg;
}

export function sampleDataUrl(): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sampleSvg())}`;
}

/** Demo markings matching the synthetic drawing (user can edit/delete all of them). */
export function sampleProject(): Project {
  const p = createEmptyProject();
  const w = (id: string, pts: [number, number][], label: string): Obstacle => ({
    id,
    type: "wall",
    points: pts.map(([x, y]) => ({ x, y })),
    label,
  });
  p.image = { source: "sample", name: "שרטוט דוגמה סינתטי", width: SAMPLE_W, height: SAMPLE_H };
  p.obstacles = [
    w(
      "s_outer",
      [
        [80, 80],
        [1520, 80],
        [1520, 940],
        [80, 940],
        [80, 80],
      ],
      "קיר חיצוני (דוגמה)",
    ),
    w("s_w1", [[80, 500], [360, 500]], "קיר (דוגמה)"),
    w("s_w2", [[440, 500], [1000, 500]], "קיר (דוגמה)"),
    w("s_w3", [[1080, 500], [1520, 500]], "קיר (דוגמה)"),
    w("s_w4", [[650, 80], [650, 500]], "קיר (דוגמה)"),
    w("s_w5", [[80, 650], [200, 650]], "קיר (דוגמה)"),
    w("s_w6", [[280, 650], [900, 650]], "קיר (דוגמה)"),
    w("s_w7", [[980, 650], [1520, 650]], "קיר (דוגמה)"),
    w("s_w8", [[380, 650], [380, 940]], "קיר (דוגמה)"),
    { id: "s_r1", type: "rect", x: 760, y: 180, w: 640, h: 70, label: "מדפים (דוגמה)" },
    { id: "s_r2", type: "rect", x: 760, y: 330, w: 640, h: 70, label: "מדפים (דוגמה)" },
    { id: "s_r3", type: "rect", x: 700, y: 720, w: 500, h: 140, label: "אזור מכונות (דוגמה)" },
  ];
  p.panels = {
    main: { x: 160, y: 820 },
    offices: { x: 180, y: 400 },
    warehouse: { x: 1440, y: 440 },
    production: { x: 1430, y: 800 },
  };
  p.corridors = [
    {
      id: "s_c1",
      points: [
        { x: 120, y: 575 },
        { x: 1480, y: 575 },
      ],
      label: "מסדרון (דוגמה)",
    },
  ];
  p.persistImage = false;
  return p;
}