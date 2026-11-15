// "Today's Focus": short, prioritised prompts derived only from logged data.
import type { AppData, ISODate, Profile } from "./types";
import { dailyTotals, isScheduled, completedSessions, waterOn, weightEntries } from "./stats";
import { daysBetween } from "./dates";

export type FocusTone = "action" | "good" | "info";
export interface FocusItem {
  id: string;
  tone: FocusTone;
  title: string;
  detail?: string;
  to?: string;
}

export function todaysFocus(data: AppData, profile: Profile, date: ISODate, hour = new Date().getHours()): FocusItem[] {
  const t = profile.targets;
  const totals = dailyTotals(data.foodEntries, date);
  const items: FocusItem[] = [];

  const calLeft = Math.round(t.calories - totals.calories);
  if (calLeft > 0) {
    const mealsLeft = hour < 11 ? 3 : hour < 15 ? 2 : hour < 20 ? 1 : 1;
    items.push({
      id: "calories",
      tone: "action",
      title: `You need another ${calLeft.toLocaleString()} calories today`,
      detail: mealsLeft > 1 ? `About ${Math.round(calLeft / mealsLeft).toLocaleString()} kcal per meal across ${mealsLeft} meals.` : "A solid meal or a shake will close the gap.",
      to: "/food",
    });
  } else {
    items.push({ id: "calories", tone: "good", title: "Calorie target reached", detail: `${Math.abs(calLeft).toLocaleString()} kcal over target.` });
  }

  const proteinLeft = Math.round(t.protein - totals.protein);
  if (proteinLeft > 0) {
    items.push({ id: "protein", tone: "action", title: `You are ${proteinLeft} g away from your protein target`, to: "/food" });
  } else {
    items.push({ id: "protein", tone: "good", title: "Protein target reached" });
  }

  const routines = isScheduled(data.routines, date);
  const doneToday = completedSessions(data.workoutSessions).some((s) => s.date === date);
  if (routines.length && !doneToday) {
    items.push({ id: "workout", tone: "action", title: `You have a workout scheduled today`, detail: routines.map((r) => r.name).join(", "), to: "/workouts" });
  } else if (doneToday) {
    items.push({ id: "workout", tone: "good", title: "Workout done", detail: "Eat well tonight to recover." });
  }

  const supps = data.supplements.filter((s) => s.active);
  for (const s of supps) {
    const taken = data.supplementLogs.filter((l) => l.supplementId === s.id && l.date === date).reduce((a, l) => a + l.servings, 0);
    if (taken < s.dailyServings) {
      items.push({ id: `supp-${s.id}`, tone: "action", title: `Remember to log your ${s.name.toLowerCase()}`, to: "/supplements" });
    }
  }

  const water = waterOn(data, date);
  if (water < t.waterMl && hour >= 12) {
    items.push({ id: "water", tone: "info", title: `Drink another ${Math.round((t.waterMl - water) / 250) * 250} ml of water` });
  }

  const weights = weightEntries(data.bodyEntries);
  const last = weights[weights.length - 1];
  if (!last || daysBetween(last.date, date) >= 7) {
    items.push({ id: "weigh", tone: "info", title: last ? "Time for a weigh-in" : "Log your first weigh-in", detail: "Weigh in the morning before eating for consistent numbers.", to: "/progress" });
  }

  const lastCheckIn = [...data.checkIns].sort((a, b) => b.weekEnding.localeCompare(a.weekEnding))[0];
  const startedDays = daysBetween(profile.onboardedAt.slice(0, 10), date);
  if ((lastCheckIn ? daysBetween(lastCheckIn.weekEnding, date) >= 7 : startedDays >= 7)) {
    items.push({ id: "checkin", tone: "info", title: "Your weekly check-in is due", to: "/check-in" });
  }

  const order: Record<FocusTone, number> = { action: 0, info: 1, good: 2 };
  return items.sort((a, b) => order[a.tone] - order[b.tone]);
}
