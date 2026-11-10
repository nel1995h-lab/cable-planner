import { ChevronDown, FileJson, FilePlus2, FlaskConical, ImageDown, Upload, Zap } from "lucide-react";
import { useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MAX_PERSIST_IMAGE_CHARS, useProjectStore } from "@/hooks/use-project";
import { buildChecklist } from "@/lib/planner/checklist";
import { createEmptyProject, normalizeProject } from "@/lib/planner/defaults";
import { computeFeeder } from "@/lib/planner/electrical";
import { buildGrid } from "@/lib/planner/grid";
import { computeRoutes, pxPerMeterOf } from "@/lib/planner/routing";
import { sampleDataUrl, sampleProject } from "@/lib/planner/sample";
import { SUB_KINDS, type PanelKind, type Selection, type SubKind, type Tool } from "@/lib/planner/types";

import { StatusBadge } from "./bits";
import { CheckerTab } from "./CheckerTab";
import { ChecklistTab, GuideTab } from "./ChecklistTab";
import { downloadJson, exportOverlayPng, routesJson } from "./export";
import { PlanCanvas } from "./PlanCanvas";
import { SidePanel } from "./SidePanel";

const MAX_SIDE = 4096;

function readImage(file: File): Promise<{ url: string; w: number; h: number }> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = () => rej(new Error("read failed"));
    fr.onload = () => {
      const url = String(fr.result);
      const img = new Image();
      img.onerror = () => rej(new Error("decode failed"));
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (Math.max(w, h) <= MAX_SIDE) return res({ url, w, h });
        const k = MAX_SIDE / Math.max(w, h);
        const cv = document.createElement("canvas");
        cv.width = Math.round(w * k);
        cv.height = Math.round(h * k);
        cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
        res({ url: cv.toDataURL("image/jpeg", 0.9), w: cv.width, h: cv.height });
      };
      img.src = url;
    };
    fr.readAsDataURL(file);
  });
}

