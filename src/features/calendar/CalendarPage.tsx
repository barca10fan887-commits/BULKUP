import { useState } from "react";
import { Link } from "react-router-dom";
import { Dumbbell, Pill, Scale, UtensilsCrossed, ClipboardCheck, Droplets } from "lucide-react";
import { useProfile, useStore } from "@/data/store";
import { formatDay, today } from "@/lib/dates";
import { completedSessions, dailyTotals, entriesOn, waterOn } from "@/lib/stats";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/misc";
import { MonthCalendar, Dot } from "@/components/MonthCalendar";
import { ProgressBar } from "@/components/ui/Progress";
import { ml } from "@/lib/format";

export default function CalendarPage() {
  const { data } = useStore();
  const profile = useProfile();
  const [sel, setSel] = useState(today());

  const foodDays = new Set(data.foodEntries.map((e) => e.date));
  const workoutDays = new Set(completedSessions(data.workoutSessions).map((s) => s.date));
  const weightDays = new Set(data.bodyEntries.filter((e) => e.weightKg).map((e) => e.date));
  const suppDays = new Set(data.supplementLogs.map((l) => l.date));
  const checkInDays = new Set(data.checkIns.map((c) => c.weekEnding));

  const totals = dailyTotals(data.foodEntries, sel);
  const entries = entriesOn(data.foodEntries, sel);
  const sessions = completedSessions(data.workoutSessions).filter((s) => s.date === sel);
  const weights = data.bodyEntries.filter((e) => e.date === sel && e.weightKg);
  const supps = data.supplementLogs.filter((l) => l.date === sel);
  const water = waterOn(data, sel);
  const checkIn = data.checkIns.find((c) => c.weekEnding === sel);

  return (
    <div>
      <PageHeader title="Calendar & history" subtitle="Pick a day to see everything you logged" />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <MonthCalendar
            selected={sel}
            onSelect={setSel}
            renderDay={(d) => (
              <>
                {foodDays.has(d) && <Dot className="bg-volt-400" />}
                {workoutDays.has(d) && <Dot className="bg-good" />}
                {weightDays.has(d) && <Dot className="bg-warn" />}
                {suppDays.has(d) && <Dot className="bg-mist-300" />}
                {checkInDays.has(d) && <Dot className="bg-[#c084fc]" />}
              </>
            )}
          />
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-mist-400">
            <Legend className="bg-volt-400" label="Food" />
            <Legend className="bg-good" label="Workout" />
            <Legend className="bg-warn" label="Weigh-in" />
            <Legend className="bg-mist-300" label="Supplements" />
            <Legend className="bg-[#c084fc]" label="Check-in" />
          </div>
        </Card>

        <div className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold">{formatDay(sel, { weekday: "long", day: "numeric", month: "long" })}</h2>
          <Card>
            <CardHeader icon={<UtensilsCrossed className="h-4 w-4" />} title="Food" subtitle={entries.length ? `${entries.length} entries` : "Nothing logged"} action={<Link to="/food" className="text-sm font-semibold text-volt-400">Diary</Link>} />
            {entries.length > 0 && (
              <>
                <p className="text-sm tabular-nums text-mist-300">
                  {Math.round(totals.calories).toLocaleString()} / {profile.targets.calories.toLocaleString()} kcal · {Math.round(totals.protein)} / {profile.targets.protein} g protein
                </p>
                <ProgressBar className="mt-2" value={totals.calories} max={profile.targets.calories} label="Calories" />
                <p className="mt-2 line-clamp-2 text-xs text-mist-500">{entries.map((e) => e.name).join(", ")}</p>
              </>
            )}
          </Card>
          <Card>
            <CardHeader icon={<Dumbbell className="h-4 w-4" />} title="Training" subtitle={sessions.length ? sessions.map((s) => `${s.name} (${s.durationMin ?? "?"} min)`).join(", ") : "No workout"} />
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardHeader icon={<Scale className="h-4 w-4" />} title="Weight" subtitle={weights.length ? `${weights[weights.length - 1].weightKg} kg` : "–"} />
            </Card>
            <Card>
              <CardHeader icon={<Droplets className="h-4 w-4" />} title="Water" subtitle={water ? ml(water) : "–"} />
            </Card>
          </div>
          <Card>
            <CardHeader
              icon={<Pill className="h-4 w-4" />}
              title="Supplements"
              subtitle={supps.length ? supps.map((l) => data.supplements.find((s) => s.id === l.supplementId)?.name ?? "Deleted supplement").join(", ") : "None logged"}
            />
          </Card>
          {checkIn && (
            <Card>
              <CardHeader icon={<ClipboardCheck className="h-4 w-4" />} title="Weekly check-in" subtitle={<Link to="/check-in" className="text-volt-400">View review</Link>} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Dot className={className} /> {label}
    </span>
  );
}
