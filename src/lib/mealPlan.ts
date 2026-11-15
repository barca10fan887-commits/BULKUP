// Day and week meal plans for the built-in coach. Deterministic per date, so
// asking about "Tuesday's breakfast" always gives the same answer as the plan,
// and consecutive days get different recipes.
import type { ISODate, Profile } from "./types";
import { RECIPES, type Recipe } from "./coachKnowledge";
import { addDays, formatDay, parseISODate, today as todayISO, weekday } from "./dates";
import { simpleGoal } from "./calc";

export type Meal = Recipe["meal"];
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
// Share of the day's calories each main meal should provide.
const SHARE: Record<Exclude<Meal, "snack">, number> = { breakfast: 0.25, lunch: 0.3, dinner: 0.3 };

/** Finds which day a question is about. Returns null if no day is mentioned. */
export function parseDay(text: string, today: ISODate = todayISO()): { date: ISODate; label: string } | null {
  const s = text.toLowerCase();
  if (/day after tomorrow/.test(s)) return { date: addDays(today, 2), label: formatDay(addDays(today, 2), { weekday: "long" }) };
  if (/\b(tomorrow|tmrw|tmr)\b/.test(s)) return { date: addDays(today, 1), label: "tomorrow" };
  if (/\b(today|tonight|this (morning|arvo|afternoon|evening))\b/.test(s)) return { date: today, label: /tonight/.test(s) ? "tonight" : "today" };
  const idx = DAY_NAMES.findIndex((d) => new RegExp(`\\b${d}\\b|\\b${d.slice(0, 3)}\\b`).test(s));
  if (idx >= 0) {
    let diff = (idx - weekday(today) + 7) % 7;
    if (diff === 0 && /next/.test(s)) diff = 7;
    const date = addDays(today, diff);
    return { date, label: diff === 0 ? "today" : formatDay(date, { weekday: "long" }) };
  }
  return null;
}

export function mentionsWeek(text: string): boolean {
  return /\b(week|weekly|7 days|seven days|next few days)\b/i.test(text);
}

export function mentionedMeal(text: string): Meal | null {
  const s = text.toLowerCase();
  if (/breakfast|brekky|brekkie/.test(s)) return "breakfast";
  if (/lunch/.test(s)) return "lunch";
  if (/dinner|tea tonight|supper|tonight/.test(s)) return "dinner";
  if (/snack/.test(s)) return "snack";
  return null;
}

function allowed(profile: Profile, r: Recipe): boolean {
  const prefs = profile.dietaryPreferences.map((p) => p.toLowerCase());
  if (prefs.includes("vegan") && !r.vegan) return false;
  if ((prefs.includes("vegetarian") || prefs.includes("vegan")) && !r.vegetarian) return false;
  if (prefs.includes("pescatarian") && !r.vegetarian && !/salmon|tuna|fish/i.test(r.name)) return false;
  return true;
}

/** Recipes that suit this person for a meal. Lunch and dinner borrow from each other when choice is thin. */
export function poolFor(profile: Profile, meal: Meal): Recipe[] {
  let pool = RECIPES.filter((r) => r.meal === meal && allowed(profile, r));
  if (pool.length < 4 && (meal === "lunch" || meal === "dinner")) {
    const other = meal === "lunch" ? "dinner" : "lunch";
    pool = [...pool, ...RECIPES.filter((r) => r.meal === other && allowed(profile, r))];
  }
  if (!pool.length) pool = RECIPES.filter((r) => r.meal === meal);
  return pool;
}

const dayNumber = (date: ISODate) => Math.floor(parseISODate(date).getTime() / 86_400_000);
const OFFSET: Record<Meal, number> = { breakfast: 0, lunch: 3, dinner: 5, snack: 2 };

/** The recipe for a meal on a given day. Rotates through the pool so consecutive days differ. */
export function recipeForDay(profile: Profile, meal: Meal, date: ISODate, shift = 0): Recipe {
  const pool = poolFor(profile, meal);
  return pool[(((dayNumber(date) + OFFSET[meal] + shift) % pool.length) + pool.length) % pool.length];
}

export interface PlannedMeal {
  meal: Meal;
  recipe: Recipe;
  portion: number;
  kcal: number;
  protein: number;
}

export interface DayPlan {
  date: ISODate;
  meals: PlannedMeal[];
  kcal: number;
  protein: number;
}

const roundPortion = (n: number) => Math.round(n * 4) / 4; // quarter portions

