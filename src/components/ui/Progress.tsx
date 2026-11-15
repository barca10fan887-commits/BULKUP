import type { ReactNode } from "react";
import { cn } from "./cn";

export function ProgressBar({ value, max, className, tone = "volt", label }: { value: number; max: number; className?: string; tone?: "volt" | "good" | "warn" | "muted"; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const color = { volt: "bg-volt-500", good: "bg-good", warn: "bg-warn", muted: "bg-mist-500" }[tone];
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-ink-700", className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={Math.round(max)} aria-label={label}>
      <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ProgressRing({ value, max, size = 132, stroke = 11, children, label, tone = "volt" }: { value: number; max: number; size?: number; stroke?: number; children?: ReactNode; label?: string; tone?: "volt" | "good" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={Math.round(max)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1c212b" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone === "good" ? "#2fd38a" : "#1f75ff"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
