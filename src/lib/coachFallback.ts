// Rule-based coach used when the AI service is not configured or unreachable.
// It answers common questions from the user's logged data only.
import type { AppData, ISODate, Profile, WeeklyStats } from "./types";
import { addDays, formatDay } from "./dates";
import { completedSessions, currentWeight, dailyTotals, weightTrendPerWeek } from "./stats";
import { nextWorkoutPlan } from "./coachContext";
import { BUILTIN_FOODS } from "./foodDb";
import { round } from "./format";

type Intent = "calories" | "protein" | "eat" | "rate" | "workout" | "plateau" | "week" | "routine" | "unknown";

export function detectIntent(q: string): Intent {
  const s = q.toLowerCase();
  if (/(stopped|stall|plateau|not gaining|isn'?t (going up|increasing)|stuck)/.test(s)) return "plateau";
  if (/(fast enough|rate|gaining.*(fast|slow|enough)|on track)/.test(s)) return "rate";
  if (/(next workout|train today|workout today|what should i (train|lift))/.test(s)) return "workout";
  if (/(improve|routine|program|split)/.test(s)) return "routine";
  if (/(this week|change|adjust)/.test(s)) return "week";
  if (/protein/.test(s)) return "protein";
  if (/(calorie|kcal|left|remaining)/.test(s)) return "calories";
  if (/(eat|meal|food|hungry|snack)/.test(s)) return "eat";
  return "unknown";
}

const vegetarianSafe = (name: string) => !/(chicken|beef|salmon|tuna|pork|turkey|burger|pie|bolognese|burrito|sushi)/i.test(name);
const veganSafe = (name: string) => vegetarianSafe(name) && !/(egg|milk|yoghurt|cheese|butter|honey|mozzarella|cottage|flat white|pizza)/i.test(name);

export function suggestFoods(profile: Profile, needCalories: number, needProtein: number, n = 4) {
  const prefs = profile.dietaryPreferences.map((p) => p.toLowerCase());
  const ok = (name: string) =>
    prefs.includes("vegan") ? veganSafe(name) : prefs.includes("vegetarian") ? vegetarianSafe(name) : prefs.includes("pescatarian") ? vegetarianSafe(name) || /(salmon|tuna)/i.test(name) : true;
  const pool = BUILTIN_FOODS.filter((f) => ok(f.name) && f.calories >= 60);
  const proteinHeavy = needProtein > 20 && needProtein * 4 > needCalories * 0.25;
  const scored = pool
    .map((f) => ({ f, score: proteinHeavy ? f.protein / Math.max(f.calories, 1) : f.calories / 100 + f.protein / 20 }))
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, n).map((x) => x.f);
}

export function basicCoachReply(question: string, data: AppData, profile: Profile, date: ISODate): string {
  const t = profile.targets;
  const totals = dailyTotals(data.foodEntries, date);
  const calLeft = Math.round(t.calories - totals.calories);
  const proLeft = Math.round(t.protein - totals.protein);
  const intent = detectIntent(question);
  const weight = currentWeight(data.bodyEntries, profile);
  const trend = weightTrendPerWeek(data.bodyEntries, addDays(date, -27), date);
  const foodsLine = (cal: number, pro: number) =>
    suggestFoods(profile, cal, pro)
      .map((f) => `- ${f.name} (${f.servingSize} ${f.servingUnit}): ${f.calories} kcal, ${f.protein} g protein`)
      .join("\n");

  switch (intent) {
    case "calories":
      return calLeft > 0
        ? `You've logged ${Math.round(totals.calories)} of ${t.calories} kcal today, so you have **${calLeft} kcal left**.`
        : `You've logged ${Math.round(totals.calories)} kcal today, which is ${Math.abs(calLeft)} kcal over your ${t.calories} kcal target.`;
    case "protein":
      if (proLeft <= 0) return `You've hit your protein target: ${Math.round(totals.protein)} g of ${t.protein} g.`;
      return `You need **${proLeft} g more protein** today (${Math.round(totals.protein)} of ${t.protein} g). Options from the food list:\n${suggestFoods(profile, proLeft * 6, proLeft).map((f) => `- ${f.name} (${f.servingSize} ${f.servingUnit}): ${f.protein} g protein`).join("\n")}`;
    case "eat":
      if (calLeft <= 0 && proLeft <= 0) return "You've hit both your calorie and protein targets today. Nothing more is needed; eat to appetite.";
      return `You still need about **${Math.max(calLeft, 0)} kcal** and **${Math.max(proLeft, 0)} g protein** today. Some foods that fit:\n${foodsLine(calLeft, proLeft)}`;
    case "rate":
    case "plateau": {
      if (trend == null) return "I need at least two weigh-ins about a week apart to judge your rate of gain. Log your weight on the Progress page a few mornings a week.";
      const planned = t.weeklyGainKg;
      const lines = [`Over the last 4 weeks your weight trend is **${trend > 0 ? "+" : ""}${trend} kg/week**. Your plan is +${planned} kg/week.`];
      const recent = Array.from({ length: 7 }, (_, i) => dailyTotals(data.foodEntries, addDays(date, -i))).filter((m) => m.calories > 0);
      const avg = recent.length ? Math.round(recent.reduce((a, m) => a + m.calories, 0) / recent.length) : null;
      if (avg != null) lines.push(`Your average logged intake over the last ${recent.length} logged days is ${avg} kcal against a ${t.calories} kcal target.`);
      if (trend < planned * 0.5) {
        lines.push(avg != null && avg < t.calories - 150 ? "You're eating below target. Hitting the target consistently is the first fix." : "If you're hitting the target and still not gaining, raise your calorie target by about 150-200 kcal for the next 2 weeks.");
      } else if (trend > planned * 1.6) {
        lines.push("You're gaining faster than planned. Consider trimming 150 kcal a day to limit fat gain.");
      } else {
        lines.push("That's on track. Keep doing what you're doing.");
      }
      return lines.join("\n\n");
    }
    case "workout": {
      const plan = nextWorkoutPlan(data, date);
      if (!plan) return "You don't have any routines yet. Add one on the Workouts page and I'll suggest weights from your history.";
      const head = plan.date === date ? `Today's workout is **${plan.routine.name}**.` : `Your next scheduled workout is **${plan.routine.name}** on ${formatDay(plan.date, { weekday: "long", day: "numeric", month: "short" })}.`;
      const body = plan.exercises
        .map((e) => {
          if (!e.last) return `- ${e.name}: ${e.sets} x ${e.reps} (no history yet, start with a weight you can do with 2 reps in reserve)`;
          const top = e.last.sets.reduce((a, s) => (s.weightKg > a.weightKg ? s : a), e.last.sets[0]);
          const hitTop = e.last.sets.every((s) => s.reps >= parseInt(e.reps.split("-").pop() || "0", 10));
          return `- ${e.name}: ${e.sets} x ${e.reps}. Last time ${top.reps} x ${top.weightKg} kg${hitTop ? `, so try ${round(top.weightKg + (top.weightKg >= 40 ? 2.5 : 1), 1)} kg` : ", so repeat the weight and aim for more reps"}`;
        })
        .join("\n");
      return `${head}\n${body}`;
    }
    case "routine":
    case "week": {
      const sessions = completedSessions(data.workoutSessions).filter((s) => s.date > addDays(date, -14));
      const perWeek = round(sessions.length / 2, 1);
      const tips = [
        `You've completed ${sessions.length} workouts in the last 14 days (${perWeek} per week) against a plan of ${profile.trainingDays} per week.`,
      ];
      if (perWeek < profile.trainingDays * 0.75) tips.push("Consistency is the biggest lever right now. Pick fixed training times and schedule them in the Workouts calendar.");
      if (trend != null && trend < t.weeklyGainKg * 0.5) tips.push(`Weight is moving slower than planned (${trend} kg/week). Add about 150-200 kcal a day this week.`);
      tips.push("Aim to add a rep or a little weight on your main lifts each week, and keep 1-3 reps in reserve on most sets.");
      return tips.join("\n\n");
    }
    default:
      return `Here's where you stand today: ${Math.round(totals.calories)}/${t.calories} kcal, ${Math.round(totals.protein)}/${t.protein} g protein, current weight ${weight} kg (target ${profile.targetWeightKg} kg).\n\nThe basic coach can answer questions like "How many calories do I have left?", "What should I eat to reach my protein target?", "Am I gaining weight fast enough?" or "What should my next workout be?".`;
  }
}

export function basicCheckInReview(stats: WeeklyStats, profile: Profile): string {
  const t = profile.targets;
  const out: string[] = [];
  if (stats.changeKg == null) out.push("There weren't enough weigh-ins to measure your weight change this week. Try to weigh in at least 3 mornings next week.");
  else if (stats.changeKg < t.weeklyGainKg * 0.5) out.push(`You changed ${stats.changeKg} kg this week, below your +${t.weeklyGainKg} kg plan.`);
  else if (stats.changeKg > t.weeklyGainKg * 1.8) out.push(`You gained ${stats.changeKg} kg, faster than your +${t.weeklyGainKg} kg plan. Some of this may be water; watch next week's trend.`);
  else out.push(`You gained ${stats.changeKg} kg, right in line with your plan.`);

  if (stats.daysLogged < 5) out.push(`You logged food on ${stats.daysLogged} of 7 days. Logging more days will make these numbers reliable.`);
  else if (stats.avgCalories < t.calories - 150) out.push(`Average intake was ${stats.avgCalories} kcal, about ${t.calories - stats.avgCalories} kcal under target. Close that gap before raising the target.`);
  else out.push(`Average intake was ${stats.avgCalories} kcal against ${t.calories} kcal. Good consistency.`);

  if (stats.avgProtein < t.protein * 0.9) out.push(`Protein averaged ${stats.avgProtein} g against ${t.protein} g. Add a protein source to one more meal each day.`);
  out.push(`Workouts: ${stats.workoutsCompleted} of ${stats.workoutsPlanned} (${stats.consistencyPct}%).`);

  if (stats.changeKg != null && stats.changeKg < t.weeklyGainKg * 0.5 && stats.avgCalories >= t.calories - 150 && stats.daysLogged >= 5) {
    out.push(`Suggested adjustment: raise your calorie target to about ${t.calories + 150} kcal for next week.`);
  }
  return out.join("\n\n");
}
