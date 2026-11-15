import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import type { Profile, Targets } from "@/lib/types";
import { useStore } from "@/data/store";
import { useAuth } from "@/auth/AuthProvider";
import { computeTargets, simpleGoal, weeksToTarget } from "@/lib/calc";
import { defaultPrivacy, defaultReminders, starterRoutines } from "@/lib/templates";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/layout/Logo";
import { Disclaimer } from "@/components/ui/misc";
import { useToast } from "@/components/ui/Toast";
import { round } from "@/lib/format";
import { BodyFields, GoalFields, TrainingFields, effectiveTarget, validateDraft, type Errors, type ProfileDraft } from "./ProfileFields";
import { PlanSummary, TARGETS_DISCLAIMER, TargetsEditor } from "./TargetsEditor";

const STEPS = [
  { key: "goal", title: "Welcome to BULKUP", sub: "Three quick steps and you're in." },
  { key: "body", title: "About you", sub: "Used to work out your calories." },
  { key: "plan", title: "Your plan", sub: "You can change any of this later." },
] as const;

export default function Onboarding() {
  const { saveProfile, addMany } = useStore();
  const { auth } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [custom, setCustom] = useState<Targets | null>(null);
  const [d, setD] = useState<ProfileDraft>({
    name: "",
    sex: "unspecified",
    experience: "beginner",
    trainingDays: 3,
    goal: "bulk",
    dailyActivity: "light",
    dietaryPreferences: [],
    dietNotes: "",
    usesCreatine: false,
    usesProteinPowder: false,
    usesMassGainer: false,
  });
  const set = (patch: Partial<ProfileDraft>) => {
    setD((x) => ({ ...x, ...patch }));
    setCustom(null); // inputs changed, so recompute targets
  };

  const target = effectiveTarget(d);
  const inputs = useMemo(
    () =>
      d.age && d.heightCm && d.startWeightKg
        ? { age: d.age, sex: d.sex, heightCm: d.heightCm, weightKg: d.startWeightKg, trainingDays: d.trainingDays, dailyActivity: d.dailyActivity, experience: d.experience, goal: d.goal }
        : null,
    [d],
  );
  const computed = useMemo(() => (inputs ? computeTargets(inputs) : null), [inputs]);
  const targets = custom ?? computed;

  function next() {
    const key = STEPS[step].key;
    if (key !== "plan") {
      const e = validateDraft(d, key);
      setErrors(e);
      if (Object.keys(e).length) return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0 });
  }

  async function finish() {
    const e = validateDraft(d, "all");
    if (Object.keys(e).length || !targets || target == null) {
      setErrors(e);
      setStep(e.name ? 0 : 1);
      return;
    }
    setSaving(true);
    const now = new Date().toISOString();
    const profile: Profile = {
      id: auth.userId ?? "local",
      name: d.name.trim(),
      age: d.age!,
      sex: d.sex,
      heightCm: d.heightCm!,
      startWeightKg: d.startWeightKg!,
      targetWeightKg: target,
      experience: d.experience,
      trainingDays: d.trainingDays,
      goal: simpleGoal(d.goal),
      dailyActivity: d.dailyActivity,
      dietaryPreferences: [],
      dietNotes: "",
      usesCreatine: false,
      usesProteinPowder: false,
      usesMassGainer: false,
      targets,
      targetsCustomised: !!custom,
      reminders: defaultReminders(),
      privacy: defaultPrivacy(),
      onboardedAt: now,
      updatedAt: now,
    };
    try {
      addMany("routines", starterRoutines(d.trainingDays));
      addMany("bodyEntries", [{ date: now.slice(0, 10), weightKg: d.startWeightKg!, custom: {}, note: "Starting weight" }]);
      await saveProfile(profile);
      toast.show({ message: `Welcome, ${profile.name}` });
    } catch (err) {
      toast.show({ tone: "error", message: `Couldn't save your profile: ${(err as Error).message}` });
      setSaving(false);
    }
  }

  const s = STEPS[step];
  const weeks = targets && inputs && target != null ? weeksToTarget(inputs.weightKg, target, targets.weeklyGainKg) : null;
  const g = simpleGoal(d.goal);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col py-6" style={{ paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}>
      <div className="flex items-center justify-between">
        <Logo small />
        <span className="text-xs font-semibold tabular-nums text-mist-500">
          {step + 1} / {STEPS.length}
        </span>
      </div>
      <div className="mt-4 flex gap-1.5" aria-hidden>
        {STEPS.map((x, i) => (
          <span key={x.key} className={`h-1 flex-1 rounded-full transition-colors duration-500 ${i <= step ? "bg-volt-500 shadow-[0_0_10px_rgba(31,117,255,.6)]" : "bg-ink-700"}`} />
        ))}
      </div>

      <div key={s.key} className="mt-8 flex-1 animate-rise">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight">{s.title}</h1>
        <p className="mt-1.5 text-mist-400">{s.sub}</p>
        <div className="mt-7">
          {s.key === "goal" && <GoalFields d={d} set={set} errors={errors} />}
          {s.key === "body" && <BodyFields d={d} set={set} errors={errors} />}
          {s.key === "plan" && inputs && targets && (
            <div className="flex flex-col gap-6">
              <TrainingFields d={d} set={set} />
              <div className="rounded-3xl border border-volt-500/40 bg-volt-500/[.07] p-5">
                <p className="text-xs font-semibold uppercase tracking-[.1em] text-volt-300">Your daily target</p>
                <p className="mt-1 font-display text-4xl font-bold tabular-nums">
                  {targets.calories.toLocaleString()} <span className="text-lg font-semibold text-mist-400">kcal</span>
                </p>
                <p className="mt-1 text-mist-300">
                  <span className="font-semibold text-mist-100">{targets.protein} g protein</span> · {targets.carbs} g carbs · {targets.fat} g fat
                </p>
                <p className="mt-3 text-sm text-mist-400">
                  {g === "maintain"
                    ? `Aim to stay around ${target} kg.`
                    : `Aim for ${targets.weeklyGainKg > 0 ? "+" : ""}${round(targets.weeklyGainKg, 2)} kg a week${weeks ? `, reaching ${target} kg in about ${weeks} weeks` : ""}.`}
                </p>
              </div>
              <button className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-volt-400" onClick={() => setShowAdjust((v) => !v)} aria-expanded={showAdjust}>
                Adjust targets <ChevronDown className={`h-4 w-4 transition ${showAdjust ? "rotate-180" : ""}`} />
              </button>
              {showAdjust && (
                <div className="flex flex-col gap-4">
                  <PlanSummary inputs={inputs} targetWeightKg={target!} weeklyGainKg={targets.weeklyGainKg} showBmi={false} />
                  <TargetsEditor targets={targets} onChange={setCustom} />
                  {custom && (
                    <button className="self-start text-sm font-semibold text-volt-400" onClick={() => setCustom(null)}>
                      Reset to suggested targets
                    </button>
                  )}
                </div>
              )}
              <Disclaimer>{TARGETS_DISCLAIMER}</Disclaimer>
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 mt-8 flex gap-3 bg-gradient-to-t from-ink-950 via-ink-950 to-transparent pb-[calc(env(safe-area-inset-bottom,0px)+8px)] pt-4">
        {step > 0 && (
          <Button variant="secondary" size="lg" onClick={() => setStep((x) => x - 1)} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        {s.key === "plan" ? (
          <Button size="lg" block onClick={finish} loading={saving}>
            Let's go
          </Button>
        ) : (
          <Button size="lg" block onClick={next}>
            Continue <ArrowRight className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
