// Profile form sections shared by onboarding and Settings > Edit profile.
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import type { DailyActivity, Experience, Goal, Sex } from "@/lib/types";
import { Input, Textarea, Toggle, num } from "@/components/ui/Field";
import { cn } from "@/components/ui/cn";
import { DIET_OPTIONS } from "@/lib/templates";
import { simpleGoal, type SimpleGoal } from "@/lib/calc";

export interface ProfileDraft {
  name: string;
  age?: number;
  sex: Sex;
  heightCm?: number;
  startWeightKg?: number;
  targetWeightKg?: number;
  experience: Experience;
  trainingDays: number;
  goal: Goal;
  dailyActivity: DailyActivity;
  dietaryPreferences: string[];
  dietNotes: string;
  usesCreatine: boolean;
  usesProteinPowder: boolean;
  usesMassGainer: boolean;
}

export type Errors = Partial<Record<keyof ProfileDraft, string>>;

export function validateDraft(d: ProfileDraft, step: "goal" | "body" | "all"): Errors {
  const e: Errors = {};
  if (step === "goal" || step === "all") {
    if (!d.name.trim()) e.name = "Enter your name.";
  }
  if (step === "body" || step === "all") {
    if (d.age == null || d.age < 13 || d.age > 100) e.age = "Enter an age between 13 and 100.";
    if (d.heightCm == null || d.heightCm < 120 || d.heightCm > 230) e.heightCm = "Enter a height between 120 and 230 cm.";
    if (d.startWeightKg == null || d.startWeightKg < 35 || d.startWeightKg > 250) e.startWeightKg = "Enter a weight between 35 and 250 kg.";
    const g = simpleGoal(d.goal);
    if (g !== "maintain") {
      if (d.targetWeightKg == null || d.targetWeightKg < 35 || d.targetWeightKg > 250) e.targetWeightKg = "Enter a goal weight between 35 and 250 kg.";
      else if (d.startWeightKg != null && g === "bulk" && d.targetWeightKg <= d.startWeightKg) e.targetWeightKg = "For a bulk, your goal weight should be above your current weight.";
      else if (d.startWeightKg != null && g === "cut" && d.targetWeightKg >= d.startWeightKg) e.targetWeightKg = "For a cut, your goal weight should be below your current weight.";
    }
  }
  return e;
}

/** Maintenance keeps the current weight as the goal. */
export function effectiveTarget(d: ProfileDraft): number | undefined {
  return simpleGoal(d.goal) === "maintain" ? d.startWeightKg : d.targetWeightKg;
}

const GOALS: { value: SimpleGoal; label: string; description: string }[] = [
  { value: "cut", label: "Cut", description: "Lose fat, keep muscle" },
  { value: "maintain", label: "Maintain", description: "Stay the same weight" },
  { value: "bulk", label: "Bulk", description: "Build muscle and size" },
];

