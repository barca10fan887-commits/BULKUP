// Client for the BULKUP API server (AI coach, food photo scanner, account deletion).
import type { ChatMessage, FoodScanResult, StatusResponse } from "@shared/api";

let tokenProvider: () => Promise<string | null> = async () => null;
export function setTokenProvider(fn: () => Promise<string | null>) {
  tokenProvider = fn;
}

const ACCESS_KEY = "bulkup.accessCode";
export function getAccessCode(): string {
  try {
    return localStorage.getItem(ACCESS_KEY) ?? "";
  } catch {
    return "";
  }
}
export function setAccessCode(code: string) {
  try {
    if (code) localStorage.setItem(ACCESS_KEY, code);
    else localStorage.removeItem(ACCESS_KEY);
  } catch {
    /* storage unavailable */
  }
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

async function headers(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = await tokenProvider();
  if (token) h.Authorization = `Bearer ${token}`;
  const code = getAccessCode();
  if (code) h["X-Access-Code"] = code;
  return h;
}

async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { method: body === undefined ? "GET" : "POST", headers: await headers(), body: body === undefined ? undefined : JSON.stringify(body), signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("Couldn't reach the BULKUP server. Check your connection.", 0, "network");
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    const j = json as { error?: string; code?: string } | null;
    throw new ApiError(j?.error || `Request failed (${res.status})`, res.status, j?.code);
  }
  return json as T;
}

let statusCache: Promise<StatusResponse> | null = null;
export function getStatus(force = false): Promise<StatusResponse> {
  if (!statusCache || force) {
    statusCache = request<StatusResponse>("/api/status").catch(() => ({ ai: false, model: null, auth: "locked", accountDeletion: false }) as StatusResponse);
  }
  return statusCache;
}

export function scanFood(imageBase64: string, mediaType: "image/jpeg", hint?: string, signal?: AbortSignal) {
  return request<FoodScanResult>("/api/food-scan", { imageBase64, mediaType, hint }, signal);
}

/** Streams the coach's reply. Calls onText with each chunk; resolves with the full text. */
export async function streamCoach(messages: ChatMessage[], context: unknown, mode: "chat" | "checkin", onText: (chunk: string) => void, signal?: AbortSignal): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/coach", { method: "POST", headers: await headers(), body: JSON.stringify({ messages, context, mode }), signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("Couldn't reach the BULKUP server. Check your connection.", 0, "network");
  }
  if (!res.ok || !res.body) {
    const j = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
    throw new ApiError(j?.error || `Coach request failed (${res.status})`, res.status, j?.code);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    full += chunk;
    onText(chunk);
  }
  const marker = full.indexOf("\u0000ERROR:");
  if (marker >= 0) throw new ApiError(full.slice(marker + 7) || "The coach stopped unexpectedly.", 500, "stream");
  return full;
}

export function deleteCloudAccount() {
  return request<{ ok: true }>("/api/account/delete", {});
}
