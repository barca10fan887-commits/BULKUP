import type { AppData, BodyEntry, FoodEntry, ISODate, Macros, Profile, Routine, WeeklyStats, WorkoutSession } from "./types";
import { addDays, dateRange, weekday } from "./dates";
import { round } from "./format";

export const ZERO: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

export function sumMacros(items: Macros[]): Macros {
  return items.reduce(
    (a, b) => ({ calories: a.calories + b.calories, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat }),
    { ...ZERO },
  );
}

export function entriesOn(entries: FoodEntry[], date: ISODate): FoodEntry[] {
  return entries.filter((e) => e.date === date);
}

export function dailyTotals(entries: FoodEntry[], date: ISODate): Macros {
  return sumMacros(entriesOn(entries, date));
}

export function waterOn(data: Pick<AppData, "waterLogs">, date: ISODate): number {
  return data.waterLogs.filter((w) => w.date === date).reduce((a, w) => a + w.ml, 0);
}

export function weightEntries(entries: BodyEntry[]): { date: ISODate; weightKg: number }[] {
  return entries
    .filter((e): e is BodyEntry & { weightKg: number } => typeof e.weightKg === "number" && e.weightKg > 0)
    .sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)))
    .map((e) => ({ date: e.date, weightKg: e.weightKg }));
}

export function currentWeight(entries: BodyEntry[], profile: Profile): number {
  const w = weightEntries(entries);
  return w.length ? w[w.length - 1].weightKg : profile.startWeightKg;
}

/** Latest weight on or before a date. */
export function weightAsOf(entries: BodyEntry[], date: ISODate): number | null {
  const w = weightEntries(entries).filter((e) => e.date <= date);
  return w.length ? w[w.length - 1].weightKg : null;
}

/** Progress from start towards target, 0-100. */
export function targetProgress(profile: Profile, currentKg: number): number {
  const total = profile.targetWeightKg - profile.startWeightKg;
  if (total === 0) return 100;
  return Math.max(0, Math.min(100, ((currentKg - profile.startWeightKg) / total) * 100));
}

/** Least-squares slope of weight over time, in kg/week. Needs 2+ points across 5+ days. */
export function weightTrendPerWeek(entries: BodyEntry[], from: ISODate, to: ISODate): number | null {
  const pts = weightEntries(entries).filter((e) => e.date >= from && e.date <= to);
  if (pts.length < 2) return null;
  const t0 = new Date(pts[0].date).getTime();
  const xs = pts.map((p) => (new Date(p.date).getTime() - t0) / 86_400_000);
  if (xs[xs.length - 1] - xs[0] < 5) return null;
  const ys = pts.map((p) => p.weightKg);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? null : round((num / den) * 7, 2);
}

export function isScheduled(routines: Routine[], date: ISODate): Routine[] {
  const wd = weekday(date);
  return routines.filter((r) => r.scheduledDays.includes(wd));
}

export function completedSessions(sessions: WorkoutSession[]): WorkoutSession[] {
  return sessions.filter((s) => !!s.finishedAt);
}

export function sessionVolume(s: WorkoutSession): number {
  return s.exercises.reduce((a, ex) => a + ex.sets.filter((x) => x.done).reduce((b, set) => b + set.reps * set.weightKg, 0), 0);
}

/** Epley estimated one-rep max. */
export function estimated1RM(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export interface PersonalRecord {
  exercise: string;
  bestWeightKg: number;
  bestWeightReps: number;
  best1RM: number;
  date: ISODate;
}

export function personalRecords(sessions: WorkoutSession[]): PersonalRecord[] {
  const map = new Map<string, PersonalRecord>();
  for (const s of completedSessions(sessions)) {
    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        if (!set.done || set.weightKg <= 0 || set.reps <= 0) continue;
        const key = ex.name.trim().toLowerCase();
        const e1 = estimated1RM(set.weightKg, set.reps);
        const cur = map.get(key);
        if (!cur) {
          map.set(key, { exercise: ex.name, bestWeightKg: set.weightKg, bestWeightReps: set.reps, best1RM: e1, date: s.date });
          continue;
        }
        if (set.weightKg > cur.bestWeightKg || (set.weightKg === cur.bestWeightKg && set.reps > cur.bestWeightReps)) {
          cur.bestWeightKg = set.weightKg;
          cur.bestWeightReps = set.reps;
          cur.date = s.date;
        }
        if (e1 > cur.best1RM) cur.best1RM = e1;
      }
    }
  }
  return [...map.values()].sort((a, b) => a.exercise.localeCompare(b.exercise));
}

/** Most recent completed sets for an exercise, used to prefill a new session. */
export function lastPerformance(sessions: WorkoutSession[], exerciseName: string) {
  const key = exerciseName.trim().toLowerCase();
  const sorted = completedSessions(sessions).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  for (const s of sorted) {
    const ex = s.exercises.find((e) => e.name.trim().toLowerCase() === key);
    if (ex && ex.sets.some((x) => x.done)) return { date: s.date, sets: ex.sets.filter((x) => x.done) };
  }
  return null;
}

export function weeklyStats(data: AppData, profile: Profile, to: ISODate): WeeklyStats {
  const from = addDays(to, -6);
  const days = dateRange(from, to);
  const logged = days.map((d) => dailyTotals(data.foodEntries, d)).filter((m) => m.calories > 0);
  const avg = (k: keyof Macros) => (logged.length ? Math.round(logged.reduce((a, m) => a + m[k], 0) / logged.length) : 0);

  const weightsInWeek = weightEntries(data.bodyEntries).filter((e) => e.date >= from && e.date <= to);
  const startWeightKg = weightAsOf(data.bodyEntries, addDays(from, -1)) ?? weightsInWeek[0]?.weightKg ?? null;
  const endWeightKg = weightsInWeek.length ? weightsInWeek[weightsInWeek.length - 1].weightKg : weightAsOf(data.bodyEntries, to);

  const workoutsCompleted = completedSessions(data.workoutSessions).filter((s) => s.date >= from && s.date <= to).length;
  const plannedFromSchedule = days.reduce((a, d) => a + (isScheduled(data.routines, d).length > 0 ? 1 : 0), 0);
  const workoutsPlanned = plannedFromSchedule || profile.trainingDays;

  return {
    from,
    to,
    startWeightKg,
    endWeightKg,
    changeKg: startWeightKg != null && endWeightKg != null ? round(endWeightKg - startWeightKg, 2) : null,
    avgCalories: avg("calories"),
    avgProtein: avg("protein"),
    daysLogged: logged.length,
    workoutsCompleted,
    workoutsPlanned,
    consistencyPct: workoutsPlanned ? Math.min(100, Math.round((workoutsCompleted / workoutsPlanned) * 100)) : 0,
    targetProgressPct: endWeightKg != null ? Math.round(targetProgress(profile, endWeightKg)) : null,
  };
}

/** Consecutive days (ending today or yesterday) with at least one food entry. */
export function loggingStreak(entries: FoodEntry[], todayDate: ISODate): number {
  const days = new Set(entries.map((e) => e.date));
  let d = days.has(todayDate) ? todayDate : addDays(todayDate, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}
