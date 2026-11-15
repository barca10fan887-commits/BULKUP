import { describe, expect, it } from "vitest";
import { dailyTotals, estimated1RM, loggingStreak, personalRecords, targetProgress, weeklyStats, weightTrendPerWeek } from "./stats";
import { emptyData, profileFixture, rec } from "./testData";
import type { BodyEntry, FoodEntry, WorkoutSession } from "./types";

const food = (date: string, calories: number, protein: number): FoodEntry => ({ ...rec(), date, meal: "lunch", name: "x", servingLabel: "1", quantity: 1, calories, protein, carbs: 0, fat: 0, source: "manual" });
const weigh = (date: string, weightKg: number): BodyEntry => ({ ...rec(), date, weightKg, custom: {} });

describe("stats", () => {
  it("sums daily totals for one date only", () => {
    const entries = [food("2026-11-10", 500, 30), food("2026-11-10", 700, 40), food("2026-11-11", 900, 50)];
    expect(dailyTotals(entries, "2026-11-10")).toEqual({ calories: 1200, protein: 70, carbs: 0, fat: 0 });
  });

  it("computes weight trend per week", () => {
    const entries = [weigh("2026-11-01", 70), weigh("2026-11-08", 70.5), weigh("2026-11-15", 71)];
    expect(weightTrendPerWeek(entries, "2026-10-20", "2026-11-15")).toBeCloseTo(0.5, 2);
  });

  it("needs enough spread for a trend", () => {
    expect(weightTrendPerWeek([weigh("2026-11-14", 70), weigh("2026-11-15", 71)], "2026-11-01", "2026-11-15")).toBeNull();
  });

  it("clamps target progress", () => {
    const p = profileFixture();
    expect(targetProgress(p, 74)).toBe(50);
    expect(targetProgress(p, 60)).toBe(0);
    expect(targetProgress(p, 90)).toBe(100);
  });

  it("finds personal records from completed sets only", () => {
    const s: WorkoutSession = {
      ...rec(),
      date: "2026-11-10",
      name: "Upper",
      startedAt: "2026-11-10T10:00:00Z",
      finishedAt: "2026-11-10T11:00:00Z",
      exercises: [{ id: "e", name: "Bench press", restSec: 90, sets: [{ reps: 5, weightKg: 80, done: true }, { reps: 3, weightKg: 100, done: false }, { reps: 8, weightKg: 70, done: true }] }],
    };
    const [pr] = personalRecords([s]);
    expect(pr.bestWeightKg).toBe(80);
    expect(pr.best1RM).toBeCloseTo(estimated1RM(70, 8) > estimated1RM(80, 5) ? estimated1RM(70, 8) : estimated1RM(80, 5));
  });

  it("builds weekly stats", () => {
    const data = emptyData();
    data.foodEntries = [food("2026-11-10", 3000, 150), food("2026-11-12", 2000, 100)];
    data.bodyEntries = [weigh("2026-11-08", 70), weigh("2026-11-14", 70.4)];
    const s = weeklyStats(data, profileFixture(), "2026-11-15");
    expect(s.from).toBe("2026-11-09");
    expect(s.avgCalories).toBe(2500);
    expect(s.daysLogged).toBe(2);
    expect(s.startWeightKg).toBe(70);
    expect(s.endWeightKg).toBe(70.4);
    expect(s.changeKg).toBeCloseTo(0.4);
    expect(s.workoutsPlanned).toBe(4);
  });

  it("counts a logging streak ending today or yesterday", () => {
    const entries = [food("2026-11-13", 1, 1), food("2026-11-14", 1, 1)];
    expect(loggingStreak(entries, "2026-11-15")).toBe(2);
    expect(loggingStreak(entries, "2026-11-17")).toBe(0);
  });
});
