import type { MealType } from "@/lib/types";

export const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snacks"];
export const MEAL_LABEL: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snacks: "Snacks" };

export function defaultMeal(hour = new Date().getHours()): MealType {
  if (hour < 10) return "breakfast";
  if (hour < 14) return "lunch";
  if (hour >= 17 && hour < 21) return "dinner";
  return "snacks";
}

export const fmt1 = (n: number) => (Math.round(n * 10) / 10).toString();
