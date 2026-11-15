import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { COLLECTIONS, type AppData, type BaseRecord, type CollectionName, type Collections, type Profile } from "@/lib/types";
import { uid } from "@/lib/id";
import type { Repository } from "./repo";
import { LocalRepository } from "./localRepo";
import { SupabaseRepository } from "./supabaseRepo";
import { supabase } from "./supabase";
import { useAuth } from "@/auth/AuthProvider";
import { useToast } from "@/components/ui/Toast";

type NewRecord<K extends CollectionName> = Omit<Collections[K], keyof BaseRecord> & Partial<Pick<BaseRecord, "id">>;

interface StoreValue {
  status: "loading" | "ready" | "error";
  error: string | null;
  repo: Repository;
  profile: Profile | null;
  data: AppData;
  reload(): Promise<void>;
  saveProfile(p: Profile): Promise<void>;
  add<K extends CollectionName>(name: K, rec: NewRecord<K>): Collections[K];
  addMany<K extends CollectionName>(name: K, recs: NewRecord<K>[]): Collections[K][];
  update<K extends CollectionName>(name: K, id: string, patch: Partial<Collections[K]>): void;
  put<K extends CollectionName>(name: K, rec: Collections[K]): void;
  remove(name: CollectionName, id: string): void;
  resetLocalState(): void;
}

/** Copies on-device data (including photos) into a newly created cloud account. */
async function importLocalData(cloud: Repository): Promise<boolean> {
  const local = new LocalRepository("local");
  let profile: Profile | null = null;
  try {
    profile = await local.loadProfile();
  } catch {
    return false;
  }
  if (!profile) return false;
  const all = await local.loadAll();
  for (const c of COLLECTIONS) {
    if (c === "progressPhotos") continue;
    const rows = all[c] as Collections[typeof c][];
    for (let i = 0; i < rows.length; i += 500) await cloud.upsertMany(c, rows.slice(i, i + 500));
  }
  const photos = [];
  for (const ph of all.progressPhotos) {
    const url = await local.photoUrl(ph.path);
    if (!url) continue;
    const blob = await (await fetch(url)).blob();
    photos.push({ ...ph, path: await cloud.savePhoto(ph.id, blob) });
  }
  if (photos.length) await cloud.upsertMany("progressPhotos", photos);
  await cloud.saveProfile({ ...profile, updatedAt: new Date().toISOString() });
  await local.wipe();
  return true;
}

const emptyData = (): AppData => Object.fromEntries(COLLECTIONS.map((c) => [c, []])) as unknown as AppData;

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  const toast = useToast();
  const repo = useMemo<Repository>(() => {
    if (auth.mode === "cloud" && auth.status === "ready" && supabase) return new SupabaseRepository(supabase, auth.userId);
    return new LocalRepository("local");
  }, [auth.mode, auth.status, auth.userId]);

  const [status, setStatus] = useState<StoreValue["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [data, setData] = useState<AppData>(emptyData);
  const dataRef = useRef(data);
  dataRef.current = data;

  const reload = useCallback(async () => {
    if (auth.status !== "ready") return;
    setStatus("loading");
    try {
      let [p, d] = await Promise.all([repo.loadProfile(), repo.loadAll()]);
      // First sign-in on a device that was used without an account: bring that data along.
      if (!p && repo.kind === "cloud") {
        const moved = await importLocalData(repo);
        if (moved) {
          [p, d] = await Promise.all([repo.loadProfile(), repo.loadAll()]);
          toast.show({ message: "Your existing data has been saved to your account" });
        }
      }
      setProfile(p);
      setData(d);
      setStatus("ready");
      setError(null);
    } catch (e) {
      setError((e as Error).message || "Couldn't load your data.");
      setStatus("error");
    }
  }, [repo, auth.status, toast]);

  useEffect(() => {
    reload();
  }, [reload]);

  const persist = useCallback(
    (p: Promise<unknown>, undo?: () => void) => {
      p.catch((e: Error) => {
        undo?.();
        toast.show({ tone: "error", message: `Couldn't save: ${e.message || "check your connection"}` });
      });
    },
    [toast],
  );

  const value = useMemo<StoreValue>(() => {
    const stamp = <K extends CollectionName>(rec: NewRecord<K>): Collections[K] => {
      const now = new Date().toISOString();
      return { ...rec, id: rec.id ?? uid(), createdAt: now, updatedAt: now } as unknown as Collections[K];
    };
    const setCollection = <K extends CollectionName>(name: K, fn: (rows: Collections[K][]) => Collections[K][]) =>
      setData((d) => ({ ...d, [name]: fn(d[name] as Collections[K][]) }));

    return {
      status,
      error,
      repo,
      profile,
      data,
      reload,
      async saveProfile(p) {
        const next = { ...p, updatedAt: new Date().toISOString() };
        const prev = profile;
        setProfile(next);
        try {
          await repo.saveProfile(next);
        } catch (e) {
          setProfile(prev);
          throw e;
        }
      },
      add(name, rec) {
        const full = stamp(rec);
        setCollection(name, (rows) => [...rows, full]);
        persist(repo.upsert(name, full), () => setCollection(name, (rows) => rows.filter((r) => r.id !== full.id)));
        return full;
      },
      addMany(name, recs) {
        const full = recs.map((r) => stamp(r));
        const ids = new Set(full.map((r) => r.id));
        setCollection(name, (rows) => [...rows, ...full]);
        persist(repo.upsertMany(name, full), () => setCollection(name, (rows) => rows.filter((r) => !ids.has(r.id))));
        return full;
      },
      update(name, id, patch) {
        const prev = (dataRef.current[name] as Collections[typeof name][]).find((r) => r.id === id);
        if (!prev) return;
        const next = { ...prev, ...patch, updatedAt: new Date().toISOString() } as Collections[typeof name];
        setCollection(name, (rows) => rows.map((r) => (r.id === id ? next : r)));
        persist(repo.upsert(name, next), () => setCollection(name, (rows) => rows.map((r) => (r.id === id ? prev : r))));
      },
      put(name, rec) {
        const prev = (dataRef.current[name] as Collections[typeof name][]).find((r) => r.id === rec.id);
        const next = { ...rec, updatedAt: new Date().toISOString() };
        setCollection(name, (rows) => (prev ? rows.map((r) => (r.id === rec.id ? next : r)) : [...rows, next]));
        persist(repo.upsert(name, next), () =>
          setCollection(name, (rows) => (prev ? rows.map((r) => (r.id === rec.id ? prev : r)) : rows.filter((r) => r.id !== rec.id))),
        );
      },
      remove(name, id) {
        const prev = (dataRef.current[name] as BaseRecord[]).find((r) => r.id === id);
        setCollection(name, (rows) => rows.filter((r) => r.id !== id));
        persist(repo.remove(name, id), () => prev && setCollection(name, (rows) => [...rows, prev as never]));
      },
      resetLocalState() {
        setProfile(null);
        setData(emptyData());
      },
    };
  }, [status, error, repo, profile, data, reload, persist]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

/** For screens that only render after onboarding. */
export function useProfile(): Profile {
  const { profile } = useStore();
  if (!profile) throw new Error("Profile not loaded");
  return profile;
}
