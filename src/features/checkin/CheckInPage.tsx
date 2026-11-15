import { useEffect, useMemo, useState } from "react";
import { Bot, ClipboardCheck, Sparkles } from "lucide-react";
import type { CheckIn } from "@/lib/types";
import { useProfile, useStore } from "@/data/store";
import { formatDay, today, daysBetween } from "@/lib/dates";
import { weeklyStats } from "@/lib/stats";
import { buildCoachContext } from "@/lib/coachContext";
import { basicCheckInReview } from "@/lib/coachFallback";
import { getStatus, streamCoach } from "@/lib/api";
import { signed } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { PageHeader, Pill, Stat } from "@/components/ui/misc";
import { ProgressBar } from "@/components/ui/Progress";
import { RichText } from "@/components/RichText";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";

export default function CheckInPage() {
  const { data, add, update } = useStore();
  const profile = useProfile();
  const toast = useToast();
  const t = today();
  const stats = useMemo(() => weeklyStats(data, profile, t), [data, profile, t]);
  const [ratings, setRatings] = useState({ energy: 3, sleep: 3, hunger: 3 });
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiOk, setAiOk] = useState(false);
  const history = [...data.checkIns].sort((a, b) => b.weekEnding.localeCompare(a.weekEnding));
  const last = history[0];
  const due = !last || daysBetween(last.weekEnding, t) >= 7;

  useEffect(() => {
    getStatus().then((s) => setAiOk(s.ai && profile.privacy.aiDataSharing));
  }, [profile.privacy.aiDataSharing]);

  async function submit() {
    setBusy(true);
    const rec = add("checkIns", { weekEnding: t, stats, ...ratings, notes: notes.trim() });
    let review = basicCheckInReview(stats, profile);
    let reviewSource: CheckIn["reviewSource"] = "basic";
    if (aiOk) {
      try {
        const ctx = { ...buildCoachContext(data, profile, t), checkIn: { ...ratings, notes: notes.trim() } };
        const text = await streamCoach([{ role: "user", content: "Please review my week and suggest adjustments." }], ctx, "checkin", () => {});
        if (text.trim()) {
          review = text.trim();
          reviewSource = "ai";
        }
      } catch {
        toast.show({ tone: "info", message: "The AI review isn't available right now, so here's the basic review." });
      }
    }
    update("checkIns", rec.id, { review, reviewSource });
    setNotes("");
    setBusy(false);
    toast.show({ message: "Check-in saved" });
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Weekly check-in" subtitle={`${formatDay(stats.from, { day: "numeric", month: "short" })} – ${formatDay(stats.to, { day: "numeric", month: "short" })}`} action={due ? <Pill tone="volt">Due</Pill> : <Pill>Next in {7 - daysBetween(last!.weekEnding, t)} days</Pill>} />

      <Card>
        <CardHeader icon={<ClipboardCheck className="h-4 w-4" />} title="Last 7 days" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Starting weight" value={stats.startWeightKg != null ? `${stats.startWeightKg} kg` : "–"} />
          <Stat label="Current weight" value={stats.endWeightKg != null ? `${stats.endWeightKg} kg` : "–"} />
          <Stat label="Change" value={stats.changeKg != null ? `${signed(stats.changeKg, 2)} kg` : "–"} sub={`Plan ${signed(profile.targets.weeklyGainKg, 2)} kg`} />
          <Stat label="To target" value={stats.targetProgressPct != null ? `${stats.targetProgressPct}%` : "–"} sub="of the way there" />
          <Stat label="Avg calories" value={stats.avgCalories ? stats.avgCalories.toLocaleString() : "–"} sub={`target ${profile.targets.calories.toLocaleString()} · ${stats.daysLogged}/7 days logged`} />
          <Stat label="Avg protein" value={stats.avgProtein ? `${stats.avgProtein} g` : "–"} sub={`target ${profile.targets.protein} g`} />
          <Stat label="Workouts" value={`${stats.workoutsCompleted}/${stats.workoutsPlanned}`} sub="completed / planned" />
          <div>
            <Stat label="Consistency" value={`${stats.consistencyPct}%`} />
            <ProgressBar className="mt-2" value={stats.consistencyPct} max={100} label="Workout consistency" />
          </div>
        </div>
      </Card>

      {due && (
        <Card>
          <CardHeader title="How did the week feel?" />
          <div className="flex flex-col gap-4">
            {(["energy", "sleep", "hunger"] as const).map((k) => (
              <Rating key={k} label={k === "energy" ? "Energy in training" : k === "sleep" ? "Sleep quality" : "Appetite (how easy was it to eat?)"} value={ratings[k]} onChange={(v) => setRatings({ ...ratings, [k]: v })} />
            ))}
            <Textarea id="ci-notes" label="Notes (optional)" placeholder="Anything that affected your week: illness, travel, stress, a new PR…" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
            <Button size="lg" block loading={busy} onClick={submit}>
              <Sparkles className="h-4 w-4" /> Complete check-in {aiOk ? "and get AI review" : ""}
            </Button>
          </div>
        </Card>
      )}

      {history.map((c) => (
        <Card key={c.id}>
          <CardHeader
            icon={<Bot className="h-4 w-4" />}
            title={`Week ending ${formatDay(c.weekEnding, { day: "numeric", month: "short" })}`}
            subtitle={`${c.stats.changeKg != null ? `${signed(c.stats.changeKg, 2)} kg · ` : ""}${c.stats.avgCalories} kcal avg · ${c.stats.workoutsCompleted} workouts`}
            action={<Pill tone={c.reviewSource === "ai" ? "volt" : "muted"}>{c.reviewSource === "ai" ? "AI review" : "Basic review"}</Pill>}
          />
          {c.review ? <div className="text-sm text-mist-300"><RichText text={c.review} /></div> : <p className="text-sm text-mist-500">Preparing review…</p>}
          {c.notes && <p className="mt-3 rounded-xl bg-ink-900 px-3 py-2 text-xs text-mist-400">Your notes: {c.notes}</p>}
        </Card>
      ))}
    </div>
  );
}

function Rating({ label, value, onChange }: { label: string; value: number; onChange(v: number): void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-[13px] font-medium text-mist-300">{label}</legend>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-pressed={value === n} onClick={() => onChange(n)} className={cn("h-11 rounded-xl border font-semibold transition", value === n ? "border-volt-500 bg-volt-500 text-white" : "border-ink-600 bg-ink-900 text-mist-400")}>
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-mist-500">
        <span>Poor</span>
        <span>Great</span>
      </div>
    </fieldset>
  );
}
