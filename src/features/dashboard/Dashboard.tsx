import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Barcode, Camera, CheckCircle2, ChevronRight, Dumbbell, Flame, Plus, Scale, Sparkles, Target } from "lucide-react";
import { useProfile, useStore } from "@/data/store";
import { today, formatDay, addDays } from "@/lib/dates";
import { currentWeight, dailyTotals, entriesOn, isScheduled, completedSessions, targetProgress, weightTrendPerWeek } from "@/lib/stats";
import { todaysFocus } from "@/lib/focus";
import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar, ProgressRing } from "@/components/ui/Progress";
import { Pill } from "@/components/ui/misc";
import { WaterCard } from "@/features/water/WaterCard";
import { kg, signed } from "@/lib/format";
import { cn } from "@/components/ui/cn";
import type { MealType } from "@/lib/types";

const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snacks"];
const MEAL_LABEL: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snacks: "Snacks" };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function Dashboard() {
  const { data } = useStore();
  const profile = useProfile();
  const date = today();
  const t = profile.targets;
  const totals = dailyTotals(data.foodEntries, date);
  const focus = useMemo(() => todaysFocus(data, profile, date), [data, profile, date]);
  const weight = currentWeight(data.bodyEntries, profile);
  const progress = targetProgress(profile, weight);
  const trend = weightTrendPerWeek(data.bodyEntries, addDays(date, -27), date);
  const routines = isScheduled(data.routines, date);
  const doneToday = completedSessions(data.workoutSessions).find((s) => s.date === date);
  const entries = entriesOn(data.foodEntries, date);
  const calLeft = Math.round(t.calories - totals.calories);
  const proLeft = Math.round(t.protein - totals.protein);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-mist-400">{formatDay(date, { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {greeting()}, {profile.name}
          </h1>
        </div>
        <Link to="/food" className="hidden sm:block">
          <span className="inline-flex h-11 items-center gap-2 rounded-xl bg-volt-500 px-4 font-semibold text-white shadow-glow hover:bg-volt-400">
            <Plus className="h-4 w-4" /> Log food
          </span>
        </Link>
      </header>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Calories & macros */}
        <Card className="animate-rise lg:col-span-3">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
            <ProgressRing value={totals.calories} max={t.calories} size={168} stroke={13} label="Calories eaten" tone={calLeft <= 0 ? "good" : "volt"}>
              <div>
                <p className="font-display text-3xl font-bold tabular-nums">{Math.round(totals.calories).toLocaleString()}</p>
                <p className="text-xs text-mist-400">of {t.calories.toLocaleString()} kcal</p>
                <p className={cn("mt-1 text-xs font-semibold", calLeft > 0 ? "text-volt-300" : "text-good")}>
                  {calLeft > 0 ? `${calLeft.toLocaleString()} left` : "Target hit"}
                </p>
              </div>
            </ProgressRing>
            <div className="flex w-full flex-1 flex-col gap-4">
              <Macro label="Protein" value={totals.protein} goal={t.protein} highlight />
              <Macro label="Carbs" value={totals.carbs} goal={t.carbs} />
              <Macro label="Fat" value={totals.fat} goal={t.fat} />
            </div>
          </div>
        </Card>

        {/* Today's focus */}
        <Card className="animate-rise lg:col-span-2" style={{ animationDelay: "60ms" }}>
          <CardHeader icon={<Sparkles className="h-4 w-4" />} title="Today's Focus" />
          <ul className="flex flex-col gap-2">
            {focus.slice(0, 5).map((f) => {
              const body = (
                <div className={cn("flex items-start gap-3 rounded-2xl border px-3.5 py-3 transition", f.tone === "action" ? "border-volt-500/30 bg-volt-500/[.07]" : f.tone === "good" ? "border-good/20 bg-good/[.06]" : "border-ink-700 bg-ink-900")}>
                  {f.tone === "good" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" /> : <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", f.tone === "action" ? "bg-volt-400 shadow-[0_0_8px_#4d95ff]" : "bg-mist-500")} />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-mist-100">{f.title}</p>
                    {f.detail && <p className="text-xs text-mist-400">{f.detail}</p>}
                  </div>
                  {f.to && <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-mist-500" />}
                </div>
              );
              return <li key={f.id}>{f.to ? <Link to={f.to}>{body}</Link> : body}</li>;
            })}
          </ul>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        <QuickAction to="/food?add=search" icon={<Plus className="h-5 w-5" />} label="Log food" />
        <QuickAction to="/food?add=barcode" icon={<Barcode className="h-5 w-5" />} label="Barcode" />
        <QuickAction to="/food?add=photo" icon={<Camera className="h-5 w-5" />} label="Photo scan" />
        <QuickAction to="/workouts" icon={<Dumbbell className="h-5 w-5" />} label="Workout" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Daily summary */}
        <Card className="lg:col-span-2">
          <CardHeader
            icon={<Flame className="h-4 w-4" />}
            title="Daily summary"
            action={
              <Link to="/food" className="inline-flex items-center gap-1 text-sm font-semibold text-volt-400">
                Diary <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />
          <div className="mb-3 flex flex-wrap gap-2">
            <Pill tone={calLeft <= 0 ? "good" : "muted"}>{calLeft <= 0 ? "Calorie target reached" : `${calLeft.toLocaleString()} kcal to go`}</Pill>
            <Pill tone={proLeft <= 0 ? "good" : "muted"}>{proLeft <= 0 ? "Protein target reached" : `${proLeft} g protein to go`}</Pill>
          </div>
          {entries.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-ink-600 px-4 py-6 text-center text-sm text-mist-400">Nothing logged yet today. Start with breakfast or a shake.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {MEALS.map((m) => {
                const items = entries.filter((e) => e.meal === m);
                const kcal = Math.round(items.reduce((a, e) => a + e.calories, 0));
                return (
                  <div key={m} className="rounded-2xl border border-ink-700 bg-ink-900 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[.08em] text-mist-500">{MEAL_LABEL[m]}</p>
                      <p className="text-xs font-semibold tabular-nums text-mist-300">{kcal} kcal</p>
                    </div>
                    {items.length ? (
                      <ul className="mt-1.5 space-y-0.5">
                        {items.map((e) => (
                          <li key={e.id} className="truncate text-sm text-mist-100">{e.name}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1.5 text-sm text-mist-500">Not logged</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {(calLeft > 0 || proLeft > 0) && entries.length > 0 && (
            <p className="mt-3 text-sm text-mist-300">
              Still to eat: <span className="font-semibold text-mist-100">{Math.max(calLeft, 0).toLocaleString()} kcal</span> and <span className="font-semibold text-mist-100">{Math.max(proLeft, 0)} g protein</span>.
            </p>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          {/* Weight goal */}
          <Card>
            <CardHeader
              icon={<Target className="h-4 w-4" />}
              title="Weight goal"
              subtitle={trend != null ? `Trend ${signed(trend, 2)} kg/week · plan +${t.weeklyGainKg}` : "Log weigh-ins to see your trend"}
              action={
                <Link to="/progress" aria-label="Log weight" className="grid h-9 w-9 place-items-center rounded-xl bg-ink-700 text-mist-300 hover:text-mist-100">
                  <Scale className="h-4 w-4" />
                </Link>
              }
            />
            <div className="flex items-baseline justify-between">
              <p className="font-display text-2xl font-bold tabular-nums">{kg(weight)}</p>
              <p className="text-sm text-mist-400">Target {kg(profile.targetWeightKg)}</p>
            </div>
            <ProgressBar value={progress} max={100} className="mt-3" label="Progress to target weight" />
            <div className="mt-2 flex justify-between text-xs text-mist-500">
              <span>Start {kg(profile.startWeightKg)}</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </Card>

          {/* Workout */}
          <Card>
            <CardHeader icon={<Dumbbell className="h-4 w-4" />} title="Training" />
            {doneToday ? (
              <p className="text-sm text-good">Completed {doneToday.name} today. Nice work.</p>
            ) : routines.length ? (
              <Link to="/workouts" className="flex items-center justify-between rounded-2xl border border-volt-500/30 bg-volt-500/[.07] px-4 py-3">
                <div>
                  <p className="text-xs text-mist-400">Scheduled today</p>
                  <p className="font-semibold">{routines.map((r) => r.name).join(" + ")}</p>
                </div>
                <span className="rounded-xl bg-volt-500 px-3 py-1.5 text-sm font-semibold text-white">Start</span>
              </Link>
            ) : (
              <p className="text-sm text-mist-400">Rest day. Recovery and food are where growth happens.</p>
            )}
          </Card>
        </div>
      </div>

      <WaterCard date={date} />
    </div>
  );
}

function Macro({ label, value, goal, highlight }: { label: string; value: number; goal: number; highlight?: boolean }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className={cn("font-semibold", highlight ? "text-mist-100" : "text-mist-300")}>{label}</span>
        <span className="tabular-nums text-mist-400">
          <span className="font-semibold text-mist-100">{Math.round(value)}</span> / {goal} g
        </span>
      </div>
      <ProgressBar value={value} max={goal} tone={value >= goal ? "good" : highlight ? "volt" : "muted"} label={`${label} progress`} />
    </div>
  );
}

function QuickAction({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="group flex flex-col items-center gap-2 rounded-2xl border border-ink-700 bg-ink-850 px-2 py-3.5 text-center transition hover:border-volt-500/40 hover:bg-ink-800">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-volt-500/12 text-volt-400 transition group-hover:bg-volt-500 group-hover:text-white">{icon}</span>
      <span className="text-xs font-semibold text-mist-300">{label}</span>
    </Link>
  );
}
