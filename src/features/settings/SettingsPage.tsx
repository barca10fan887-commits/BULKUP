import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, Bot, LineChart, CalendarDays, ChevronRight, ClipboardCheck, Database, Download, Droplets, LogOut, Pill as PillIcon, RefreshCw, Shield, Target, Trash2, User } from "lucide-react";
import type { Profile, ReminderPrefs, Targets } from "@/lib/types";
import { useProfile, useStore } from "@/data/store";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/data/supabase";
import { GOAL_LABEL, computeTargets, inputsFromProfile, simpleGoal } from "@/lib/calc";
import { currentWeight } from "@/lib/stats";
import { WEEKDAYS_SHORT } from "@/lib/dates";
import { deleteCloudAccount, getAccessCode, getStatus, setAccessCode } from "@/lib/api";
import { getPermission, isIOS, isStandalone, notificationsSupported, permission, requestPermission, notify } from "@/lib/notifications";
import { isNative } from "@/lib/nativeReminders";
import type { StatusResponse } from "@shared/api";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Toggle, num } from "@/components/ui/Field";
import { Disclaimer, PageHeader, Pill } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { BodyFields, DietFields, GoalFields, TrainingFields, effectiveTarget, validateDraft, type Errors, type ProfileDraft } from "@/features/onboarding/ProfileFields";
import { PlanSummary, TARGETS_DISCLAIMER, TargetsEditor } from "@/features/onboarding/TargetsEditor";