/** A full day sized to the person's calorie target: three meals plus snacks to fill the gap. */
export function dayPlan(profile: Profile, date: ISODate): DayPlan {
  const target = profile.targets.calories;
  const cutting = simpleGoal(profile.goal) === "cut";
  const meals: PlannedMeal[] = (["breakfast", "lunch", "dinner"] as const).map((meal) => {
    const recipe = recipeForDay(profile, meal, date);
    const portion = Math.min(1.75, Math.max(0.75, roundPortion((target * SHARE[meal]) / recipe.kcal)));
    return { meal, recipe, portion, kcal: Math.round(recipe.kcal * portion), protein: Math.round(recipe.protein * portion) };
  });
  // Fill the rest with snacks (lower-calorie ones first when cutting).
  const snacks = [...poolFor(profile, "snack")].sort((a, b) => (cutting ? a.kcal - b.kcal : b.kcal - a.kcal));
  const start = (dayNumber(date) + OFFSET.snack) % snacks.length;
  let total = meals.reduce((a, m) => a + m.kcal, 0);
  for (let i = 0; i < snacks.length && meals.length < 6; i++) {
    const s = snacks[(start + i) % snacks.length];
    if (target - total < 120) break;
    if (total + s.kcal > target + 120) continue;
    meals.push({ meal: "snack", recipe: s, portion: 1, kcal: s.kcal, protein: s.protein });
    total += s.kcal;
  }
  return { date, meals, kcal: meals.reduce((a, m) => a + m.kcal, 0), protein: meals.reduce((a, m) => a + m.protein, 0) };
}

export function weekPlan(profile: Profile, start: ISODate): DayPlan[] {
  return Array.from({ length: 7 }, (_, i) => dayPlan(profile, addDays(start, i)));
}

const LABEL: Record<Meal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
const portionText = (p: number) => (p === 1 ? "" : ` (${p}x portion)`);

export function formatDayPlan(plan: DayPlan, profile: Profile, label: string): string {
  const t = profile.targets;
  const lines = plan.meals.map((m) => `- **${LABEL[m.meal]}:** ${m.recipe.name}${portionText(m.portion)}, about ${m.kcal} kcal, ${m.protein} g protein`);
  const proteinGap = t.protein - plan.protein;
  const extra = proteinGap > 15 ? `\n\nThat's ${proteinGap} g short on protein. Add a protein shake or yoghurt to close the gap.` : "";
  return `**Meal plan for ${label}** (target ${t.calories.toLocaleString()} kcal, ${t.protein} g protein)\n${lines.join("\n")}\n\n**Total:** about ${plan.kcal.toLocaleString()} kcal and ${plan.protein} g protein.${extra}\n\nAsk "${plan.meals[0].meal} recipe for ${label}" to see ingredients and steps.`;
}

export function formatWeekPlan(plans: DayPlan[], profile: Profile): string {
  const lines = plans.map((p) => {
    const main = p.meals.filter((m) => m.meal !== "snack").map((m) => m.recipe.name).join(" · ");
    const snacks = p.meals.filter((m) => m.meal === "snack").length;
    return `**${formatDay(p.date, { weekday: "short", day: "numeric", month: "short" })}:** ${main}${snacks ? ` + ${snacks} snack${snacks > 1 ? "s" : ""}` : ""} (about ${p.kcal.toLocaleString()} kcal, ${p.protein} g protein)`;
  });
  return `**Your meal plan for the next 7 days** (target ${profile.targets.calories.toLocaleString()} kcal, ${profile.targets.protein} g protein a day)\n\n${lines.join("\n\n")}\n\nAsk about any day, like "meal plan for Thursday" or "dinner recipe for Saturday", for portions, ingredients and steps.`;
}

export function formatRecipeFor(profile: Profile, meal: Meal, recipe: Recipe, label: string): string {
  const share = meal === "snack" ? 0.12 : SHARE[meal];
  const portion = Math.min(1.75, Math.max(0.75, roundPortion((profile.targets.calories * share) / recipe.kcal)));
  const sized = portion === 1 ? "" : `\n\nFor your targets, have about **${portion}x** this amount (${Math.round(recipe.kcal * portion)} kcal, ${Math.round(recipe.protein * portion)} g protein).`;
  return `**${LABEL[meal]} for ${label}: ${recipe.name}** (about ${recipe.kcal} kcal, ${recipe.protein} g protein)\n${recipe.ingredients.map((i) => `- ${i}`).join("\n")}\n\n${recipe.steps}${sized}\n\nSay "another one" for a different idea.`;
}
