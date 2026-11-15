// Cloud storage in Supabase Postgres + Storage. Row-level security (see
// supabase/migrations) guarantees each user only ever reads/writes their own rows.
import type { SupabaseClient } from "@supabase/supabase-js";
import { COLLECTIONS, type AppData, type CollectionName, type Collections, type Profile } from "@/lib/types";
import type { Repository } from "./repo";
import { PHOTO_BUCKET } from "./supabase";

export const TABLES: Record<CollectionName, string> = {
  foodEntries: "food_entries",
  customFoods: "custom_foods",
  favouriteMeals: "favourite_meals",
  waterLogs: "water_logs",
  routines: "routines",
  workoutSessions: "workout_sessions",
  bodyEntries: "body_entries",
  progressPhotos: "progress_photos",
  supplements: "supplements",
  supplementLogs: "supplement_logs",
  checkIns: "check_ins",
  coachMessages: "coach_messages",
};

const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** Converts only top-level keys; nested JSON columns keep their camelCase shape. */
export function toRow(obj: object, userId: string): Record<string, unknown> {
  const out: Record<string, unknown> = { user_id: userId };
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[snake(k)] = v;
  return out;
}

export function fromRow<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "user_id") continue;
    if (v === null) continue;
    out[camel(k)] = typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) && NUMERIC_KEYS.has(k) ? Number(v) : v;
  }
  return out as T;
}

// Postgres numeric columns arrive as strings via PostgREST in some setups.
const NUMERIC_KEYS = new Set([
  "calories", "protein", "carbs", "fat", "quantity", "serving_size", "ml", "weight_kg", "chest_cm", "arm_cm", "waist_cm", "leg_cm",
  "serving_amount", "daily_servings", "container_cost", "servings_per_container", "servings", "duration_min",
]);

export class SupabaseRepository implements Repository {
  readonly kind = "cloud" as const;
  private urlCache = new Map<string, { url: string; exp: number }>();

  constructor(private sb: SupabaseClient, private userId: string) {}

  private check<T>(res: { data: T; error: { message: string } | null }): T {
    if (res.error) throw new Error(res.error.message);
    return res.data;
  }

  async loadProfile() {
    const res = await this.sb.from("profiles").select("data").eq("id", this.userId).maybeSingle();
    const row = this.check(res) as { data: Profile } | null;
    return row?.data ?? null;
  }
  async saveProfile(p: Profile) {
    this.check(await this.sb.from("profiles").upsert({ id: this.userId, data: p, updated_at: new Date().toISOString() }));
  }

  async loadAll(): Promise<AppData> {
    const results = await Promise.all(
      COLLECTIONS.map(async (c) => {
        const rows: Record<string, unknown>[] = [];
        // Page through in 1000-row chunks (PostgREST default limit).
        for (let from = 0; ; from += 1000) {
          const res = await this.sb.from(TABLES[c]).select("*").range(from, from + 999);
          const page = this.check(res) as Record<string, unknown>[];
          rows.push(...page);
          if (page.length < 1000) break;
        }
        return [c, rows.map((r) => fromRow(r))] as const;
      }),
    );
    return Object.fromEntries(results) as unknown as AppData;
  }

  upsert<K extends CollectionName>(name: K, record: Collections[K]) {
    return this.upsertMany(name, [record]);
  }
  async upsertMany<K extends CollectionName>(name: K, records: Collections[K][]) {
    if (!records.length) return;
    this.check(await this.sb.from(TABLES[name]).upsert(records.map((r) => toRow(r, this.userId))));
  }
  async remove(name: CollectionName, id: string) {
    this.check(await this.sb.from(TABLES[name]).delete().eq("id", id));
  }

  async savePhoto(id: string, blob: Blob) {
    const path = `${this.userId}/${id}.jpg`;
    const { error } = await this.sb.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error(error.message);
    return path;
  }
  async photoUrl(path: string) {
    const hit = this.urlCache.get(path);
    if (hit && hit.exp > Date.now()) return hit.url;
    // Private bucket: short-lived signed URLs only.
    const { data, error } = await this.sb.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600);
    if (error || !data) return null;
    this.urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 3500_000 });
    return data.signedUrl;
  }
  async deletePhoto(path: string) {
    await this.sb.storage.from(PHOTO_BUCKET).remove([path]);
    this.urlCache.delete(path);
  }
  async wipe() {
    const { data } = await this.sb.storage.from(PHOTO_BUCKET).list(this.userId, { limit: 1000 });
    if (data?.length) await this.sb.storage.from(PHOTO_BUCKET).remove(data.map((f) => `${this.userId}/${f.name}`));
    for (const c of COLLECTIONS) await this.sb.from(TABLES[c]).delete().eq("user_id", this.userId);
    await this.sb.from("profiles").delete().eq("id", this.userId);
  }
}
