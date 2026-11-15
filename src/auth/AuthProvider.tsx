import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/data/supabase";

export type AuthState =
  | { mode: "local"; status: "ready"; userId: "local"; email: null }
  | { mode: "cloud"; status: "loading" | "signed_out"; userId: null; email: null }
  | { mode: "cloud"; status: "ready"; userId: string; email: string | null };

interface AuthContextValue {
  auth: AuthState;
  /** True after the user follows a password-reset email link. */
  recovering: boolean;
  setRecovering(v: boolean): void;
  signOut(): Promise<void>;
  accessToken(): Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    let auth: AuthState;
    if (!supabase) auth = { mode: "local", status: "ready", userId: "local", email: null };
    else if (loading) auth = { mode: "cloud", status: "loading", userId: null, email: null };
    else if (!session) auth = { mode: "cloud", status: "signed_out", userId: null, email: null };
    else auth = { mode: "cloud", status: "ready", userId: session.user.id, email: session.user.email ?? null };
    return {
      auth,
      recovering,
      setRecovering,
      async signOut() {
        if (supabase) await supabase.auth.signOut();
      },
      async accessToken() {
        if (!supabase) return null;
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? null;
      },
    };
  }, [loading, session, recovering]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
