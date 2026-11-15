// Fixtures for unit tests.
import type { AppData, Profile } from "./types";
import { COLLECTIONS } from "./types";
import { defaultPrivacy, defaultReminders } from "./templates";

export function emptyData(): AppData {
  return Object.fromEntries(COLLECTIONS.map((c) => [c, []])) as unknown as AppData;
}

export function profileFixture(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "u1",
    name: "Sam",
    age: 24,
    sex: "male",
    heightCm: 180,
    startWeightKg: 70,
    targetWeightKg: 78,
    experience: "beginner",
    trainingDays: 4,
    goal: "bulk",
    dailyActivity: "light",
    dietaryPreferences: [],
    dietNotes: "",
    usesCreatine: true,
    usesProteinPowder: true,
    usesMassGainer: false,
    targets: { calories: 3000, protein: 140, carbs: 380, fat: 90, waterMl: 3000, weeklyGainKg: 0.35 },
    targetsCustomised: false,
    reminders: defaultReminders(),
    privacy: defaultPrivacy(),
    onboardedAt: "2026-11-01T08:00:00.000Z",
    updatedAt: "2026-11-01T08:00:00.000Z",
    ...overrides,
  };
}

let n = 0;
export const rec = () => {
  n++;
  return { id: `r${n}`, createdAt: `2026-11-01T00:00:${String(n % 60).padStart(2, "0")}.000Z`, updatedAt: "2026-11-01T00:00:00.000Z" };
};
