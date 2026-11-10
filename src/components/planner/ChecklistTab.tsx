import type { ChecklistItem } from "@/lib/planner/checklist";

import { StatusBadge, type Tone } from "./bits";

const META: Record<ChecklistItem["status"], { tone: Tone; label: string }> = {
  done: { tone: "ok", label: "הושלם" },
  warn: { tone: "warn", label: "לבדיקה" },
  missing: { tone: "pending", label: "חסר" },
  "not-implemented": { tone: "info", label: "לא מיושם" },
};

export function ChecklistTab({ items }: { items: ChecklistItem[] }) {
  const groups = Array.from(new Set(items.map((i) => i.group)));
  const done = items.filter((i) => i.status === "done").length;
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="panel-surface space-y-2 p-4">
        <h2 className="text-lg font-semibold">מה חסר לתכנון מאושר</h2>
        <p className="text-sm text-muted-foreground">
          גם כשכל הסעיפים שניתנים לבדיקה כאן הושלמו, התוצאה היא <b>הצעה גאומטרית ובדיקות עזר</b> — לא תכנון חשמלי מאושר.
          נדרשים חישובים נוספים ואישור של בעל מקצוע מוסמך.
        </p>
        <p className="text-sm">
          הושלמו <bdi className="ltr-num">{done} / {items.length}</bdi> סעיפים
        </p>
      </div>
      {groups.map((g) => (
        <div key={g} className="panel-surface p-4">
          <h3 className="section-title mb-3">{g}</h3>
          <ul className="space-y-2">
            {items
              .filter((i) => i.group === g)
              .map((i) => (
                <li key={i.id} className="flex items-start gap-3 text-sm">
                  <StatusBadge tone={META[i.status].tone}>{META[i.status].label}</StatusBadge>
                  <div>
                    <div>{i.title}</div>
                    <div className="text-xs text-muted-foreground">{i.hint}</div>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function GuideTab() {
  const steps = [
    ["העלו תוכנית", "PNG או JPG מהמחשב. הקובץ נשאר בדפדפן שלכם. אפשר גם לנסות את שרטוט הדוגמה הסינתטי."],
    ["כיילו קנה מידה", "כלי ׳כיול׳: לחצו על שני קצוות של מידה ידועה (למשל קיר עם מידה רשומה) והזינו אורך במטרים."],
    ["סמנו לוחות", "כלי ׳לוח׳: לוח ראשי ו־3 לוחות משנה. גררו אותם בכלי הבחירה לתיקון מיקום."],
    ["סמנו מכשולים", "קירות (קו שבור), אזורים אסורים (מלבן/פוליגון). השאירו פתחים במקום דלתות. שום דבר לא מזוהה אוטומטית."],
    ["בדקו תוואים", "בלשונית ׳תוואים׳ בחרו A או חלופה ב׳ לכל מזין. התוואים מחושבים מחדש בכל שינוי."],
    ["הזינו נתוני מזין", "בלשונית ׳בודק מזינים׳ הזינו Ib, In, Iz, מקדמים, R, X מגיליון היצרן."],
    ["עברו על הרשימה", "׳מה חסר לתכנון מאושר׳ מראה מה עוד נדרש."],
  ];
  const keys = [
    ["V", "בחירה"],
    ["H / Space", "הזזת תצוגה"],
    ["C", "כיול"],
    ["P, 1–4", "לוחות"],
    ["R / W / A / K", "מלבן / קיר / פוליגון / מסדרון"],
    ["Enter", "סיום קו/פוליגון"],
    ["Esc", "ביטול / חזרה לבחירה"],
    ["Delete", "מחיקת הנבחר"],
    ["Ctrl+Z / Ctrl+Y", "ביטול / חזרה"],
    ["Shift", "יישור ל־45°"],
  ];
  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-4 md:grid-cols-[2fr_1fr]">
      <div className="panel-surface p-4">
        <h2 className="mb-3 text-lg font-semibold">מדריך מהיר</h2>
        <ol className="space-y-3">
          {steps.map(([t, d], i) => (
            <li key={t} className="flex gap-3 text-sm">
              <span className="ltr-num flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                {i + 1}
              </span>
              <div>
                <div className="font-semibold">{t}</div>
                <div className="text-muted-foreground">{d}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="panel-surface p-4">
        <h3 className="section-title mb-3">קיצורי מקלדת</h3>
        <ul className="space-y-1.5 text-sm">
          {keys.map(([k, d]) => (
            <li key={k} className="flex justify-between gap-2">
              <span>{d}</span>
              <kbd className="ltr-num rounded border bg-muted px-1.5 text-xs">{k}</kbd>
            </li>
          ))}
        </ul>
        <h3 className="section-title mb-2 mt-5">על הניתוב</h3>
        <p className="text-xs text-muted-foreground">
          A* דטרמיניסטי על רשת חסימה בקנה מידה של התמונה. במצב 8 שכנים אסור לחתוך פינות. קטעים עוברים רק בתאים פנויים.
          ניתוב תלת־ממדי אינו מחושב.
        </p>
      </div>
    </div>
  );
}