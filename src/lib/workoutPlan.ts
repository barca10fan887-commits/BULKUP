// Builds a personal weekly training plan from the user's goal, experience,
// training days and equipment. Pure and deterministic, so it works offline.
import type { Experience, Routine, RoutineExercise } from "./types";
import type { SimpleGoal } from "./calc";
import { uid } from "./id";

export type Equipment = "gym" | "dumbbells" | "bodyweight";

export const EQUIPMENT_LABEL: Record<Equipment, string> = { gym: "Full gym", dumbbells: "Dumbbells at home", bodyweight: "No equipment" };

type Pattern =
  | "squat" | "hinge" | "lunge" | "hPush" | "inclinePush" | "vPush" | "hPull" | "vPull"
  | "chestIso" | "lateral" | "rearDelt" | "biceps" | "triceps" | "calves" | "hamIso" | "quadIso" | "core";

// Each pattern lists variations; plan days rotate through them so A and B days differ.
const POOL: Record<Equipment, Record<Pattern, string[]>> = {
  gym: {
    squat: ["Squats", "Leg press", "Hack squat"],
    hinge: ["Romanian deadlifts", "Deadlifts", "Hip thrusts"],
    lunge: ["Bulgarian split squats", "Walking lunges"],
    hPush: ["Bench press", "Dumbbell bench press", "Machine chest press"],
    inclinePush: ["Incline dumbbell press", "Incline bench press"],
    vPush: ["Shoulder press", "Dumbbell shoulder press"],
    hPull: ["Seated cable rows", "Barbell rows", "Dumbbell rows"],
    vPull: ["Lat pulldown", "Pull-ups"],
    chestIso: ["Cable fly", "Chest fly"],
    lateral: ["Lateral raises", "Cable lateral raises"],
    rearDelt: ["Face pulls", "Rear delt fly"],
    biceps: ["Bicep curls", "Hammer curls", "Preacher curls"],
    triceps: ["Tricep pushdowns", "Overhead tricep extension", "Skull crushers"],
    calves: ["Calf raises", "Seated calf raises"],
    hamIso: ["Leg curls", "Seated leg curls"],
    quadIso: ["Leg extensions"],
    core: ["Hanging leg raises", "Cable crunches", "Plank"],
  },
  dumbbells: {
    squat: ["Goblet squats", "Dumbbell squats"],
    hinge: ["Dumbbell Romanian deadlifts", "Single-leg Romanian deadlifts"],
    lunge: ["Bulgarian split squats", "Dumbbell reverse lunges"],
    hPush: ["Dumbbell floor press", "Push-ups"],
    inclinePush: ["Feet-elevated push-ups", "Dumbbell floor fly press"],
    vPush: ["Dumbbell shoulder press", "Arnold press"],
    hPull: ["Dumbbell rows", "Chest-supported dumbbell rows"],
    vPull: ["Dumbbell pullovers", "Pull-ups (if you have a bar)"],
    chestIso: ["Dumbbell floor fly"],
    lateral: ["Lateral raises"],
    rearDelt: ["Rear delt fly"],
    biceps: ["Dumbbell curls", "Hammer curls"],
    triceps: ["Overhead dumbbell extension", "Dumbbell kickbacks"],
    calves: ["Single-leg calf raises"],
    hamIso: ["Single-leg hip thrusts"],
    quadIso: ["Dumbbell step-ups"],
    core: ["Plank", "Dead bugs", "Russian twists"],
  },
  bodyweight: {
    squat: ["Bodyweight squats", "Jump squats"],
    hinge: ["Glute bridges", "Single-leg glute bridges"],
    lunge: ["Reverse lunges", "Split squats"],
    hPush: ["Push-ups", "Wide push-ups"],
    inclinePush: ["Feet-elevated push-ups", "Decline push-ups"],
    vPush: ["Pike push-ups"],
    hPull: ["Inverted rows (under a sturdy table)", "Towel rows"],
    vPull: ["Pull-ups (or doorway rows)", "Chin-ups (or doorway rows)"],
    chestIso: ["Wide push-ups"],
    lateral: ["Plank shoulder taps"],
    rearDelt: ["Prone Y-raises"],
    biceps: ["Chin-ups (or towel curls)"],
    triceps: ["Diamond push-ups", "Bench dips"],
    calves: ["Calf raises"],
    hamIso: ["Sliding leg curls"],
    quadIso: ["Wall sit"],
    core: ["Plank", "Hollow hold", "Mountain climbers"],
  },
};

const COMPOUND: Pattern[] = ["squat", "hinge", "lunge", "hPush", "inclinePush", "vPush", "hPull", "vPull"];

interface DayTemplate {
  name: string;
  focus: string;
  patterns: Pattern[];
}

