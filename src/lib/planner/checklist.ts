import { FEEDER_LABEL, PANEL_META } from "./defaults";
import type { FeederResult } from "./electrical";
import type { RoutesOutput } from "./routing";
import { SUB_KINDS, type Project, type SubKind } from "./types";

export type ChecklistStatus = "done" | "missing" | "warn" | "not-implemented";
export type ChecklistItem = { id: string; group: string; title: string; status: ChecklistStatus; hint: string };

export function buildChecklist(
  p: Project,
  routes: RoutesOutput,
  feeders: Record<SubKind, FeederResult>,
): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const add = (i: ChecklistItem) => items.push(i);

  add({
    id: "image",
    group: "תוכנית ושרטוט",
    title: "תוכנית אדריכלית אמיתית נטענה",
    status: p.image.source === "upload" ? "done" : p.image.source === "sample" ? "warn" : "missing",
    hint:
      p.image.source === "sample"
        ? "כרגע מוצג שרטוט דוגמה סינתטי — העלו את התוכנית שלכם"
        : "העלו קובץ PNG/JPG של התוכנית",
  });
  add({
    id: "calib",
    group: "תוכנית ושרטוט",
    title: "קנה מידה מכויל",
    status: p.calibration ? (p.image.source === "sample" ? "warn" : "done") : "missing",
    hint: p.calibration
      ? "ודאו שהכיול בוצע על מידה ידועה ומדויקת בשרטוט"
      : "השתמשו בכלי הכיול: שתי נקודות + אורך אמיתי במטרים",
  });
  for (const k of ["main", ...SUB_KINDS] as const) {
    add({
      id: `panel-${k}`,
      group: "לוחות",
      title: `${PANEL_META[k].label} סומן`,
      status: p.panels[k] ? "done" : "missing",
      hint: "בחרו בכלי ׳לוח׳ ולחצו על מיקום הלוח בתוכנית",
    });
  }
  add({
    id: "obstacles",
    group: "מכשולים",
    title: "כל המכשולים, הקירות והאזורים האסורים סומנו ידנית",
    status: p.obstaclesConfirmed ? "done" : p.obstacles.length ? "warn" : "missing",
    hint: "האפליקציה אינה מזהה קירות/דלתות אוטומטית. סמנו ואשרו בלשונית התוואי",
  });
  for (const k of SUB_KINDS) {
    const r = routes.byKind[k].A;
    add({
      id: `route-${k}`,
      group: "תוואים",
      title: `תוואי גאומטרי ל${FEEDER_LABEL[k]}`,
      status: r.status === "ok" ? (r.lengthM == null ? "warn" : "done") : "missing",
      hint:
        r.status === "ok"
          ? r.lengthM == null
            ? "נמצא תוואי אך ללא כיול — האורך בפיקסלים בלבד"
            : "הצעה גאומטרית בלבד — יש לאמת בשטח"
          : r.message,
    });
  }
  add({
    id: "3d",
    group: "תוואים",
    title: "ניתוב תלת־ממדי (גבהים, חדירות, מעברי אש)",
    status: "not-implemented",
    hint: "לא מחושב. העדפות תקרה/קיר הן תווית בלבד. הוסיפו תוספת אנכית ידנית בבודק",
  });
  for (const k of SUB_KINDS) {
    const f = feeders[k];
    add({
      id: `feeder-${k}`,
      group: "בודק מזינים",
      title: `נתוני ${FEEDER_LABEL[k]} הוזנו`,
      status: f.missing.length === 0 ? (f.overall === "issues" ? "warn" : "done") : "missing",
      hint: f.missing.length ? `חסר: ${f.missing.join(", ")}` : f.overall === "issues" ? "יש בדיקה שלא עומדת" : "כל השדות הוזנו",
    });
  }
  add({
    id: "reg",
    group: "תקינה",
    title: "אישור סף מפל המתח לפי התקנות החלות",
    status: "warn",
    hint: "הסף (ברירת מחדל 3%) הוא קו בסיס שביקשתם — יש לאמת מול התקנות העדכניות בתחום השיפוט",
  });
  const ni = (id: string, title: string, hint: string) =>
    add({ id, group: "לא מיושם באפליקציה", title, status: "not-implemented", hint });
  ni("sizing", "בחירת חתך כבל לפי טבלאות תקן", "האפליקציה אינה בוחרת כבל; Iz, R, X מוזנים מגיליון היצרן");
  ni("sc", "חישוב זרם קצר וכושר ניתוק", "לא מיושם");
  ni("prot", "תיאום הגנות וסלקטיביות", "לא מיושם");
  ni("earth", "הארקה, עכבת לולאת תקלה וזמן ניתוק", "לא מיושם");
  ni("harm", "הרמוניות, זרמי התנעה ועומסים מיוחדים", "לא מיושם");
  ni("sign", "בדיקה וחתימה של מהנדס/חשמלאי מוסמך", "נדרש תמיד לפני ביצוע");
  return items;
}