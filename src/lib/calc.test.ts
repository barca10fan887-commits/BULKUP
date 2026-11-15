import { describe, expect, it } from "vitest";
import { bmi, bmr, computeTargets, maintenanceCalories, suggestedSurplus, weeksToTarget } from "./calc";

const base = { age: 24, sex: "male" as const, heightCm: 180, weightKg: 70, trainingDays: 4, dailyActivity: "light" as const, experience: "beginner" as const, goal: "bulk" as const };

describe("calc", () => {
  it("computes BMI", () => {
    expect(bmi(70, 175)).toBeCloseTo(22.86, 2);
  });
  it("computes Mifflin-St Jeor BMR", () => {
    // 10*70 + 6.25*180 - 5*24 + 5 = 1710
    expect(bmr(base)).toBe(1710);
    expect(bmr({ ...base, sex: "female" })).toBe(1544);
  });
  it("adds a surplus on top of maintenance", () => {
    const t = computeTargets(base);
    const maint = maintenanceCalories(base);
    expect(t.calories).toBeGreaterThan(maint);
    expect(t.calories - maint).toBeCloseTo(suggestedSurplus("bulk", "beginner"), -1);
  });
  it("sets protein near 2 g/kg and macros that add up", () => {
    const t = computeTargets(base);
    expect(t.protein).toBe(140);
    const macroKcal = t.protein * 4 + t.carbs * 4 + t.fat * 9;
    expect(Math.abs(macroKcal - t.calories)).toBeLessThan(15);
  });
  it("suggests a slower rate for advanced lifters", () => {
    expect(computeTargets({ ...base, experience: "advanced" }).weeklyGainKg).toBeLessThan(computeTargets(base).weeklyGainKg);
  });
  it("estimates weeks to target", () => {
    expect(weeksToTarget(70, 78, 0.35)).toBe(23);
    expect(weeksToTarget(80, 78, 0.35)).toBeNull();
  });
});
