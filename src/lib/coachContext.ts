// Builds a compact, factual snapshot of the user's own data for the AI coach.
// Only logged facts go in; anything missing is stated as missing so the model
// does not fill gaps with invented meals or progress.
import type { AppData, ISODate, Profile } from "./types";
import { addDays, dateRange, weekday, WEEKDAYS_SHORT } from "./dates";
import { completedSessions, currentWeight, dailyTotals, entriesOn, isScheduled, lastPerformance, personalRecords, waterOn, weightEntries, weightTrendPerWeek, weeklyStats } from "./stats";
import { round } from "./format";

export function buildCoachContext(data: AppData, profile: Profile, date: ISODate) {
  const weight = currentWeight(data.bodyEntries, profile);
  const totals = dailyTotals(data.foodEntries, date);
  const last14 = dateRange(addDays(date, -13), date).map((d) => {
    const m = dailyTotals(data.foodEntries, d);
    return { date: d, logged: m.calories > 0, calories: Math.round(m.calories), protein: Math.round(m.protein) };
  });
  const sessions = completedSessions(data.workoutSessions)
    .filter((s) => s.date >= addDays(date, -30))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)
    .map((s) => ({
      date: s.date,
      name: s.name,
      exercises: s.exercises.map((e) => ({
        name: e.name,
        sets: e.sets.filter((x) => x.done).map((x) => `${x.reps}x${x.weightKg}kg`),
      })),
    }));
  const scheduledToday = isScheduled(data.routines, date).map((r) => r.name);
  const nextScheduled = dateRange(addDays(date, 1), addDays(date, 7))
    .map((d) => ({ d, r: isScheduled(data.routines, d) }))
    .find((x) => x.r.length);

  return {
    today: date,
    weekday: WEEKDAYS_SHORT[weekday(date)],
    profile: {
      name: profile.name,
      age: profile.age,
      sex: profile.sex,
      heightCm: profile.heightCm,
      startWeightKg: profile.startWeightKg,
      currentWeightKg: weight,
      targetWeightKg: profile.targetWeightKg,
      experience: profile.experience,
      goal: profile.goal,
      trainingDaysPerWeek: profile.trainingDays,
      dietaryPreferences: profile.dietaryPreferences,
      dietNotes: profile.dietNotes || undefined,
      usesCreatine: profile.usesCreatine,
      usesProteinPowder: profile.usesProteinPowder,
      usesMassGainer: profile.usesMassGainer,
    },
    targets: profile.targets,
    todayFood: {
      totals: { calories: Math.round(totals.calories), protein: Math.round(totals.protein), carbs: Math.round(totals.carbs), fat: Math.round(totals.fat) },
      remaining: {
        calories: Math.round(profile.targets.calories - totals.calories),
        protein: Math.round(profile.targets.protein - totals.protein),
      },
      entries: entriesOn(data.foodEntries, date).map((e) => ({ meal: e.meal, name: e.name, serving: e.servingLabel, calories: Math.round(e.calories), protein: Math.round(e.protein) })),
      waterMl: waterOn(data, date),
    },
    last14Days: last14,
    weight: {
      entries: weightEntries(data.bodyEntries).slice(-20),
      trendKgPerWeek_last28Days: weightTrendPerWeek(data.bodyEntries, addDays(date, -27), date),
      plannedKgPerWeek: profile.targets.weeklyGainKg,
    },
    thisWeek: weeklyStats(data, profile, date),
    workouts: {
      routines: data.routines.map((r) => ({ name: r.name, days: r.scheduledDays.map((d) => WEEKDAYS_SHORT[d]), exercises: r.exercises.map((e) => `${e.name} ${e.sets}x${e.reps}`) })),
      scheduledToday,
      nextScheduled: nextScheduled ? { date: nextScheduled.d, routines: nextScheduled.r.map((r) => r.name) } : null,
      recentSessions: sessions,
      personalRecords: personalRecords(data.workoutSessions).slice(0, 15).map((p) => ({ exercise: p.exercise, best: `${p.bestWeightReps}x${p.bestWeightKg}kg`, e1rm: round(p.best1RM, 1) })),
    },
    supplements: data.supplements
      .filter((s) => s.active)
      .map((s) => ({
        name: s.name,
        serving: `${s.servingAmount} ${s.servingUnit}`,
        dailyServings: s.dailyServings,
        takenToday: data.supplementLogs.filter((l) => l.supplementId === s.id && l.date === date).reduce((a, l) => a + l.servings, 0),
        daysTakenLast7: new Set(data.supplementLogs.filter((l) => l.supplementId === s.id && l.date > addDays(date, -7)).map((l) => l.date)).size,
      })),
  };
}

export type CoachContext = ReturnType<typeof buildCoachContext>;

/** Last performance for the next workout, used by the basic coach. */
export function nextWorkoutPlan(data: AppData, date: ISODate) {
  const today = isScheduled(data.routines, date);
  const done = completedSessions(data.workoutSessions).some((s) => s.date === date);
  let routine = !done ? today[0] : undefined;
  let when: ISODate = date;
  if (!routine) {
    for (let i = 1; i <= 7; i++) {
      const d = addDays(date, i);
      const r = isScheduled(data.routines, d)[0];
      if (r) {
        routine = r;
        when = d;
        break;
      }
    }
  }
  if (!routine) routine = data.routines[0];
  if (!routine) return null;
  return {
    routine,
    date: when,
    exercises: routine.exercises.map((e) => ({ ...e, last: lastPerformance(data.workoutSessions, e.name) })),
  };
}
