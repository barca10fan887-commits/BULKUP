import type { AppData, CollectionName, Collections, Profile } from "@/lib/types";

/**
 * Storage abstraction. The UI never talks to IndexedDB or Supabase directly,
 * which keeps a future native (Capacitor / React Native) port to one new adapter.
 */
export interface Repository {
  readonly kind: "local" | "cloud";
  loadProfile(): Promise<Profile | null>;
  saveProfile(p: Profile): Promise<void>;
  loadAll(): Promise<AppData>;
  upsert<K extends CollectionName>(name: K, record: Collections[K]): Promise<void>;
  upsertMany<K extends CollectionName>(name: K, records: Collections[K][]): Promise<void>;
  remove(name: CollectionName, id: string): Promise<void>;
  /** Photo blobs */
  savePhoto(id: string, blob: Blob): Promise<string>;
  photoUrl(path: string): Promise<string | null>;
  deletePhoto(path: string): Promise<void>;
  /** Remove everything for this user on this backend. */
  wipe(): Promise<void>;
}
