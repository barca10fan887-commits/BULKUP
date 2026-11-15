// On-device storage in IndexedDB. Used when Supabase isn't configured.
import { createStore, del, get, set, clear, type UseStore } from "idb-keyval";
import { COLLECTIONS, type AppData, type CollectionName, type Collections, type Profile } from "@/lib/types";
import type { Repository } from "./repo";

export class LocalRepository implements Repository {
  readonly kind = "local" as const;
  private db: UseStore;
  private photos: UseStore;
  private objectUrls = new Map<string, string>();

  constructor(namespace = "local") {
    this.db = createStore(`bulkup-${namespace}`, "data");
    this.photos = createStore(`bulkup-${namespace}-photos`, "photos");
  }

  loadProfile() {
    return get<Profile>("profile", this.db).then((p) => p ?? null);
  }
  saveProfile(p: Profile) {
    return set("profile", p, this.db);
  }

  async loadAll(): Promise<AppData> {
    const entries = await Promise.all(COLLECTIONS.map(async (c) => [c, (await get(c, this.db)) ?? []] as const));
    return Object.fromEntries(entries) as unknown as AppData;
  }

  private async mutate<K extends CollectionName>(name: K, fn: (rows: Collections[K][]) => Collections[K][]) {
    const rows = ((await get(name, this.db)) ?? []) as Collections[K][];
    await set(name, fn(rows), this.db);
  }

  upsert<K extends CollectionName>(name: K, record: Collections[K]) {
    return this.upsertMany(name, [record]);
  }
  upsertMany<K extends CollectionName>(name: K, records: Collections[K][]) {
    const ids = new Set(records.map((r) => r.id));
    return this.mutate(name, (rows) => [...rows.filter((r) => !ids.has(r.id)), ...records]);
  }
  remove(name: CollectionName, id: string) {
    return this.mutate(name, (rows) => rows.filter((r) => r.id !== id));
  }

  async savePhoto(id: string, blob: Blob) {
    const path = `photo:${id}`;
    await set(path, blob, this.photos);
    return path;
  }
  async photoUrl(path: string) {
    const cached = this.objectUrls.get(path);
    if (cached) return cached;
    const blob = await get<Blob>(path, this.photos);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    this.objectUrls.set(path, url);
    return url;
  }
  async deletePhoto(path: string) {
    const url = this.objectUrls.get(path);
    if (url) URL.revokeObjectURL(url);
    this.objectUrls.delete(path);
    await del(path, this.photos);
  }
  async wipe() {
    await clear(this.db);
    await clear(this.photos);
  }
}
