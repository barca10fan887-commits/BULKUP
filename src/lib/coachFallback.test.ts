import { describe, expect, it } from "vitest";
import { basicCheckInReview, basicCoachReply, detectIntent, suggestFoods } from "./coachFallback";
import { emptyData, profileFixture, rec } from "./testData";

describe("basic coach", () => {
  it("detects intents", () => {
    expect(detectIntent("How many calories do I have left?")).toBe("calories");
    expect(detectIntent("What should I eat to reach my protein target?")).toBe("protein");
    expect(detectIntent("Am I gaining weight fast enough?")).toBe("rate");
    expect(detectIntent("Why has my weight stopped increasing?")).toBe("plateau");
    expect(detectIntent("What should my next workout be?")).toBe("workout");
    expect(detectIntent("What should I change this week?")).toBe("week");
  });

  it("answers calories left from logged data", () => {
    const data = emptyData();
    const date = "2026-11-15";
    data.foodEntries = [{ ...rec(), date, meal: "breakfast", name: "Oats", servingLabel: "1", quantity: 1, calories: 800, protein: 30, carbs: 100, fat: 20, source: "manual" }];
    const reply = basicCoachReply("How many calories do I have left?", data, profileFixture(), date);
    expect(reply).toContain("2200 kcal left");
  });

  it("says it needs data rather than inventing a trend", () => {
    const reply = basicCoachReply("Am I gaining weight fast enough?", emptyData(), profileFixture(), "2026-11-15");
    expect(reply).toMatch(/need at least two weigh-ins/i);
  });

  it("respects vegetarian preference", () => {
    const foods = suggestFoods(profileFixture({ dietaryPreferences: ["Vegetarian"] }), 800, 40, 8);
    expect(foods.some((f) => /chicken|beef|tuna|salmon|pork/i.test(f.name))).toBe(false);
  });

  it("suggests a calorie increase when gain stalls despite hitting target", () => {
    const p = profileFixture();
    const review = basicCheckInReview(
      { from: "", to: "", startWeightKg: 70, endWeightKg: 70, changeKg: 0, avgCalories: 3000, avgProtein: 140, daysLogged: 7, workoutsCompleted: 4, workoutsPlanned: 4, consistencyPct: 100, targetProgressPct: 0 },
      p,
    );
    expect(review).toContain("3150 kcal");
  });
});

describe("built-in coach topics", () => {
  const date = "2026-11-15";
  const ask = (q: string, profile = profileFixture(), history: string[] = []) => basicCoachReply(q, emptyData(), profile, date, history, 18);

  it("recognises lots of everyday questions", () => {
    const cases: [string, string][] = [
      ["Give me a dinner recipe", "recipe"],
      ["Is creatine worth it?", "supplement"],
      ["How do I sleep better?", "sleep"],
      ["I'm so sore after legs", "recovery"],
      ["I have no motivation today", "motivation"],
      ["squat form tips", "form"],
      ["Eating out tips", "eatingOut"],
      ["my knee hurts when I squat", "pain"],
      ["I can't eat enough", "appetite"],
      ["Is cardio bad for gains?", "cardio"],
      ["how do I get abs", "fatLoss"],
      ["thanks!", "thanks"],
      ["cheap foods for bulking", "budget"],
    ];
    for (const [q, intent] of cases) expect(detectIntent(q), q).toBe(intent);
  });

  it("gives a recipe and a different one when asked for another", () => {
    const first = ask("Give me a dinner recipe");
    const second = ask("another one", profileFixture(), ["Give me a dinner recipe"]);
    expect(first).toMatch(/kcal/);
    expect(second).toMatch(/kcal/);
    expect(first.split("\n")[2]).not.toBe(second.split("\n")[2]);
  });

  it("only suggests vegan recipes to vegans", () => {
    const reply = ask("Give me a dinner recipe", profileFixture({ dietaryPreferences: ["Vegan"] }));
    expect(reply).toMatch(/Lentil and chickpea curry/);
  });

  it("refers pain to a professional", () => {
    expect(ask("my shoulder hurts")).toMatch(/doctor or physio/);
  });

  it("gives specific form tips", () => {
    expect(ask("deadlift form")).toMatch(/Bar over mid-foot/);
  });
});
