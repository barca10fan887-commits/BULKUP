import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Profile, Targets } from "@/lib/types";
import { useStore } from "@/data/store";
import { useAuth } from "@/auth/AuthProvider";
import { computeTargets } from "@/lib/calc";
import { defaultPrivacy, defaultReminders, starterRoutines, starterSupplements } from "@/lib/templates";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/layout/Logo";
import { Disclaimer } from "@/components/ui/misc";
import { useToast } from "@/components/ui/Toast";
import { AboutFields, BodyFields, DietFields, TrainingFields, validateDraft, type Errors, type ProfileDraft } from "./ProfileFields";
import { PlanSummary, TARGETS_DISCLAIMER, TargetsEditor } from "./TargetsEditor";

const STEPS = [
  { key: "about", title: "Let's get to know you", sub: "This personalises your targets and coaching." },
  { key: "body", title: "Where you are now", sub: "Your starting point and where you want to be." },
  { key: "training", title: "How you train", sub: "Used for your calorie estimate and starter routines." },
  { key: "diet", title: "Food and supplements", sub: "So suggestions fit how you eat." },
  { key: "plan", title: "Your starting plan", sub: "Adjust anything. You can change it later in Settings." },
] as const;

export default function Onboarding() {
  const { saveProfile, addMany } = useStore();
  const { auth } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [d, setD] = useState<ProfileDraft>({
    name: "",
    sex: "unspecified",
    experience: "beginner",
    trainingDays: 4,
    goal: "bulk",
    dailyActivity: "light",
    dietaryPreferences: [],
    dietNotes: "",
    usesCreatine: false,
    usesProteinPowder: false,
    usesMassGainer: false,
  });
  const set = (patch: Partial<ProfileDraft>) => setD((x) => ({ ...x, ...patch }));

  const inputs = useMemo(
    () =>
      d.age && d.heightCm && d.startWeightKg
        ? { age: d.age, sex: d.sex, heightCm: d.heightCm, weightKg: d.startWeightKg, trainingDays: d.trainingDays, dailyActivity: d.dailyActivity, experience: d.experience, goal: d.goal }
        : null,
    [d],
  );
  const computed = useMemo(() => (inputs ? computeTargets(inputs) : null), [inputs]);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [customised, setCustomised] = useState(false);

  function next() {
    const key = STEPS[step].key;
    if (key === "about" || key === "body") {
      const e = validateDraft(d, key);
      setErrors(e);
      if (Object.keys(e).length) return;
    }
    if (STEPS[step + 1]?.key === "plan" && computed && !customised) setTargets(computed);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0 });
  }

  async function finish() {
    const e = validateDraft(d, "all");
    if (Object.keys(e).length || !targets) {
      setErrors(e);
      setStep(Object.keys(e).some((k) => k === "name" || k === "age") ? 0 : 1);
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
      targetWeightKg: d.targetWeightKg!,
      experience: d.experience,
      trainingDays: d.trainingDays,
      goal: d.goal,
      dailyActivity: d.dailyActivity,
      dietaryPreferences: d.dietaryPreferences,
      dietNotes: d.dietNotes.trim(),
      usesCreatine: d.usesCreatine,
      usesProteinPowder: d.usesProteinPowder,
      usesMassGainer: d.usesMassGainer,
      targets,
      targetsCustomised: customised,
      reminders: defaultReminders(),
      privacy: defaultPrivacy(),
      onboardedAt: now,
      updatedAt: now,
    };
    try {
      addMany("routines", starterRoutines(d.trainingDays));
      addMany("supplements", starterSupplements({ creatine: d.usesCreatine, protein: d.usesProteinPowder, gainer: d.usesMassGainer }));
      addMany("bodyEntries", [{ date: now.slice(0, 10), weightKg: d.startWeightKg!, custom: {}, note: "Starting weight" }]);
      await saveProfile(profile);
      toast.show({ message: `Welcome to BULKUP, ${profile.name}` });
    } catch (err) {
      toast.show({ tone: "error", message: `Couldn't save your profile: ${(err as Error).message}` });
      setSaving(false);
    }
  }

  const s = STEPS[step];
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col py-6" style={{ paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}>
      <div className="flex items-center justify-between">
        <Logo small />
        <span className="text-xs font-semibold tabular-nums text-mist-500">
          Step {step + 1} of {STEPS.length}
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
          {s.key === "about" && <AboutFields d={d} set={set} errors={errors} />}
          {s.key === "body" && <BodyFields d={d} set={set} errors={errors} />}
          {s.key === "training" && <TrainingFields d={d} set={set} />}
          {s.key === "diet" && <DietFields d={d} set={set} />}
          {s.key === "plan" && inputs && targets && (
            <div className="flex flex-col gap-5">
              <PlanSummary inputs={inputs} targetWeightKg={d.targetWeightKg!} weeklyGainKg={targets.weeklyGainKg} />
              <TargetsEditor
                targets={targets}
                onChange={(t) => {
                  setTargets(t);
                  setCustomised(true);
                }}
              />
              {customised && computed && (
                <button
                  className="self-start text-sm font-semibold text-volt-400"
                  onClick={() => {
                    setTargets(computed);
                    setCustomised(false);
                  }}
                >
                  Reset to suggested targets
                </button>
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
            Start bulking
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
