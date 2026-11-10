import { Check, Maximize, Minus, Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectStore } from "@/hooks/use-project";
import { PANEL_META } from "@/lib/planner/defaults";
import { dist, snapAngle, uid } from "@/lib/planner/geometry";
import type { Grid } from "@/lib/planner/grid";
import type { RoutesOutput } from "@/lib/planner/routing";
import type { PanelKind, Pt, Selection, Tool } from "@/lib/planner/types";

import { CSS_PALETTE, Overlay, type Draft } from "./Overlay";

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 12;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

type DragState =
  | { type: "pan"; sx: number; sy: number; ox: number; oy: number; moved: boolean }
  | { type: "panel"; kind: PanelKind; dx: number; dy: number; moved: boolean }
  | { type: "move"; target: "obstacle" | "corridor"; id: string; last: Pt; moved: boolean }
  | { type: "rect"; a: Pt }
  | null;

type Props = {
  store: ProjectStore;
  routes: RoutesOutput;
  grid: Grid | null;
  tool: Tool;
  setTool: (t: Tool) => void;
  panelKind: PanelKind;
  setPanelKind: (k: PanelKind) => void;
  selection: Selection;
  setSelection: (s: Selection) => void;
  mode: "edit" | "preview";
  lengthUnit: (px: number) => string;
  ppm: number | null;
  fitSignal: number;
};

