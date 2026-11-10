import { Info } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { ProjectStore } from "@/hooks/use-project";
import { FEEDER_LABEL, PANEL_META } from "@/lib/planner/defaults";
import type { CheckResult, FeederResult } from "@/lib/planner/electrical";
import type { RoutesOutput } from "@/lib/planner/routing";
import { SUB_KINDS, type FeederInputs, type SubKind } from "@/lib/planner/types";
import { cn } from "@/lib/utils";

import { NumField, StatusBadge, Sym, type Tone } from "./bits";

const tone = (s: CheckResult["status"]): Tone =>
  s === "pass" ? "ok" : s === "fail" || s === "invalid" ? "fail" : "pending";
const toneLabel = (s: CheckResult["status"]) =>
  s === "pass" ? "עומד" : s === "fail" ? "לא עומד" : s === "invalid" ? "ערך לא תקין" : "לא נבדק";

type Props = {
  store: ProjectStore;
  routes: RoutesOutput;
  results: Record<SubKind, FeederResult>;
};

export function CheckerTab({ store, routes, results }: Props) {
  const { project, update } = store;
  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="panel-surface space-y-2 border-warn/40 p-4 text-sm">
        <p className="font-semibold text-warn">בודק מזינים — כלי עזר לבדיקה, לא מתכנן כבלים מוסמך</p>
        <p className="text-muted-foreground">
          כל הערכים (<Sym>Iz</Sym>, מקדמים, <Sym>R</Sym>, <Sym>X</Sym>, <Sym>I2</Sym>) מוזנים על ידיכם מגיליון יצרן / טבלאות
          רלוונטיות — האפליקציה אינה ממציאה ערכים. בחירת חתך, זרם קצר, הגנות והארקה אינם מיושמים. התוצאות אינן פלט תכנון
          מאושר.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span>סף מפל מתח מצטבר עד העומס הסופי:</span>
          <div className="relative w-24" dir="ltr">
            <Input
              dir="ltr"
              className="ltr-num h-8 pr-6"
              value={project.dropLimitPct}
              onChange={(e) => update((p) => ({ ...p, dropLimitPct: e.target.value }), false)}
            />
            <span className="ltr-num absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
          <span className="text-xs text-muted-foreground">
            קו בסיס לפי בקשתכם (ברירת מחדל <Sym>3%</Sym>). תחולת הסף תלויה בתקנות העדכניות בתחום השיפוט — יש לאמת.
          </span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {SUB_KINDS.map((k) => (
          <FeederCard
            key={k}
            kind={k}
            inp={project.feeders[k]}
            res={results[k]}
            routeLen={routes.byKind[k][project.feeders[k].routeChoice]?.lengthM ?? null}
            routeOk={(routes.byKind[k][project.feeders[k].routeChoice]?.status ?? "missing") === "ok"}
            onChange={(patch) =>
              update((p) => ({ ...p, feeders: { ...p.feeders, [k]: { ...p.feeders[k], ...patch } } }), false)
            }
          />
        ))}
      </div>

      <div className="panel-surface space-y-1 p-4 text-xs text-muted-foreground">
        <p className="flex items-center gap-1 font-semibold text-foreground">
          <Info className="size-4" /> מוסכמות והנחות
        </p>
        <p>
          <Sym>I&apos;z = Iz × k_temp × k_group × k_other</Sym> (k_other ריק = לא מוחל). בדיקה: <Sym>Ib ≤ In ≤ I&apos;z</Sym>.
        </p>
        <p>
          <Sym>I2 ≤ 1.45 × I&apos;z</Sym> נבדק רק כאשר <Sym>I2</Sym> הוזן במפורש — לא מניחים <Sym>I2</Sym> לפי סוג מפסק.
        </p>
        <p>
          תלת־פאזי: <Sym>ΔU = √3 · Ib · L(km) · (R·cosφ + X·sinφ)</Sym>, באחוזים ביחס למתח שזור נקוב. חד־פאזי:{" "}
          <Sym>ΔU = 2 · Ib · L(km) · (R·cosφ + X·sinφ)</Sym>, ביחס למתח פאזה. <Sym>L</Sym> = אורך חד־כיווני; <Sym>R, X</Sym>{" "}
          לכל מוליך ב־<Sym>Ω/km</Sym> בטמפרטורת העבודה כפי שהוזנו.
        </p>
        <p>
          אורך: <Sym>(אורך תוואי + תוספת אנכית) × (1 + רזרבה%)</Sym>. אורך התוואי הוא הצעה גאומטרית דו־ממדית.
        </p>
      </div>
    </div>
  );
}

