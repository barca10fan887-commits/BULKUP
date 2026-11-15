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

const SURPLUS: Record<Goal, number> = { lean_bulk: 250, bulk: 400, gain_weight: 550, strength: 300 };
const EXPERIENCE_SCALE: Record<Experience, number> = { beginner: 1.1, intermediate: 1, advanced: 0.8 };

export function suggestedSurplus(goal: Goal, experience: Experience): number {
  return Math.round((SURPLUS[goal] * EXPERIENCE_SCALE[experience]) / 25) * 25;
}

/** Suggested weekly gain as a fraction of body weight. */
const GAIN_RATE: Record<Experience, number> = { beginner: 0.005, intermediate: 0.0035, advanced: 0.0025 };
const GOAL_RATE_SCALE: Record<Goal, number> = { lean_bulk: 0.7, bulk: 1, gain_weight: 1.25, strength: 0.8 };

export function suggestedWeeklyGainKg(weightKg: number, experience: Experience, goal: Goal): number {
  return round(weightKg * GAIN_RATE[experience] * GOAL_RATE_SCALE[goal], 2);
}

export function proteinTarget(weightKg: number, goal: Goal): number {
  const perKg = goal === "lean_bulk" ? 2.2 : 2.0;
  return Math.round(weightKg * perKg);
}

export function computeTargets(i: BodyInputs): Targets {
  const maintenance = maintenanceCalories(i);
  const calories = Math.round((maintenance + suggestedSurplus(i.goal, i.experience)) / 10) * 10;
  const protein = proteinTarget(i.weightKg, i.goal);
  const fat = Math.round((calories * 0.27) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return {
    calories,
    protein,
    carbs,
    fat,
    waterMl: Math.round((i.weightKg * 35 + i.trainingDays * 70) / 250) * 250,
    weeklyGainKg: suggestedWeeklyGainKg(i.weightKg, i.experience, i.goal),
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

/** Weeks to reach the target at the planned rate. Null if already there or no rate. */
export function weeksToTarget(currentKg: number, targetKg: number, weeklyGainKg: number): number | null {
  const diff = targetKg - currentKg;
  if (diff <= 0 || weeklyGainKg <= 0) return null;
  return Math.ceil(diff / weeklyGainKg);
}

/** Macros from calories for a food: Atwater check used to sanity-check manual entries. */
export function caloriesFromMacros(protein: number, carbs: number, fat: number): number {
  return protein * 4 + carbs * 4 + fat * 9;
}