const FULL: DayTemplate[] = [
  { name: "Full Body A", focus: "Squat, push and pull", patterns: ["squat", "hPush", "hPull", "vPush", "biceps", "core"] },
  { name: "Full Body B", focus: "Hinge, pull and push", patterns: ["hinge", "vPull", "inclinePush", "lunge", "triceps", "calves"] },
  { name: "Full Body C", focus: "Legs, chest and back", patterns: ["squat", "hPush", "hPull", "lateral", "hamIso", "core"] },
];
const UPPER: DayTemplate = { name: "Upper", focus: "Chest, back, shoulders and arms", patterns: ["hPush", "hPull", "vPush", "vPull", "lateral", "biceps", "triceps"] };
const LOWER: DayTemplate = { name: "Lower", focus: "Quads, hamstrings, glutes and calves", patterns: ["squat", "hinge", "lunge", "hamIso", "calves", "core"] };
const PUSH: DayTemplate = { name: "Push", focus: "Chest, shoulders and triceps", patterns: ["hPush", "vPush", "inclinePush", "chestIso", "lateral", "triceps"] };
const PULL: DayTemplate = { name: "Pull", focus: "Back, rear delts and biceps", patterns: ["vPull", "hPull", "hPull", "rearDelt", "biceps", "biceps"] };
const LEGS: DayTemplate = { name: "Legs", focus: "Quads, hamstrings, glutes and core", patterns: ["squat", "hinge", "quadIso", "hamIso", "calves", "core"] };

const SPLITS: Record<number, DayTemplate[]> = {
  1: [FULL[0]],
  2: [FULL[0], FULL[1]],
  3: FULL,
  4: [{ ...UPPER, name: "Upper A" }, { ...LOWER, name: "Lower A" }, { ...UPPER, name: "Upper B" }, { ...LOWER, name: "Lower B" }],
  5: [UPPER, LOWER, PUSH, PULL, LEGS],
  6: [{ ...PUSH, name: "Push A" }, { ...PULL, name: "Pull A" }, { ...LEGS, name: "Legs A" }, { ...PUSH, name: "Push B" }, { ...PULL, name: "Pull B" }, { ...LEGS, name: "Legs B" }],
};

// 0 = Sunday. Spread sessions out with rest days where possible.
const SCHEDULE: Record<number, number[]> = { 1: [3], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 0] };

export interface PlanOptions {
  goal: SimpleGoal;
  experience: Experience;
  days: number;
  equipment: Equipment;
}

export type PlannedRoutine = Omit<Routine, "id" | "createdAt" | "updatedAt">;

function prescription(goal: SimpleGoal, experience: Experience, compound: boolean, bodyweight: boolean) {
  const extra = experience === "advanced" && compound ? 1 : 0;
  if (bodyweight) return { sets: 3 + extra, reps: goal === "cut" ? "12-20" : "10-20", restSec: compound ? 75 : 45 };
  if (goal === "bulk") return compound ? { sets: 3 + extra, reps: "6-10", restSec: 120 } : { sets: 3, reps: "10-15", restSec: 75 };
  if (goal === "cut") return compound ? { sets: 3 + extra, reps: "5-8", restSec: 120 } : { sets: 2 + (experience === "beginner" ? 0 : 1), reps: "10-15", restSec: 60 };
  return compound ? { sets: 3 + extra, reps: "8-12", restSec: 90 } : { sets: 2 + (experience === "beginner" ? 0 : 1), reps: "12-15", restSec: 60 };
}

export function generatePlan(opts: PlanOptions): PlannedRoutine[] {
  const days = Math.min(7, Math.max(1, Math.round(opts.days)));
  const templates = SPLITS[Math.min(days, 6)];
  const schedule = SCHEDULE[days];
  const pool = POOL[opts.equipment];
  const maxExercises = opts.experience === "beginner" ? 5 : 6 + (opts.experience === "advanced" ? 1 : 0);
  const seen: Partial<Record<Pattern, number>> = {};

  const routines: PlannedRoutine[] = templates.map((t, dayIndex) => {
    const exercises: RoutineExercise[] = [];
    const usedNames = new Set<string>();
    for (const pattern of t.patterns.slice(0, maxExercises)) {
      const options = pool[pattern];
      // Rotate through variations each time a pattern reappears in the week.
      let idx = seen[pattern] ?? 0;
      let name = options[idx % options.length];
      for (let k = 0; usedNames.has(name) && k < options.length; k++) name = options[++idx % options.length];
      seen[pattern] = idx + 1;
      if (usedNames.has(name)) continue;
      usedNames.add(name);
      exercises.push({ id: uid(), name, ...prescription(opts.goal, opts.experience, COMPOUND.includes(pattern), opts.equipment === "bodyweight") });
    }
    // Cuts get a short cardio finisher on alternate days to help the deficit.
    if (opts.goal === "cut" && dayIndex % 2 === 0) exercises.push({ id: uid(), name: "Cardio finisher (bike, incline walk or rower)", sets: 1, reps: "10-15 min", restSec: 0 });
    return { name: t.name, description: t.focus, exercises, scheduledDays: schedule[dayIndex] != null ? [schedule[dayIndex]] : [] };
  });

  if (days === 7) {
    routines.push({
      name: "Active recovery",
      description: "Light movement to recover",
      scheduledDays: [schedule[6]],
      exercises: [
        { id: uid(), name: "Easy walk or bike", sets: 1, reps: "20-40 min", restSec: 0 },
        { id: uid(), name: "Mobility and stretching", sets: 1, reps: "10 min", restSec: 0 },
      ],
    });
  }
  return routines;
}

export function planSummary(opts: PlanOptions): string {
  const split = opts.days <= 3 ? "full-body" : opts.days === 4 ? "upper/lower" : opts.days === 5 ? "upper/lower + push/pull/legs" : "push/pull/legs";
  const style = opts.goal === "bulk" ? "Moderate reps to build muscle" : opts.goal === "cut" ? "Heavy compound lifts to keep muscle, plus short cardio finishers" : "Balanced reps to stay strong and fit";
  return `${opts.days} days a week, ${split}. ${style}.`;
}