export function PlanCanvas({
  store,
  routes,
  grid,
  tool,
  setTool,
  panelKind,
  setPanelKind,
  selection,
  setSelection,
  mode,
  lengthUnit,
  ppm,
  fitSignal,
}: Props) {
  const { project, update, checkpoint, imageUrl } = store;
  const { width: W, height: H } = project.image;
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [draft, setDraftState] = useState<Draft>(null);
  const draftRef = useRef<Draft>(null);
  const setDraft = useCallback((d: Draft) => {
    draftRef.current = d;
    setDraftState(d);
  }, []);
  const [calibPts, setCalibPts] = useState<Pt[]>([]);
  const [calibMeters, setCalibMeters] = useState("");
  const [spaceDown, setSpaceDown] = useState(false);
  const [gridImage, setGridImage] = useState<{ href: string; w: number; h: number } | null>(null);
  const drag = useRef<DragState>(null);
  const editing = mode === "edit";

  // ---------- view fitting
  const fit = useCallback(() => {
    const el = containerRef.current;
    if (!el || !W || !H) return;
    const r = el.getBoundingClientRect();
    const z = clamp(Math.min((r.width - 40) / W, (r.height - 40) / H), MIN_ZOOM, MAX_ZOOM);
    setView({ zoom: z, x: (r.width - W * z) / 2, y: (r.height - H * z) / 2 });
  }, [W, H]);

  useEffect(() => {
    fit();
  }, [fit, imageUrl, fitSignal]);

  // ---------- coordinate mapping (screen -> image pixels)
  const toImage = useCallback((clientX: number, clientY: number): Pt => {
    const el = containerRef.current!;
    const r = el.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - r.left - v.x) / v.zoom, y: (clientY - r.top - v.y) / v.zoom };
  }, []);

  const zoomAt = useCallback((factor: number, px: number, py: number) => {
    setView((v) => {
      const next = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM);
      const k = next / v.zoom;
      return { zoom: next, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });
  }, []);

  // native non-passive wheel listener (prevents page scroll / browser pinch zoom)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      zoomAt(Math.exp(-dy * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // ---------- grid visualisation
  useEffect(() => {
    if (!grid || !project.layers.grid) {
      setGridImage(null);
      return;
    }
    const cv = document.createElement("canvas");
    cv.width = grid.cols;
    cv.height = grid.rows;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(grid.cols, grid.rows);
    for (let i = 0; i < grid.cols * grid.rows; i++) {
      const o = i * 4;
      if (grid.blocked[i]) {
        img.data[o] = 230;
        img.data[o + 1] = 70;
        img.data[o + 2] = 70;
        img.data[o + 3] = 170;
      } else if (grid.corridor[i]) {
        img.data[o] = 60;
        img.data[o + 1] = 200;
        img.data[o + 2] = 200;
        img.data[o + 3] = 70;
      }
    }
    ctx.putImageData(img, 0, 0);
    setGridImage({ href: cv.toDataURL(), w: grid.cols * grid.cell, h: grid.rows * grid.cell });
  }, [grid, project.layers.grid]);

  // ---------- drafts
  const cancelDraft = useCallback(() => {
    setDraft(null);
    setCalibPts([]);
    setCalibMeters("");
  }, [setDraft]);

  useEffect(() => {
    cancelDraft();
  }, [tool, cancelDraft]);

  const finishPoly = useCallback(() => {
    const d = draftRef.current;
    if (!d || d.kind !== "poly") return;
    const need = d.tool === "zone" ? 3 : 2;
    if (d.points.length < need) {
      toast.message(d.tool === "zone" ? "אזור דורש לפחות 3 נקודות" : "נדרשות לפחות 2 נקודות");
      return;
    }
    const pts = d.points;
    if (d.tool === "corridor") {
      update((p) => ({ ...p, corridors: [...p.corridors, { id: uid("cor"), points: pts }] }));
    } else {
      const type = d.tool;
      update((p) => ({ ...p, obstacles: [...p.obstacles, { id: uid(type), type, points: pts }] }));
    }
    setDraft(null);
  }, [update, setDraft]);

  const deleteSelection = useCallback(() => {
    if (!selection) return;
    if (selection.kind === "obstacle") {
      update((p) => ({ ...p, obstacles: p.obstacles.filter((o) => o.id !== selection.id) }));
    } else if (selection.kind === "corridor") {
      update((p) => ({ ...p, corridors: p.corridors.filter((o) => o.id !== selection.id) }));
    } else if (selection.kind === "panel") {
      update((p) => {
        const panels = { ...p.panels };
        delete panels[selection.id];
        return { ...p, panels };
      });
    }
    setSelection(null);
  }, [selection, update, setSelection]);

  // ---------- keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.key === "Escape") {
        if (draft || calibPts.length) cancelDraft();
        else if (tool !== "select") setTool("select");
        else setSelection(null);
        (document.activeElement as HTMLElement | null)?.blur?.();
        return;
      }
      if (typing) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        store.redo();
        return;
      }
      if (e.key === "Enter" && draft?.kind === "poly") {
        e.preventDefault();
        finishPoly();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selection && editing) {
        e.preventDefault();
        deleteSelection();
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        setSpaceDown(true);
        return;
      }
      if (mod || !editing) return;
      const map: Record<string, Tool> = {
        v: "select",
        h: "pan",
        c: "calibrate",
        p: "panel",
        r: "rect",
        w: "wall",
        a: "zone",
        k: "corridor",
      };
      const nt = map[e.key.toLowerCase()];
      if (nt) setTool(nt);
      if (["1", "2", "3", "4"].includes(e.key)) {
        const kinds: PanelKind[] = ["main", "offices", "warehouse", "production"];
        setPanelKind(kinds[Number(e.key) - 1]);
        setTool("panel");
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === " ") setSpaceDown(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
    };
  }, [draft, calibPts, tool, selection, editing, cancelDraft, finishPoly, deleteSelection, setTool, setSelection, setPanelKind, store]);

  // ---------- pointer handling
  const onPointerDown = (e: React.PointerEvent) => {
    if (!W) return;
    const el = containerRef.current!;
    const p = toImage(e.clientX, e.clientY);
    const panMode = e.button === 1 || spaceDown || tool === "pan" || !editing;
    if (panMode || e.button !== 0) {
      if (e.button === 2) return;
      el.setPointerCapture(e.pointerId);
      drag.current = { type: "pan", sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y, moved: false };
      return;
    }
    el.setPointerCapture(e.pointerId);

    if (tool === "select") {
      const hit = (e.target as Element).closest("[data-hit]")?.getAttribute("data-hit");
      if (hit) {
        const [kind, id] = hit.split(":");
        if (kind === "panel") {
          const pos = project.panels[id as PanelKind]!;
          setSelection({ kind: "panel", id: id as PanelKind });
          drag.current = { type: "panel", kind: id as PanelKind, dx: pos.x - p.x, dy: pos.y - p.y, moved: false };
        } else if (kind === "obstacle" || kind === "corridor") {
          setSelection({ kind, id });
          drag.current = { type: "move", target: kind, id, last: p, moved: false };
        }
        return;
      }
      drag.current = { type: "pan", sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y, moved: false };
      return;
    }

    if (tool === "calibrate") {
      if (calibPts.length >= 2) return;
      const q = e.shiftKey && calibPts.length === 1 ? snapAngle(calibPts[0], p) : p;
      setCalibPts((c) => [...c, q]);
      return;
    }
    if (tool === "panel") {
      update((pr) => ({ ...pr, panels: { ...pr.panels, [panelKind]: p } }));
      // auto-advance to the next unplaced panel to speed up setup
      const order: PanelKind[] = ["main", "offices", "warehouse", "production"];
      const nextKind = order.find((k) => k !== panelKind && !project.panels[k]);
      if (nextKind) setPanelKind(nextKind);
      return;
    }
    if (tool === "rect") {
      drag.current = { type: "rect", a: p };
      setDraft({ kind: "rect", a: p, b: p });
      return;
    }
    if (tool === "wall" || tool === "zone" || tool === "corridor") {
      const d = draftRef.current;
      const pts = d?.kind === "poly" ? d.points : [];
      const last = pts[pts.length - 1];
      const q = e.shiftKey && last ? snapAngle(last, p) : p;
      // clicking on the last point again (double click) finishes
      if (last && dist(last, q) * view.zoom < 6) {
        finishPoly();
        return;
      }
      setDraft({ kind: "poly", tool, points: [...pts, q] });
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!W) return;
    const p = toImage(e.clientX, e.clientY);
    const d = drag.current;
    if (draft?.kind === "poly" && e.shiftKey && draft.points.length) {
      setCursor(snapAngle(draft.points[draft.points.length - 1], p));
    } else if (tool === "calibrate" && e.shiftKey && calibPts.length === 1) {
      setCursor(snapAngle(calibPts[0], p));
    } else setCursor(p);
    if (!d) return;
    if (d.type === "pan") {
      if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3) d.moved = true;
      setView((v) => ({ ...v, x: d.ox + e.clientX - d.sx, y: d.oy + e.clientY - d.sy }));
    } else if (d.type === "panel") {
      if (!d.moved) {
        checkpoint();
        d.moved = true;
      }
      const np = { x: clamp(p.x + d.dx, 0, W), y: clamp(p.y + d.dy, 0, H) };
      update((pr) => ({ ...pr, panels: { ...pr.panels, [d.kind]: np } }), false);
    } else if (d.type === "move") {
      const dx = p.x - d.last.x;
      const dy = p.y - d.last.y;
      if (!d.moved) {
        if (Math.hypot(dx, dy) * view.zoom < 3) return;
        checkpoint();
        d.moved = true;
      }
      d.last = p;
      const mv = (q: Pt) => ({ x: q.x + dx, y: q.y + dy });
      if (d.target === "obstacle") {
        update(
          (pr) => ({
            ...pr,
            obstacles: pr.obstacles.map((o) =>
              o.id !== d.id ? o : o.type === "rect" ? { ...o, x: o.x + dx, y: o.y + dy } : { ...o, points: o.points.map(mv) },
            ),
          }),
          false,
        );
      } else {
        update(
          (pr) => ({
            ...pr,
            corridors: pr.corridors.map((o) => (o.id !== d.id ? o : { ...o, points: o.points.map(mv) })),
          }),
          false,
        );
      }
    } else if (d.type === "rect") {
      setDraft({ kind: "rect", a: d.a, b: p });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    try {
      containerRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (!d) return;
    if (d.type === "pan" && !d.moved && tool === "select") setSelection(null);
    if (d.type === "rect") {
      const b = toImage(e.clientX, e.clientY);
      const w = b.x - d.a.x;
      const h = b.y - d.a.y;
      setDraft(null);
      if (Math.abs(w) * view.zoom < 4 || Math.abs(h) * view.zoom < 4) {
        toast.message("גררו כדי לסמן מלבן");
        return;
      }
      update((p) => ({
        ...p,
        obstacles: [
          ...p.obstacles,
          {
            id: uid("rect"),
            type: "rect",
            x: Math.min(d.a.x, b.x),
            y: Math.min(d.a.y, b.y),
            w: Math.abs(w),
            h: Math.abs(h),
          },
        ],
      }));
    }
  };

  const saveCalibration = () => {
    const m = Number(calibMeters.replace(",", "."));
    if (!(m > 0) || calibPts.length !== 2) {
      toast.error("הזינו אורך חיובי במטרים");
      return;
    }
    if (dist(calibPts[0], calibPts[1]) < 2) {
      toast.error("הנקודות קרובות מדי");
      return;
    }
    update((p) => ({ ...p, calibration: { a: calibPts[0], b: calibPts[1], meters: m } }));
    toast.success("קנה המידה נשמר");
    cancelDraft();
    setTool("select");
  };

  const cursorClass =
    drag.current?.type === "pan" || spaceDown || tool === "pan" || !editing
      ? "cursor-grab active:cursor-grabbing"
      : tool === "select"
        ? "cursor-default"
        : "cursor-crosshair";

  const hint: Record<Tool, string> = {
    select: "לחצו לבחירה, גררו לוח/מכשול להזזה, גררו רקע להזזת התצוגה. Delete למחיקה",
    pan: "גררו להזזת התצוגה. גלגלת לזום",
    calibrate:
      calibPts.length === 0
        ? "כיול: לחצו על נקודה ראשונה של מידה ידועה"
        : calibPts.length === 1
          ? "כיול: לחצו על הנקודה השנייה (Shift ליישור)"
          : "הזינו את האורך האמיתי במטרים",
    panel: `לחצו למיקום: ${PANEL_META[panelKind].label}`,
    rect: "גררו לסימון אזור אסור מלבני",
    wall: "לחצו נקודות לקיר. Enter / לחיצה כפולה לסיום, Esc לביטול, Shift ליישור",
    zone: "לחצו נקודות לפוליגון אסור. Enter לסיום (3 נקודות לפחות)",
    corridor: "לחצו נקודות לציר מסדרון מועדף. Enter לסיום",
  };

  return (
    <div className="relative h-full w-full overflow-hidden" dir="ltr">
      <div
        ref={containerRef}
        className={`canvas-backdrop absolute inset-0 touch-none select-none ${cursorClass}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setCursor(null)}
        onContextMenu={(e) => {
          e.preventDefault();
          if (draft?.kind === "poly") finishPoly();
        }}
        role="application"
        aria-label="אזור שרטוט"
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: W,
            height: H,
            transformOrigin: "0 0",
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
          }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="תוכנית"
              draggable={false}
              width={W}
              height={H}
              style={{ position: "absolute", left: 0, top: 0, width: W, height: H, maxWidth: "none" }}
            />
          ) : (
            <div className="absolute inset-0 border-2 border-dashed border-border" />
          )}
          <Overlay
            project={project}
            routes={routes}
            unit={1 / view.zoom}
            palette={CSS_PALETTE}
            mode={mode}
            tool={tool}
            selection={selection}
            draft={draft}
            cursor={cursor}
            calibPts={calibPts}
            gridImage={gridImage}
            lengthUnit={lengthUnit}
          />
        </div>
      </div>

      {/* zoom controls */}
      <div className="panel-surface absolute bottom-3 left-3 flex items-center gap-1 p-1">
        <Button size="icon" variant="ghost" aria-label="הקטנה" onClick={() => {
          const r = containerRef.current!.getBoundingClientRect();
          zoomAt(1 / 1.25, r.width / 2, r.height / 2);
        }}>
          <Minus />
        </Button>
        <span className="ltr-num w-14 text-center text-xs">{Math.round(view.zoom * 100)}%</span>
        <Button size="icon" variant="ghost" aria-label="הגדלה" onClick={() => {
          const r = containerRef.current!.getBoundingClientRect();
          zoomAt(1.25, r.width / 2, r.height / 2);
        }}>
          <Plus />
        </Button>
        <Button size="icon" variant="ghost" aria-label="התאמה למסך" onClick={fit}>
          <Maximize />
        </Button>
      </div>

      {/* status line */}
      <div className="panel-surface absolute bottom-3 right-3 flex max-w-[60%] items-center gap-3 px-3 py-1.5 text-xs" dir="rtl">
        <span className="text-muted-foreground">{editing ? hint[tool] : "מצב תצוגה מקדימה — העריכה נעולה"}</span>
        {cursor && (
          <span className="ltr-num shrink-0 text-foreground">
            x {cursor.x.toFixed(0)} · y {cursor.y.toFixed(0)} px
            {ppm ? ` · (${(cursor.x / ppm).toFixed(2)}, ${(cursor.y / ppm).toFixed(2)}) m` : ""}
          </span>
        )}
      </div>

      {/* calibration input */}
      {tool === "calibrate" && calibPts.length === 2 && (
        <div className="panel-surface absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 p-2" dir="rtl">
          <span className="text-sm">אורך אמיתי:</span>
          <span className="ltr-num text-xs text-muted-foreground">
            {dist(calibPts[0], calibPts[1]).toFixed(1)} px =
          </span>
          <Input
            autoFocus
            dir="ltr"
            inputMode="decimal"
            className="ltr-num h-8 w-24"
            placeholder="m"
            value={calibMeters}
            onChange={(e) => setCalibMeters(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveCalibration();
            }}
          />
          <span className="text-sm">מ׳</span>
          <Button size="sm" onClick={saveCalibration}>
            <Check /> שמירה
          </Button>
          <Button size="sm" variant="ghost" onClick={cancelDraft}>
            <X /> ביטול
          </Button>
        </div>
      )}
    </div>
  );
}