export default function SettingsPage() {
  const loc = useLocation();
  useEffect(() => {
    if (loc.hash) setTimeout(() => document.getElementById(loc.hash.slice(1))?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [loc.hash]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Profile" />
      <ProfileSection />
      <QuickLinks />
      <AccountSection />
      <TargetsSection />
      <NotificationsSection />
      <PrivacySection />
      <DataSection />
      <Disclaimer>{TARGETS_DISCLAIMER}</Disclaimer>
      <p className="text-center text-xs text-mist-500">BULKUP version {__BUILD_ID__}</p>
    </div>
  );
}

function Section({ id, icon, title, subtitle, children, action }: { id?: string; icon: ReactNode; title: string; subtitle?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-6">
      <CardHeader icon={icon} title={title} subtitle={subtitle} action={action} />
      {children}
    </Card>
  );
}

function QuickLinks() {
  const links = [
    { to: "/progress", label: "Progress", icon: LineChart },
    { to: "/coach", label: "Coach", icon: Bot },
    { to: "/supplements", label: "Supplements", icon: PillIcon },
    { to: "/water", label: "Water", icon: Droplets },
    { to: "/check-in", label: "Weekly check-in", icon: ClipboardCheck },
    { to: "/calendar", label: "History", icon: CalendarDays },
  ];
  return (
    <ul className="divide-y divide-ink-700/70 overflow-hidden rounded-3xl border border-ink-700/80 bg-ink-850">
      {links.map((l) => (
        <li key={l.to}>
          <Link to={l.to} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-ink-800">
            <l.icon className="h-5 w-5 text-volt-400" />
            <span className="flex-1 font-semibold">{l.label}</span>
            <ChevronRight className="h-4 w-4 text-mist-500" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AccountSection() {
  const { auth, signOut } = useAuth();
  const { repo } = useStore();
  const profile = useProfile();
  return (
    <Section icon={<User className="h-4 w-4" />} title="Account">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{profile.name}</p>
          <p className="text-sm text-mist-400">{auth.mode === "cloud" ? auth.email : "Local mode: data is stored only on this device"}</p>
        </div>
        {auth.mode === "cloud" ? (
          <Button variant="secondary" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Log out
          </Button>
        ) : (
          <Pill tone="warn">{repo.kind === "local" ? "Not synced" : "Synced"}</Pill>
        )}
      </div>
      {auth.mode === "local" && (
        <p className="mt-3 text-xs text-mist-500">Accounts, sign-in and sync across devices turn on when the app is connected to Supabase (see the README). Until then, export your data regularly as a backup.</p>
      )}
    </Section>
  );
}

function ProfileSection() {
  const { saveProfile, data } = useStore();
  const profile = useProfile();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<ProfileDraft>(() => toDraft(profile));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setD(toDraft(profile));
      setErrors({});
    }
  }, [open, profile]);

  async function save() {
    const e = validateDraft(d, "all");
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const goalChanged = simpleGoal(d.goal) !== simpleGoal(profile.goal);
      const next: Profile = { ...profile, ...d, goal: simpleGoal(d.goal), name: d.name.trim(), age: d.age!, heightCm: d.heightCm!, startWeightKg: d.startWeightKg!, targetWeightKg: effectiveTarget(d)! };
      // A new goal (e.g. bulk -> cut) needs new calorie targets straight away.
      if (goalChanged) next.targets = computeTargets(inputsFromProfile(next, currentWeight(data.bodyEntries, next)));
      await saveProfile(next);
      toast.show({ message: goalChanged ? "Goal updated and targets recalculated" : "Profile updated" });
      setOpen(false);
    } catch (err) {
      toast.show({ tone: "error", message: `Couldn't save: ${(err as Error).message}` });
    } finally {
      setSaving(false);
    }
  }
  const set = (patch: Partial<ProfileDraft>) => setD((x) => ({ ...x, ...patch }));
  const goal = simpleGoal(profile.goal);
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-volt-500/15 font-display text-2xl font-bold text-volt-300">{profile.name.slice(0, 1).toUpperCase()}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xl font-semibold">{profile.name}</p>
          <p className="text-sm text-mist-400">
            {GOAL_LABEL[goal]}
            {goal !== "maintain" ? ` to ${profile.targetWeightKg} kg` : ""} · {profile.targets.calories.toLocaleString()} kcal · {profile.targets.protein} g protein
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Edit
        </Button>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Edit profile" wide footer={<Button block loading={saving} onClick={save}>Save profile</Button>}>
        <div className="flex flex-col gap-6">
          <GoalFields d={d} set={set} errors={errors} />
          <BodyFields d={d} set={set} errors={errors} />
          <TrainingFields d={d} set={set} showActivity />
          <details className="rounded-2xl border border-ink-700 bg-ink-900 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-mist-300">Diet and supplements (optional)</summary>
            <div className="mt-4">
              <DietFields d={d} set={set} />
            </div>
          </details>
          <p className="text-xs text-mist-500">Changing your goal recalculates your targets. Other changes keep your current targets; use "Recalculate" under Goals & targets to update them.</p>
        </div>
      </Sheet>
    </Card>
  );
}

function toDraft(p: Profile): ProfileDraft {
  return {
    name: p.name,
    age: p.age,
    sex: p.sex,
    heightCm: p.heightCm,
    startWeightKg: p.startWeightKg,
    targetWeightKg: p.targetWeightKg,
    experience: p.experience,
    trainingDays: p.trainingDays,
    equipment: p.equipment ?? "gym",
    goal: p.goal,
    dailyActivity: p.dailyActivity,
    dietaryPreferences: p.dietaryPreferences,
    dietNotes: p.dietNotes,
    usesCreatine: p.usesCreatine,
    usesProteinPowder: p.usesProteinPowder,
    usesMassGainer: p.usesMassGainer,
  };
}

function TargetsSection() {
  const { data, saveProfile } = useStore();
  const profile = useProfile();
  const toast = useToast();
  const weight = currentWeight(data.bodyEntries, profile);
  const inputs = useMemo(() => inputsFromProfile(profile, weight), [profile, weight]);
  const suggested = useMemo(() => computeTargets(inputs), [inputs]);
  const [targets, setTargets] = useState<Targets>(profile.targets);
  const [targetWeight, setTargetWeight] = useState(String(profile.targetWeightKg));
  const dirty = JSON.stringify(targets) !== JSON.stringify(profile.targets) || num(targetWeight) !== profile.targetWeightKg;

  useEffect(() => {
    setTargets(profile.targets);
    setTargetWeight(String(profile.targetWeightKg));
  }, [profile.targets, profile.targetWeightKg]);

  async function save(next: Targets, customised: boolean) {
    const tw = num(targetWeight);
    if (!tw || tw < 35 || tw > 250) return toast.show({ tone: "error", message: "Enter a goal weight between 35 and 250 kg." });
    const g = simpleGoal(profile.goal);
    if (g === "cut" && tw >= weight) return toast.show({ tone: "error", message: "You're cutting, so your goal weight should be below your current weight. To gain instead, change your goal under Edit." });
    if (g === "bulk" && tw <= weight) return toast.show({ tone: "error", message: "You're bulking, so your goal weight should be above your current weight. To lose instead, change your goal under Edit." });
    if (next.calories < 1200 || next.calories > 7000) return toast.show({ tone: "error", message: "Calorie target should be between 1,200 and 7,000 kcal." });
    if (next.protein < 30 || next.protein > 400) return toast.show({ tone: "error", message: "Protein target should be between 30 and 400 g." });
    await saveProfile({ ...profile, targets: next, targetsCustomised: customised, targetWeightKg: tw });
    toast.show({ message: "Targets saved" });
  }

  return (
    <Section id="targets" icon={<Target className="h-4 w-4" />} title="Goals & targets" subtitle={`Based on your current weight of ${weight} kg`}>
      <div className="flex flex-col gap-4">
        <PlanSummary inputs={inputs} targetWeightKg={profile.targetWeightKg} weeklyGainKg={profile.targets.weeklyGainKg} />
        <Input id="st-target-weight" label="Goal weight" type="number" inputMode="decimal" step="0.1" suffix="kg" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} />
        <TargetsEditor targets={targets} onChange={setTargets} />
        <div className="rounded-2xl border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-mist-400">
          Suggested now: <span className="font-semibold text-mist-100">{suggested.calories.toLocaleString()} kcal</span>, {suggested.protein} g protein, {suggested.carbs} g carbs, {suggested.fat} g fat, {suggested.waterMl} ml water, +{suggested.weeklyGainKg} kg/week.
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save(targets, true)} disabled={!dirty}>
            Save targets
          </Button>
          <Button variant="secondary" onClick={() => save(suggested, false)}>
            <RefreshCw className="h-4 w-4" /> Recalculate from current stats
          </Button>
        </div>
      </div>
    </Section>
  );
}

