// Built-in coach (no AI service): answers a wide range of fitness and food
// questions using curated advice plus the user's own logged data.
import type { AppData, ISODate, Profile, WeeklyStats } from "./types";
import { addDays, formatDay } from "./dates";
import { completedSessions, currentWeight, dailyTotals, weightTrendPerWeek } from "./stats";
import { nextWorkoutPlan } from "./coachContext";
import { BUILTIN_FOODS } from "./foodDb";
import { round } from "./format";
import { simpleGoal } from "./calc";
import { FORM_TIPS, RECIPES, SUPPLEMENT_INFO, type Recipe } from "./coachKnowledge";

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

type Intent =
  | "calories" | "protein" | "eat" | "rate" | "workout" | "plateau" | "week" | "routine"
  | "recipe" | "snack" | "sleep" | "recovery" | "motivation" | "cardio" | "supplement" | "water" | "alcohol"
  | "eatingOut" | "cheat" | "budget" | "mealPrep" | "form" | "warmup" | "missed" | "pain" | "appetite" | "hunger"
  | "fluctuation" | "targets" | "fatLoss" | "greeting" | "thanks" | "unknown";

// Checked in order: more specific topics first.
const RULES: [Intent, RegExp][] = [
  ["pain", /\b(pain|hurts?|injur|sprain|strain|pulled|tweak|sharp|doctor|physio)/],
  ["thanks", /^(thanks|thank you|thx|cheers|ty)\b/],
  ["greeting", /^(hi|hey|hello|yo|sup|g'?day|good (morning|afternoon|evening))\b[!. ]*$/],
  ["supplement", /(creatine|protein powder|whey|mass gainer|gainer|pre[- ]?workout|fish oil|omega|vitamin d|bcaa|supplement)/],
  ["form", /(form|technique|how (do|to) (i )?(do|perform)|cues?)\b.*|(bench|squat|deadlift|shoulder press|overhead press|ohp|row|pull[- ]?up|push[- ]?up).*(form|technique|properly|right|correct)/],
  ["warmup", /(warm[- ]?up|warming up|before (i )?lift)/],
  ["recipe", /(recipe|cook|make for (dinner|lunch|breakfast)|dinner idea|lunch idea|breakfast idea|meal idea|another one|something else|another)/],
  ["mealPrep", /(meal ?prep|prep (my )?meals|batch cook)/],
  ["budget", /(cheap|budget|afford|money|broke|student)/],
  ["eatingOut", /(eating out|restaurant|takeaway|take ?out|fast food|mcdonald|kfc|subway|uber ?eats|maccas)/],
  ["alcohol", /(alcohol|beer|drink(ing)? (alcohol|beer)|wine|party|drunk)/],
  ["cheat", /(cheat (meal|day)|binge|overate|ate too much|junk food|pizza last night|blew my diet)/],
  ["appetite", /(can'?t eat|not hungry|no appetite|full all the time|struggle to eat|too full|hard to eat)/],
  ["hunger", /(always hungry|so hungry|starving|cravings?|keep snacking)/],
  ["sleep", /(sleep|tired|insomnia|bed ?time|rest well)/],
  ["recovery", /(sore|soreness|doms|recover|rest day|deload|overtrain)/],
  ["motivation", /(motivat|lazy|give up|can'?t be bothered|don'?t feel like|discipline|consisten)/],
  ["missed", /(missed|skipped|skip|sick|ill|holiday|travel)/],
  ["cardio", /(cardio|running|run |walk|steps|hiit|bike|swim)/],
  ["water", /(water|hydrat|drink enough)/],
  ["fluctuation", /(weight (went|jumped|is) up|fluctuat|heavier this morning|water weight|bloat)/],
  ["fatLoss", /(lose fat|belly fat|abs|six pack|tone|toned|body ?fat|lean out)/],
  ["plateau", /(stopped|stall|plateau|not gaining|not losing|isn'?t (going up|going down|increasing|dropping)|stuck)/],
  ["rate", /(fast enough|rate|gaining.*(fast|slow|enough)|losing.*(fast|slow|enough)|on track|progress)/],
  ["workout", /(next workout|train today|workout today|what should i (train|lift)|today'?s workout)/],
  ["eat", /(meal plan|diet plan|what (should|can) i eat(?!.*protein))/],
  ["routine", /(improve|routine|program|split|plan)/],
  ["week", /(this week|change|adjust)/],
  ["targets", /(why .*(calories|protein|target)|how (much|many) (protein|calories)(?!.*(left|remaining))|explain my (target|calories))/],
  ["snack", /(snack|between meals|something small)/],
  ["protein", /protein/],
  ["calories", /(calorie|kcal|left|remaining)/],
  ["eat", /(eat|meal|food|hungry|dinner|lunch|breakfast)/],
];

export function detectIntent(q: string): Intent {
  const s = q.toLowerCase().trim();
  for (const [intent, re] of RULES) if (re.test(s)) return intent;
  return "unknown";
}

const pick = <T,>(arr: T[], seed: number) => arr[Math.abs(seed) % arr.length];

function recipesFor(profile: Profile, meal?: Recipe["meal"]): Recipe[] {
  const prefs = profile.dietaryPreferences.map((p) => p.toLowerCase());
  const g = simpleGoal(profile.goal);
  return RECIPES.filter((r) => (!meal || r.meal === meal) && (!prefs.includes("vegan") || r.vegan) && (!prefs.includes("vegetarian") || r.vegetarian))
    .sort((a, b) => (g === "cut" ? b.protein / b.kcal - a.protein / a.kcal : g === "bulk" ? b.kcal - a.kcal : 0));
}

function mealOfDay(hour: number): Recipe["meal"] {
  if (hour < 10) return "breakfast";
  if (hour < 14) return "lunch";
  if (hour < 16) return "snack";
  return "dinner";
}

function formatRecipe(r: Recipe): string {
  return `**${r.name}** (about ${r.kcal} kcal, ${r.protein} g protein)\n${r.ingredients.map((i) => `- ${i}`).join("\n")}\n\n${r.steps}`;
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

export function basicCoachReply(question: string, data: AppData, profile: Profile, date: ISODate, history: string[] = [], hour = new Date().getHours()): string {
  const t = profile.targets;
  const totals = dailyTotals(data.foodEntries, date);
  const calLeft = Math.round(t.calories - totals.calories);
  const proLeft = Math.round(t.protein - totals.protein);
  let intent = detectIntent(question);
  const goal = simpleGoal(profile.goal);
  // "another one" / "more" continues the previous topic.
  const followUp = /^(another|more|again|next|something else|another one|other)\b/i.test(question.trim());
  if (followUp && history.length) {
    const prev = [...history].reverse().map(detectIntent).find((i) => i !== "unknown" && i !== "recipe");
    if (prev === "snack") intent = "snack";
    else intent = "recipe";
  }
  const seed = history.length + question.length;
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
    case "recipe": {
      const meals = ["breakfast", "lunch", "dinner", "snack"] as const;
      const findMeal = (text: string) => meals.find((m) => text.toLowerCase().includes(m));
      // A follow-up keeps the meal from the last recipe request.
      const mealWord = findMeal(question) ?? (followUp ? [...history].reverse().map(findMeal).find(Boolean) : undefined);
      const list = recipesFor(profile, mealWord ?? mealOfDay(hour));
      const pool = list.length ? list : recipesFor(profile);
      const asked = history.filter((h) => ["recipe"].includes(detectIntent(h)) || /^(another|more|something else)/i.test(h)).length;
      const r = pool[asked % pool.length];
      const fit = calLeft > 0 ? `\n\nYou have ${calLeft} kcal and ${Math.max(proLeft, 0)} g protein left today, so this ${r.kcal <= calLeft ? "fits" : "would take you a bit over. Use a smaller portion"}.` : "";
      return `Try this:\n\n${formatRecipe(r)}${fit}\n\nSay "another one" for a different idea.`;
    }
    case "snack": {
      const pool = recipesFor(profile, "snack");
      const asked = history.filter((h) => detectIntent(h) === "snack").length;
      const r = pool[asked % pool.length];
      return goal === "cut"
        ? `A filling, high-protein snack:\n\n${formatRecipe(r)}\n\nOther quick options: a protein yoghurt, a tin of tuna on rice cakes, or an apple with a protein shake.`
        : `${formatRecipe(r)}\n\nOther easy calorie boosters: a handful of nuts (about 180 kcal), a banana with peanut butter, or a glass of full cream milk.`;
    }
    case "mealPrep":
      return `Meal prep in about an hour:\n- Cook 1 kg of chicken (or tofu/lentils) with 2-3 different seasonings so it doesn't get boring.\n- Cook a big pot of rice or roast a tray of potatoes.\n- Roast or steam 2-3 trays of vegetables.\n- Portion into 4-5 containers. They keep about 3-4 days in the fridge, or freeze some.\n\nGood batch recipes: ${recipesFor(profile, "dinner").slice(0, 2).map((r) => r.name).join(", ")}.`;
    case "budget":
      return `Cheap foods that are great for ${goal === "cut" ? "cutting" : goal === "bulk" ? "bulking" : "staying fit"}:\n- Eggs, canned tuna, chicken thighs, mince on special\n- Oats, rice, pasta, potatoes, bread\n- Frozen vegetables and bananas\n- Milk, Greek yoghurt, cottage cheese\n- Lentils, chickpeas and beans (very cheap protein)\n\nBuying in bulk and meal prepping saves the most money.`;
    case "eatingOut":
      return goal === "cut"
        ? "Eating out on a cut:\n- Pick a grilled protein (chicken, steak, fish) with salad or veg.\n- Ask for sauces on the side; skip the fries or share them.\n- Burgers: single patty, no mayo. Subway: a 6-inch with double meat and salad.\n- Log your best guess afterwards. A rough estimate beats nothing."
        : "Eating out on a bulk is easy:\n- Burgers, burritos and pasta dishes are calorie-dense. Add extra protein where you can.\n- Pair it with a milkshake or a side if you're short on calories.\n- Log your best guess afterwards so the day still counts.";
    case "alcohol":
      return `Alcohol is about 7 kcal per gram with no nutrition. A beer is about 150 kcal, a glass of wine about 120 kcal and a mixer drink about 200 kcal. It also slows recovery and muscle building, especially in big amounts.\n\nIf you drink: keep it to a few, eat a proper protein meal first, drink water between drinks, and log it.${goal === "cut" ? " On a cut, the calories add up fast." : ""}`;
    case "cheat":
      return "One big day won't undo your progress. A single day of overeating mostly shows up as water weight for a few days.\n\nJust go back to normal at your next meal: don't skip meals or starve yourself to make up for it. Log it honestly so your averages stay real, and move on.";
    case "appetite":
      return `Struggling to eat enough is really common on a bulk. Try:\n- Drink some calories: the mass-gain smoothie (milk, oats, banana, peanut butter, protein) is about 750 kcal.\n- Add calorie-dense extras: olive oil on rice, peanut butter, cheese, nuts, dried fruit.\n- Eat more often: 4-5 smaller meals instead of 3 big ones.\n- Don't fill up on water or salad right before meals.\n\nYou still need about ${Math.max(calLeft, 0)} kcal today.`;
    case "hunger":
      return goal === "cut"
        ? "Feeling hungry on a cut is normal. To stay fuller:\n- Get protein in every meal (you're aiming for " + t.protein + " g a day).\n- Fill half your plate with vegetables.\n- Choose high-volume foods: potatoes, oats, berries, soups, popcorn.\n- Drink water and get enough sleep. Poor sleep makes you hungrier.\n- Diet drinks and sugar-free gum can help with cravings."
        : `If you're hungry, eat! You have ${Math.max(calLeft, 0)} kcal left today. Protein-rich options keep you full longest.`;
    case "sleep":
      return "Sleep is when you recover and build muscle. Aim for 7-9 hours.\n- Keep a regular bedtime and wake time, even on weekends.\n- No caffeine (including pre-workout) within 6-8 hours of bed.\n- Dark, cool room; put your phone away 30 minutes before bed.\n- A big late meal can disrupt sleep for some people. A small protein snack is fine.";
    case "recovery":
      return "Soreness is normal after new or harder training and usually fades in 2-3 days.\n- Light movement (walking, easy cycling) helps more than total rest.\n- Sleep, protein and enough food are the biggest recovery tools.\n- You can train a sore muscle lightly, but if you're very sore, train something else that day.\n- Every 6-10 weeks of hard training, an easier deload week helps you come back stronger.";
    case "motivation":
      return `Everyone has low-motivation days. ${pick(["You don't need motivation, you need a plan you follow even when you don't feel like it.", "Showing up for a short workout beats skipping. Tell yourself you'll do just 15 minutes; you'll usually do more.", "Progress is built on boring, consistent weeks, not perfect ones."], seed)}\n\n${data.workoutSessions.filter((s) => s.finishedAt).length ? `You've already completed ${data.workoutSessions.filter((s) => s.finishedAt).length} workouts in BULKUP. Keep the streak going.` : "Start small: log today's food and do one workout this week."}`;
    case "missed":
      return "Missing a session or a few days isn't a problem. Just pick up where you left off with your next scheduled workout. Don't try to cram missed sessions in.\n\nIf you've been sick, start back a little lighter for a session or two. Strength comes back quickly.";
    case "cardio":
      return goal === "cut"
        ? "Cardio helps a cut by burning extra calories, but diet does most of the work.\n- Easiest win: walk more. 8,000-10,000 steps a day adds up.\n- 2-3 sessions of 20-30 minutes (bike, incline walk, rower) on top of lifting is plenty.\n- Keep lifting heavy so you keep your muscle."
        : goal === "bulk"
          ? "A little cardio is great for heart health and won't hurt your gains.\n- 2-3 sessions of 20 minutes, or regular walking, is plenty.\n- Just eat a bit more to cover what you burn."
          : "For general fitness, aim for about 150 minutes of moderate cardio a week (brisk walking counts), plus your lifting.";
    case "water":
      return `Your water target is ${t.waterMl} ml a day. You've logged ${data.waterLogs.filter((w) => w.date === date).reduce((a, w) => a + w.ml, 0)} ml today.\n\nKeep a bottle with you, drink a glass with each meal, and add more on training days or when it's hot. Pale yellow urine is a good sign you're hydrated.`;
    case "fluctuation":
      return "Daily weight jumps of 0.5-2 kg are normal. They come from water, salt, carbs, food in your gut and hormones, not fat.\n\nWeigh in the morning after the toilet, before eating, and look at the weekly average on the Progress page instead of single days.";
    case "fatLoss":
      return `You can't spot-reduce fat from one area. Abs show when overall body fat gets low enough.\n- That takes a calorie deficit (a Cut goal), high protein and consistent lifting.\n- Ab exercises build the muscle underneath but don't burn the fat on top.\n${goal !== "cut" ? "\nIf that's your main aim, switch your goal to Cut under Me > Edit." : `\nYou're already cutting with a target of ${t.calories} kcal. Stay consistent.`}`;
    case "targets":
      return `Your targets come from your age, height, weight, activity and goal:\n- **${t.calories} kcal/day**: your estimated maintenance ${goal === "cut" ? "minus a deficit to lose fat" : goal === "bulk" ? "plus a surplus to build muscle" : "to stay the same"}.\n- **${t.protein} g protein**: about ${round(t.protein / weight, 1)} g per kg of body weight, which supports muscle${goal === "cut" ? " while you lose fat" : ""}.\n- **${t.weeklyGainKg > 0 ? "+" : ""}${t.weeklyGainKg} kg/week**: a sustainable rate.\n\nThese are estimates. If your weight isn't moving as planned after 2-3 weeks, adjust calories by 150-200 under Me > Goals & targets.`;
    case "supplement": {
      const s2 = question.toLowerCase();
      const key = s2.includes("creatine") ? "creatine" : /protein|whey/.test(s2) ? "protein" : /gainer/.test(s2) ? "gainer" : /pre[- ]?workout/.test(s2) ? "pre-workout" : /fish|omega/.test(s2) ? "fish oil" : /vitamin d/.test(s2) ? "vitamin d" : /bcaa/.test(s2) ? "bcaa" : null;
      if (key) return SUPPLEMENT_INFO[key];
      return `Supplements are optional; food, training and sleep matter far more. The ones worth considering:\n- ${SUPPLEMENT_INFO.creatine}\n- ${SUPPLEMENT_INFO.protein}\n\nMost others (BCAAs, fat burners, testosterone boosters) aren't worth the money.`;
    }
    case "form": {
      const s2 = question.toLowerCase();
      const key = Object.keys(FORM_TIPS).find((k) => s2.includes(k) || (k === "shoulder press" && /overhead press|ohp/.test(s2)) || (k === "pull-up" && /pull ?up|chin/.test(s2)) || (k === "push-up" && /push ?up/.test(s2)));
      if (key) return `**${key[0].toUpperCase() + key.slice(1)} tips:**\n${FORM_TIPS[key].map((x) => `- ${x}`).join("\n")}\n\nFilm a set from the side to check yourself. If anything hurts (not just effort), stop and get it checked.`;
      return `I have technique tips for: ${Object.keys(FORM_TIPS).join(", ")}. Ask something like "squat form tips".`;
    }
    case "warmup":
      return "A quick warm-up (5-10 minutes):\n1. 3-5 minutes of light cardio to get warm.\n2. A few dynamic moves: leg swings, arm circles, bodyweight squats.\n3. For your first lift, do 2-3 lighter sets building up to your working weight (e.g. empty bar x10, 50% x5, 75% x3).";
    case "pain":
      return "I'm not able to diagnose pain or injuries. If something hurts sharply, is swollen, or doesn't improve in a few days, please see a doctor or physio.\n\nIn the meantime, avoid movements that cause pain, keep training the parts that feel fine, and don't push through sharp pain.";
    case "greeting":
      return `Hey ${profile.name}! You've got ${Math.max(calLeft, 0)} kcal and ${Math.max(proLeft, 0)} g protein left today. Ask me about meals, recipes, your workouts, progress, sleep or anything else fitness-related.`;
    case "thanks":
      return pick(["Anytime! Keep it up.", "No worries. You've got this.", "Happy to help. Stay consistent!"], seed);
    default:
      return `Here's where you stand today: ${Math.round(totals.calories)}/${t.calories} kcal, ${Math.round(totals.protein)}/${t.protein} g protein, current weight ${weight} kg (target ${profile.targetWeightKg} kg).\n\nI can help with things like:\n- "Give me a dinner recipe" or "high-protein snack"\n- "Am I on track?" or "Why has my weight stopped changing?"\n- "What should my next workout be?" or "Squat form tips"\n- "Is creatine worth it?", "How do I sleep better?", "Eating out tips"`;
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
