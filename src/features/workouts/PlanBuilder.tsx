import { useEffect, useMemo, useState } from "react";
import { useProfile, useStore } from "@/data/store";
import { GOAL_LABEL, simpleGoal } from "@/lib/calc";
import { generatePlan, planSummary, type Equipment } from "@/lib/workoutPlan";
import type { Experience } from "@/lib/types";
import { WEEKDAYS_SHORT } from "@/lib/dates";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { ChoiceGrid } from "@/features/onboarding/ProfileFields";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/Toast";

/** Builds a new weekly plan from the user's goal and replaces their current routines. Workout history is kept. */
export function PlanBuilder({ open, onClose }: { open: boolean; onClose(): void }) {
  const { data, addMany, remove, saveProfile } = useStore();
  const profile = useProfile();
  const toast = useToast();
  const goal = simpleGoal(profile.goal);
  const [days, setDays] = useState(profile.trainingDays);
  const [experience, setExperience] = useState<Experience>(profile.experience);
  const [equipment, setEquipment] = useState<Equipment>(profile.equipment ?? "gym");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDays(profile.trainingDays);
      setExperience(profile.experience);
      setEquipment(profile.equipment ?? "gym");
    }
  }, [open, profile]);

  const opts = { goal, experience, days, equipment };
  const plan = useMemo(() => generatePlan(opts), [goal, experience, days, equipment]); // eslint-disable-line react-hooks/exhaustive-deps

  async function apply() {
    setSaving(true);
    try {
      data.routines.forEach((r) => remove("routines", r.id));
      addMany("routines", plan);
      await saveProfile({ ...profile, trainingDays: days, experience, equipment });
      toast.show({ message: "Your new plan is ready" });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Build my plan"
      wide
      footer={
        <Button block size="lg" loading={saving} onClick={apply}>
          {data.routines.length ? "Replace my plan" : "Use this plan"}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm text-mist-400">
          Built for your goal: <span className="font-semibold text-mist-100">{GOAL_LABEL[goal]}</span>. Your workout history stays as it is.
        </p>
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-mist-300">Workouts per week</legend>
          <div className="grid grid-cols-7 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button key={n} type="button" aria-pressed={days === n} onClick={() => setDays(n)} className={cn("h-11 rounded-xl border font-semibold transition", days === n ? "border-volt-500 bg-volt-500 text-white" : "border-ink-600 bg-ink-900 text-mist-300")}>
                {n}
              </button>
            ))}
          </div>
        </fieldset>
        <ChoiceGrid label="Where do you train?" value={equipment} onChange={setEquipment} columns={3} options={[{ value: "gym", label: "Gym" }, { value: "dumbbells", label: "Home, dumbbells" }, { value: "bodyweight", label: "No equipment" }]} />
        <ChoiceGrid label="Experience" value={experience} onChange={setExperience} columns={3} options={[{ value: "beginner", label: "New" }, { value: "intermediate", label: "1-3 years" }, { value: "advanced", label: "3+ years" }]} />

        <div>
          <p className="mb-2 text-sm text-mist-300">{planSummary(opts)}</p>
          <ul className="flex flex-col gap-2">
            {plan.map((r) => (
              <li key={r.name} className="rounded-2xl border border-ink-700 bg-ink-900 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-xs text-mist-500">{r.scheduledDays.map((d) => WEEKDAYS_SHORT[d]).join(", ")}</p>
                </div>
                <p className="mt-1 text-xs text-mist-400">{r.exercises.map((e) => e.name).join(" · ")}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Sheet>
  );
}
