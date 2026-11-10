import { PANEL_META } from "@/lib/planner/defaults";
import { pointAlong } from "@/lib/planner/geometry";
import type { RoutesOutput } from "@/lib/planner/routing";
import { PANEL_KINDS, SUB_KINDS, type Project, type Pt, type Selection, type Tool } from "@/lib/planner/types";

export type Palette = {
  main: string;
  offices: string;
  warehouse: string;
  production: string;
  obstacle: string;
  wall: string;
  corridor: string;
  calib: string;
  select: string;
  halo: string;
  text: string;
  shared: string;
};

export const CSS_PALETTE: Palette = {
  main: "var(--panel-main)",
  offices: "var(--panel-offices)",
  warehouse: "var(--panel-warehouse)",
  production: "var(--panel-production)",
  obstacle: "var(--obstacle)",
  wall: "var(--wall)",
  corridor: "var(--corridor)",
  calib: "var(--info)",
  select: "var(--primary)",
  halo: "var(--canvas)",
  text: "var(--foreground)",
  shared: "var(--foreground)",
};

export type Draft =
  | { kind: "poly"; tool: "wall" | "zone" | "corridor"; points: Pt[] }
  | { kind: "rect"; a: Pt; b: Pt }
  | null;

type Props = {
  project: Project;
  routes: RoutesOutput;
  /** image pixels per screen pixel (1/zoom) so strokes stay readable */
  unit: number;
  palette: Palette;
  mode: "edit" | "preview" | "export";
  tool?: Tool;
  selection?: Selection;
  draft?: Draft;
  cursor?: Pt | null;
  calibPts?: Pt[];
  gridImage?: { href: string; w: number; h: number } | null;
  lengthUnit: (px: number) => string;
};

const ptsAttr = (pts: Pt[]) => pts.map((p) => `${p.x},${p.y}`).join(" ");

