import { useEffect, useRef } from "react";
import { useStore } from "@/data/store";
import { notify, permission } from "@/lib/notifications";
import { today, weekday, daysBetween } from "@/lib/dates";
import { dailyTotals, entriesOn, isScheduled, completedSessions, waterOn } from "@/lib/stats";

const FIRED_KEY = "bulkup.reminders.fired";

function loadFired(): Record<string, true> {
  try {
    const raw = JSON.parse(localStorage.getItem(FIRED_KEY) || "{}") as Record<string, true>;
    const t = today();
    return Object.fromEntries(Object.entries(raw).filter(([k]) => k.startsWith(t)));
  } catch {
    return {};
  }
}
function saveFired(f: Record<string, true>) {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(f));
  } catch {
    /* ignore */
  }
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** Checks once a minute and fires due reminders. Skips reminders that are already satisfied. */
export function ReminderScheduler() {
  const { profile, data } = useStore();
  const state = useRef({ profile, data });
  state.current = { profile, data };

  useEffect(() => {
    const tick = () => {
      const { profile: p, data: d } = state.current;
      if (!p?.reminders.enabled || permission() !== "granted") return;
      const r = p.reminders;
      const t = today();
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const fired = loadFired();
      const due = (key: string, at: string) => nowMin >= minutes(at) && nowMin < minutes(at) + 30 && !fired[`${t}:${key}`];
      const mark = (key: string) => {
        fired[`${t}:${key}`] = true;
        saveFired(fired);
      };

      if (r.meals.enabled) {
        r.meals.times.forEach((time, i) => {
          if (due(`meal${i}`, time)) {
            mark(`meal${i}`);
            const left = Math.round(p.targets.calories - dailyTotals(d.foodEntries, t).calories);
            if (left > 0) notify("Time to eat", entriesOn(d.foodEntries, t).length ? `${left} kcal to go today. Log your next meal.` : "Log your first meal of the day.", `meal${i}`, "/food");
          }
        });
      }
      if (r.water.enabled && r.water.everyHours > 0) {
        for (let m = minutes(r.water.from); m <= minutes(r.water.to); m += r.water.everyHours * 60) {
          const at = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
          if (due(`water${m}`, at)) {
            mark(`water${m}`);
            if (waterOn(d, t) < p.targets.waterMl) notify("Drink some water", `${Math.round(waterOn(d, t))} of ${p.targets.waterMl} ml so far.`, "water", "/water");
          }
        }
      }
      if (r.supplements.enabled) {
        for (const s of d.supplements) {
          if (!s.active || !s.reminderTime) continue;
          if (due(`supp-${s.id}`, s.reminderTime)) {
            mark(`supp-${s.id}`);
            const taken = d.supplementLogs.filter((l) => l.supplementId === s.id && l.date === t).reduce((a, l) => a + l.servings, 0);
            if (taken < s.dailyServings) notify(`Take your ${s.name.toLowerCase()}`, `${s.servingAmount} ${s.servingUnit}. Tap to log it.`, `supp-${s.id}`, "/supplements");
          }
        }
      }
      if (r.workouts.enabled && due("workout", r.workouts.time)) {
        mark("workout");
        const routines = isScheduled(d.routines, t);
        if (routines.length && !completedSessions(d.workoutSessions).some((s) => s.date === t)) notify("Workout today", `${routines.map((x) => x.name).join(", ")} is scheduled.`, "workout", "/workouts");
      }
      if (r.checkIn.enabled && weekday(t) === r.checkIn.weekday && due("checkin", r.checkIn.time)) {
        mark("checkin");
        const last = [...d.checkIns].sort((a, b) => b.weekEnding.localeCompare(a.weekEnding))[0];
        if (!last || daysBetween(last.weekEnding, t) >= 6) notify("Weekly check-in", "Review your week and get adjustments for the next one.", "checkin", "/check-in");
      }
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  return null;
}
