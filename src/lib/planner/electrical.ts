import type { FeederInputs } from "./types";

/** Parse a user-entered number. Empty / invalid => null (never a silent default). */
export function num(v: string | undefined | null): number | null {
  if (v == null) return null;
  const t = String(v).trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export type CheckStatus = "pass" | "fail" | "missing" | "invalid";

export type CheckResult = {
  status: CheckStatus;
  detail: string;
  missing: string[];
};

export type LengthBreakdown = {
  source: "route" | "override" | "none";
  routeM: number | null;
  verticalM: number;
  reservePct: number;
  totalM: number | null;
};

export type FeederResult = {
  length: LengthBreakdown;
  izCorrected: number | null;
  izCheck: CheckResult;
  i2Check: CheckResult;
  drop: CheckResult & { volts: number | null; pct: number | null; formula: string };
  totalDrop: CheckResult & {
    pct: number | null;
    includesUpstream: boolean;
    includesDownstream: boolean;
  };
  missing: string[];
  /** never "approved": the best possible outcome is "entered checks satisfied, design not approved" */
  overall: "incomplete" | "issues" | "entered-checks-ok";
};

const fmt = (n: number, d = 2) => n.toFixed(d);

/** Combined derating: I'z = Iz × k_temp × k_group × k_other (k_other optional, blank = not applied). */
export function correctedIz(inp: FeederInputs): { value: number | null; missing: string[] } {
  const iz = num(inp.iz);
  const kt = num(inp.kTemp);
  const kg = num(inp.kGroup);
  const ko = num(inp.kOther);
  const missing: string[] = [];
  if (iz == null) missing.push("Iz");
  if (kt == null) missing.push("מקדם טמפרטורה");
  if (kg == null) missing.push("מקדם קיבוץ");
  if (missing.length) return { value: null, missing };
  return { value: iz! * kt! * kg! * (ko ?? 1), missing };
}

/**
 * Voltage drop, convention:
 *  3-phase: ΔU = √3 · Ib · L · (R·cosφ + X·sinφ), referred to line-to-line voltage.
 *  1-phase: ΔU = 2 · Ib · L · (R·cosφ + X·sinφ), referred to phase-to-neutral voltage.
 *  L = one-way length in km, R and X in Ω/km per conductor (user/datasheet values).
 */
export function voltageDrop(
  system: "3ph" | "1ph",
  ib: number,
  lengthKm: number,
  rPerKm: number,
  xPerKm: number,
  cosPhi: number,
  nominalV: number,
): { volts: number; pct: number } {
  const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
  const k = system === "3ph" ? Math.sqrt(3) : 2;
  const volts = k * ib * lengthKm * (rPerKm * cosPhi + xPerKm * sinPhi);
  return { volts, pct: (volts / nominalV) * 100 };
}

export function feederLength(inp: FeederInputs, routeM: number | null): LengthBreakdown {
  const vertical = num(inp.verticalM) ?? 0;
  const reserve = num(inp.reservePct) ?? 0;
  if (inp.useLengthOverride) {
    const o = num(inp.lengthOverrideM);
    return {
      source: o == null ? "none" : "override",
      routeM: o,
      verticalM: vertical,
      reservePct: reserve,
      totalM: o == null ? null : (o + vertical) * (1 + reserve / 100),
    };
  }
  return {
    source: routeM == null ? "none" : "route",
    routeM,
    verticalM: vertical,
    reservePct: reserve,
    totalM: routeM == null ? null : (routeM + vertical) * (1 + reserve / 100),
  };
}

export function computeFeeder(
  inp: FeederInputs,
  routeM: number | null,
  limitPctStr: string,
): FeederResult {
  const length = feederLength(inp, routeM);
  const ib = num(inp.ib);
  const inom = num(inp.inom);
  const i2 = num(inp.i2);
  const { value: izc, missing: izMissing } = correctedIz(inp);

  // --- Ib <= In <= I'z
  let izCheck: CheckResult;
  {
    const missing = [...(ib == null ? ["Ib"] : []), ...(inom == null ? ["In"] : []), ...izMissing];
    if (missing.length) {
      izCheck = { status: "missing", detail: "חסרים נתונים לבדיקה", missing };
    } else if (ib! <= 0 || inom! <= 0 || izc! <= 0) {
      izCheck = { status: "invalid", detail: "ערכים חייבים להיות חיוביים", missing: [] };
    } else {
      const ok1 = ib! <= inom!;
      const ok2 = inom! <= izc!;
      izCheck = {
        status: ok1 && ok2 ? "pass" : "fail",
        detail: `Ib=${fmt(ib!, 1)}A ${ok1 ? "≤" : ">"} In=${fmt(inom!, 1)}A ${ok2 ? "≤" : ">"} I'z=${fmt(izc!, 1)}A`,
        missing: [],
      };
    }
  }

  // --- I2 <= 1.45 I'z (only when I2 entered explicitly)
  let i2Check: CheckResult;
  if (i2 == null) {
    i2Check = {
      status: "missing",
      detail: "I2 לא הוזן — הבדיקה לא בוצעה (לא מניחים ערך לפי סוג המפסק)",
      missing: ["I2"],
    };
  } else if (izc == null) {
    i2Check = { status: "missing", detail: "נדרש I'z לבדיקה", missing: izMissing };
  } else if (i2 <= 0) {
    i2Check = { status: "invalid", detail: "I2 חייב להיות חיובי", missing: [] };
  } else {
    const lim = 1.45 * izc;
    i2Check = {
      status: i2 <= lim ? "pass" : "fail",
      detail: `I2=${fmt(i2, 1)}A ${i2 <= lim ? "≤" : ">"} 1.45·I'z=${fmt(lim, 1)}A`,
      missing: [],
    };
  }

  // --- voltage drop
  const formula =
    inp.system === "3ph"
      ? "ΔU = √3 · Ib · L(km) · (R·cosφ + X·sinφ)"
      : "ΔU = 2 · Ib · L(km) · (R·cosφ + X·sinφ)";
  const U = num(inp.voltage);
  const cos = num(inp.cosPhi);
  const R = num(inp.rPerKm);
  const X = num(inp.xPerKm);
  const dropMissing = [
    ...(U == null ? ["מתח נקוב"] : []),
    ...(ib == null ? ["Ib"] : []),
    ...(length.totalM == null ? ["אורך תוואי"] : []),
    ...(cos == null ? ["cosφ"] : []),
    ...(R == null ? ["R (Ω/km)"] : []),
    ...(X == null ? ["X (Ω/km)"] : []),
  ];
  let drop: FeederResult["drop"];
  if (dropMissing.length) {
    drop = {
      status: "missing",
      detail: "חסרים נתונים לחישוב מפל מתח",
      missing: dropMissing,
      volts: null,
      pct: null,
      formula,
    };
  } else if (U! <= 0 || cos! <= 0 || cos! > 1 || R! < 0 || X! < 0 || ib! <= 0) {
    drop = {
      status: "invalid",
      detail: "בדקו ערכים: 0 < cosφ ≤ 1, U>0, Ib>0, R,X ≥ 0",
      missing: [],
      volts: null,
      pct: null,
      formula,
    };
  } else {
    const r = voltageDrop(inp.system, ib!, length.totalM! / 1000, R!, X!, cos!, U!);
    drop = {
      status: "pass", // informational — the limit is applied on the combined total
      detail: `ΔU = ${fmt(r.volts, 2)}V (${fmt(r.pct, 2)}%)`,
      missing: [],
      volts: r.volts,
      pct: r.pct,
      formula,
    };
  }

  // --- combined drop to final load
  const limit = num(limitPctStr);
  const up = num(inp.upstreamPct);
  const down = num(inp.downstreamPct);
  let totalDrop: FeederResult["totalDrop"];
  if (drop.pct == null) {
    totalDrop = {
      status: "missing",
      detail: "אין מפל מתח מחושב למזין",
      missing: drop.missing,
      pct: null,
      includesUpstream: up != null,
      includesDownstream: down != null,
    };
  } else if (limit == null || limit <= 0) {
    totalDrop = {
      status: "missing",
      detail: "לא הוגדר סף מפל מתח",
      missing: ["סף מפל מתח"],
      pct: null,
      includesUpstream: up != null,
      includesDownstream: down != null,
    };
  } else {
    const total = drop.pct + (up ?? 0) + (down ?? 0);
    const partial = up == null || down == null;
    totalDrop = {
      status: total <= limit ? "pass" : "fail",
      detail: `סה״כ ${fmt(total, 2)}% ${total <= limit ? "≤" : ">"} ${fmt(limit, 2)}%${partial ? " (חלקי — לא כל המקטעים הוזנו)" : ""}`,
      missing: [
        ...(up == null ? ["מפל מתח במעלה הזרם"] : []),
        ...(down == null ? ["מפל מתח עד העומס הסופי"] : []),
      ],
      pct: total,
      includesUpstream: up != null,
      includesDownstream: down != null,
    };
  }

  const missing = Array.from(
    new Set([...izCheck.missing, ...i2Check.missing, ...drop.missing, ...totalDrop.missing]),
  );
  const checks = [izCheck, i2Check, drop, totalDrop];
  const anyFail = checks.some((c) => c.status === "fail" || c.status === "invalid");
  const overall: FeederResult["overall"] = anyFail
    ? "issues"
    : missing.length || checks.some((c) => c.status !== "pass")
      ? "incomplete"
      : "entered-checks-ok";

  return { length, izCorrected: izc, izCheck, i2Check, drop, totalDrop, missing, overall };
}