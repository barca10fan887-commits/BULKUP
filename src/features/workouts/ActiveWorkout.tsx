import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Minus, Plus, Timer, Trash2, Trophy, X } from "lucide-react";
import type { SessionExercise, SetLog, WorkoutSession } from "@/lib/types";
import { useStore } from "@/data/store";
import { lastPerformance, personalRecords } from "@/lib/stats";
import { uid } from "@/lib/id";
import { EXERCISE_LIBRARY } from "@/lib/templates";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, num } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";

function useElapsed(startedAt: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function ActiveWorkout({ session }: { session: WorkoutSession }) {
  const { data, put, remove } = useStore();
  const toast = useToast();
  const elapsed = useElapsed(session.startedAt);
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null);
  const [confirm, setConfirm] = useState<"finish" | "discard" | null>(null);
  const [newExercise, setNewExercise] = useState("");
  const prsBefore = useMemo(() => new Map(personalRecords(data.workoutSessions).map((p) => [p.exercise.toLowerCase(), p.bestWeightKg])), [data.workoutSessions]);

  // Session edits are saved immediately so nothing is lost if the app closes.
  const save = (exercises: SessionExercise[], extra: Partial<WorkoutSession> = {}) => put("workoutSessions", { ...session, exercises, ...extra });
  const setSet = (exId: string, i: number, patch: Partial<SetLog>) =>
    save(session.exercises.map((e) => (e.id === exId ? { ...e, sets: e.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) } : e)));

  function toggleDone(ex: SessionExercise, i: number, lastSet?: SetLog) {
    const set = ex.sets[i];
    const done = !set.done;
    // When ticking an empty set, fill it from last time's matching set.
    const weightKg = done && !set.weightKg && lastSet ? lastSet.weightKg : set.weightKg;
    const reps = done && !set.reps && lastSet ? lastSet.reps : set.reps;
    setSet(ex.id, i, { done, weightKg, reps });
    if (done) {
      if (ex.restSec > 0) setRest({ until: Date.now() + ex.restSec * 1000, total: ex.restSec });
      const prev = prsBefore.get(ex.name.toLowerCase());
      if (prev != null && weightKg > prev && reps > 0) toast.show({ message: `New personal record: ${ex.name} ${weightKg} kg` });
    }
  }

  function finish() {
    const finishedAt = new Date().toISOString();
    const durationMin = Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60000);
    const exercises = session.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done || s.reps > 0) })).filter((e) => e.sets.length);
    if (!exercises.some((e) => e.sets.some((s) => s.done))) {
      toast.show({ tone: "error", message: "Tick off at least one set before finishing, or discard the workout." });
      setConfirm(null);
      return;
    }
    save(exercises, { finishedAt, durationMin });
    toast.show({ message: `Workout saved: ${durationMin} min` });
  }

  const doneSets = session.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
  const totalSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <Card className="sticky z-20 border-volt-500/30 bg-ink-850/95 backdrop-blur" style={{ top: "calc(env(safe-area-inset-top, 0px) + 8px)" }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.08em] text-volt-400">In progress</p>
            <h1 className="truncate font-display text-xl font-bold">{session.name}</h1>
            <p className="text-sm tabular-nums text-mist-400">
              {elapsed} · {doneSets}/{totalSets} sets
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirm("discard")}>
              Discard
            </Button>
            <Button onClick={() => setConfirm("finish")}>Finish</Button>
          </div>
        </div>
        {confirm && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-ink-600 bg-ink-900 px-3 py-2.5">
            <p className="text-sm">{confirm === "finish" ? "Finish and save this workout?" : "Discard this workout? Logged sets will be lost."}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              {confirm === "finish" ? (
                <Button size="sm" onClick={finish}>
                  Save
                </Button>
              ) : (
                <Button size="sm" variant="danger" onClick={() => remove("workoutSessions", session.id)}>
                  Discard
                </Button>
              )}
            </div>
          </div>
        )}
        {rest && <RestTimer rest={rest} onDone={() => setRest(null)} onAdjust={(s) => setRest((r) => (r ? { until: r.until + s * 1000, total: r.total + s } : r))} />}
      </Card>

      {session.exercises.map((ex) => {
        const last = lastPerformance(
          data.workoutSessions.filter((s) => s.id !== session.id),
          ex.name,
        );
        return (
          <Card key={ex.id}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="font-display font-semibold">{ex.name}</h2>
                <p className="text-xs text-mist-500">
                  {last ? `Last time: ${last.sets.map((s) => `${s.reps}x${s.weightKg}`).join(", ")} kg` : "No previous sets"} · Rest {ex.restSec}s
                </p>
              </div>
              <Button size="icon" variant="ghost" aria-label={`Remove ${ex.name}`} onClick={() => save(session.exercises.filter((e) => e.id !== ex.id))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-[28px_1fr_1fr_48px] items-center gap-2 px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-mist-500">
              <span>Set</span>
              <span>kg</span>
              <span>Reps</span>
              <span className="text-center">Done</span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {ex.sets.map((s, i) => (
                <li key={i} className={cn("grid grid-cols-[28px_1fr_1fr_48px] items-center gap-2 rounded-xl px-1 py-1 transition", s.done && "bg-good/[.07]")}>
                  <span className="text-center text-sm font-semibold tabular-nums text-mist-400">{i + 1}</span>
                  <input
                    aria-label={`Set ${i + 1} weight in kg`}
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    value={s.weightKg || ""}
                    placeholder={last?.sets[i] ? String(last.sets[i].weightKg) : "0"}
                    onChange={(e) => setSet(ex.id, i, { weightKg: num(e.target.value) ?? 0 })}
                    className="h-11 w-full rounded-xl border border-ink-600 bg-ink-900 px-3 text-center text-[16px] tabular-nums focus:border-volt-500 focus:outline-none"
                  />
                  <input
                    aria-label={`Set ${i + 1} reps`}
                    type="number"
                    inputMode="numeric"
                    value={s.reps || ""}
                    placeholder={last?.sets[i] ? String(last.sets[i].reps) : "0"}
                    onChange={(e) => setSet(ex.id, i, { reps: num(e.target.value) ?? 0 })}
                    className="h-11 w-full rounded-xl border border-ink-600 bg-ink-900 px-3 text-center text-[16px] tabular-nums focus:border-volt-500 focus:outline-none"
                  />
                  <button
                    aria-label={`Mark set ${i + 1} ${s.done ? "not done" : "done"}`}
                    aria-pressed={s.done}
                    onClick={() => toggleDone(ex, i, last?.sets[i])}
                    className={cn("mx-auto grid h-11 w-11 place-items-center rounded-xl border transition", s.done ? "border-good bg-good text-ink-950" : "border-ink-600 bg-ink-900 text-mist-500 hover:border-mist-500")}
                  >
                    <Check className="h-5 w-5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const prev = ex.sets[ex.sets.length - 1];
                  save(session.exercises.map((e) => (e.id === ex.id ? { ...e, sets: [...e.sets, { reps: prev?.reps ?? 0, weightKg: prev?.weightKg ?? 0, done: false }] } : e)));
                }}
              >
                <Plus className="h-4 w-4" /> Add set
              </Button>
              {ex.sets.length > 1 && (
                <Button size="sm" variant="ghost" onClick={() => save(session.exercises.map((e) => (e.id === ex.id ? { ...e, sets: e.sets.slice(0, -1) } : e)))}>
                  <Minus className="h-4 w-4" /> Remove set
                </Button>
              )}
            </div>
          </Card>
        );
      })}

      <Card>
        <datalist id="exercise-library-active">
          {EXERCISE_LIBRARY.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newExercise.trim()) return;
            save([...session.exercises, { id: uid(), name: newExercise.trim(), restSec: 90, sets: [0, 1, 2].map(() => ({ reps: 0, weightKg: 0, done: false })) }]);
            setNewExercise("");
          }}
        >
          <Input id="aw-new-ex" className="flex-1" label="Add an exercise" list="exercise-library-active" value={newExercise} onChange={(e) => setNewExercise(e.target.value)} placeholder="e.g. Dips" />
          <Button type="submit" variant="secondary">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </form>
        <Textarea id="aw-notes" className="mt-4" label="Notes" placeholder="How did it feel?" value={session.notes ?? ""} onChange={(e) => put("workoutSessions", { ...session, notes: e.target.value })} />
      </Card>
      <p className="flex items-center justify-center gap-1.5 text-xs text-mist-500">
        <Trophy className="h-3.5 w-3.5" /> Personal records are detected automatically when you tick a set.
      </p>
    </div>
  );
}

