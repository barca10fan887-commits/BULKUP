import { useState, type FormEvent } from "react";
import { supabase } from "@/data/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Logo } from "@/components/layout/Logo";
import { Segmented } from "@/components/ui/misc";

type Mode = "signin" | "signup" | "forgot";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setError(null);
    setNotice(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address.");
    if (mode !== "forgot" && password.length < 8) return setError("Passwords need at least 8 characters.");
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL } });
        if (error) throw error;
        if (!data.session) {
          setNotice("Almost done: open the email we just sent and tap the link to confirm, then sign in here.");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + import.meta.env.BASE_URL });
        if (error) throw error;
        setNotice("If an account exists for that email, a reset link is on its way.");
      }
    } catch (err) {
      const msg = (err as Error).message || "";
      setError(
        /invalid login credentials/i.test(msg)
          ? "That email and password don't match. Try again or reset your password."
          : /already registered/i.test(msg)
            ? "There's already an account with that email. Sign in instead."
            : /email not confirmed/i.test(msg)
              ? "Please confirm your email first. Check your inbox for the link."
              : /rate limit|too many/i.test(msg)
                ? "Too many attempts. Wait a few minutes and try again."
                : /fetch|network/i.test(msg)
                  ? "Couldn't connect. Check your internet connection."
                  : msg || "Something went wrong. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm animate-rise">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-3xl border border-ink-700 bg-ink-850 p-6 shadow-card">
          <h1 className="font-display text-xl font-bold">{mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your free account" : "Reset your password"}</h1>
          <p className="mt-1 text-sm text-mist-400">
            {mode === "forgot" ? "We'll email you a link to set a new password." : mode === "signup" ? "Save your progress and use BULKUP on any device. Only you can see your data." : "Sign in to pick up where you left off."}
          </p>
          {mode !== "forgot" && (
            <Segmented
              className="mt-5"
              value={mode}
              onChange={(m) => {
                setMode(m);
                setError(null);
                setNotice(null);
              }}
              options={[
                { value: "signup", label: "Sign up" },
                { value: "signin", label: "Sign in" },
              ]}
            />
          )}
          <form onSubmit={submit} className="mt-5 flex flex-col gap-4" noValidate>
            <Input id="auth-email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            {mode !== "forgot" && (
              <Input
                id="auth-password"
                label="Password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                hint={mode === "signup" ? "At least 8 characters." : undefined}
                required
              />
            )}
            {error && <p role="alert" className="text-sm text-bad">{error}</p>}
            {notice && <p role="status" className="text-sm text-good">{notice}</p>}
            <Button type="submit" size="lg" block loading={busy}>
              {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            {mode === "forgot" ? (
              <button className="font-semibold text-volt-400" onClick={() => setMode("signin")}>Back to sign in</button>
            ) : (
              <button className="text-mist-400 hover:text-mist-100" onClick={() => setMode("forgot")}>Forgot your password?</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
