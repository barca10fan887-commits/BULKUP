import { describe, expect, it } from "vitest";
import { dayPlan, parseDay, recipeForDay, weekPlan } from "./mealPlan";
import { basicCoachReply, detectIntent } from "./coachFallback";
import { emptyData, profileFixture } from "./testData";

const today = "2026-11-15"; // a Sunday

describe("parseDay", () => {
  it("understands today, tonight, tomorrow and weekday names", () => {
    expect(parseDay("breakfast tomorrow", today)).toEqual({ date: "2026-11-16", label: "tomorrow" });
    expect(parseDay("dinner tonight", today)?.date).toBe(today);
    expect(parseDay("lunch on wednesday", today)?.date).toBe("2026-11-18");
    expect(parseDay("what about fri", today)?.date).toBe("2026-11-20");
    expect(parseDay("just a recipe", today)).toBeNull();
  });
});

describe("recipes per day", () => {
  const p = profileFixture();
  it("gives a different breakfast on each of the next 7 days", () => {
    const names = Array.from({ length: 7 }, (_, i) => recipeForDay(p, "breakfast", `2026-11-${16 + i}`).name);
    expect(new Set(names).size).toBe(7);
  });
  it("is stable for the same day", () => {
    expect(recipeForDay(p, "dinner", "2026-11-18").name).toBe(recipeForDay(p, "dinner", "2026-11-18").name);
  });
  it("only uses vegan recipes for vegans", () => {
    const v = profileFixture({ dietaryPreferences: ["Vegan"] });
    for (const d of weekPlan(v, today)) for (const m of d.meals) expect(m.recipe.vegan, m.recipe.name).toBe(true);
  });
});

describe("dayPlan", () => {
  it("lands close to the calorie target for a bulk and a cut", () => {
    for (const calories of [3000, 1900]) {
      const p = profileFixture({ goal: calories < 2000 ? "cut" : "bulk", targets: { ...profileFixture().targets, calories } });
      const plan = dayPlan(p, "2026-11-16");
      expect(Math.abs(plan.kcal - calories), `target ${calories}, got ${plan.kcal}`).toBeLessThan(calories * 0.12);
      expect(plan.meals.map((m) => m.meal).slice(0, 3)).toEqual(["breakfast", "lunch", "dinner"]);
    }
  });
});

describe("coach meal questions", () => {
  const p = profileFixture();
  const ask = (q: string, history: string[] = []) => basicCoachReply(q, emptyData(), p, today, history, 18);
  it("routes the questions", () => {
    expect(detectIntent("What should I have for breakfast tomorrow?")).toBe("recipe");
    expect(detectIntent("Make me a meal plan for this week")).toBe("mealPlan");
    expect(detectIntent("what should i eat tomorrow")).toBe("mealPlan");
  });
  it("answers breakfast tomorrow with that day's breakfast", () => {
    const reply = ask("What should I have for breakfast tomorrow?");
    expect(reply).toContain("Breakfast for tomorrow");
    expect(reply).toContain(recipeForDay(p, "breakfast", "2026-11-16").name);
  });
  it("gives another option for the same meal and day", () => {
    const first = ask("What should I have for breakfast tomorrow?");
    const second = ask("another one", ["What should I have for breakfast tomorrow?"]);
    expect(second).toContain("Breakfast for tomorrow");
    expect(second.split("\n")[0]).not.toBe(first.split("\n")[0]);
  });
  it("builds a week plan with 7 days", () => {
    const reply = ask("Make me a meal plan for this week");
    expect(reply.match(/\*\*\w{3}, \d+ \w{3}:\*\*|\*\*\w{3} \d+ \w{3}:\*\*/g)?.length ?? reply.split("kcal,").length - 1).toBeGreaterThanOrEqual(7);
  });
  it("builds tomorrow's plan", () => {
    expect(ask("meal plan for tomorrow")).toMatch(/Meal plan for tomorrow[\s\S]*Breakfast[\s\S]*Lunch[\s\S]*Dinner[\s\S]*Total/);
  });
});