export function GoalFields({ d, set, errors }: { d: ProfileDraft; set: SetDraft; errors: Errors }) {
  const current = simpleGoal(d.goal);
  return (
    <div className="flex flex-col gap-5">
      <Input id="p-name" label="Your name" autoComplete="given-name" value={d.name} onChange={(e) => set({ name: e.target.value })} error={errors.name} />
      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-mist-300">What's your goal?</legend>
        <div className="flex flex-col gap-2">
          {GOALS.map((g) => {
            const active = current === g.value;
            return (
              <button
                key={g.value}
                type="button"
                aria-pressed={active}
                onClick={() => set({ goal: g.value })}
                className={cn("flex items-center justify-between rounded-2xl border px-4 py-4 text-left transition", active ? "border-volt-500 bg-volt-500/10 shadow-glow" : "border-ink-600 bg-ink-900 hover:border-ink-500")}
              >
                <span>
                  <span className="block font-display text-lg font-semibold">{g.label}</span>
                  <span className="block text-sm text-mist-400">{g.description}</span>
                </span>
                <span className={cn("grid h-6 w-6 place-items-center rounded-full border-2", active ? "border-volt-500 bg-volt-500" : "border-ink-500")}>{active && <Check className="h-3.5 w-3.5 text-white" />}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}

export function ChoiceGrid<T extends string | number>({
  value,
  onChange,
  options,
  columns = 2,
  label,
}: {
  value: T;
  onChange(v: T): void;
  options: { value: T; label: ReactNode; description?: ReactNode }[];
  columns?: number;
  label: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-[13px] font-medium text-mist-300">{label}</legend>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              type="button"
              key={String(o.value)}
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={cn(
                "relative rounded-2xl border px-3.5 py-3 text-left transition",
                active ? "border-volt-500 bg-volt-500/10 shadow-glow" : "border-ink-600 bg-ink-900 hover:border-ink-500",
              )}
            >
              <span className={cn("block text-sm font-semibold", active ? "text-mist-100" : "text-mist-300")}>{o.label}</span>
              {o.description && <span className="mt-0.5 block text-xs text-mist-500">{o.description}</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

type SetDraft = (patch: Partial<ProfileDraft>) => void;

export function BodyFields({ d, set, errors, withAge = true }: { d: ProfileDraft; set: SetDraft; errors: Errors; withAge?: boolean }) {
  const g = simpleGoal(d.goal);
  return (
    <div className="flex flex-col gap-4">
      {withAge && (
        <div className="grid grid-cols-2 gap-3">
          <Input id="p-age" label="Age" type="number" inputMode="numeric" value={d.age ?? ""} onChange={(e) => set({ age: num(e.target.value) })} error={errors.age} suffix="yrs" />
          <Input id="p-height" label="Height" type="number" inputMode="decimal" value={d.heightCm ?? ""} onChange={(e) => set({ heightCm: num(e.target.value) })} error={errors.heightCm} suffix="cm" />
        </div>
      )}
      <div className={cn("grid gap-3", g === "maintain" ? "grid-cols-1" : "grid-cols-2")}>
        <Input id="p-weight" label="Current weight" type="number" inputMode="decimal" step="0.1" value={d.startWeightKg ?? ""} onChange={(e) => set({ startWeightKg: num(e.target.value) })} error={errors.startWeightKg} suffix="kg" />
        {g !== "maintain" && (
          <Input id="p-target" label="Goal weight" type="number" inputMode="decimal" step="0.1" value={d.targetWeightKg ?? ""} onChange={(e) => set({ targetWeightKg: num(e.target.value) })} error={errors.targetWeightKg} suffix="kg" hint={g === "cut" ? "Lower than now" : "Higher than now"} />
        )}
      </div>
      {withAge && (
        <ChoiceGrid
          label="Sex (only used to estimate calories)"
          value={d.sex}
          onChange={(sex) => set({ sex })}
          columns={3}
          options={[
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
            { value: "unspecified", label: "Skip" },
          ]}
        />
      )}
    </div>
  );
}

export function TrainingFields({ d, set, showActivity = false }: { d: ProfileDraft; set: SetDraft; showActivity?: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-mist-300">Workouts per week</legend>
        <div className="grid grid-cols-7 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={d.trainingDays === n}
              onClick={() => set({ trainingDays: n })}
              className={cn("h-12 rounded-xl border font-display text-lg font-semibold transition", d.trainingDays === n ? "border-volt-500 bg-volt-500 text-white shadow-glow" : "border-ink-600 bg-ink-900 text-mist-300")}
            >
              {n}
            </button>
          ))}
        </div>
      </fieldset>
      <ChoiceGrid
        label="Gym experience"
        value={d.experience}
        onChange={(experience) => set({ experience })}
        columns={3}
        options={[
          { value: "beginner", label: "New" },
          { value: "intermediate", label: "1-3 years" },
          { value: "advanced", label: "3+ years" },
        ]}
      />
      {showActivity && (
        <ChoiceGrid
          label="Activity outside the gym"
          value={d.dailyActivity}
          onChange={(dailyActivity) => set({ dailyActivity })}
          columns={3}
          options={[
            { value: "sedentary", label: "Mostly sitting" },
            { value: "light", label: "On my feet some" },
            { value: "active", label: "Physical job" },
          ]}
        />
      )}
    </div>
  );
}

export function DietFields({ d, set }: { d: ProfileDraft; set: SetDraft }) {
  const toggle = (opt: string) => {
    if (opt === "No restrictions") return set({ dietaryPreferences: d.dietaryPreferences.includes(opt) ? [] : [opt] });
    const cur = d.dietaryPreferences.filter((x) => x !== "No restrictions");
    set({ dietaryPreferences: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] });
  };
  return (
    <div className="flex flex-col gap-5">
      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-mist-300">Dietary preferences</legend>
        <div className="flex flex-wrap gap-2">
          {DIET_OPTIONS.map((o) => {
            const on = d.dietaryPreferences.includes(o);
            return (
              <button
                type="button"
                key={o}
                aria-pressed={on}
                onClick={() => toggle(o)}
                className={cn("inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition", on ? "border-volt-500 bg-volt-500/15 text-volt-300" : "border-ink-600 bg-ink-900 text-mist-300")}
              >
                {on && <Check className="h-3.5 w-3.5" />}
                {o}
              </button>
            );
          })}
        </div>
      </fieldset>
      <Textarea id="p-diet-notes" label="Anything else about how you eat? (optional)" placeholder="e.g. no seafood, small appetite in the morning" value={d.dietNotes} onChange={(e) => set({ dietNotes: e.target.value })} />
      <div className="rounded-2xl border border-ink-700 bg-ink-900 px-4 py-2">
        <Toggle label="I use creatine" checked={d.usesCreatine} onChange={(v) => set({ usesCreatine: v })} />
        <Toggle label="I use protein powder" checked={d.usesProteinPowder} onChange={(v) => set({ usesProteinPowder: v })} />
        <Toggle label="I use a mass gainer" checked={d.usesMassGainer} onChange={(v) => set({ usesMassGainer: v })} />
      </div>
    </div>
  );
}