function NotificationsSection() {
  const { saveProfile, data } = useStore();
  const profile = useProfile();
  const toast = useToast();
  const r = profile.reminders;
  const [perm, setPerm] = useState(permission());
  useEffect(() => {
    getPermission().then(setPerm);
  }, []);
  const update = (patch: Partial<ReminderPrefs>) => saveProfile({ ...profile, reminders: { ...r, ...patch } });
  const iosNeedsInstall = isIOS() && !isStandalone();

  async function enable(v: boolean) {
    if (!v) return update({ enabled: false });
    const p = await requestPermission();
    setPerm(p);
    if (p === "granted") {
      await update({ enabled: true });
      if (!isNative()) notify("Reminders are on", "BULKUP will remind you while the app is open or running in the background.", "test");
      else toast.show({ message: "Reminders are on" });
    } else if (p === "denied") toast.show({ tone: "error", message: "Notifications are blocked. Allow them for BULKUP in your device or browser settings." });
  }

  return (
    <Section id="notifications" icon={<Bell className="h-4 w-4" />} title="Notifications">
      {!notificationsSupported() || iosNeedsInstall ? (
        <p className="text-sm text-mist-400">
          {iosNeedsInstall
            ? "On iPhone, notifications work once BULKUP is added to your home screen: tap Share, then 'Add to Home Screen', and open it from there."
            : "This browser doesn't support notifications."}
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-ink-700/70">
          <Toggle label="Enable reminders" description={perm === "denied" ? "Blocked in your settings" : "We'll only ask for permission when you turn this on."} checked={r.enabled && perm === "granted"} onChange={enable} />
          {r.enabled && perm === "granted" && (
            <>
              <div className="py-2">
                <Toggle label="Meal reminders" checked={r.meals.enabled} onChange={(v) => update({ meals: { ...r.meals, enabled: v } })} />
                {r.meals.enabled && (
                  <div className="grid grid-cols-3 gap-2 pb-2">
                    {r.meals.times.map((t, i) => (
                      <Input key={i} id={`rm-meal-${i}`} aria-label={`Meal reminder ${i + 1}`} type="time" value={t} onChange={(e) => update({ meals: { ...r.meals, times: r.meals.times.map((x, j) => (j === i ? e.target.value : x)) } })} />
                    ))}
                  </div>
                )}
              </div>
              <div className="py-2">
                <Toggle label="Water reminders" checked={r.water.enabled} onChange={(v) => update({ water: { ...r.water, enabled: v } })} />
                {r.water.enabled && (
                  <div className="grid grid-cols-3 gap-2 pb-2">
                    <Select id="rm-water-every" label="Every" value={r.water.everyHours} onChange={(e) => update({ water: { ...r.water, everyHours: Number(e.target.value) } })}>
                      {[1, 2, 3, 4].map((h) => (
                        <option key={h} value={h}>{h} h</option>
                      ))}
                    </Select>
                    <Input id="rm-water-from" label="From" type="time" value={r.water.from} onChange={(e) => update({ water: { ...r.water, from: e.target.value } })} />
                    <Input id="rm-water-to" label="Until" type="time" value={r.water.to} onChange={(e) => update({ water: { ...r.water, to: e.target.value } })} />
                  </div>
                )}
              </div>
              <Toggle
                label="Supplement reminders"
                description={data.supplements.some((s) => s.reminderTime) ? "Uses the reminder time set on each supplement." : "Set a reminder time on a supplement to use this."}
                checked={r.supplements.enabled}
                onChange={(v) => update({ supplements: { enabled: v } })}
              />
              <div className="py-2">
                <Toggle label="Workout reminders" description="On scheduled training days" checked={r.workouts.enabled} onChange={(v) => update({ workouts: { ...r.workouts, enabled: v } })} />
                {r.workouts.enabled && <Input id="rm-workout" className="pb-2" aria-label="Workout reminder time" type="time" value={r.workouts.time} onChange={(e) => update({ workouts: { ...r.workouts, time: e.target.value } })} />}
              </div>
              <div className="py-2">
                <Toggle label="Weekly check-in reminder" checked={r.checkIn.enabled} onChange={(v) => update({ checkIn: { ...r.checkIn, enabled: v } })} />
                {r.checkIn.enabled && (
                  <div className="grid grid-cols-2 gap-2 pb-2">
                    <Select id="rm-ci-day" label="Day" value={r.checkIn.weekday} onChange={(e) => update({ checkIn: { ...r.checkIn, weekday: Number(e.target.value) } })}>
                      {WEEKDAYS_SHORT.map((d, i) => (
                        <option key={d} value={i}>{d}</option>
                      ))}
                    </Select>
                    <Input id="rm-ci-time" label="Time" type="time" value={r.checkIn.time} onChange={(e) => update({ checkIn: { ...r.checkIn, time: e.target.value } })} />
                  </div>
                )}
              </div>
              <p className="pt-3 text-xs text-mist-500">
                {isNative() ? "Reminders are scheduled on your iPhone and arrive even when BULKUP is closed." : "In the browser, reminders arrive while BULKUP is open or recently used. The App Store version delivers them even when the app is closed."}
              </p>
            </>
          )}
        </div>
      )}
    </Section>
  );
}

