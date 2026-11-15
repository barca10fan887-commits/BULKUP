import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cloudEnabled, config } from "@/lib/config";

export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export const PHOTO_BUCKET = "progress-photos";
