import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from "./publicConfig";

export const config = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || PUBLIC_SUPABASE_URL,
  supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || PUBLIC_SUPABASE_ANON_KEY,
  /** Where the BULKUP API server lives. Empty = same origin (web deployment with the Node server). */
  apiBaseUrl: ((import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "").replace(/\/$/, ""),
  offBaseUrl: ((import.meta.env.VITE_OFF_BASE_URL as string | undefined)?.trim() || "https://world.openfoodfacts.org").replace(/\/$/, ""),
};

export const cloudEnabled = Boolean(config.supabaseUrl && config.supabaseAnonKey);
