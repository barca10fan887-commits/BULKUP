import { useMemo, useState } from "react";
import { CalendarDays, ChevronRight, Dumbbell, History, Pencil, Play, Plus, Sparkles, Trash2, Trophy } from "lucide-react";
import type { Routine, WorkoutSession } from "@/lib/types";
import { useStore } from "@/data/store";
import { today, weekday, WEEKDAYS_SHORT, friendlyDay, formatDay } from "@/lib/dates";
import { completedSessions, isScheduled, lastPerformance, personalRecords, sessionVolume } from "@/lib/stats";
import { round } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState, PageHeader, Pill, Segmented } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/components/ui/cn";
import { RoutineEditor } from "./RoutineEditor";
import { PlanBuilder } from "./PlanBuilder";
import { Art } from "@/components/Art";
import { ActiveWorkout } from "./ActiveWorkout";
import { uid } from "@/lib/id";

export default function WorkoutsPage() {
  const { data, add } = useStore();
  const [tab, setTab] = useState<"plan" | "history">("plan");
  const [editing, setEditing] = useState<{ open: boolean; routine: Routine | null }>({ open: false, routine: null });
  const [builder, setBuilder] = useState(false);
  const active = data.workoutSessions.find((s) => !s.finishedAt);

  if (active) return <ActiveWorkout session={active} />;

  function start(r: Routine | null) {
    const now = new Date().toISOString();
    add("workoutSessions", {
      date: today(),
      routineId: r?.id,
      name: r?.name ?? "Quick workout",
      startedAt: now,
      exercises: (r?.exercises ?? []).map((e) => {
        const last = lastPerformance(data.workoutSessions, e.name);
        return {
          id: uid(),
          name: e.name,
          restSec: e.restSec,
          sets: Array.from({ length: e.sets }, (_, i) => ({ reps: 0, weightKg: last?.sets[i]?.weightKg ?? last?.sets[last.sets.length - 1]?.weightKg ?? 0, done: false })),
        };
      }),
    });
    window.scrollTo({ top: 0 });
  }

  return (
    <div>
      <PageHeader
        title="Train"
        action={
          <Button onClick={() => setBuilder(true)}>
            <Sparkles className="h-4 w-4" /> New plan
          </Button>
        }
      />
      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: "plan", label: "My plan" },
          { value: "history", label: "History" },
        ]}
      />
      {tab === "plan" && <Plan onStart={start} onEdit={(r) => setEditing({ open: true, routine: r })} onBuild={() => setBuilder(true)} onAdd={() => setEditing({ open: true, routine: null })} />}
      {tab === "history" && (
        <div className="flex flex-col gap-6">
          <HistoryList />
          <section>
            <h2 className="mb-2 text-sm font-semibold text-mist-300">Personal records</h2>
            <Records />
          </section>
        </div>
      )}
      <PlanBuilder open={builder} onClose={() => setBuilder(false)} />
      <RoutineEditor open={editing.open} routine={editing.routine} onClose={() => setEditing({ open: false, routine: null })} />
    </div>
  );
}

function Plan({ onStart, onEdit, onBuild, onAdd }: { onStart(r: Routine | null): void; onEdit(r: Routine): void; onBuild(): void; onAdd(): void }) {
  const { data } = useStore();
  const t = today();
  const todays = isScheduled(data.routines, t);
  const doneToday = completedSessions(data.workoutSessions).filter((s) => s.date === t);
  const wd = weekday(t);

  return (
    <div className="flex flex-col gap-4">
      {/* Week strip */}
      <Card>
        <CardHeader icon={<CalendarDays className="h-4 w-4" />} title="This week" />
        <div className="grid grid-cols-7 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const rs = data.routines.filter((r) => r.scheduledDays.includes(d));
            return (
              <div key={d} className={cn("flex min-h-[76px] flex-col items-center gap-1 rounded-2xl border px-1 py-2 text-center", d === wd ? "border-volt-500/60 bg-volt-500/10" : "border-ink-700 bg-ink-900")}>
                <span className={cn("text-[11px] font-semibold uppercase", d === wd ? "text-volt-300" : "text-mist-500")}>{WEEKDAYS_SHORT[d]}</span>
                {rs.length ? rs.map((r) => <span key={r.id} className="line-clamp-2 text-[10px] font-semibold leading-tight text-mist-100">{r.name}</span>) : <span className="text-[10px] text-mist-500">Rest</span>}
              </div>
            );
          })}
        </div>
      </Card>

      {doneToday.length > 0 && (
        <div className="rounded-2xl border border-good/30 bg-good/[.07] px-4 py-3 text-sm text-good">Completed today: {doneToday.map((s) => s.name).join(", ")}</div>
      )}

      {data.routines.length === 0 ? (
        <EmptyState icon={<Dumbbell className="h-5 w-5" />} title="No plan yet" body="Get a weekly plan built for your goal, or start a workout and add exercises as you go." action={<Button onClick={onBuild}>Build my plan</Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {[...todays, ...data.routines.filter((r) => !todays.includes(r))].map((r) => {
            const isToday = todays.includes(r);
            return (
              <Card key={r.id} className={cn(isToday && "border-volt-500/40")}>
                <div className="flex items-start justify-between gap-2">
                  <Art name={/lower|legs/i.test(r.name) ? "lifter" : /recovery/i.test(r.name) ? "water" : "muscle"} size={44} className="mr-1" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-display text-lg font-semibold">{r.name}</h3>
                      {isToday && <Pill tone="volt">Today</Pill>}
                    </div>
                    <p className="text-xs text-mist-500">
                      {r.exercises.length} exercises · {r.scheduledDays.length ? [...r.scheduledDays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEKDAYS_SHORT[d]).join(", ") : "Not scheduled"}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" aria-label={`Edit ${r.name}`} onClick={() => onEdit(r)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-mist-300">
                  {r.exercises.slice(0, 6).map((e) => (
                    <li key={e.id} className="flex justify-between gap-2">
                      <span className="truncate">{e.name}</span>
                      <span className="shrink-0 tabular-nums text-mist-500">
                        {e.sets} x {e.reps}
                      </span>
                    </li>
                  ))}
                  {r.exercises.length > 6 && <li className="text-xs text-mist-500">+{r.exercises.length - 6} more</li>}
                </ul>
                <Button block className="mt-4" variant={isToday ? "primary" : "secondary"} onClick={() => onStart(r)}>
                  <Play className="h-4 w-4" /> Start workout
                </Button>
              </Card>
            );
          })}
        </div>
      )}
      {data.routines.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="ghost" onClick={onAdd}>
            <Plus className="h-4 w-4" /> Add a day
          </Button>
          <Button variant="ghost" onClick={() => onStart(null)}>
            Start an empty workout
          </Button>
        </div>
      )}
    </div>
  );
}