function RestTimer({ rest, onDone, onAdjust }: { rest: { until: number; total: number }; onDone(): void; onAdjust(sec: number): void }) {
  const [now, setNow] = useState(Date.now());
  const notified = useRef(false);
  useEffect(() => {
    notified.current = false;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [rest.until]);
  const left = Math.max(0, Math.ceil((rest.until - now) / 1000));
  useEffect(() => {
    if (left === 0 && !notified.current) {
      notified.current = true;
      navigator.vibrate?.([120, 80, 120]);
      const t = setTimeout(onDone, 2500);
      return () => clearTimeout(t);
    }
  }, [left, onDone]);
  const pct = rest.total ? (left / rest.total) * 100 : 0;
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-volt-500/30 bg-volt-500/[.08]">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="inline-flex items-center gap-2 text-sm font-semibold" aria-live="polite">
          <Timer className="h-4 w-4 text-volt-400" />
          {left > 0 ? `Rest ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "Rest over. Next set!"}
        </span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => onAdjust(-15)} aria-label="Shorten rest by 15 seconds">
            -15
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onAdjust(15)} aria-label="Extend rest by 15 seconds">
            +15
          </Button>
          <Button size="icon" variant="ghost" onClick={onDone} aria-label="Skip rest">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="h-1 bg-ink-700">
        <div className="h-full bg-volt-500 transition-[width] duration-300 ease-linear" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