function PrivacySection() {
  const { saveProfile } = useStore();
  const profile = useProfile();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [code, setCode] = useState(getAccessCode());
  const toast = useToast();
  useEffect(() => {
    getStatus(true).then(setStatus);
  }, []);
  const p = profile.privacy;
  return (
    <Section id="privacy" icon={<Shield className="h-4 w-4" />} title="Privacy">
      <div className="flex flex-col divide-y divide-ink-700/70">
        <Toggle
          label="AI features"
          description={status?.provider === "gemini"
            ? "Lets the AI coach and photo scanner send your questions, logged data and scanned photos to Google's Gemini AI when you use them. On Google's free tier, Google may use this to improve its products."
            : "Lets the AI coach and photo scanner send your profile, logged food, workouts, weight and photos you scan to the AI service when you use them. It isn't used to train models."}
          checked={p.aiDataSharing}
          onChange={(v) => saveProfile({ ...profile, privacy: { ...p, aiDataSharing: v } })}
        />
        <a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer" className="py-3 text-sm font-semibold text-volt-400">
          Read the privacy policy
        </a>
        <Toggle label="Blur progress photo thumbnails" description="Thumbnails stay blurred until you tap or hover." checked={p.blurPhotos} onChange={(v) => saveProfile({ ...profile, privacy: { ...p, blurPhotos: v } })} />
        <div className="pt-3 text-sm text-mist-400">
          AI service status:{" "}
          {status == null ? "checking…" : status.ai ? <Pill tone="good">On ({status.provider === "gemini" ? "Gemini" : "Claude"})</Pill> : <Pill tone="warn">Not set up yet</Pill>}
        </div>
        {status?.auth === "access_code" && (
          <form
            className="mt-3 flex items-end gap-2 pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              setAccessCode(code.trim());
              toast.show({ message: "Access code saved on this device" });
            }}
          >
            <Input id="access-code" className="flex-1" label="Server access code" type="password" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} hint="Required by this server for AI features. Stored only on this device." />
            <Button type="submit" variant="secondary">Save</Button>
          </form>
        )}
      </div>
    </Section>
  );
}

