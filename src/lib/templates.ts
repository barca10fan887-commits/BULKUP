import type { PrivacyPrefs, ReminderPrefs, Routine, RoutineExercise, Supplement, SupplementKind } from "./types";
import { uid } from "./id";

const ex = (name: string, sets: number, reps: string, restSec: number): RoutineExercise => ({ id: uid(), name, sets, reps, restSec });

export function starterRoutines(trainingDays: number): Omit<Routine, "id" | "createdAt" | "updatedAt">[] {
  // Spread starter templates over the week to match the chosen training days.
  const schedules: Record<number, [number[], number[], number[]]> = {
    1: [[], [], [3]],
    2: [[], [], [1, 4]],
    3: [[], [], [1, 3, 5]],
    4: [[1, 4], [2, 5], []],
    5: [[1, 4], [2, 5], [6]],
    6: [[1, 4], [2, 5], [3, 6]],
    7: [[1, 4], [2, 5], [0, 3, 6]],
  };
  const [upper, lower, full] = schedules[Math.min(7, Math.max(1, trainingDays))];
  return [
    {
      name: "Upper Body",
      description: "Chest, shoulders and arms",
      scheduledDays: upper,
      exercises: [
        ex("Bench press", 4, "6-8", 150),
        ex("Incline dumbbell press", 3, "8-10", 120),
        ex("Shoulder press", 3, "8-10", 120),
        ex("Lateral raises", 3, "12-15", 60),
        ex("Tricep pushdowns", 3, "10-12", 60),
        ex("Bicep curls", 3, "10-12", 60),
      ],
    },
    {
      name: "Lower Body",
      description: "Quads, hamstrings and calves",
      scheduledDays: lower,
      exercises: [
        ex("Squats", 4, "5-8", 180),
        ex("Leg press", 3, "10-12", 120),
        ex("Romanian deadlifts", 3, "8-10", 120),
        ex("Leg curls", 3, "10-12", 75),
        ex("Calf raises", 4, "12-15", 60),
      ],
    },
    {
      name: "Full Body",
      description: "Compound lifts for the whole body",
      scheduledDays: full,
      exercises: [
        ex("Bench press", 3, "6-8", 150),
        ex("Lat pulldown", 3, "8-10", 90),
        ex("Squats", 3, "6-8", 180),
        ex("Shoulder press", 3, "8-10", 90),
        ex("Rows", 3, "8-10", 90),
        ex("Bicep curls", 2, "10-12", 60),
      ],
    },
  ];
}

export const EXERCISE_LIBRARY = [
  "Bench press", "Incline bench press", "Incline dumbbell press", "Dumbbell bench press", "Chest fly", "Push-ups", "Dips",
  "Shoulder press", "Dumbbell shoulder press", "Lateral raises", "Rear delt fly", "Face pulls",
  "Pull-ups", "Chin-ups", "Lat pulldown", "Rows", "Barbell rows", "Seated cable rows", "Dumbbell rows", "Deadlifts",
  "Squats", "Front squats", "Leg press", "Hack squat", "Lunges", "Bulgarian split squats", "Romanian deadlifts",
  "Leg curls", "Leg extensions", "Hip thrusts", "Calf raises",
  "Bicep curls", "Hammer curls", "Preacher curls", "Tricep pushdowns", "Skull crushers", "Overhead tricep extension",
  "Plank", "Hanging leg raises", "Cable crunches",
];

export function starterSupplements(opts: { creatine: boolean; protein: boolean; gainer: boolean }): Omit<Supplement, "id" | "createdAt" | "updatedAt">[] {
  const list: Omit<Supplement, "id" | "createdAt" | "updatedAt">[] = [];
  if (opts.creatine) list.push(blankSupplement("creatine"));
  if (opts.protein) list.push(blankSupplement("protein"));
  if (opts.gainer) list.push(blankSupplement("mass_gainer"));
  return list;
}

export function blankSupplement(kind: SupplementKind): Omit<Supplement, "id" | "createdAt" | "updatedAt"> {
  // Nutrition values start at zero on purpose: the user enters them from their own label.
  const base = { calories: 0, protein: 0, carbs: 0, fat: 0, active: true, dailyServings: 1 };
  switch (kind) {
    case "creatine":
      return { ...base, name: "Creatine monohydrate", kind, servingAmount: 5, servingUnit: "g" };
    case "protein":
      return { ...base, name: "Protein powder", kind, servingAmount: 30, servingUnit: "g" };
    case "mass_gainer":
      return { ...base, name: "Mass gainer", kind, servingAmount: 150, servingUnit: "g" };
    case "pre_workout":
      return { ...base, name: "Pre-workout", kind, servingAmount: 1, servingUnit: "scoop" };
    default:
      return { ...base, name: "", kind, servingAmount: 1, servingUnit: "serving" };
  }
}

export const SUPPLEMENT_LABEL: Record<SupplementKind, string> = {
  creatine: "Creatine",
  protein: "Protein powder",
  mass_gainer: "Mass gainer",
  pre_workout: "Pre-workout",
  custom: "Custom",
};

export function defaultReminders(): ReminderPrefs {
  return {
    enabled: false,
    meals: { enabled: true, times: ["08:00", "12:30", "18:30"] },
    water: { enabled: true, everyHours: 2, from: "09:00", to: "20:00" },
    supplements: { enabled: true },
    workouts: { enabled: true, time: "17:00" },
    checkIn: { enabled: true, weekday: 0, time: "10:00" },
  };
}

export function defaultPrivacy(): PrivacyPrefs {
  return { aiDataSharing: false, blurPhotos: true };
}

export const DIET_OPTIONS = [
  "No restrictions",
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  "Halal",
  "Kosher",
  "Dairy-free",
  "Gluten-free",
  "Nut allergy",
  "Low FODMAP",
];
