import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-ink-800 bg-ink-900 p-4 sm:p-5", className)} {...rest} />;
}

export function CardHeader({ title, subtitle, action, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && <span className="shrink-0 text-volt-400">{icon}</span>}
        <div className="min-w-0">
          <h2 className="truncate font-display text-[15px] font-semibold text-mist-100">{title}</h2>
          {subtitle && <p className="text-xs text-mist-400">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
