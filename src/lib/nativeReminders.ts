// Native (iOS) reminders via @capacitor/local-notifications. Unlike the web,
// these are scheduled with the OS and fire even when the app is closed.
import { Capacitor } from "@capacitor/core";
import type { Profile, Supplement } from "./types";

export const isNative = () => Capacitor.isNativePlatform();

const lib = () => import("@capacitor/local-notifications").then((m) => m.LocalNotifications);

export async function nativePermission(): Promise<NotificationPermission> {
  const { display } = await (await lib()).checkPermissions();
  return display === "granted" ? "granted" : display === "denied" ? "denied" : "default";
}

export async function requestNativePermission(): Promise<NotificationPermission> {
  const { display } = await (await lib()).requestPermissions();
  return display === "granted" ? "granted" : display === "denied" ? "denied" : "default";
}

const hm = (s: string) => {
  const [hour, minute] = s.split(":").map(Number);
  return { hour: hour || 0, minute: minute || 0 };
};

/** Replace all scheduled reminders to match the user's preferences. */
export async function syncNativeReminders(profile: Profile, supplements: Supplement[]) {
  const ln = await lib();
  const pending = await ln.getPending();
  if (pending.notifications.length) await ln.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  const r = profile.reminders;
  if (!r.enabled || (await nativePermission()) !== "granted") return;

  type N = { id: number; title: string; body: string; schedule: { on: { hour: number; minute: number; weekday?: number }; repeats: true; allowWhileIdle: true }; extra: { path: string } };
  const list: N[] = [];
  const add = (id: number, title: string, body: string, on: N["schedule"]["on"], path: string) => list.push({ id, title, body, schedule: { on, repeats: true, allowWhileIdle: true }, extra: { path } });

  if (r.meals.enabled) r.meals.times.forEach((t, i) => add(100 + i, "Time to eat", "Log your meal to stay on track with your calories.", hm(t), "/food"));
  if (r.water.enabled && r.water.everyHours > 0) {
    const from = hm(r.water.from);
    const to = hm(r.water.to);
    let i = 0;
    for (let m = from.hour * 60 + from.minute; m <= to.hour * 60 + to.minute && i < 16; m += r.water.everyHours * 60, i++) add(200 + i, "Drink some water", "Top up towards your daily water goal.", { hour: Math.floor(m / 60), minute: m % 60 }, "/water");
  }
  if (r.supplements.enabled)
    supplements.filter((s) => s.active && s.reminderTime).slice(0, 20).forEach((s, i) => add(300 + i, `Take your ${s.name.toLowerCase()}`, `${s.servingAmount} ${s.servingUnit}. Tap to log it.`, hm(s.reminderTime!), "/supplements"));
  if (r.workouts.enabled) add(400, "Training check", "Got a workout scheduled today? Tap to start it.", hm(r.workouts.time), "/workouts");
  // Capacitor weekdays are 1 = Sunday ... 7 = Saturday.
  if (r.checkIn.enabled) add(500, "Weekly check-in", "Review your week and get adjustments for the next one.", { ...hm(r.checkIn.time), weekday: r.checkIn.weekday + 1 }, "/check-in");

  if (list.length) await ln.schedule({ notifications: list });
}

/** Open the right screen when a reminder is tapped. */
export async function onNativeReminderTap(navigate: (path: string) => void) {
  const ln = await lib();
  const handle = await ln.addListener("localNotificationActionPerformed", (e) => {
    const path = (e.notification.extra as { path?: string } | undefined)?.path;
    if (path) navigate(path);
  });
  return () => handle.remove();
}
