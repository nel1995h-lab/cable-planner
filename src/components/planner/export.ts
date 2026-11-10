import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import type { RoutesOutput } from "@/lib/planner/routing";
import { SUB_KINDS, type Project } from "@/lib/planner/types";

import { Overlay, type Palette } from "./Overlay";

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadJson(data: unknown, name: string) {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), name);
}

function resolvedPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim() || "#ffffff";
  return {
    main: v("--panel-main"),
    offices: v("--panel-offices"),
    warehouse: v("--panel-warehouse"),
    production: v("--panel-production"),
    obstacle: v("--obstacle"),
    wall: v("--wall"),
    corridor: v("--corridor"),
    calib: v("--info"),
    select: v("--primary"),
    halo: v("--canvas"),
    text: v("--foreground"),
    shared: v("--foreground"),
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("image load failed"));
    img.src = src;
  });
}

/** Rasterise the plan image + current overlay (routes, panels, obstacles) into a PNG. */
export async function exportOverlayPng(
  project: Project,
  routes: RoutesOutput,
  imageUrl: string | null,
  lengthUnit: (px: number) => string,
) {
  const { width: W, height: H } = project.image;
  const host = document.createElement("div");
  const root = createRoot(host);
  const unit = Math.max(1, Math.max(W, H) / 1400);
  flushSync(() => {
    root.render(
      createElement(Overlay, {
        project,
        routes,
        unit,
        palette: resolvedPalette(),
        mode: "export",
        lengthUnit,
      }),
    );
  });
  const svgEl = host.querySelector("svg");
  const svgText = svgEl ? new XMLSerializer().serializeToString(svgEl) : "";
  root.unmount();

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--canvas") || "#000";
  ctx.fillRect(0, 0, W, H);
  if (imageUrl) ctx.drawImage(await loadImage(imageUrl), 0, 0, W, H);
  const svgUrl = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
  try {
    ctx.drawImage(await loadImage(svgUrl), 0, 0, W, H);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
  // footer disclaimer stamped on the export
  const fs = Math.max(12, Math.round(unit * 13));
  ctx.font = `${fs}px sans-serif`;
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  const msg = "Cable Planner — הצעה גאומטרית בלבד, לא תכנון מאושר";
  const tw = ctx.measureText(msg).width;
  ctx.fillStyle = "rgba(10,18,30,0.75)";
  ctx.fillRect(W - tw - fs * 1.5, H - fs * 2, tw + fs, fs * 1.6);
  ctx.fillStyle = "#e6edf5";
  ctx.fillText(msg, W - fs, H - fs * 0.8);

  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("PNG export failed");
  downloadBlob(blob, "cable-planner-overlay.png");
}

export function routesJson(project: Project, routes: RoutesOutput, ppm: number | null) {
  return {
    app: "Cable Planner",
    kind: "routes",
    exportedAt: new Date().toISOString(),
    status: "geometric-suggestion-not-engineering-approved",
    imageSize: { width: project.image.width, height: project.image.height },
    coordinateUnits: "image pixels (origin top-left)",
    pixelsPerMeter: ppm,
    calibrated: ppm != null,
    prefs: project.prefs,
    assumptions: [
      "2D routing on manually marked obstacles only",
      "No height, penetration or 3D information is used",
      "Mounting preference is a label only",
    ],
    panels: project.panels,
    routes: SUB_KINDS.map((k) => {
      const { A, B } = routes.byKind[k];
      const pack = (r: typeof A | null) =>
        r && {
          variant: r.variant,
          status: r.status,
          method: r.method,
          message: r.message,
          points: r.points.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]),
          startConnector: r.startConnector,
          endConnector: r.endConnector,
          lengthPx: r.lengthPx,
          lengthM: r.lengthM,
        };
      return { feeder: k, selected: project.feeders[k].routeChoice, A: pack(A), B: pack(B) };
    }),
    sharedTrunk: { lengthPx: routes.shared.lengthPx, lengthM: routes.shared.lengthM },
  };
}