function FeederCard({
  kind,
  inp,
  res,
  routeLen,
  routeOk,
  onChange,
}: {
  kind: SubKind;
  inp: FeederInputs;
  res: FeederResult;
  routeLen: number | null;
  routeOk: boolean;
  onChange: (p: Partial<FeederInputs>) => void;
}) {
  const miss = (label: string) => res.missing.includes(label);
  const f = (key: keyof FeederInputs) => ({
    value: inp[key] as string,
    onChange: (v: string) => onChange({ [key]: v } as Partial<FeederInputs>),
  });
  const overall =
    res.overall === "issues"
      ? { t: "fail" as Tone, l: "נמצאו חריגות" }
      : res.overall === "incomplete"
        ? { t: "pending" as Tone, l: "חסרים נתונים" }
        : { t: "warn" as Tone, l: "הבדיקות שהוזנו עומדות — עדיין לא תכנון מאושר" };

  return (
    <div className="panel-surface flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <span className={cn("size-3 rounded-sm", PANEL_META[kind].bgClass)} />
        <h3 className="font-semibold">{FEEDER_LABEL[kind]}</h3>
        <span className="ms-auto">
          <StatusBadge tone={overall.t}>{overall.l}</StatusBadge>
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span>מערכת:</span>
        {(["3ph", "1ph"] as const).map((s) => (
          <button
            key={s}
            onClick={() => onChange({ system: s })}
            className={cn(
              "rounded-md border px-2 py-1 text-xs",
              inp.system === s ? "border-primary bg-primary/15 text-primary" : "border-border hover:bg-accent",
            )}
          >
            {s === "3ph" ? "תלת־פאזי" : "חד־פאזי"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumField
          label={inp.system === "3ph" ? "מתח שזור נקוב" : "מתח פאזה נקוב"}
          sym="U"
          unit="V"
          required
          missing={miss("מתח נקוב")}
          {...f("voltage")}
        />
        <NumField label="מקדם הספק" sym="cosφ" required missing={miss("cosφ")} {...f("cosPhi")} />
        <NumField label="זרם תכנון" sym="Ib" unit="A" required missing={miss("Ib")} {...f("ib")} />
        <NumField label="זרם נקוב הגנה" sym="In" unit="A" required missing={miss("In")} {...f("inom")} />
        <NumField label="כושר הולכה (טבלה)" sym="Iz" unit="A" required missing={miss("Iz")} {...f("iz")} />
        <NumField label="זרם פעולה מוסכם" sym="I2" unit="A" missing={miss("I2")} hint="אופציונלי — מנתוני היצרן" {...f("i2")} />
        <NumField label="מקדם טמפרטורה" sym="k_temp" required missing={miss("מקדם טמפרטורה")} {...f("kTemp")} />
        <NumField label="מקדם קיבוץ" sym="k_group" required missing={miss("מקדם קיבוץ")} {...f("kGroup")} />
        <NumField label="מקדם נוסף" sym="k_other" hint="ריק = לא מוחל" {...f("kOther")} />
        <div />
        <NumField label="התנגדות" sym="R" unit="Ω/km" required missing={miss("R (Ω/km)")} {...f("rPerKm")} />
        <NumField label="היגב" sym="X" unit="Ω/km" required missing={miss("X (Ω/km)")} {...f("xPerKm")} />
      </div>

      <div className="space-y-2 rounded-md border p-3">
        <div className="text-sm font-semibold">אורך</div>
        <div className="text-xs text-muted-foreground">
          מהכלי (תוואי {inp.routeChoice === "A" ? "A" : "ב׳"}):{" "}
          {routeLen != null ? (
            <Sym className="text-foreground">{routeLen.toFixed(2)} m</Sym>
          ) : (
            <span className="text-warn">{routeOk ? "יש לכייל קנה מידה" : "אין תוואי"}</span>
          )}
        </div>
        <label className="flex items-center justify-between text-xs">
          עקיפה ידנית של אורך התוואי
          <Switch checked={inp.useLengthOverride} onCheckedChange={(v) => onChange({ useLengthOverride: v })} />
        </label>
        {inp.useLengthOverride && <NumField label="אורך ידני" unit="m" {...f("lengthOverrideM")} />}
        <div className="grid grid-cols-2 gap-3">
          <NumField label="תוספת אנכית" unit="m" hint="עליות/ירידות — ידני" {...f("verticalM")} />
          <NumField label="רזרבה" unit="%" {...f("reservePct")} />
        </div>
        <div className="text-xs">
          אורך לחישוב:{" "}
          {res.length.totalM != null ? (
            <Sym className="font-semibold">{res.length.totalM.toFixed(2)} m</Sym>
          ) : (
            <span className="text-warn">חסר</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumField label="מפל במעלה הזרם (קיים)" unit="%" hint="עד הלוח הראשי" {...f("upstreamPct")} />
        <NumField label="מפל עד העומס הסופי" unit="%" hint="מלוח המשנה והלאה" {...f("downstreamPct")} />
      </div>

      <div className="space-y-2 border-t pt-3">
        <Row title={<>I&apos;z מתוקן</>} status={res.izCorrected != null ? "pass" : "missing"} text={res.izCorrected != null ? `${res.izCorrected.toFixed(1)} A` : "חסר"} info />
        <Row title={<Sym>Ib ≤ In ≤ I&apos;z</Sym>} status={res.izCheck.status} text={res.izCheck.detail} />
        <Row title={<Sym>I2 ≤ 1.45·I&apos;z</Sym>} status={res.i2Check.status} text={res.i2Check.detail} />
        <Row title={<>מפל מתח במזין</>} status={res.drop.status} text={res.drop.detail} info />
        <Row title={<>מפל מצטבר מול סף</>} status={res.totalDrop.status} text={res.totalDrop.detail} />
        {res.missing.length > 0 && (
          <p className="text-[11px] text-warn">חסר: {res.missing.join(" · ")}</p>
        )}
      </div>
    </div>
  );
}

function Row({
  title,
  status,
  text,
  info,
}: {
  title: React.ReactNode;
  status: CheckResult["status"];
  text: string;
  info?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <div className="w-28 shrink-0 font-semibold">{title}</div>
      <div className="flex-1 text-muted-foreground">
        <bdi className="ltr-num">{text}</bdi>
      </div>
      {info && status === "pass" ? (
        <StatusBadge tone="info">חושב</StatusBadge>
      ) : (
        <StatusBadge tone={tone(status)}>{toneLabel(status)}</StatusBadge>
      )}
    </div>
  );
}