function DataSection() {
  const { data, profile, repo, resetLocalState } = useStore();
  const { auth, signOut } = useAuth();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  async function exportData() {
    const payload = { exportedAt: new Date().toISOString(), app: "BULKUP", version: 1, profile, ...data };
    if (isNative()) {
      // iOS apps can't trigger browser downloads; copy the export instead.
      try {
        await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
        toast.show({ message: "Export copied. Paste it into Notes or an email to keep a copy." });
      } catch {
        toast.show({ tone: "error", message: "Couldn't copy the export on this device." });
      }
      return;
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bulkup-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast.show({ message: "Export downloaded. Progress photos aren't included in the file." });
  }

  async function deleteAll() {
    setBusy(true);
    try {
      if (auth.mode === "cloud") {
        // Remove photos and rows, then the login itself.
        await repo.wipe();
        const { error } = (await supabase?.rpc("delete_own_account")) ?? { error: null };
        if (error) {
          const status = await getStatus(true);
          if (!status.accountDeletion) throw new Error("Your data was deleted, but the account login couldn't be removed. Please contact support.");
          await deleteCloudAccount();
        }
        await signOut();
      } else {
        await repo.wipe();
        resetLocalState();
      }
      toast.show({ message: "Your data has been deleted." });
    } catch (e) {
      toast.show({ tone: "error", message: (e as Error).message || "Couldn't delete your data." });
      setBusy(false);
    }
  }

  return (
    <Section icon={<Database className="h-4 w-4" />} title="Your data">
      <div className="flex flex-col gap-3">
        <Button variant="secondary" onClick={exportData} className="self-start">
          <Download className="h-4 w-4" /> Export personal data (JSON)
        </Button>
        {!confirm ? (
          <Button variant="danger" className="self-start" onClick={() => setConfirm(true)}>
            <Trash2 className="h-4 w-4" /> {auth.mode === "cloud" ? "Delete account" : "Delete all data on this device"}
          </Button>
        ) : (
          <div className="rounded-2xl border border-bad/40 bg-bad/[.07] p-4">
            <p className="text-sm font-semibold text-bad">This permanently deletes {auth.mode === "cloud" ? "your account and" : ""} all food logs, workouts, weigh-ins, photos and settings. It can't be undone.</p>
            <Input id="delete-confirm" className="mt-3" label='Type "DELETE" to confirm' value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            <div className="mt-3 flex gap-2">
              <Button variant="ghost" onClick={() => { setConfirm(false); setTyped(""); }}>Cancel</Button>
              <Button variant="danger" disabled={typed !== "DELETE"} loading={busy} onClick={deleteAll}>Delete permanently</Button>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