export function Overlay({
  project,
  routes,
  unit: u,
  palette: c,
  mode,
  tool,
  selection,
  draft,
  cursor,
  calibPts = [],
  gridImage,
  lengthUnit,
}: Props) {
  const { width: W, height: H } = project.image;
  const L = project.layers;
  const editing = mode === "edit";
  const hitable = editing && tool === "select";
  const isSel = (kind: "obstacle" | "corridor", id: string) =>
    selection?.kind === kind && selection.id === id;
  const textStyle = {
    paintOrder: "stroke" as const,
    stroke: c.halo,
    strokeWidth: 4 * u,
    strokeLinejoin: "round" as const,
  };
  const fontSize = 13 * u;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      fontFamily="IBM Plex Sans Hebrew, sans-serif"
    >
      {gridImage && L.grid && mode !== "export" && (
        <image
          href={gridImage.href}
          x={0}
          y={0}
          width={gridImage.w}
          height={gridImage.h}
          preserveAspectRatio="none"
          opacity={0.45}
          style={{ imageRendering: "pixelated", pointerEvents: "none" }}
        />
      )}

      {/* corridors */}
      {L.corridors &&
        project.corridors.map((co) => (
          <g key={co.id} data-hit={`corridor:${co.id}`} style={{ cursor: hitable ? "move" : undefined }}>
            <polyline
              points={ptsAttr(co.points)}
              fill="none"
              stroke={c.corridor}
              strokeOpacity={0.18}
              strokeWidth={Math.max(16 * u, 10)}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents={hitable ? "stroke" : "none"}
            />
            <polyline
              points={ptsAttr(co.points)}
              fill="none"
              stroke={isSel("corridor", co.id) ? c.select : c.corridor}
              strokeWidth={2 * u}
              strokeDasharray={`${8 * u} ${5 * u}`}
              pointerEvents="none"
            />
          </g>
        ))}

      {/* obstacles */}
      {L.obstacles &&
        project.obstacles.map((ob) => {
          const sel = isSel("obstacle", ob.id);
          const stroke = sel ? c.select : ob.type === "wall" ? c.wall : c.obstacle;
          const common = {
            "data-hit": `obstacle:${ob.id}`,
            style: { cursor: hitable ? "move" : undefined },
          };
          if (ob.type === "rect") {
            const x = Math.min(ob.x, ob.x + ob.w);
            const y = Math.min(ob.y, ob.y + ob.h);
            return (
              <rect
                key={ob.id}
                {...common}
                x={x}
                y={y}
                width={Math.abs(ob.w)}
                height={Math.abs(ob.h)}
                fill={c.obstacle}
                fillOpacity={mode === "preview" ? 0.12 : 0.22}
                stroke={stroke}
                strokeWidth={(sel ? 3 : 1.5) * u}
                strokeDasharray={`${6 * u} ${3 * u}`}
                pointerEvents={hitable ? "all" : "none"}
              />
            );
          }
          if (ob.type === "zone") {
            return (
              <polygon
                key={ob.id}
                {...common}
                points={ptsAttr(ob.points)}
                fill={c.obstacle}
                fillOpacity={mode === "preview" ? 0.12 : 0.22}
                stroke={stroke}
                strokeWidth={(sel ? 3 : 1.5) * u}
                pointerEvents={hitable ? "all" : "none"}
              />
            );
          }
          return (
            <g key={ob.id} {...common}>
              <polyline
                points={ptsAttr(ob.points)}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(12 * u, project.prefs.wallThicknessPx)}
                pointerEvents={hitable ? "stroke" : "none"}
              />
              <polyline
                points={ptsAttr(ob.points)}
                fill="none"
                stroke={stroke}
                strokeOpacity={mode === "preview" ? 0.55 : 0.95}
                strokeWidth={Math.max((sel ? 4 : 2.5) * u, project.prefs.wallThicknessPx)}
                strokeLinecap="square"
                strokeLinejoin="miter"
                pointerEvents="none"
              />
            </g>
          );
        })}

      {/* routes */}
      {L.routes && (
        <g pointerEvents="none">
          {routes.shared.segments.map((seg, i) => (
            <polyline
              key={`sh${i}`}
              points={ptsAttr(seg)}
              fill="none"
              stroke={c.shared}
              strokeOpacity={0.25}
              strokeWidth={12 * u}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {SUB_KINDS.map((k) => {
            const { A, B } = routes.byKind[k];
            const col = c[k];
            const choice = project.feeders[k].routeChoice;
            return (
              <g key={k}>
                {B && B.status === "ok" && (
                  <polyline
                    points={ptsAttr(B.points)}
                    fill="none"
                    stroke={col}
                    strokeOpacity={choice === "B" ? 0.95 : 0.55}
                    strokeWidth={(choice === "B" ? 3.5 : 2) * u}
                    strokeDasharray={`${3 * u} ${5 * u}`}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {A.status === "ok" && (
                  <>
                    <polyline
                      points={ptsAttr(A.points)}
                      fill="none"
                      stroke={c.halo}
                      strokeWidth={7 * u}
                      strokeOpacity={0.7}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <polyline
                      points={ptsAttr(A.points)}
                      fill="none"
                      stroke={col}
                      strokeOpacity={choice === "A" ? 1 : 0.6}
                      strokeWidth={(choice === "A" ? 3.5 : 2.2) * u}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {[A.startConnector, A.endConnector].map(
                      (cn, i) =>
                        cn && (
                          <polyline
                            key={i}
                            points={ptsAttr(cn)}
                            fill="none"
                            stroke={col}
                            strokeWidth={2 * u}
                            strokeDasharray={`${2 * u} ${3 * u}`}
                          />
                        ),
                    )}
                  </>
                )}
                {L.labels &&
                  [A, B].map((r) => {
                    if (!r || r.status !== "ok" || r.points.length < 2) return null;
                    const p = pointAlong(r.points, r.variant === "A" ? 0.55 : 0.4);
                    return (
                      <text
                        key={r.variant}
                        x={p.x}
                        y={p.y - 8 * u}
                        fontSize={fontSize}
                        fill={col}
                        textAnchor="middle"
                        fontWeight={600}
                        style={textStyle}
                      >
                        {`${PANEL_META[k].short} ${r.variant === "B" ? "(ב׳)" : ""} ${lengthUnit(r.lengthPx)}`}
                      </text>
                    );
                  })}
              </g>
            );
          })}
        </g>
      )}

      {/* calibration */}
      {L.calibration && project.calibration && (
        <g pointerEvents="none">
          <line
            x1={project.calibration.a.x}
            y1={project.calibration.a.y}
            x2={project.calibration.b.x}
            y2={project.calibration.b.y}
            stroke={c.calib}
            strokeWidth={2 * u}
            strokeDasharray={`${4 * u} ${3 * u}`}
          />
          {[project.calibration.a, project.calibration.b].map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={4 * u} fill={c.calib} />
          ))}
          <text
            x={(project.calibration.a.x + project.calibration.b.x) / 2}
            y={(project.calibration.a.y + project.calibration.b.y) / 2 - 8 * u}
            fontSize={fontSize}
            fill={c.calib}
            textAnchor="middle"
            style={textStyle}
          >
            {`כיול: ${project.calibration.meters} מ׳`}
          </text>
        </g>
      )}

      {/* panels */}
      {PANEL_KINDS.map((k) => {
        const p = project.panels[k];
        if (!p) return null;
        const col = c[k];
        const s = k === "main" ? 11 : 9;
        return (
          <g
            key={k}
            data-hit={`panel:${k}`}
            style={{ cursor: hitable ? "grab" : undefined }}
            pointerEvents={hitable ? "all" : "none"}
          >
            <rect
              x={p.x - s * u}
              y={p.y - s * u}
              width={2 * s * u}
              height={2 * s * u}
              rx={2 * u}
              fill={col}
              stroke={selection?.kind === "panel" && selection.id === k ? c.select : c.halo}
              strokeWidth={2.5 * u}
            />
            {k === "main" && (
              <path
                d={`M ${p.x + 1.5 * u} ${p.y - 7 * u} L ${p.x - 4 * u} ${p.y + 1 * u} L ${p.x} ${p.y + 1 * u} L ${p.x - 1.5 * u} ${p.y + 7 * u} L ${p.x + 4 * u} ${p.y - 1 * u} L ${p.x} ${p.y - 1 * u} Z`}
                fill={c.halo}
              />
            )}
            {L.labels && (
              <text
                x={p.x}
                y={p.y + (s + 15) * u}
                fontSize={fontSize}
                fontWeight={700}
                fill={col}
                textAnchor="middle"
                style={textStyle}
              >
                {PANEL_META[k].label}
              </text>
            )}
          </g>
        );
      })}

      {/* drafts */}
      {editing && draft?.kind === "rect" && (
        <rect
          x={Math.min(draft.a.x, draft.b.x)}
          y={Math.min(draft.a.y, draft.b.y)}
          width={Math.abs(draft.b.x - draft.a.x)}
          height={Math.abs(draft.b.y - draft.a.y)}
          fill={c.obstacle}
          fillOpacity={0.2}
          stroke={c.select}
          strokeWidth={2 * u}
          strokeDasharray={`${5 * u} ${3 * u}`}
          pointerEvents="none"
        />
      )}
      {editing && draft?.kind === "poly" && draft.points.length > 0 && (
        <g pointerEvents="none">
          <polyline
            points={ptsAttr(cursor ? [...draft.points, cursor] : draft.points)}
            fill={draft.tool === "zone" ? c.obstacle : "none"}
            fillOpacity={0.15}
            stroke={draft.tool === "corridor" ? c.corridor : c.select}
            strokeWidth={2.5 * u}
            strokeDasharray={`${5 * u} ${3 * u}`}
          />
          {draft.points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={4 * u} fill={c.select} />
          ))}
        </g>
      )}
      {editing && tool === "calibrate" && calibPts.length > 0 && (
        <g pointerEvents="none">
          {calibPts.length === 1 && cursor && (
            <line
              x1={calibPts[0].x}
              y1={calibPts[0].y}
              x2={cursor.x}
              y2={cursor.y}
              stroke={c.calib}
              strokeWidth={2 * u}
              strokeDasharray={`${4 * u} ${3 * u}`}
            />
          )}
          {calibPts.length === 2 && (
            <line
              x1={calibPts[0].x}
              y1={calibPts[0].y}
              x2={calibPts[1].x}
              y2={calibPts[1].y}
              stroke={c.calib}
              strokeWidth={2.5 * u}
            />
          )}
          {calibPts.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={6 * u} fill="none" stroke={c.calib} strokeWidth={2 * u} />
              <line x1={p.x - 10 * u} y1={p.y} x2={p.x + 10 * u} y2={p.y} stroke={c.calib} strokeWidth={1 * u} />
              <line x1={p.x} y1={p.y - 10 * u} x2={p.x} y2={p.y + 10 * u} stroke={c.calib} strokeWidth={1 * u} />
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}