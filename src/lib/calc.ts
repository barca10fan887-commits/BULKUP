// Nutrition estimates. These are population-level formulas and are labelled
// in the UI as estimates, not medical advice.
import type { DailyActivity, Experience, Goal, Profile, Sex, Targets } from "./types";
import { round } from "./format";

export interface BodyInputs {
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  trainingDays: number;
  dailyActivity: DailyActivity;
  experience: Experience;
  goal: Goal;
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return m > 0 ? weightKg / (m * m) : 0;
}

export function bmiCategory(v: number): string {
  if (v < 18.5) return "Below the standard range";
  if (v < 25) return "Standard range";
  if (v < 30) return "Above the standard range";
  return "Well above the standard range";
}

/** Mifflin-St Jeor basal metabolic rate. Unspecified sex uses the midpoint. */
export function bmr({ age, sex, heightCm, weightKg }: Pick<BodyInputs, "age" | "sex" | "heightCm" | "weightKg">): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const offset = sex === "male" ? 5 : sex === "female" ? -161 : -78;
  return base + offset;
}

export function activityMultiplier(trainingDays: number, daily: DailyActivity): number {
  const training = 1.2 + Math.min(Math.max(trainingDays, 0), 7) * 0.05;
  const lifestyle = daily === "active" ? 0.15 : daily === "light" ? 0.075 : 0;
  return Math.min(training + lifestyle, 1.9);
}

export function maintenanceCalories(i: BodyInputs): number {
  return bmr(i) * activityMultiplier(i.trainingDays, i.dailyActivity);
}

export type SimpleGoal = "cut" | "maintain" | "bulk";

export function simpleGoal(goal: Goal): SimpleGoal {
  if (goal === "cut") return "cut";
  if (goal === "maintain" || goal === "strength") return "maintain";
  return "bulk";
}

export const GOAL_LABEL: Record<SimpleGoal, string> = { cut: "Cut", maintain: "Maintain", bulk: "Bulk" };

/** Daily calorie change from maintenance: a deficit for a cut, a surplus for a bulk. */
export function calorieAdjustment(goal: Goal, experience: Experience): number {
  const g = simpleGoal(goal);
  if (g === "maintain") return 0;
  if (g === "cut") return experience === "advanced" ? -400 : -500;
  const base = goal === "lean_bulk" ? 250 : goal === "gain_weight" ? 550 : 400;
  const scale = experience === "beginner" ? 1.1 : experience === "advanced" ? 0.8 : 1;
  return Math.round((base * scale) / 25) * 25;
}

/** @deprecated kept for older callers; same as calorieAdjustment. */
export const suggestedSurplus = calorieAdjustment;

/** Suggested weekly weight change in kg (negative when cutting). */
export function suggestedWeeklyChangeKg(weightKg: number, experience: Experience, goal: Goal): number {
  const g = simpleGoal(goal);
  if (g === "maintain") return 0;
  if (g === "cut") return round(-weightKg * 0.006, 2);
  const rate = experience === "beginner" ? 0.005 : experience === "intermediate" ? 0.0035 : 0.0025;
  const scale = goal === "lean_bulk" ? 0.7 : goal === "gain_weight" ? 1.25 : 1;
  return round(weightKg * rate * scale, 2);
}

export function proteinTarget(weightKg: number, goal: Goal): number {
  const g = simpleGoal(goal);
  const perKg = g === "cut" ? 2.2 : g === "maintain" ? 1.8 : 2.0;
  return Math.round(weightKg * perKg);
}

export function computeTargets(i: BodyInputs): Targets {
  const maintenance = maintenanceCalories(i);
  // Never suggest eating below basal metabolic rate (or 1,200 kcal) when cutting.
  const floor = Math.max(1200, bmr(i));
  const calories = Math.round(Math.max(floor, maintenance + calorieAdjustment(i.goal, i.experience)) / 10) * 10;
  const protein = proteinTarget(i.weightKg, i.goal);
  const fat = Math.max(Math.round(i.weightKg * 0.6), Math.round((calories * 0.27) / 9));
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return {
    calories,
    protein,
    carbs,
    fat,
    waterMl: Math.round((i.weightKg * 35 + i.trainingDays * 70) / 250) * 250,
    weeklyGainKg: suggestedWeeklyChangeKg(i.weightKg, i.experience, i.goal),
  };
}

export function inputsFromProfile(p: Profile, currentWeightKg?: number): BodyInputs {
  return {
    age: p.age,
    sex: p.sex,
    heightCm: p.heightCm,
    weightKg: currentWeightKg ?? p.startWeightKg,
    trainingDays: p.trainingDays,
    dailyActivity: p.dailyActivity,
    experience: p.experience,
    goal: p.goal,
  };
}

/** Weeks to reach the target at the planned rate. Null if already there or the rate points the wrong way. */
export function weeksToTarget(currentKg: number, targetKg: number, weeklyChangeKg: number): number | null {
  const diff = targetKg - currentKg;
  if (Math.abs(diff) < 0.05 || weeklyChangeKg === 0 || Math.sign(diff) !== Math.sign(weeklyChangeKg)) return null;
  return Math.ceil(diff / weeklyChangeKg);
}

/** Which way the user wants their weight to go. */
export function direction(startKg: number, targetKg: number): -1 | 0 | 1 {
  const d = targetKg - startKg;
  return Math.abs(d) < 0.25 ? 0 : d > 0 ? 1 : -1;
}

/** Macros from calories for a food: Atwater check used to sanity-check manual entries. */
export function caloriesFromMacros(protein: number, carbs: number, fat: number): number {
  return protein * 4 + carbs * 4 + fat * 9;
}
