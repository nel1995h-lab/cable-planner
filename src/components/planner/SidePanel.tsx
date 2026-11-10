import {
  Box,
  Eye,
  FileJson,
  Hand,
  ImageDown,
  Minus as LineIcon,
  MousePointer2,
  Pencil,
  Redo2,
  Route,
  Ruler,
  Spline,
  Square,
  Trash2,
  Undo2,
  Waypoints,
  Zap,
} from "lucide-react";
import type { ComponentType } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProjectStore } from "@/hooks/use-project";
import { FEEDER_LABEL, PANEL_META } from "@/lib/planner/defaults";
import { dist } from "@/lib/planner/geometry";
import type { Grid } from "@/lib/planner/grid";
import type { RoutesOutput } from "@/lib/planner/routing";
import {
  PANEL_KINDS,
  SUB_KINDS,
  type Layers,
  type Mounting,
  type PanelKind,
  type RoutePrefs,
  type Selection,
  type Tool,
} from "@/lib/planner/types";
import { cn } from "@/lib/utils";

import { Section, StatusBadge, Sym } from "./bits";

const TOOLS: { id: Tool; label: string; key: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "select", label: "בחירה / הזזה", key: "V", icon: MousePointer2 },
  { id: "pan", label: "הזזת תצוגה", key: "H", icon: Hand },
  { id: "calibrate", label: "כיול קנה מידה", key: "C", icon: Ruler },
  { id: "panel", label: "מיקום לוח", key: "P", icon: Zap },
  { id: "rect", label: "אזור אסור מלבני", key: "R", icon: Square },
  { id: "wall", label: "קיר (קו שבור)", key: "W", icon: LineIcon },
  { id: "zone", label: "אזור אסור פוליגון", key: "A", icon: Box },
  { id: "corridor", label: "מסדרון מועדף", key: "K", icon: Spline },
];

const LAYER_LABEL: Record<keyof Layers, string> = {
  obstacles: "מכשולים",
  corridors: "מסדרונות",
  routes: "תוואים",
  labels: "תוויות",
  calibration: "קו כיול",
  grid: "רשת חסימה (דיבאג)",
};

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
  setMode: (m: "edit" | "preview") => void;
  ppm: number | null;
  lengthUnit: (px: number) => string;
  onExportPng: () => void;
  onExportRoutes: () => void;
};

export function SidePanel(props: Props) {
  return (
    <Tabs defaultValue="tools" className="flex h-full flex-col">
      <TabsList className="mx-3 mt-3 grid grid-cols-3">
        <TabsTrigger value="tools">כלים</TabsTrigger>
        <TabsTrigger value="marks">סימונים</TabsTrigger>
        <TabsTrigger value="routes">תוואים</TabsTrigger>
      </TabsList>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
        <TabsContent value="tools" className="space-y-5">
          <ToolsSection {...props} />
        </TabsContent>
        <TabsContent value="marks" className="space-y-5">
          <MarksSection {...props} />
        </TabsContent>
        <TabsContent value="routes" className="space-y-5">
          <RoutesSection {...props} />
        </TabsContent>
      </div>
    </Tabs>
  );
}

