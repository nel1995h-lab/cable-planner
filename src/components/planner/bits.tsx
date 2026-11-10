import { AlertTriangle, CheckCircle2, CircleDashed, Ban, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type Tone = "ok" | "warn" | "fail" | "pending" | "info";

export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const Icon =
    tone === "ok" ? CheckCircle2 : tone === "fail" ? XCircle : tone === "warn" ? AlertTriangle : tone === "info" ? Ban : CircleDashed;
  return (
    <Badge variant={tone} className="gap-1 whitespace-nowrap font-medium">
      <Icon className="size-3.5" />
      {children}
    </Badge>
  );
}

/** Engineering symbols / numbers rendered left-to-right inside Hebrew text. */
export function Sym({ children, className }: { children: ReactNode; className?: string }) {
  return <bdi className={cn("ltr-num", className)}>{children}</bdi>;
}

export function NumField({
  label,
  sym,
  unit,
  value,
  onChange,
  required,
  missing,
  placeholder,
  hint,
}: {
  label: string;
  sym?: string;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  missing?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="flex items-center gap-1 text-muted-foreground">
        {sym && <Sym className="font-semibold text-foreground">{sym}</Sym>}
        <span>{label}</span>
        {required && <span className={missing ? "text-warn" : "text-muted-foreground"}>*</span>}
      </span>
      <div className="relative" dir="ltr">
        <Input
          dir="ltr"
          inputMode="decimal"
          value={value}
          placeholder={placeholder ?? "—"}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "ltr-num h-8 pr-10 text-sm",
            missing && "border-warn/60 bg-warn/5",
          )}
        />
        {unit && (
          <span className="ltr-num pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-2", className)}>
      <h3 className="section-title">{title}</h3>
      {children}
    </section>
  );
}