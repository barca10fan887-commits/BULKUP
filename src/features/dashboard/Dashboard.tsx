import { useEffect, useMemo, useState } from "react";
import { getStatus } from "@/lib/api";
import { Link } from "react-router-dom";
import { Barcode, Bot, Camera, Check, CheckCircle2, ChevronRight, Dumbbell, Pill as PillIcon, Plus, Scale } from "lucide-react";
import { useProfile, useStore } from "@/data/store";
import { today, formatDay, addDays, nowTime } from "@/lib/dates";
import { currentWeight, dailyTotals, isScheduled, completedSessions, targetProgress, weightTrendPerWeek, goalStatus } from "@/lib/stats";
import { todaysFocus } from "@/lib/focus";
import { GOAL_LABEL, simpleGoal } from "@/lib/calc";
import { Card } from "@/components/ui/Card";
import { ProgressBar, ProgressRing } from "@/components/ui/Progress";
import { Pill } from "@/components/ui/misc";
import { WaterCard } from "@/features/water/WaterCard";
import { kg, signed } from "@/lib/format";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/Toast";

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
  const focus = useMemo(() => todaysFocus(data, profile, date).filter((f) => f.id !== "calories" && f.id !== "protein" && f.id !== "water"), [data, profile, date]);
  const weight = currentWeight(data.bodyEntries, profile);
  const status = goalStatus(profile, weight);
  const trend = weightTrendPerWeek(data.bodyEntries, addDays(date, -27), date);
  const routines = isScheduled(data.routines, date);
  const doneToday = completedSessions(data.workoutSessions).find((s) => s.date === date);
  const calLeft = Math.round(t.calories - totals.calories);
  const proLeft = Math.round(t.protein - totals.protein);
  const goal = simpleGoal(profile.goal);
  const over = calLeft < 0;
  const [aiOn, setAiOn] = useState(false);
  useEffect(() => {
    getStatus().then((st) => setAiOn(st.ai));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="text-sm text-mist-400">{formatDay(date, { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {greeting()}, {profile.name}
        </h1>
      </header>

      {/* Today's numbers */}
      <Card className="animate-rise">
        <div className="flex items-center gap-5">
          <ProgressRing value={totals.calories} max={t.calories} size={128} stroke={11} label="Calories eaten" tone={calLeft <= 0 && goal !== "cut" ? "good" : "volt"}>
            <div>
              <p className="font-display text-2xl font-bold tabular-nums">{Math.abs(calLeft).toLocaleString()}</p>
              <p className="text-[11px] text-mist-400">{over ? "kcal over" : "kcal left"}</p>
            </div>
          </ProgressRing>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="font-semibold">Calories</span>
                <span className="tabular-nums text-mist-400">
                  <span className="font-semibold text-mist-100">{Math.round(totals.calories).toLocaleString()}</span> / {t.calories.toLocaleString()}
                </span>
              </div>
              <ProgressBar value={totals.calories} max={t.calories} tone={over && goal === "cut" ? "warn" : "volt"} label="Calories" />
            </div>
            <div>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="font-semibold">Protein</span>
                <span className="tabular-nums text-mist-400">
                  <span className="font-semibold text-mist-100">{Math.round(totals.protein)}</span> / {t.protein} g
                </span>
              </div>
              <ProgressBar value={totals.protein} max={t.protein} tone={proLeft <= 0 ? "good" : "volt"} label="Protein" />
            </div>
            <p className="text-xs tabular-nums text-mist-500">
              Carbs {Math.round(totals.carbs)}/{t.carbs} g · Fat {Math.round(totals.fat)}/{t.fat} g
            </p>
          </div>
        </div>
        <div className={cn("mt-4 grid gap-2", aiOn ? "grid-cols-3" : "grid-cols-2")}>
          <QuickAction to="/food?add=search" icon={<Plus className="h-5 w-5" />} label="Log food" primary />
          <QuickAction to="/food?add=barcode" icon={<Barcode className="h-5 w-5" />} label="Scan barcode" />
          {aiOn && <QuickAction to="/food?add=photo" icon={<Camera className="h-5 w-5" />} label="Photo" />}
        </div>
      </Card>

      {/* Reminders for today (workout, supplements, weigh-in, check-in) */}
      {focus.length > 0 && (
        <ul className="flex flex-col gap-2">
          {focus.slice(0, 3).map((f) => {
            const body = (
              <div className={cn("flex items-center gap-3 rounded-2xl border px-4 py-3", f.tone === "good" ? "border-good/20 bg-good/[.06]" : "border-ink-700 bg-ink-850")}>
                {f.tone === "good" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-good" /> : <span className={cn("h-2 w-2 shrink-0 rounded-full", f.tone === "action" ? "bg-volt-400" : "bg-mist-500")} />}
                <p className="min-w-0 flex-1 text-sm font-semibold">{f.title}</p>
                {f.to && <ChevronRight className="h-4 w-4 shrink-0 text-mist-500" />}
              </div>
            );
            return <li key={f.id}>{f.to ? <Link to={f.to}>{body}</Link> : body}</li>;
          })}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Weight goal */}
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-mist-300">Weight</p>
                <Pill tone="volt">{GOAL_LABEL[goal]}</Pill>
              </div>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums">{kg(weight)}</p>
            </div>
            <Link to="/progress" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-ink-700 px-3 text-sm font-semibold text-mist-100 hover:bg-ink-600">
              <Scale className="h-4 w-4" /> Progress
            </Link>
          </div>
          {status.maintaining ? (
            <p className="mt-3 text-sm text-mist-400">{status.label}</p>
          ) : (
            <>
              <ProgressBar value={targetProgress(profile, weight)} max={100} className="mt-3" label="Progress to goal weight" tone={status.reached ? "good" : "volt"} />
              <div className="mt-2 flex justify-between text-xs text-mist-400">
                <span>{status.label}</span>
                <span>Goal {kg(profile.targetWeightKg)}</span>
              </div>
            </>
          )}
          {trend != null && <p className="mt-2 text-xs text-mist-500">Trend {signed(trend, 2)} kg/week · plan {signed(t.weeklyGainKg, 2)}</p>}
        </Card>

        {/* Training */}
        <Card>
          <p className="text-sm font-semibold text-mist-300">Training</p>
          {doneToday ? (
            <p className="mt-2 flex items-center gap-2 text-good">
              <CheckCircle2 className="h-5 w-5" /> {doneToday.name} done today
            </p>
          ) : routines.length ? (
            <>
              <p className="mt-1 font-display text-xl font-semibold">{routines.map((r) => r.name).join(" + ")}</p>
              <Link to="/workouts" className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-volt-500 font-semibold text-white shadow-glow hover:bg-volt-400">
                <Dumbbell className="h-4 w-4" /> Start workout
              </Link>
            </>
          ) : (
            <p className="mt-2 text-sm text-mist-400">Rest day. Recovery is part of the plan.</p>
          )}
        </Card>
      </div>

      <WaterCard date={date} />
      <SupplementsQuick />

      <Link to="/coach" className="flex items-center gap-3 rounded-3xl border border-ink-700 bg-ink-850 p-4 transition hover:border-volt-500/40">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-volt-500/15 text-volt-400">
          <Bot className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Ask your coach</p>
          <p className="truncate text-sm text-mist-400">"What should I eat today?"</p>
        </div>
        <ChevronRight className="h-5 w-5 text-mist-500" />
      </Link>
    </div>
  );
}

/** One-tap supplement logging. Hidden until the user adds a supplement. */
function SupplementsQuick() {
  const { data, add } = useStore();
  const toast = useToast();
  const t = today();
  const supps = data.supplements.filter((s) => s.active);
  if (!supps.length) return null;
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-mist-300">
          <PillIcon className="h-4 w-4" /> Supplements
        </p>
        <Link to="/supplements" className="text-sm font-semibold text-volt-400">
          Manage
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {supps.map((s) => {
          const taken = data.supplementLogs.filter((l) => l.supplementId === s.id && l.date === t).reduce((a, l) => a + l.servings, 0);
          const done = taken >= s.dailyServings;
          return (
            <button
              key={s.id}
              disabled={done}
              onClick={() => {
                let foodEntryId: string | undefined;
                if (s.calories > 0) foodEntryId = add("foodEntries", { date: t, meal: "snacks", name: s.name, servingLabel: `${s.servingAmount} ${s.servingUnit}`, quantity: 1, calories: s.calories, protein: s.protein, carbs: s.carbs, fat: s.fat, source: "supplement" }).id;
                add("supplementLogs", { date: t, supplementId: s.id, servings: 1, time: nowTime(), foodEntryId });
                toast.show({ message: `Logged ${s.name}` });
              }}
              className={cn("inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition", done ? "border-good/30 bg-good/10 text-good" : "border-ink-600 bg-ink-900 text-mist-100 hover:border-volt-500/50")}
            >
              {done ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {s.name}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function QuickAction({ to, icon, label, primary }: { to: string; icon: React.ReactNode; label: string; primary?: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        "flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition",
        primary ? "bg-volt-500 text-white shadow-glow hover:bg-volt-400" : "border border-ink-600 bg-ink-900 text-mist-100 hover:border-ink-500",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
