import { describe, expect, it } from "vitest";
import { generatePlan } from "./workoutPlan";

describe("generatePlan", () => {
  it("creates one routine per training day, each on its own weekday", () => {
    for (const days of [1, 2, 3, 4, 5, 6, 7]) {
      const plan = generatePlan({ goal: "bulk", experience: "intermediate", days, equipment: "gym" });
      expect(plan).toHaveLength(days);
      const weekdays = plan.flatMap((r) => r.scheduledDays);
      expect(new Set(weekdays).size).toBe(days);
    }
  });
  it("uses a split that matches the number of days", () => {
    expect(generatePlan({ goal: "bulk", experience: "beginner", days: 3, equipment: "gym" }).map((r) => r.name)).toEqual(["Full Body A", "Full Body B", "Full Body C"]);
    expect(generatePlan({ goal: "bulk", experience: "beginner", days: 4, equipment: "gym" })[0].name).toBe("Upper A");
    expect(generatePlan({ goal: "bulk", experience: "beginner", days: 6, equipment: "gym" })[0].name).toBe("Push A");
  });
  it("adds cardio finishers when cutting", () => {
    const cut = generatePlan({ goal: "cut", experience: "intermediate", days: 4, equipment: "gym" });
    expect(cut.some((r) => r.exercises.some((e) => /cardio/i.test(e.name)))).toBe(true);
    const bulk = generatePlan({ goal: "bulk", experience: "intermediate", days: 4, equipment: "gym" });
    expect(bulk.some((r) => r.exercises.some((e) => /cardio/i.test(e.name)))).toBe(false);
  });
  it("uses bulk-style reps for bulking and heavier compounds for cutting", () => {
    const bulk = generatePlan({ goal: "bulk", experience: "intermediate", days: 3, equipment: "gym" });
    const cut = generatePlan({ goal: "cut", experience: "intermediate", days: 3, equipment: "gym" });
    expect(bulk[0].exercises[0].reps).toBe("6-10");
    expect(cut[0].exercises[0].reps).toBe("5-8");
  });
  it("only uses equipment the person has", () => {
    const home = generatePlan({ goal: "maintain", experience: "intermediate", days: 5, equipment: "bodyweight" });
    const names = home.flatMap((r) => r.exercises.map((e) => e.name)).join(" ");
    expect(names).not.toMatch(/bench press|barbell|cable|machine|leg press|dumbbell/i);
  });
  it("keeps beginners' sessions short and avoids repeats within a day", () => {
    const plan = generatePlan({ goal: "bulk", experience: "beginner", days: 6, equipment: "gym" });
    for (const r of plan) {
      expect(r.exercises.length).toBeLessThanOrEqual(5);
      expect(new Set(r.exercises.map((e) => e.name)).size).toBe(r.exercises.length);
    }
  });
  it("varies exercises between A and B days", () => {
    const plan = generatePlan({ goal: "bulk", experience: "intermediate", days: 4, equipment: "gym" });
    expect(plan[0].exercises[0].name).not.toBe(plan[2].exercises[0].name);
  });
});