export function CablePlannerApp() {
  const store = useProjectStore();
  const { project, update, imageUrl, imageStatus, loadProject } = store;
  const [tool, setTool] = useState<Tool>("select");
  const [panelKind, setPanelKind] = useState<PanelKind>("main");
  const [selection, setSelection] = useState<Selection>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [tab, setTab] = useState("plan");
  const [fitSignal, setFitSignal] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  const ppm = pxPerMeterOf(project);
  const lengthUnit = useCallback(
    (px: number) => (ppm ? `${(px / ppm).toFixed(1)} מ׳` : `${px.toFixed(0)} px`),
    [ppm],
  );

  // routing on a deferred snapshot keeps dragging responsive
  const deferred = useDeferredValue(project);
  const dppm = pxPerMeterOf(deferred);
  const grid = useMemo(
    () =>
      deferred.image.width > 0
        ? buildGrid({
            width: deferred.image.width,
            height: deferred.image.height,
            obstacles: deferred.obstacles,
            corridors: deferred.corridors,
            prefs: deferred.prefs,
            pxPerMeter: dppm,
          })
        : null,
    [deferred.image.width, deferred.image.height, deferred.obstacles, deferred.corridors, deferred.prefs, dppm],
  );
  const routes = useMemo(
    () => computeRoutes(deferred, grid),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [grid, deferred.panels, deferred.prefs, deferred.calibration],
  );
  const results = useMemo(() => {
    const out = {} as Record<SubKind, ReturnType<typeof computeFeeder>>;
    for (const k of SUB_KINDS) {
      const r = routes.byKind[k][project.feeders[k].routeChoice];
      out[k] = computeFeeder(project.feeders[k], r && r.status === "ok" ? r.lengthM : null, project.dropLimitPct);
    }
    return out;
  }, [routes, project.feeders, project.dropLimitPct]);
  const checklist = useMemo(() => buildChecklist(project, routes, results), [project, routes, results]);

  const onUpload = async (file: File) => {
    if (!/image\/(png|jpe?g)/.test(file.type)) {
      toast.error("יש לבחור קובץ PNG או JPG");
      return;
    }
    try {
      const { url, w, h } = await readImage(file);
      const prev = project;
      const sameSize = prev.image.source === "upload" && prev.image.width === w && prev.image.height === h;
      const base = sameSize ? prev : createEmptyProject();
      const next = { ...base, image: { source: "upload" as const, name: file.name, width: w, height: h } };
      loadProject(next, url);
      const saved = next.persistImage && url.length <= MAX_PERSIST_IMAGE_CHARS;
      toast.success(sameSize ? "התמונה נטענה מחדש — הסימונים נשמרו" : "התוכנית נטענה");
      if (!saved) toast.warning("התמונה גדולה מכדי להישמר בדפדפן. הסימונים יישמרו; בביקור הבא טענו את הקובץ שוב.");
      setTab("plan");
      setFitSignal((n) => n + 1);
    } catch {
      toast.error("לא ניתן לקרוא את הקובץ");
    }
  };

  const loadSample = () => {
    loadProject(sampleProject(), sampleDataUrl());
    setSelection(null);
    setTool("select");
    setTab("plan");
    setFitSignal((n) => n + 1);
    toast.message("נטען שרטוט דוגמה סינתטי — לא תוכנית אמיתית");
  };

  const exportProject = (withImage: boolean) => {
    downloadJson(
      {
        app: "Cable Planner",
        kind: "project",
        exportedAt: new Date().toISOString(),
        project,
        imageDataUrl: withImage && project.image.source === "upload" ? imageUrl : null,
      },
      "cable-planner-project.json",
    );
  };

  const importProject = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const p = normalizeProject(data.project ?? data);
      const img =
        p.image.source === "sample" ? sampleDataUrl() : typeof data.imageDataUrl === "string" ? data.imageDataUrl : null;
      loadProject(p, img);
      setSelection(null);
      setFitSignal((n) => n + 1);
      toast.success(
        p.image.source === "upload" && !img ? "הפרויקט יובא — טענו את קובץ התמונה המקורי" : "הפרויקט יובא",
      );
    } catch {
      toast.error("קובץ JSON לא תקין");
    }
  };

  const onExportPng = async () => {
    if (!project.image.width) return;
    try {
      await exportOverlayPng(project, routes, imageUrl, lengthUnit);
      toast.success("קובץ PNG נוצר");
    } catch {
      toast.error("ייצוא PNG נכשל");
    }
  };

  const hasImage = project.image.source !== "none";

  return (
    <div className="flex h-screen flex-col" dir="rtl">
      <header className="app-header flex flex-wrap items-center gap-3 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Zap className="size-5" />
          </span>
          <div>
            <h1 className="text-base font-semibold leading-tight">Cable Planner</h1>
            <p className="text-[11px] text-muted-foreground">תכנון תוואי מזינים · הצעה גאומטרית</p>
          </div>
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="plan">תוואי</TabsTrigger>
            <TabsTrigger value="checker">בודק מזינים</TabsTrigger>
            <TabsTrigger value="missing">מה חסר לתכנון מאושר</TabsTrigger>
            <TabsTrigger value="guide">מדריך</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {hasImage && (
            <>
              {project.image.source === "sample" && <StatusBadge tone="warn">שרטוט דוגמה סינתטי</StatusBadge>}
              {ppm ? <StatusBadge tone="ok">מכויל</StatusBadge> : <StatusBadge tone="warn">לא מכויל</StatusBadge>}
              <StatusBadge tone="info">לא מאושר הנדסית</StatusBadge>
            </>
          )}
          <Button variant="default" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload /> העלאת תוכנית
          </Button>
          <Button variant="header" size="sm" onClick={loadSample}>
            <FlaskConical /> דוגמה
          </Button>
          <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild>
              <Button variant="header" size="sm">
                פרויקט <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem onClick={() => exportProject(false)}>
                <FileJson /> ייצוא פרויקט JSON (ללא תמונה)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportProject(true)} disabled={project.image.source !== "upload" || !imageUrl}>
                <FileJson /> ייצוא פרויקט JSON כולל תמונה
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => jsonRef.current?.click()}>
                <Upload /> ייבוא פרויקט JSON
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={!hasImage} onClick={() => downloadJson(routesJson(project, routes, ppm), "cable-planner-routes.json")}>
                <FileJson /> ייצוא תוואים JSON
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!hasImage} onClick={onExportPng}>
                <ImageDown /> ייצוא שכבת תוכנית PNG
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="flex items-center justify-between px-2 py-1.5 text-sm">
                שמירת התמונה בדפדפן
                <Switch
                  checked={project.persistImage}
                  onCheckedChange={(v) => {
                    update((p) => ({ ...p, persistImage: v }), false);
                    if (project.image.source === "upload") {
                      const ok = store.persistImage(imageUrl, v);
                      if (v && !ok) toast.warning("התמונה גדולה מכדי להישמר בדפדפן");
                    }
                  }}
                />
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  if (window.confirm("למחוק את הפרויקט הנוכחי ולהתחיל מחדש?")) {
                    loadProject(createEmptyProject(), null);
                    setSelection(null);
                  }
                }}
              >
                <FilePlus2 /> פרויקט חדש
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />
        <input
          ref={jsonRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importProject(f);
            e.target.value = "";
          }}
        />
      </header>

      <main className="min-h-0 flex-1">
        {tab === "plan" &&
          (!hasImage ? (
            <EmptyState onUpload={() => fileRef.current?.click()} onSample={loadSample} />
          ) : (
            <div className="flex h-full">
              <aside className="w-80 shrink-0 border-l border-border bg-sidebar">
                <SidePanel
                  store={store}
                  routes={routes}
                  grid={grid}
                  tool={tool}
                  setTool={setTool}
                  panelKind={panelKind}
                  setPanelKind={setPanelKind}
                  selection={selection}
                  setSelection={setSelection}
                  mode={mode}
                  setMode={setMode}
                  ppm={ppm}
                  lengthUnit={lengthUnit}
                  onExportPng={onExportPng}
                  onExportRoutes={() => downloadJson(routesJson(project, routes, ppm), "cable-planner-routes.json")}
                />
              </aside>
              <div className="relative min-w-0 flex-1">
                {imageStatus === "missing-upload" && (
                  <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-center gap-3 bg-warn/15 p-2 text-sm text-warn">
                    התמונה ({project.image.name}, <bdi className="ltr-num">{project.image.width}×{project.image.height}</bdi>) לא
                    נשמרה בדפדפן. הסימונים קיימים.
                    <Button size="sm" onClick={() => fileRef.current?.click()}>
                      טעינת הקובץ שוב
                    </Button>
                  </div>
                )}
                <PlanCanvas
                  store={store}
                  routes={routes}
                  grid={grid}
                  tool={tool}
                  setTool={setTool}
                  panelKind={panelKind}
                  setPanelKind={setPanelKind}
                  selection={selection}
                  setSelection={setSelection}
                  mode={mode}
                  lengthUnit={lengthUnit}
                  ppm={ppm}
                  fitSignal={fitSignal}
                />
              </div>
            </div>
          ))}
        {tab === "checker" && (
          <div className="h-full overflow-y-auto">
            <CheckerTab store={store} routes={routes} results={results} />
          </div>
        )}
        {tab === "missing" && (
          <div className="h-full overflow-y-auto">
            <ChecklistTab items={checklist} />
          </div>
        )}
        {tab === "guide" && (
          <div className="h-full overflow-y-auto">
            <GuideTab />
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState({ onUpload, onSample }: { onUpload: () => void; onSample: () => void }) {
  return (
    <div className="canvas-backdrop flex h-full items-center justify-center p-6">
      <div className="panel-surface max-w-lg space-y-5 p-8 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Zap className="size-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">התחילו מתוכנית</h2>
          <p className="text-sm text-muted-foreground">
            העלו תוכנית אדריכלית כ־PNG או JPG. הקובץ נשאר בדפדפן שלכם ואינו נשלח לשרת. לאחר מכן כיילו קנה מידה, סמנו לוחות
            ומכשולים, וקבלו הצעת תוואי.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onUpload}>
            <Upload /> העלאת תוכנית
          </Button>
          <Button variant="secondary" onClick={onSample}>
            <FlaskConical /> נסו שרטוט דוגמה
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          שרטוט הדוגמה סינתטי לחלוטין — גאומטריה ונתונים לבדיקה בלבד, ללא נתונים הנדסיים אמיתיים.
        </p>
      </div>
    </div>
  );
}