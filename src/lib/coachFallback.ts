// Rule-based coach used when the AI service is not configured or unreachable.
// It answers common questions from the user's logged data only.
import type { AppData, ISODate, Profile, WeeklyStats } from "./types";
import { addDays, formatDay } from "./dates";
import { completedSessions, currentWeight, dailyTotals, weightTrendPerWeek } from "./stats";
import { nextWorkoutPlan } from "./coachContext";
import { BUILTIN_FOODS } from "./foodDb";
import { round } from "./format";

export type Pace = "on_track" | "too_slow" | "too_fast" | "wrong_way";

/** Compares an observed weekly change with the plan. Works for cuts (negative), bulks and maintenance. */
export function assessPace(actual: number, planned: number): Pace {
  if (planned === 0) return Math.abs(actual) <= 0.2 ? "on_track" : "wrong_way";
  const ratio = actual / planned; // 1 = exactly on plan; negative = moving the wrong way
  if (ratio < 0) return "wrong_way";
  if (ratio < 0.5) return "too_slow";
  if (ratio > 1.7) return "too_fast";
  return "on_track";
}

const fmtKg = (n: number) => `${n > 0 ? "+" : ""}${n}`;

/** What to change, given the pace and whether intake matched the target. */
function paceAdvice(pace: Pace, planned: number, actual: number, avgCalories: number | null, target: number): string {
  const cutting = planned < 0;
  const maintaining = planned === 0;
  const offTarget = avgCalories != null && (cutting ? avgCalories > target + 150 : avgCalories < target - 150);
  if (pace === "on_track") return "That's on track. Keep doing what you're doing.";
  if (offTarget) return cutting ? "You're eating above your target. Hitting the target consistently is the first fix." : "You're eating below your target. Hitting the target consistently is the first fix.";
  if (maintaining) return actual > 0 ? "Your weight is creeping up. Trim about 150 kcal a day." : "Your weight is drifting down. Add about 150 kcal a day.";
  if (pace === "too_fast") return cutting ? "You're losing faster than planned, which can cost muscle. Add about 150 kcal a day." : "You're gaining faster than planned. Trim about 150 kcal a day to limit fat gain.";
  return cutting ? "If you're on target and the scale isn't moving, lower your calories by about 150-200 kcal for the next 2 weeks or add some daily steps." : "If you're on target and still not gaining, raise your calories by about 150-200 kcal for the next 2 weeks.";
}

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
      if (calLeft <= 0 && proLeft <= 0) return t.weeklyGainKg < 0 ? "You've reached your calorie and protein targets for today. If you're hungry, pick something low in calories like vegetables or a salad." : "You've hit both your calorie and protein targets today. Nothing more is needed; eat to appetite.";
      return `You still need about **${Math.max(calLeft, 0)} kcal** and **${Math.max(proLeft, 0)} g protein** today. Some foods that fit:\n${foodsLine(calLeft, proLeft)}`;
    case "rate":
    case "plateau": {
      if (trend == null) return "I need at least two weigh-ins about a week apart to judge your progress. Log your weight on the Progress page a few mornings a week.";
      const planned = t.weeklyGainKg;
      const lines = [`Over the last 4 weeks your weight trend is **${fmtKg(trend)} kg/week**. Your plan is ${fmtKg(planned)} kg/week.`];
      const recent = Array.from({ length: 7 }, (_, i) => dailyTotals(data.foodEntries, addDays(date, -i))).filter((m) => m.calories > 0);
      const avg = recent.length ? Math.round(recent.reduce((a, m) => a + m.calories, 0) / recent.length) : null;
      if (avg != null) lines.push(`Your average logged intake over the last ${recent.length} logged days is ${avg} kcal against a ${t.calories} kcal target.`);
      lines.push(paceAdvice(assessPace(trend, planned), planned, trend, avg, t.calories));
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
      if (trend != null && assessPace(trend, t.weeklyGainKg) !== "on_track") tips.push(`Your weight trend is ${fmtKg(trend)} kg/week against a plan of ${fmtKg(t.weeklyGainKg)}. ${paceAdvice(assessPace(trend, t.weeklyGainKg), t.weeklyGainKg, trend, null, t.calories)}`);
      tips.push("Aim to add a rep or a little weight on your main lifts each week, and keep 1-3 reps in reserve on most sets.");
      return tips.join("\n\n");
    }
    default:
      return `Here's where you stand today: ${Math.round(totals.calories)}/${t.calories} kcal, ${Math.round(totals.protein)}/${t.protein} g protein, current weight ${weight} kg (target ${profile.targetWeightKg} kg).\n\nThe basic coach can answer questions like "How many calories do I have left?", "What should I eat to reach my protein target?", "Am I on track?" or "What should my next workout be?".`;
  }
}

export function basicCheckInReview(stats: WeeklyStats, profile: Profile): string {
  const t = profile.targets;
  const planned = t.weeklyGainKg;
  const out: string[] = [];
  const offTarget = planned < 0 ? stats.avgCalories > t.calories + 150 : stats.avgCalories < t.calories - 150;
  if (stats.changeKg == null) out.push("There weren't enough weigh-ins to measure your weight change this week. Try to weigh in at least 3 mornings next week.");
  else {
    const pace = assessPace(stats.changeKg, planned);
    out.push(`Your weight changed ${fmtKg(stats.changeKg)} kg this week against a plan of ${fmtKg(planned)} kg. ${pace === "on_track" ? "That's right on plan." : "One week can be water, so watch the trend."}`);
  }

  if (stats.daysLogged < 5) out.push(`You logged food on ${stats.daysLogged} of 7 days. Logging more days will make these numbers reliable.`);
  else if (offTarget) out.push(`Average intake was ${stats.avgCalories} kcal against a ${t.calories} kcal target. Getting closer to the target is the first fix.`);
  else out.push(`Average intake was ${stats.avgCalories} kcal against ${t.calories} kcal. Good consistency.`);

  if (stats.avgProtein < t.protein * 0.9) out.push(`Protein averaged ${stats.avgProtein} g against ${t.protein} g. Add a protein source to one more meal each day.`);
  out.push(`Workouts: ${stats.workoutsCompleted} of ${stats.workoutsPlanned} (${stats.consistencyPct}%).`);

  if (stats.changeKg != null && stats.daysLogged >= 5 && !offTarget) {
    const pace = assessPace(stats.changeKg, planned);
    if (planned > 0 && pace === "too_slow") out.push(`Suggested adjustment: raise your calorie target to about ${t.calories + 150} kcal for next week.`);
    if (planned < 0 && pace === "too_slow") out.push(`Suggested adjustment: lower your calorie target to about ${Math.max(1200, t.calories - 150)} kcal for next week.`);
    if (planned < 0 && pace === "too_fast") out.push(`Suggested adjustment: raise your calorie target to about ${t.calories + 150} kcal to protect muscle.`);
    if (planned > 0 && pace === "too_fast") out.push(`Suggested adjustment: lower your calorie target to about ${t.calories - 150} kcal for next week.`);
  }
  return out.join("\n\n");
}
