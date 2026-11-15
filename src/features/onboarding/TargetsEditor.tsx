import type { Targets } from "@/lib/types";
import { bmi, bmiCategory, maintenanceCalories, suggestedSurplus, weeksToTarget, type BodyInputs } from "@/lib/calc";
import { Input, num } from "@/components/ui/Field";
import { Disclaimer, Stat } from "@/components/ui/misc";
import { round } from "@/lib/format";

export const TARGETS_DISCLAIMER =
  "All calorie, macro and weight-gain numbers are estimates from standard formulas, not medical or dietetic advice. Everyone's metabolism differs: adjust based on how your weight actually changes, and check with a doctor or dietitian if you have a health condition.";

export function PlanSummary({ inputs, targetWeightKg, weeklyGainKg, showBmi = true }: { inputs: BodyInputs; targetWeightKg: number; weeklyGainKg: number; showBmi?: boolean }) {
  const maint = Math.round(maintenanceCalories(inputs) / 10) * 10;
  const surplus = suggestedSurplus(inputs.goal, inputs.experience);
  const b = bmi(inputs.weightKg, inputs.heightCm);
  const weeks = weeksToTarget(inputs.weightKg, targetWeightKg, weeklyGainKg);
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-2xl border border-ink-700 bg-ink-900 p-4 sm:grid-cols-4">
      <Stat label="Maintenance" value={`${maint.toLocaleString()}`} sub="kcal / day (est.)" />
      <Stat label="Suggested surplus" value={`+${surplus}`} sub="kcal / day" />
      <Stat label="Rate of gain" value={`+${round(weeklyGainKg, 2)}`} sub={weeks ? `kg / week · ~${weeks} weeks to target` : "kg / week"} />
      {showBmi && <Stat label="BMI (optional)" value={round(b, 1).toFixed(1)} sub={bmiCategory(b)} />}
    </div>
  );
}

export function TargetsEditor({ targets, onChange }: { targets: Targets; onChange(t: Targets): void }) {
  const set = (k: keyof Targets, v: string) => {
    const n = num(v);
    onChange({ ...targets, [k]: n ?? 0 });
  };
  const macroCals = targets.protein * 4 + targets.carbs * 4 + targets.fat * 9;
  const gap = Math.round(macroCals - targets.calories);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Input id="t-cal" label="Daily calories" type="number" inputMode="numeric" value={targets.calories || ""} onChange={(e) => set("calories", e.target.value)} suffix="kcal" />
        <Input id="t-protein" label="Protein" type="number" inputMode="numeric" value={targets.protein || ""} onChange={(e) => set("protein", e.target.value)} suffix="g" />
        <Input id="t-carbs" label="Carbohydrates" type="number" inputMode="numeric" value={targets.carbs || ""} onChange={(e) => set("carbs", e.target.value)} suffix="g" />
        <Input id="t-fat" label="Fat" type="number" inputMode="numeric" value={targets.fat || ""} onChange={(e) => set("fat", e.target.value)} suffix="g" />
        <Input id="t-water" label="Water" type="number" inputMode="numeric" step="250" value={targets.waterMl || ""} onChange={(e) => set("waterMl", e.target.value)} suffix="ml" />
        <Input id="t-gain" label="Planned gain" type="number" inputMode="decimal" step="0.05" value={targets.weeklyGainKg || ""} onChange={(e) => set("weeklyGainKg", e.target.value)} suffix="kg/wk" />
      </div>
      {Math.abs(gap) > 60 && (
        <p className="text-xs text-warn">
          Your macros add up to {Math.round(macroCals).toLocaleString()} kcal, {Math.abs(gap)} kcal {gap > 0 ? "above" : "below"} your calorie target.
        </p>
      )}
    </div>
  );
}

export { Disclaimer };
