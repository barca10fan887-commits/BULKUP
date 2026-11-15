import { useState, type FormEvent } from "react";
import { supabase } from "@/data/supabase";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Logo } from "@/components/layout/Logo";

export default function UpdatePassword() {
  const { setRecovering } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Passwords need at least 8 characters.");
    if (password !== confirm) return setError("The passwords don't match.");
    setBusy(true);
    const { error } = await supabase!.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    setRecovering(false);
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm animate-rise rounded-3xl border border-ink-700 bg-ink-850 p-6" noValidate>
        <Logo />
        <h1 className="mt-6 font-display text-xl font-bold">Set a new password</h1>
        <div className="mt-5 flex flex-col gap-4">
          <Input id="new-password" label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Input id="confirm-password" label="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <p role="alert" className="text-sm text-bad">{error}</p>}
          <Button type="submit" size="lg" block loading={busy}>Save password</Button>
        </div>
      </form>
    </div>
  );
}