function ToolsSection({ store, tool, setTool, panelKind, setPanelKind, mode, setMode, ppm }: Props) {
  const { project, update } = store;
  const editing = mode === "edit";
  return (
    <>
      <Section title="מצב">
        <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
          <Button variant="tool" size="sm" data-active={editing} onClick={() => setMode("edit")}>
            <Pencil /> עריכה
          </Button>
          <Button variant="tool" size="sm" data-active={!editing} onClick={() => setMode("preview")}>
            <Eye /> תצוגה מקדימה
          </Button>
        </div>
      </Section>

      <Section title="כלי שרטוט">
        <div className="grid grid-cols-2 gap-1">
          {TOOLS.map((t) => (
            <Button
              key={t.id}
              variant="tool"
              size="sm"
              disabled={!editing}
              data-active={tool === t.id}
              onClick={() => setTool(t.id)}
              className="justify-start"
              title={`${t.label} (${t.key})`}
            >
              <t.icon />
              <span className="truncate">{t.label}</span>
              <kbd className="ltr-num ms-auto text-[10px] opacity-60">{t.key}</kbd>
            </Button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          <kbd className="ltr-num">Esc</kbd> ביטול / חזרה לבחירה · <kbd className="ltr-num">Space</kbd> + גרירה להזזה ·
          גלגלת לזום
        </p>
      </Section>

      {tool === "panel" && editing && (
        <Section title="איזה לוח למקם">
          <div className="space-y-1">
            {PANEL_KINDS.map((k, i) => (
              <button
                key={k}
                onClick={() => setPanelKind(k)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-sm transition-colors",
                  panelKind === k ? "border-primary bg-primary/10" : "border-border hover:bg-accent",
                )}
              >
                <span className={cn("size-3 rounded-sm", PANEL_META[k].bgClass)} />
                <span>{PANEL_META[k].label}</span>
                <span className="ms-auto text-[11px] text-muted-foreground">
                  {project.panels[k] ? "סומן ✓" : "לא סומן"} · <Sym>{i + 1}</Sym>
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}

      <Section title="קנה מידה">
        {project.calibration && ppm ? (
          <div className="space-y-2 rounded-md border border-ok/30 bg-ok/5 p-2 text-sm">
            <StatusBadge tone="ok">מכויל</StatusBadge>
            <div className="text-xs text-muted-foreground">
              <Sym>{dist(project.calibration.a, project.calibration.b).toFixed(1)} px</Sym> ={" "}
              <Sym>{project.calibration.meters} m</Sym> → <Sym>{ppm.toFixed(3)} px/m</Sym>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="secondary" onClick={() => setTool("calibrate")} disabled={!editing}>
                <Ruler /> כיול מחדש
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!editing}
                onClick={() => update((p) => ({ ...p, calibration: null }))}
              >
                <Trash2 /> הסרה
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 rounded-md border border-warn/30 bg-warn/5 p-2 text-sm">
            <StatusBadge tone="warn">לא מכויל — אורכים בפיקסלים</StatusBadge>
            <p className="text-xs text-muted-foreground">
              בחרו בכלי הכיול, לחצו על שני קצוות של מידה ידועה בשרטוט והזינו את אורכה במטרים.
            </p>
            <Button size="sm" onClick={() => setTool("calibrate")} disabled={!editing}>
              <Ruler /> התחלת כיול
            </Button>
          </div>
        )}
      </Section>

      <Section title="מקרא">
        <ul className="space-y-1 text-xs">
          {PANEL_KINDS.map((k) => (
            <li key={k} className="flex items-center gap-2">
              <span className={cn("size-3 rounded-sm", PANEL_META[k].bgClass)} />
              {PANEL_META[k].label}
              {k !== "main" && <span className="text-muted-foreground">— קו רציף = A, מקווקו = חלופה ב׳</span>}
            </li>
          ))}
          <li className="flex items-center gap-2">
            <span className="h-1 w-3 rounded-sm bg-wall" /> קיר שסומן
          </li>
          <li className="flex items-center gap-2">
            <span className="size-3 rounded-sm border border-obstacle bg-obstacle/30" /> אזור אסור
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1 w-3 rounded-sm bg-corridor" /> מסדרון מועדף
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2 w-3 rounded-sm bg-foreground/25" /> קטע תוואי משותף
          </li>
        </ul>
      </Section>
    </>
  );
}

function MarksSection({ store, selection, setSelection, mode }: Props) {
  const { project, update, undo, redo, canUndo, canRedo } = store;
  const editing = mode === "edit";
  const setLayer = (k: keyof Layers, v: boolean) =>
    update((p) => ({ ...p, layers: { ...p.layers, [k]: v } }), false);
  const typeLabel = { rect: "מלבן אסור", wall: "קיר", zone: "פוליגון אסור" } as const;

  return (
    <>
      <Section title="היסטוריה">
        <div className="flex gap-1">
          <Button size="sm" variant="secondary" onClick={undo} disabled={!canUndo}>
            <Undo2 /> ביטול <Sym className="text-[10px] opacity-60">Ctrl+Z</Sym>
          </Button>
          <Button size="sm" variant="secondary" onClick={redo} disabled={!canRedo}>
            <Redo2 /> חזרה <Sym className="text-[10px] opacity-60">Ctrl+Y</Sym>
          </Button>
        </div>
      </Section>

      <Section title="שכבות">
        <div className="space-y-1.5">
          {(Object.keys(LAYER_LABEL) as (keyof Layers)[]).map((k) => (
            <label key={k} className="flex items-center justify-between text-sm">
              {LAYER_LABEL[k]}
              <Switch checked={project.layers[k]} onCheckedChange={(v) => setLayer(k, v)} />
            </label>
          ))}
        </div>
      </Section>

      <Section title={`מכשולים (${project.obstacles.length})`}>
        <p className="text-[11px] text-muted-foreground">
          האפליקציה אינה מזהה קירות, דלתות או מסדרונות אוטומטית — רק מה שסימנתם משפיע על הניתוב.
        </p>
        {project.obstacles.length === 0 ? (
          <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
            עדיין לא סומנו מכשולים. השתמשו בכלי קיר / מלבן / פוליגון.
          </p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {project.obstacles.map((o, i) => {
              const sel = selection?.kind === "obstacle" && selection.id === o.id;
              return (
                <li
                  key={o.id}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-2 py-1 text-xs",
                    sel ? "border-primary bg-primary/10" : "border-border",
                  )}
                >
                  <button className="flex-1 text-start" onClick={() => setSelection({ kind: "obstacle", id: o.id })}>
                    <Sym className="text-muted-foreground">#{i + 1}</Sym> {o.label ?? typeLabel[o.type]}
                    {o.type !== "rect" && <span className="text-muted-foreground"> · <Sym>{o.points.length}</Sym> נק׳</span>}
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label="מחיקה"
                    disabled={!editing}
                    onClick={() => {
                      update((p) => ({ ...p, obstacles: p.obstacles.filter((x) => x.id !== o.id) }));
                      if (sel) setSelection(null);
                    }}
                  >
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <label className="flex items-start gap-2 rounded-md border border-border p-2 text-xs">
          <Checkbox
            checked={project.obstaclesConfirmed}
            onCheckedChange={(v) => update((p) => ({ ...p, obstaclesConfirmed: v === true }))}
          />
          <span>בדקתי שכל הקירות, האזורים האסורים והמעברים הרלוונטיים סומנו ידנית.</span>
        </label>
        {project.obstacles.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            disabled={!editing}
            onClick={() => update((p) => ({ ...p, obstacles: [], obstaclesConfirmed: false }))}
          >
            <Trash2 /> מחיקת כל המכשולים
          </Button>
        )}
      </Section>

      <Section title={`מסדרונות מועדפים (${project.corridors.length})`}>
        {project.corridors.length === 0 ? (
          <p className="text-xs text-muted-foreground">אופציונלי: סמנו ציר מסדרון ושלבו ״העדפת מסדרונות״ בלשונית תוואים.</p>
        ) : (
          <ul className="space-y-1">
            {project.corridors.map((c, i) => (
              <li key={c.id} className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
                <button className="flex-1 text-start" onClick={() => setSelection({ kind: "corridor", id: c.id })}>
                  <Sym className="text-muted-foreground">#{i + 1}</Sym> {c.label ?? "מסדרון"}
                </button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  aria-label="מחיקה"
                  disabled={!editing}
                  onClick={() => update((p) => ({ ...p, corridors: p.corridors.filter((x) => x.id !== c.id) }))}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="לוחות">
        <ul className="space-y-1 text-xs">
          {PANEL_KINDS.map((k) => {
            const p = project.panels[k];
            return (
              <li key={k} className="flex items-center gap-2 rounded-md border px-2 py-1">
                <span className={cn("size-3 rounded-sm", PANEL_META[k].bgClass)} />
                <span className="flex-1">{PANEL_META[k].label}</span>
                {p ? (
                  <>
                    <Sym className="text-muted-foreground">
                      {p.x.toFixed(0)}, {p.y.toFixed(0)}
                    </Sym>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label="הסרת לוח"
                      disabled={!editing}
                      onClick={() =>
                        update((pr) => {
                          const panels = { ...pr.panels };
                          delete panels[k];
                          return { ...pr, panels };
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </>
                ) : (
                  <span className="text-warn">לא סומן</span>
                )}
              </li>
            );
          })}
        </ul>
      </Section>
    </>
  );
}

function RoutesSection({ store, routes, grid, ppm, lengthUnit, onExportPng, onExportRoutes }: Props) {
  const { project, update } = store;
  const prefs = project.prefs;
  const setPref = <K extends keyof RoutePrefs>(k: K, v: RoutePrefs[K]) =>
    update((p) => ({ ...p, prefs: { ...p.prefs, [k]: v } }));
  const numInput = (value: number, on: (n: number) => void, step = "1") => (
    <Input
      dir="ltr"
      type="number"
      step={step}
      min={0}
      className="ltr-num h-8 w-24"
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n) && n >= 0) on(n);
      }}
    />
  );

  return (
    <>
      <div className="rounded-md border border-info/30 bg-info/5 p-2 text-xs text-info">
        תוואים אלו הם <b>הצעה גאומטרית</b> דו־ממדית על בסיס המכשולים שסומנו בלבד — לא תכנון מאושר הנדסית.
      </div>

      <Section title="תוצאות">
        <div className="space-y-2">
          {SUB_KINDS.map((k) => {
            const { A, B } = routes.byKind[k];
            const choice = project.feeders[k].routeChoice;
            return (
              <div key={k} className="rounded-md border p-2">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                  <span className={cn("size-3 rounded-sm", PANEL_META[k].bgClass)} />
                  {FEEDER_LABEL[k]}
                  <span className="ms-auto">
                    {A.status === "ok" ? (
                      <StatusBadge tone="ok">נמצא תוואי</StatusBadge>
                    ) : A.status === "missing" ? (
                      <StatusBadge tone="pending">חסר</StatusBadge>
                    ) : (
                      <StatusBadge tone="fail">אין תוואי</StatusBadge>
                    )}
                  </span>
                </div>
                {A.status !== "ok" && <p className="text-xs text-muted-foreground">{A.message}</p>}
                {[A, B].map(
                  (r) =>
                    r &&
                    r.status === "ok" && (
                      <button
                        key={r.variant}
                        onClick={() =>
                          update((p) => ({
                            ...p,
                            feeders: { ...p.feeders, [k]: { ...p.feeders[k], routeChoice: r.variant } },
                          }))
                        }
                        className={cn(
                          "mt-1 flex w-full items-center gap-2 rounded px-2 py-1 text-start text-xs transition-colors",
                          choice === r.variant ? "bg-primary/15 text-foreground" : "hover:bg-accent",
                        )}
                      >
                        <span className="font-semibold">{r.variant === "A" ? "A" : "ב׳"}</span>
                        <span className="text-muted-foreground">{r.method}</span>
                        <span className="ltr-num ms-auto font-semibold">{lengthUnit(r.lengthPx)}</span>
                      </button>
                    ),
                )}
                {B && B.status !== "ok" && A.status === "ok" && (
                  <p className="mt-1 text-[11px] text-muted-foreground">חלופה ב׳: {B.message}</p>
                )}
                {A.message && A.status === "ok" && <p className="mt-1 text-[11px] text-warn">{A.message}</p>}
              </div>
            );
          })}
          {routes.shared.lengthPx > 0 && (
            <p className="text-xs text-muted-foreground">
              קטע משותף בין תוואי A (לפי תאי הרשת): <Sym>{lengthUnit(routes.shared.lengthPx)}</Sym>
            </p>
          )}
          {!ppm && (
            <p className="text-xs text-warn">ללא כיול — האורכים מוצגים בפיקסלים ואינם מועברים לבודק המזינים.</p>
          )}
        </div>
      </Section>

      <Section title="ייצוא">
        <div className="grid grid-cols-2 gap-1">
          <Button size="sm" variant="secondary" onClick={onExportRoutes}>
            <FileJson /> תוואים JSON
          </Button>
          <Button size="sm" variant="secondary" onClick={onExportPng}>
            <ImageDown /> שכבה כ־PNG
          </Button>
        </div>
      </Section>

      <Section title="העדפות ניתוב">
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span>שכנות ברשת</span>
            <div className="flex gap-1 rounded-md bg-muted p-0.5">
              {[8, 4].map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant="tool"
                  data-active={prefs.neighbors === n}
                  onClick={() => setPref("neighbors", n as 4 | 8)}
                  className="h-7"
                >
                  <Sym>{n}</Sym>
                </Button>
              ))}
            </div>
          </div>
          <p className="-mt-2 text-[11px] text-muted-foreground">
            <Sym>8</Sym> = כולל אלכסונים (ללא חיתוך פינות); <Sym>4</Sym> = אורתוגונלי בלבד.
          </p>
          <label className="flex items-center justify-between">
            החלקה בקו ראייה
            <Switch
              checked={prefs.smoothing}
              disabled={prefs.neighbors === 4 || prefs.shareTrunk}
              onCheckedChange={(v) => setPref("smoothing", v)}
            />
          </label>
          <label className="flex items-center justify-between">
            הצגת חלופה ב׳
            <Switch checked={prefs.showAlternatives} onCheckedChange={(v) => setPref("showAlternatives", v)} />
          </label>
          <label className="flex items-center justify-between">
            העדפת תוואי משותף (trunk)
            <Switch checked={prefs.shareTrunk} onCheckedChange={(v) => setPref("shareTrunk", v)} />
          </label>
          <label className="flex items-center justify-between">
            העדפת מסדרונות שסומנו
            <Switch
              checked={prefs.preferCorridors}
              disabled={project.corridors.length === 0}
              onCheckedChange={(v) => setPref("preferCorridors", v)}
            />
          </label>
          {prefs.preferCorridors && (
            <div className="flex items-center justify-between">
              <span className="text-xs">מקדם עלות מחוץ למסדרון</span>
              {numInput(prefs.corridorPenalty, (n) => setPref("corridorPenalty", Math.max(1, n)), "0.1")}
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs">
              מרווח ממכשולים {ppm ? <Sym>(m)</Sym> : <Sym>(px — לא מכויל)</Sym>}
            </span>
            {ppm
              ? numInput(prefs.clearanceM, (n) => setPref("clearanceM", n), "0.05")
              : numInput(prefs.clearancePx, (n) => setPref("clearancePx", n))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs">
              עובי קיר לחסימה <Sym>(px)</Sym>
            </span>
            {numInput(prefs.wallThicknessPx, (n) => setPref("wallThicknessPx", n))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs">
              גודל תא רשת <Sym>(px, 0 = אוטו׳)</Sym>
            </span>
            {numInput(prefs.cellPx, (n) => setPref("cellPx", Math.round(n)))}
          </div>
          {grid && (
            <p className="text-[11px] text-muted-foreground">
              רשת: <Sym>{grid.cols}×{grid.rows}</Sym> תאים, <Sym>{grid.cell}px</Sym>/תא
              {ppm && <> (<Sym>{(grid.cell / ppm).toFixed(2)} m</Sym>)</>}
            </p>
          )}
          <div className="space-y-1">
            <span className="text-xs">אופן התקנה (תווית בלבד)</span>
            <Select value={prefs.mounting} onValueChange={(v) => setPref("mounting", v as Mounting)}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unspecified">לא הוגדר</SelectItem>
                <SelectItem value="ceiling">בתקרה / תעלה עליונה</SelectItem>
                <SelectItem value="wall">על קיר</SelectItem>
                <SelectItem value="floor">ברצפה / תעלה תחתונה</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-warn">
              ניתוב תלת־ממדי אינו זמין: ללא נתוני גבהים וחדירות לא מחושבים מעברים אנכיים. הוסיפו תוספת אנכית ידנית
              בבודק המזינים.
            </p>
          </div>
        </div>
      </Section>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Route className="size-3.5" />
        <Waypoints className="size-3.5" />
        A* דטרמיניסטי, מחושב מחדש בכל שינוי.
      </div>
    </>
  );
}