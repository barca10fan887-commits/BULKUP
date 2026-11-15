import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from "./publicConfig";

const env = (k: string) => ((import.meta.env as Record<string, string | undefined>)[k] ?? "").trim();

export const config = {
  // VITE_SUPABASE_URL=off forces on-device mode (used for local testing).
  supabaseUrl: env("VITE_SUPABASE_URL") === "off" ? "" : env("VITE_SUPABASE_URL") || PUBLIC_SUPABASE_URL,
  supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || PUBLIC_SUPABASE_ANON_KEY,
  /** Where the BULKUP API server lives. Empty = same origin (web deployment with the Node server). */
  apiBaseUrl: ((import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "").replace(/\/$/, ""),
  offBaseUrl: ((import.meta.env.VITE_OFF_BASE_URL as string | undefined)?.trim() || "https://world.openfoodfacts.org").replace(/\/$/, ""),
};

export const cloudEnabled = Boolean(config.supabaseUrl && config.supabaseAnonKey);

// With accounts on and no separate server, AI runs as a Supabase Edge Function.
if (!config.apiBaseUrl && cloudEnabled) config.apiBaseUrl = `${config.supabaseUrl.replace(/\/$/, "")}/functions/v1/api`;
