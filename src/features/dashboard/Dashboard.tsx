import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Barcode, Camera, Check, ChevronRight, Plus } from "lucide-react";
import { getStatus } from "@/lib/api";
import { useProfile, useStore } from "@/data/store";
import { today, formatDay, addDays, nowTime } from "@/lib/dates";
import { currentWeight, dailyTotals, isScheduled, completedSessions, targetProgress, weightTrendPerWeek, goalStatus, waterOn } from "@/lib/stats";
import { todaysFocus } from "@/lib/focus";
import { GOAL_LABEL, simpleGoal } from "@/lib/calc";
import { recipeForDay, mentionedMeal } from "@/lib/mealPlan";
import { foodArt } from "@/lib/art";
import { Card } from "@/components/ui/Card";
import { ProgressBar, ProgressRing } from "@/components/ui/Progress";
import { Pill } from "@/components/ui/misc";
import { Art } from "@/components/Art";
import { kg, ml, signed } from "@/lib/format";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/Toast";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** The next meal of the day, for the "Up next" suggestion. */
function nextMeal(hour: number) {
  return mentionedMeal(hour < 10 ? "breakfast" : hour < 14 ? "lunch" : hour < 16 ? "snack" : "dinner")!;
}

export default function Dashboard() {
  const { data, add, remove } = useStore();
  const profile = useProfile();
  const toast = useToast();
  const date = today();
  const hour = new Date().getHours();
  const t = profile.targets;
  const totals = dailyTotals(data.foodEntries, date);
  const reminders = useMemo(
    () => todaysFocus(data, profile, date).filter((f) => !["calories", "protein", "water", "workout"].includes(f.id) && !f.id.startsWith("supp-")),
    [data, profile, date],
  );
  const weight = currentWeight(data.bodyEntries, profile);
  const status = goalStatus(profile, weight);
  const trend = weightTrendPerWeek(data.bodyEntries, addDays(date, -27), date);
  const routines = isScheduled(data.routines, date);
  const doneToday = completedSessions(data.workoutSessions).find((s) => s.date === date);
  const calLeft = Math.round(t.calories - totals.calories);
  const proLeft = Math.round(t.protein - totals.protein);
  const goal = simpleGoal(profile.goal);
  const over = calLeft < 0;
  const water = waterOn(data, date);
  const meal = nextMeal(hour);
  const suggestion = recipeForDay(profile, meal, date);
  const [aiOn, setAiOn] = useState(false);
  useEffect(() => {
    getStatus().then((st) => setAiOn(st.ai));
  }, []);

  const addWater = () => {
    const rec = add("waterLogs", { date, ml: 250 });
    toast.show({ message: "Added 250 ml", action: { label: "Undo", onClick: () => remove("waterLogs", rec.id) } });
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="mb-1">
        <p className="text-sm text-mist-400">{formatDay(date, { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight sm:text-3xl">
          {greeting()}, {profile.name}
        </h1>
      </header>

      {/* Today's numbers */}
      <Card className="animate-rise">
        <div className="flex items-center gap-5">
          <ProgressRing value={totals.calories} max={t.calories} size={124} stroke={10} label="Calories eaten" tone={calLeft <= 0 && goal !== "cut" ? "good" : "volt"}>
            <div>
              <p className="font-display text-2xl font-bold tabular-nums">{Math.abs(calLeft).toLocaleString()}</p>
              <p className="text-[11px] text-mist-400">{over ? "kcal over" : "kcal left"}</p>
            </div>
          </ProgressRing>
          <div className="flex min-w-0 flex-1 flex-col gap-3.5">
            <Metric label="Calories" value={totals.calories} goal={t.calories} unit="" tone={over && goal === "cut" ? "warn" : "volt"} />
            <Metric label="Protein" value={totals.protein} goal={t.protein} unit=" g" tone={proLeft <= 0 ? "good" : "volt"} />
            <p className="text-xs tabular-nums text-mist-500">
              Carbs {Math.round(totals.carbs)}/{t.carbs} g · Fat {Math.round(totals.fat)}/{t.fat} g
            </p>
          </div>
        </div>
        <div className={cn("mt-5 grid gap-2", aiOn ? "grid-cols-3" : "grid-cols-2")}>
          <QuickAction to="/food?add=search" icon={<Plus className="h-5 w-5" />} label="Log food" primary />
          <QuickAction to="/food?add=barcode" icon={<Barcode className="h-5 w-5" />} label="Scan" />
          {aiOn && <QuickAction to="/food?add=photo" icon={<Camera className="h-5 w-5" />} label="Photo" />}
        </div>
      </Card>

      {/* Up next: a meal idea for the next meal of the day */}
      <Link to="/coach" state={{ ask: `What should I have for ${meal} today?` }} className="group flex items-center gap-4 rounded-2xl border border-ink-800 bg-ink-900 p-4 transition hover:border-ink-700">
        <Art name={foodArt(suggestion.name)} size={60} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[.08em] text-volt-400">Up next · {meal}</p>
          <p className="truncate font-semibold">{suggestion.name}</p>
          <p className="text-sm text-mist-400">
            {suggestion.kcal} kcal · {suggestion.protein} g protein
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-mist-500 transition group-hover:translate-x-0.5" />
      </Link>

      {/* Water and training side by side */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="flex flex-col">
          <div className="flex items-start justify-between">
            <Art name="water" size={44} />
            <button onClick={addWater} aria-label="Add 250 ml of water" className="grid h-9 w-9 place-items-center rounded-full bg-volt-500 text-white transition active:scale-95">
              <Plus className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-3 text-sm text-mist-400">Water</p>
          <p className="font-display text-lg font-semibold tabular-nums">
            {ml(water)} <span className="text-sm font-normal text-mist-500">/ {ml(t.waterMl)}</span>
          </p>
          <ProgressBar className="mt-2" value={water} max={t.waterMl} tone={water >= t.waterMl ? "good" : "volt"} label="Water" />
        </Card>
        <Link to="/workouts" className="flex flex-col rounded-2xl border border-ink-800 bg-ink-900 p-4 transition hover:border-ink-700 sm:p-5">
          <Art name="lifter" size={44} />
          <p className="mt-3 text-sm text-mist-400">Training</p>
          {doneToday ? (
            <p className="flex items-center gap-1.5 font-semibold text-good">
              <Check className="h-4 w-4" /> Done today
            </p>
          ) : routines.length ? (
            <>
              <p className="truncate font-display text-lg font-semibold">{routines[0].name}</p>
              <p className="mt-auto pt-2 text-sm font-semibold text-volt-400">Start workout →</p>
            </>
          ) : (
            <>
              <p className="font-display text-lg font-semibold">Rest day</p>
              <p className="mt-auto pt-2 text-sm text-mist-500">Recovery counts too</p>
            </>
          )}
        </Link>
      </div>

      {/* Weight goal */}
      <Link to="/progress" className="rounded-2xl border border-ink-800 bg-ink-900 p-4 transition hover:border-ink-700 sm:p-5">
        <div className="flex items-center gap-4">
          <Art name="scale" size={52} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm text-mist-400">Weight</p>
              <Pill tone="volt">{GOAL_LABEL[goal]}</Pill>
            </div>
            <p className="font-display text-2xl font-bold tabular-nums">{kg(weight)}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-mist-500" />
        </div>
        {status.maintaining ? (
          <p className="mt-3 text-sm text-mist-400">{status.label}</p>
        ) : (
          <>
            <ProgressBar value={targetProgress(profile, weight)} max={100} className="mt-4" label="Progress to goal weight" tone={status.reached ? "good" : "volt"} />
            <div className="mt-2 flex justify-between text-xs text-mist-400">
              <span>{status.label}</span>
              <span>Goal {kg(profile.targetWeightKg)}</span>
            </div>
          </>
        )}
        {trend != null && <p className="mt-2 text-xs text-mist-500">Trend {signed(trend, 2)} kg/week · plan {signed(t.weeklyGainKg, 2)}</p>}
      </Link>

      <SupplementsQuick />

      {/* Other reminders (weigh-in, check-in) */}
      {reminders.length > 0 && (
        <ul className="flex flex-col gap-2">
          {reminders.slice(0, 2).map((f) => (
            <li key={f.id}>
              <Link to={f.to ?? "/"} className="flex items-center gap-3 rounded-2xl border border-ink-800 bg-ink-900 px-4 py-3 transition hover:border-ink-700">
                <span className="h-2 w-2 shrink-0 rounded-full bg-volt-400" />
                <p className="min-w-0 flex-1 text-sm font-semibold">{f.title}</p>
                <ChevronRight className="h-4 w-4 shrink-0 text-mist-500" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link to="/coach" className="flex items-center gap-4 rounded-2xl border border-ink-800 bg-ink-900 p-4 transition hover:border-ink-700">
        <Art name="muscle" size={52} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Ask your coach</p>
          <p className="truncate text-sm text-mist-400">Meal plans, recipes, workouts and more</p>
        </div>
        <ChevronRight className="h-5 w-5 text-mist-500" />
      </Link>
    </div>
  );
}

function Metric({ label, value, goal, unit, tone }: { label: string; value: number; goal: number; unit: string; tone: "volt" | "good" | "warn" }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="tabular-nums text-mist-400">
          <span className="font-semibold text-mist-100">{Math.round(value).toLocaleString()}</span> / {goal.toLocaleString()}
          {unit}
        </span>
      </div>
      <ProgressBar value={value} max={goal} tone={tone} label={label} />
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
      <div className="mb-3 flex items-center gap-3">
        <Art name="pill" size={36} />
        <p className="flex-1 font-semibold">Supplements</p>
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
              className={cn("inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition", done ? "border-good/30 bg-good/10 text-good" : "border-ink-600 bg-ink-850 text-mist-100 hover:border-volt-500/50")}
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
        "flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition active:scale-[.98]",
        primary ? "bg-volt-500 text-white hover:bg-volt-400" : "border border-ink-700 bg-ink-850 text-mist-100 hover:border-ink-600",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
