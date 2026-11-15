import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-mist-400" role="status">
      <Loader2 className="h-5 w-5 animate-spin text-volt-400" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ink-600 px-6 py-8 text-center">
      {icon && <div className="mb-1 grid h-11 w-11 place-items-center rounded-2xl bg-ink-700 text-mist-400">{icon}</div>}
      <p className="font-semibold text-mist-100">{title}</p>
      {body && <p className="max-w-sm text-sm text-mist-400">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight text-mist-100 sm:text-3xl" style={{ textWrap: "balance" } as never}>
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-mist-400">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: NoInfer<T>) => void; options: { value: NoInfer<T>; label: ReactNode }[]; className?: string }) {
  return (
    <div role="tablist" className={cn("flex gap-1 rounded-2xl border border-ink-700 bg-ink-900 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition",
            value === o.value ? "bg-volt-500 text-white shadow-glow" : "text-mist-400 hover:text-mist-100",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-mist-500">{label}</p>
      <p className="mt-0.5 font-display text-xl font-semibold tabular-nums text-mist-100">{value}</p>
      {sub && <p className="text-xs text-mist-400">{sub}</p>}
    </div>
  );
}

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "volt" | "good" | "warn" | "bad" }) {
  const tones = {
    muted: "bg-ink-700 text-mist-300",
    volt: "bg-volt-500/15 text-volt-300",
    good: "bg-good/15 text-good",
    warn: "bg-warn/15 text-warn",
    bad: "bg-bad/15 text-bad",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone])}>{children}</span>;
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-ink-700 bg-ink-900/60 px-3 py-2 text-xs leading-relaxed text-mist-400">{children}</p>;
}
