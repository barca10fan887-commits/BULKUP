export const config = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || "",
  supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || "",
  offBaseUrl: ((import.meta.env.VITE_OFF_BASE_URL as string | undefined)?.trim() || "https://world.openfoodfacts.org").replace(/\/$/, ""),
};

export const cloudEnabled = Boolean(config.supabaseUrl && config.supabaseAnonKey);
