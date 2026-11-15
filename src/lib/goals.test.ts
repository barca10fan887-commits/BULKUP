import { describe, expect, it } from "vitest";
import { computeTargets, direction, maintenanceCalories, simpleGoal, weeksToTarget } from "./calc";
import { assessPace, basicCheckInReview } from "./coachFallback";
import { goalStatus } from "./stats";
import { profileFixture } from "./testData";
import { validateDraft, type ProfileDraft } from "@/features/onboarding/ProfileFields";

const base = { age: 30, sex: "male" as const, heightCm: 178, weightKg: 90, trainingDays: 4, dailyActivity: "light" as const, experience: "intermediate" as const };

describe("cutting", () => {
  it("sets calories below maintenance and a negative weekly change", () => {
    const t = computeTargets({ ...base, goal: "cut" });
    expect(t.calories).toBeLessThan(maintenanceCalories({ ...base, goal: "cut" }));
    expect(t.weeklyGainKg).toBeLessThan(0);
    expect(t.protein).toBe(198); // 2.2 g/kg
  });
  it("maintain has no adjustment", () => {
    const t = computeTargets({ ...base, goal: "maintain" });
    expect(Math.abs(t.calories - maintenanceCalories({ ...base, goal: "maintain" }))).toBeLessThan(10);
    expect(t.weeklyGainKg).toBe(0);
  });
  it("never goes below 1200 kcal", () => {
    const t = computeTargets({ ...base, weightKg: 40, heightCm: 150, age: 60, sex: "female", trainingDays: 0, dailyActivity: "sedentary", goal: "cut" });
    expect(t.calories).toBeGreaterThanOrEqual(1200);
  });
  it("works out weeks to a lower goal", () => {
    expect(weeksToTarget(90, 80, -0.54)).toBe(19);
    expect(weeksToTarget(90, 80, 0.3)).toBeNull();
    expect(direction(90, 80)).toBe(-1);
  });
  it("maps legacy goals", () => {
    expect(simpleGoal("lean_bulk")).toBe("bulk");
    expect(simpleGoal("strength")).toBe("maintain");
  });
});

describe("goal weight validation", () => {
  const draft = (goal: ProfileDraft["goal"], target: number): ProfileDraft => ({
    name: "A", age: 25, sex: "male", heightCm: 180, startWeightKg: 85, targetWeightKg: target, experience: "beginner", trainingDays: 3, goal, dailyActivity: "light",
    dietaryPreferences: [], dietNotes: "", usesCreatine: false, usesProteinPowder: false, usesMassGainer: false,
  });
  it("accepts a lower goal weight when cutting", () => {
    expect(validateDraft(draft("cut", 75), "all")).toEqual({});
    expect(validateDraft(draft("cut", 90), "all").targetWeightKg).toMatch(/below/);
  });
  it("requires a higher goal weight when bulking", () => {
    expect(validateDraft(draft("bulk", 75), "all").targetWeightKg).toMatch(/above/);
    expect(validateDraft(draft("bulk", 90), "all")).toEqual({});
  });
  it("doesn't ask for a goal weight when maintaining", () => {
    expect(validateDraft({ ...draft("maintain", 0), targetWeightKg: undefined }, "all")).toEqual({});
  });
});

describe("progress towards a cut", () => {
  const p = profileFixture({ goal: "cut", startWeightKg: 90, targetWeightKg: 80, targets: { ...profileFixture().targets, weeklyGainKg: -0.5 } });
  it("describes kg left to lose", () => {
    expect(goalStatus(p, 86).label).toBe("6 kg to lose");
    expect(goalStatus(p, 79.5).reached).toBe(true);
  });
  it("judges pace in the right direction", () => {
    expect(assessPace(-0.5, -0.5)).toBe("on_track");
    expect(assessPace(-0.1, -0.5)).toBe("too_slow");
    expect(assessPace(0.3, -0.5)).toBe("wrong_way");
    expect(assessPace(-1.2, -0.5)).toBe("too_fast");
  });
  it("suggests lowering calories when a cut stalls", () => {
    const review = basicCheckInReview(
      { from: "", to: "", startWeightKg: 88, endWeightKg: 88, changeKg: 0, avgCalories: p.targets.calories, avgProtein: p.targets.protein, daysLogged: 7, workoutsCompleted: 4, workoutsPlanned: 4, consistencyPct: 100, targetProgressPct: 20 },
      p,
    );
    expect(review).toContain(`lower your calorie target to about ${p.targets.calories - 150}`);
  });
});
