import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { Routine, RoutineExercise } from "@/lib/types";
import { useStore } from "@/data/store";
import { uid } from "@/lib/id";
import { EXERCISE_LIBRARY } from "@/lib/templates";
import { WEEKDAYS_SHORT } from "@/lib/dates";
import { Sheet } from "@/components/ui/Sheet";
import { Input, num } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

type Draft = Omit<Routine, "id" | "createdAt" | "updatedAt">;

export function RoutineEditor({ routine, open, onClose }: { routine: Routine | null; open: boolean; onClose(): void }) {
  const { add, put, remove } = useStore();
  const [d, setD] = useState<Draft>({ name: "", description: "", exercises: [], scheduledDays: [] });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setD(routine ? { name: routine.name, description: routine.description ?? "", exercises: routine.exercises.map((e) => ({ ...e })), scheduledDays: [...routine.scheduledDays] } : { name: "", description: "", exercises: [newExercise()], scheduledDays: [] });
    setConfirmDelete(false);
    setError(null);
  }, [open, routine]);

  const setEx = (id: string, patch: Partial<RoutineExercise>) => setD((x) => ({ ...x, exercises: x.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const move = (i: number, dir: -1 | 1) =>
    setD((x) => {
      const ex = [...x.exercises];
      const j = i + dir;
      if (j < 0 || j >= ex.length) return x;
      [ex[i], ex[j]] = [ex[j], ex[i]];
      return { ...x, exercises: ex };
    });

  function save() {
    if (!d.name.trim()) return setError("Give the routine a name.");
    const exercises = d.exercises.filter((e) => e.name.trim());
    if (!exercises.length) return setError("Add at least one exercise.");
    const clean = { ...d, name: d.name.trim(), exercises };
    if (routine) put("routines", { ...routine, ...clean });
    else add("routines", clean);
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={routine ? "Edit routine" : "New routine"}
      wide
      footer={
        <div className="flex gap-2">
          {routine &&
            (confirmDelete ? (
              <Button
                variant="danger"
                onClick={() => {
                  remove("routines", routine.id);
                  onClose();
                }}
              >
                Confirm delete
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmDelete(true)} aria-label="Delete routine">
                <Trash2 className="h-4 w-4" />
              </Button>
            ))}
          <Button block onClick={save}>
            Save routine
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input id="re-name" label="Routine name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="e.g. Push day" />
        <Input id="re-desc" label="Description (optional)" value={d.description ?? ""} onChange={(e) => setD({ ...d, description: e.target.value })} />
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-mist-300">Scheduled days</legend>
          <div className="grid grid-cols-7 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
              const on = d.scheduledDays.includes(wd);
              return (
                <button
                  key={wd}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setD({ ...d, scheduledDays: on ? d.scheduledDays.filter((x) => x !== wd) : [...d.scheduledDays, wd] })}
                  className={cn("h-10 rounded-xl border text-xs font-semibold transition", on ? "border-volt-500 bg-volt-500 text-white" : "border-ink-600 bg-ink-900 text-mist-400")}
                >
                  {WEEKDAYS_SHORT[wd]}
                </button>
              );
            })}
          </div>
        </fieldset>
        <datalist id="exercise-library">
          {EXERCISE_LIBRARY.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <div>
          <p className="mb-2 text-[13px] font-medium text-mist-300">Exercises</p>
          <ul className="flex flex-col gap-2.5">
            {d.exercises.map((e, i) => (
              <li key={e.id} className="rounded-2xl border border-ink-700 bg-ink-900 p-3">
                <div className="flex items-center gap-1.5">
                  <Input id={`re-ex-${e.id}`} className="flex-1" aria-label={`Exercise ${i + 1} name`} list="exercise-library" placeholder="Exercise" value={e.name} onChange={(ev) => setEx(e.id, { name: ev.target.value })} />
                  <Button size="icon" variant="ghost" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === d.exercises.length - 1}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label={`Remove ${e.name || "exercise"}`} onClick={() => setD({ ...d, exercises: d.exercises.filter((x) => x.id !== e.id) })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Input id={`re-sets-${e.id}`} label="Sets" type="number" inputMode="numeric" value={e.sets} onChange={(ev) => setEx(e.id, { sets: Math.max(1, Math.min(12, num(ev.target.value) ?? 1)) })} />
                  <Input id={`re-reps-${e.id}`} label="Reps" value={e.reps} onChange={(ev) => setEx(e.id, { reps: ev.target.value })} placeholder="8-10" />
                  <Input id={`re-rest-${e.id}`} label="Rest" type="number" inputMode="numeric" value={e.restSec} onChange={(ev) => setEx(e.id, { restSec: num(ev.target.value) ?? 0 })} suffix="s" />
                </div>
              </li>
            ))}
          </ul>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => setD({ ...d, exercises: [...d.exercises, newExercise()] })}>
            <Plus className="h-4 w-4" /> Add exercise
          </Button>
        </div>
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      </div>
    </Sheet>
  );
}

const newExercise = (): RoutineExercise => ({ id: uid(), name: "", sets: 3, reps: "8-12", restSec: 90 });