function HistoryList() {
  const { data } = useStore();
  const [open, setOpen] = useState<WorkoutSession | null>(null);
  const sessions = completedSessions(data.workoutSessions).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  if (!sessions.length) return <EmptyState icon={<History className="h-5 w-5" />} title="No workouts logged yet" body="Finished workouts appear here with their sets, volume and duration." />;
  return (
    <>
      <ul className="flex flex-col gap-2">
        {sessions.map((s) => (
          <li key={s.id}>
            <button onClick={() => setOpen(s)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-ink-700 bg-ink-850 px-4 py-3 text-left transition hover:border-ink-600">
              <div className="min-w-0">
                <p className="truncate font-semibold">{s.name}</p>
                <p className="text-xs text-mist-500">
                  {friendlyDay(s.date)} · {s.durationMin ?? "?"} min · {s.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0)} sets
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-semibold tabular-nums text-mist-300">{round(sessionVolume(s)).toLocaleString()} kg</span>
                <ChevronRight className="h-4 w-4 text-mist-500" />
              </div>
            </button>
          </li>
        ))}
      </ul>
      <SessionDetail session={open} onClose={() => setOpen(null)} />
    </>
  );
}

function SessionDetail({ session, onClose }: { session: WorkoutSession | null; onClose(): void }) {
  const { remove } = useStore();
  const [confirm, setConfirm] = useState(false);
  if (!session) return null;
  return (
    <Sheet
      open
      onClose={() => {
        setConfirm(false);
        onClose();
      }}
      title={session.name}
      footer={
        confirm ? (
          <div className="flex gap-2">
            <Button variant="ghost" block onClick={() => setConfirm(false)}>
              Keep
            </Button>
            <Button
              variant="danger"
              block
              onClick={() => {
                remove("workoutSessions", session.id);
                setConfirm(false);
                onClose();
              }}
            >
              Delete workout
            </Button>
          </div>
        ) : (
          <Button variant="ghost" block onClick={() => setConfirm(true)}>
            <Trash2 className="h-4 w-4" /> Delete from history
          </Button>
        )
      }
    >
      <p className="mb-4 text-sm text-mist-400">
        {formatDay(session.date, { weekday: "long", day: "numeric", month: "long" })} · {session.durationMin ?? "?"} min · {round(sessionVolume(session)).toLocaleString()} kg volume
      </p>
      <div className="flex flex-col gap-3">
        {session.exercises.map((e) => (
          <div key={e.id} className="rounded-2xl border border-ink-700 bg-ink-900 p-3">
            <p className="font-semibold">{e.name}</p>
            <p className="mt-1 text-sm tabular-nums text-mist-300">
              {e.sets
                .filter((s) => s.done)
                .map((s) => `${s.reps} x ${s.weightKg} kg`)
                .join("  ·  ") || "No completed sets"}
            </p>
          </div>
        ))}
        {session.notes && <p className="rounded-2xl bg-ink-900 p-3 text-sm text-mist-300">{session.notes}</p>}
      </div>
    </Sheet>
  );
}

function Records() {
  const { data } = useStore();
  const prs = useMemo(() => personalRecords(data.workoutSessions), [data.workoutSessions]);
  if (!prs.length) return <EmptyState icon={<Trophy className="h-5 w-5" />} title="No personal records yet" body="Complete sets with a weight and reps and your best lifts will be tracked here automatically." />;
  return (
    <div className="overflow-x-auto rounded-2xl border border-ink-700 bg-ink-850">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="border-b border-ink-700 text-left text-[11px] uppercase tracking-[.08em] text-mist-500">
            <th className="px-4 py-3 font-semibold">Exercise</th>
            <th className="px-4 py-3 font-semibold">Heaviest</th>
            <th className="px-4 py-3 font-semibold">Est. 1RM</th>
            <th className="px-4 py-3 font-semibold">Date</th>
          </tr>
        </thead>
        <tbody>
          {prs.map((p) => (
            <tr key={p.exercise} className="border-b border-ink-700/60 last:border-0">
              <td className="px-4 py-3 font-semibold">{p.exercise}</td>
              <td className="px-4 py-3 tabular-nums">
                {p.bestWeightKg} kg x {p.bestWeightReps}
              </td>
              <td className="px-4 py-3 tabular-nums text-volt-300">{round(p.best1RM, 1)} kg</td>
              <td className="px-4 py-3 text-mist-400">{formatDay(p.date, { day: "numeric", month: "short" })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-3 text-xs text-mist-500">Estimated 1RM uses the Epley formula and is a guide only.</p>
    </div>
  );
}
