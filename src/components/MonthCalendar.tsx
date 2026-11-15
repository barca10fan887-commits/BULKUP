import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toISODate, today, WEEKDAYS_SHORT } from "@/lib/dates";
import type { ISODate } from "@/lib/types";
import { cn } from "./ui/cn";
import { Button } from "./ui/Button";

/** Month grid. `renderDay` returns small markers for a date. */
export function MonthCalendar({ selected, onSelect, renderDay }: { selected?: ISODate; onSelect?(d: ISODate): void; renderDay(d: ISODate): ReactNode }) {
  const init = selected ? new Date(selected + "T00:00:00") : new Date();
  const [cursor, setCursor] = useState(new Date(init.getFullYear(), init.getMonth(), 1));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (ISODate | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => toISODate(new Date(year, month, i + 1)))];
  while (cells.length % 7) cells.push(null);
  const t = today();
  const headers = [1, 2, 3, 4, 5, 6, 0].map((d) => WEEKDAYS_SHORT[d]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setCursor(new Date(year, month - 1, 1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <p className="font-display font-semibold">{cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
        <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => setCursor(new Date(year, month + 1, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {headers.map((h) => (
          <div key={h} className="pb-1 text-[11px] font-semibold uppercase tracking-wide text-mist-500">
            {h.slice(0, 2)}
          </div>
        ))}
        {cells.map((d, i) =>
          d ? (
            <button
              key={d}
              onClick={() => onSelect?.(d)}
              aria-label={new Date(d + "T00:00:00").toDateString()}
              aria-pressed={selected === d}
              className={cn(
                "flex aspect-square min-h-[42px] flex-col items-center justify-start gap-1 rounded-xl pt-1.5 text-sm tabular-nums transition",
                selected === d ? "bg-volt-500/15 ring-1 ring-volt-500" : "hover:bg-ink-800",
                d === t ? "font-bold text-volt-300" : d > t ? "text-mist-500" : "text-mist-100",
              )}
            >
              {Number(d.slice(8))}
              <span className="flex flex-wrap justify-center gap-0.5">{renderDay(d)}</span>
            </button>
          ) : (
            <div key={`e${i}`} />
          ),
        )}
      </div>
    </div>
  );
}

export function Dot({ className }: { className: string }) {
  return <span className={cn("h-1.5 w-1.5 rounded-full", className)} />;
}
