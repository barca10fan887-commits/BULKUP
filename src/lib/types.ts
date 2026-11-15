// Domain model for BULKUP. All weights are kg, lengths cm, volumes ml, energy kcal.
// Dates are local calendar days formatted YYYY-MM-DD.

export type ISODate = string;

export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type Sex = "male" | "female" | "unspecified";
export type Experience = "beginner" | "intermediate" | "advanced";
export type Goal = "lean_bulk" | "bulk" | "gain_weight" | "strength";
export type DailyActivity = "sedentary" | "light" | "active";
export type MealType = "breakfast" | "lunch" | "dinner" | "snacks";

export interface Targets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  waterMl: number;
  /** Planned weekly gain in kg. */
  weeklyGainKg: number;
}

export interface ReminderPrefs {
  enabled: boolean;
  meals: { enabled: boolean; times: string[] };
  water: { enabled: boolean; everyHours: number; from: string; to: string };
  supplements: { enabled: boolean };
  workouts: { enabled: boolean; time: string };
  checkIn: { enabled: boolean; weekday: number; time: string };
}

export interface PrivacyPrefs {
  /** Explicit consent to send logged data to the AI coach / scanner. */
  aiDataSharing: boolean;
  /** Blur progress photo thumbnails until tapped. */
  blurPhotos: boolean;
}

export interface Profile {
  id: string; // equals user id
  name: string;
  age: number;
  sex: Sex;
  heightCm: number;
  startWeightKg: number;
  targetWeightKg: number;
  experience: Experience;
  trainingDays: number;
  goal: Goal;
  dailyActivity: DailyActivity;
  dietaryPreferences: string[];
  dietNotes: string;
  usesCreatine: boolean;
  usesProteinPowder: boolean;
  usesMassGainer: boolean;
  targets: Targets;
  /** True once the user overrides a computed target; recalculation then asks first. */
  targetsCustomised: boolean;
  reminders: ReminderPrefs;
  privacy: PrivacyPrefs;
  onboardedAt: string;
  updatedAt: string;
}

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type FoodSource = "manual" | "database" | "openfoodfacts" | "barcode" | "photo_ai" | "custom" | "favourite" | "supplement";

export interface FoodEntry extends BaseRecord, Macros {
  date: ISODate;
  meal: MealType;
  name: string;
  brand?: string;
  /** Human readable serving e.g. "2 x 50 g" */
  servingLabel: string;
  quantity: number;
  source: FoodSource;
  barcode?: string;
  note?: string;
}

/** A reusable food with nutrition per one serving. */
export interface CustomFood extends BaseRecord, Macros {
  name: string;
  brand?: string;
  servingSize: number;
  servingUnit: string;
  barcode?: string;
}

export interface MealItem extends Macros {
  name: string;
  servingLabel: string;
  quantity: number;
}

export interface FavouriteMeal extends BaseRecord {
  name: string;
  meal: MealType;
  items: MealItem[];
}

export interface WaterLog extends BaseRecord {
  date: ISODate;
  ml: number;
}

export interface RoutineExercise {
  id: string;
  name: string;
  sets: number;
  reps: string; // e.g. "8-10"
  restSec: number;
  note?: string;
}

export interface Routine extends BaseRecord {
  name: string;
  description?: string;
  exercises: RoutineExercise[];
  /** 0 = Sunday ... 6 = Saturday */
  scheduledDays: number[];
}

export interface SetLog {
  reps: number;
  weightKg: number;
  done: boolean;
}

export interface SessionExercise {
  id: string;
  name: string;
  restSec: number;
  sets: SetLog[];
}

export interface WorkoutSession extends BaseRecord {
  date: ISODate;
  routineId?: string;
  name: string;
  exercises: SessionExercise[];
  startedAt: string;
  finishedAt?: string;
  durationMin?: number;
  notes?: string;
}

export interface BodyEntry extends BaseRecord {
  date: ISODate;
  weightKg?: number;
  chestCm?: number;
  armCm?: number;
  waistCm?: number;
  legCm?: number;
  custom: Record<string, number>;
  note?: string;
}

export interface ProgressPhoto extends BaseRecord {
  date: ISODate;
  /** Storage key: IndexedDB key in local mode, storage object path in cloud mode. */
  path: string;
  pose: "front" | "side" | "back" | "other";
  note?: string;
}

export type SupplementKind = "creatine" | "protein" | "mass_gainer" | "pre_workout" | "custom";

export interface Supplement extends BaseRecord {
  name: string;
  kind: SupplementKind;
  servingAmount: number;
  servingUnit: string;
  dailyServings: number;
  /** Nutrition per serving, from the product label. Zero for creatine etc. */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Optional cost tracking */
  containerCost?: number;
  servingsPerContainer?: number;
  reminderTime?: string;
  active: boolean;
}

export interface SupplementLog extends BaseRecord {
  date: ISODate;
  supplementId: string;
  servings: number;
  time: string;
  /** Linked diary entry when the supplement has calories. */
  foodEntryId?: string;
}

export interface WeeklyStats {
  from: ISODate;
  to: ISODate;
  startWeightKg: number | null;
  endWeightKg: number | null;
  changeKg: number | null;
  avgCalories: number;
  avgProtein: number;
  daysLogged: number;
  workoutsCompleted: number;
  workoutsPlanned: number;
  consistencyPct: number;
  targetProgressPct: number | null;
}

export interface CheckIn extends BaseRecord {
  weekEnding: ISODate;
  stats: WeeklyStats;
  energy: number; // 1-5
  sleep: number; // 1-5
  hunger: number; // 1-5
  notes: string;
  review?: string;
  reviewSource?: "ai" | "basic";
}

export interface CoachMessage extends BaseRecord {
  role: "user" | "assistant";
  content: string;
  source?: "ai" | "basic";
}

export interface Collections {
  foodEntries: FoodEntry;
  customFoods: CustomFood;
  favouriteMeals: FavouriteMeal;
  waterLogs: WaterLog;
  routines: Routine;
  workoutSessions: WorkoutSession;
  bodyEntries: BodyEntry;
  progressPhotos: ProgressPhoto;
  supplements: Supplement;
  supplementLogs: SupplementLog;
  checkIns: CheckIn;
  coachMessages: CoachMessage;
}

export type CollectionName = keyof Collections;

export const COLLECTIONS: CollectionName[] = [
  "foodEntries",
  "customFoods",
  "favouriteMeals",
  "waterLogs",
  "routines",
  "workoutSessions",
  "bodyEntries",
  "progressPhotos",
  "supplements",
  "supplementLogs",
  "checkIns",
  "coachMessages",
];

export type AppData = { [K in CollectionName]: Collections[K][] };
