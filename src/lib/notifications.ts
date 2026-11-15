// Local reminders. Web apps can only show these while the app is open or
// recently backgrounded; reliable background delivery needs a push server.
import { isNative, nativePermission, requestNativePermission } from "./nativeReminders";

export function notificationsSupported(): boolean {
  return isNative() || (typeof window !== "undefined" && "Notification" in window);
}

/** Current permission, including the native app. */
export async function getPermission(): Promise<NotificationPermission | "unsupported"> {
  if (isNative()) return nativePermission();
  return permission();
}

export function permission(): NotificationPermission | "unsupported" {
  return notificationsSupported() ? Notification.permission : "unsupported";
}

export async function requestPermission(): Promise<NotificationPermission | "unsupported"> {
  if (isNative()) return requestNativePermission();
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

const BASE = import.meta.env.BASE_URL;
const ICON = `${BASE}icons/icon-192.png`;

export async function notify(title: string, body: string, tag: string, path = "/") {
  if (permission() !== "granted") return;
  const url = BASE.replace(/\/$/, "") + path;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, tag, icon: ICON, badge: ICON, data: { url } });
    else new Notification(title, { body, tag, icon: ICON });
  } catch {
    /* some browsers refuse notifications from page context */
  }
}

/** Is installed to the home screen (required for notifications on iOS). */
export function isStandalone(): boolean {
  if (isNative()) return true;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
