import { useEffect, useState } from "react";
import { Bell, Check, DollarSign, Pencil, Pill as PillIcon, Plus, Undo2 } from "lucide-react";
import type { Supplement, SupplementKind } from "@/lib/types";
import { useStore } from "@/data/store";
import { addDays, dateRange, formatDay, nowTime, today } from "@/lib/dates";
import { SUPPLEMENT_LABEL, blankSupplement } from "@/lib/templates";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Toggle, num } from "@/components/ui/Field";
import { EmptyState, PageHeader, Pill } from "@/components/ui/misc";
import { ProgressBar } from "@/components/ui/Progress";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";

export default function SupplementsPage() {
  const { data } = useStore();
  const [editing, setEditing] = useState<{ open: boolean; supp: Supplement | null; kind: SupplementKind }>({ open: false, supp: null, kind: "custom" });
  const [picker, setPicker] = useState(false);
  const active = data.supplements.filter((s) => s.active);
  const inactive = data.supplements.filter((s) => !s.active);

  const monthly = active.reduce((a, s) => (s.containerCost && s.servingsPerContainer ? a + (s.containerCost / s.servingsPerContainer) * s.dailyServings * 30 : a), 0);

  return (
    <div>
      <PageHeader
        title="Supplements"
        subtitle="Log servings and keep track of your stack"
        action={
          <Button onClick={() => setPicker(true)}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        }
      />
      {data.supplements.length === 0 ? (
        <EmptyState icon={<PillIcon className="h-5 w-5" />} title="No supplements yet" body="Add the supplements you actually take. Supplements are optional; food comes first." action={<Button onClick={() => setPicker(true)}>Add a supplement</Button>} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            {active.map((s) => (
              <SupplementCard key={s.id} supp={s} onEdit={() => setEditing({ open: true, supp: s, kind: s.kind })} />
            ))}
          </div>
          <History />
          {monthly > 0 && (
            <Card>
              <CardHeader icon={<DollarSign className="h-4 w-4" />} title="Estimated spend" />
              <p className="font-display text-2xl font-bold tabular-nums">${monthly.toFixed(2)} <span className="text-sm font-normal text-mist-400">per month</span></p>
              <ul className="mt-2 space-y-1 text-sm text-mist-400">
                {active
                  .filter((s) => s.containerCost && s.servingsPerContainer)
                  .map((s) => (
                    <li key={s.id} className="flex justify-between">
                      <span>{s.name}</span>
                      <span className="tabular-nums">${((s.containerCost! / s.servingsPerContainer!) * s.dailyServings * 30).toFixed(2)}</span>
                    </li>
                  ))}
              </ul>
            </Card>
          )}
          {inactive.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.08em] text-mist-500">Paused</p>
              <div className="flex flex-wrap gap-2">
                {inactive.map((s) => (
                  <Button key={s.id} size="sm" variant="secondary" onClick={() => setEditing({ open: true, supp: s, kind: s.kind })}>
                    {s.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Sheet open={picker} onClose={() => setPicker(false)} title="Add supplement">
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(SUPPLEMENT_LABEL) as SupplementKind[]).map((k) => (
            <button
              key={k}
              onClick={() => {
                setPicker(false);
                setEditing({ open: true, supp: null, kind: k });
              }}
              className="rounded-2xl border border-ink-600 bg-ink-900 px-4 py-4 text-left font-semibold transition hover:border-volt-500/50"
            >
              {SUPPLEMENT_LABEL[k]}
            </button>
          ))}
        </div>
      </Sheet>
      <SupplementEditor {...editing} onClose={() => setEditing((e) => ({ ...e, open: false }))} />
    </div>
  );
}

function SupplementCard({ supp, onEdit }: { supp: Supplement; onEdit(): void }) {
  const { data, add, remove } = useStore();
  const toast = useToast();
  const t = today();
  const logs = data.supplementLogs.filter((l) => l.supplementId === supp.id && l.date === t);
  const taken = logs.reduce((a, l) => a + l.servings, 0);
  const done = taken >= supp.dailyServings;
  const hasNutrition = supp.calories > 0 || supp.protein > 0;
  const needsLabel = (supp.kind === "protein" || supp.kind === "mass_gainer") && !hasNutrition;

  function log() {
    let foodEntryId: string | undefined;
    if (hasNutrition) {
      const fe = add("foodEntries", { date: t, meal: "snacks", name: supp.name, servingLabel: `${supp.servingAmount} ${supp.servingUnit}`, quantity: 1, calories: supp.calories, protein: supp.protein, carbs: supp.carbs, fat: supp.fat, source: "supplement" });
      foodEntryId = fe.id;
    }
    const rec = add("supplementLogs", { date: t, supplementId: supp.id, servings: 1, time: nowTime(), foodEntryId });
    toast.show({
      message: hasNutrition ? `Logged ${supp.name} (+${supp.calories} kcal to your diary)` : `Logged ${supp.name}`,
      action: {
        label: "Undo",
        onClick: () => {
          remove("supplementLogs", rec.id);
          if (foodEntryId) remove("foodEntries", foodEntryId);
        },
      },
    });
  }

  function undoLast() {
    const last = [...logs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!last) return;
    remove("supplementLogs", last.id);
    if (last.foodEntryId) remove("foodEntries", last.foodEntryId);
  }

  return (
    <Card className={cn(done && "border-good/30")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-lg font-semibold">{supp.name}</h3>
            {done && <Pill tone="good">Done</Pill>}
          </div>
          <p className="text-xs text-mist-500">
            {supp.servingAmount} {supp.servingUnit} · {supp.dailyServings}x daily
            {hasNutrition ? ` · ${supp.calories} kcal, ${supp.protein} g protein` : ""}
            {supp.reminderTime ? ` · reminder ${supp.reminderTime}` : ""}
          </p>
        </div>
        <Button size="icon" variant="ghost" aria-label={`Edit ${supp.name}`} onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
      {needsLabel && (
        <button onClick={onEdit} className="mt-3 w-full rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-left text-xs text-warn">
          Add the nutrition from your product label so servings count towards your calories and protein.
        </button>
      )}
      <div className="mt-4 flex items-center gap-3">
        <ProgressBar value={taken} max={supp.dailyServings} tone={done ? "good" : "volt"} label={`${supp.name} servings today`} />
        <span className="shrink-0 text-sm font-semibold tabular-nums text-mist-300">
          {taken}/{supp.dailyServings}
        </span>
      </div>
      <div className="mt-4 flex gap-2">
        <Button block variant={done ? "secondary" : "primary"} onClick={log}>
          <Check className="h-4 w-4" /> Log serving
        </Button>
        {logs.length > 0 && (
          <Button variant="ghost" aria-label="Undo last serving" onClick={undoLast}>
            <Undo2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}

function History() {
  const { data } = useStore();
  const days = dateRange(addDays(today(), -13), today());
  const supps = data.supplements.filter((s) => s.active);
  if (!supps.length) return null;
  return (
    <Card>
      <CardHeader title="Last 14 days" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th />
              {days.map((d) => (
                <th key={d} className="font-medium text-mist-500">
                  {formatDay(d, { day: "numeric" })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {supps.map((s) => (
              <tr key={s.id}>
                <td className="whitespace-nowrap pr-2 text-sm text-mist-300">{s.name}</td>
                {days.map((d) => {
                  const n = data.supplementLogs.filter((l) => l.supplementId === s.id && l.date === d).reduce((a, l) => a + l.servings, 0);
                  return (
                    <td key={d}>
                      <div title={`${d}: ${n} serving(s)`} className={cn("mx-auto h-6 w-6 rounded-md", n >= s.dailyServings ? "bg-volt-500 shadow-[0_0_8px_rgba(31,117,255,.5)]" : n > 0 ? "bg-volt-500/40" : "bg-ink-700")} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SupplementEditor({ open, supp, kind, onClose }: { open: boolean; supp: Supplement | null; kind: SupplementKind; onClose(): void }) {
  const { add, put, remove } = useStore();
  const [v, setV] = useState<Record<string, string>>({});
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    const base = supp ?? { ...blankSupplement(kind), id: "", createdAt: "", updatedAt: "" };
    setV({
      name: base.name,
      servingAmount: String(base.servingAmount),
      servingUnit: base.servingUnit,
      dailyServings: String(base.dailyServings),
      calories: base.calories ? String(base.calories) : "",
      protein: base.protein ? String(base.protein) : "",
      carbs: base.carbs ? String(base.carbs) : "",
      fat: base.fat ? String(base.fat) : "",
      containerCost: base.containerCost != null ? String(base.containerCost) : "",
      servingsPerContainer: base.servingsPerContainer != null ? String(base.servingsPerContainer) : "",
      reminderTime: base.reminderTime ?? "",
    });
    setActive(base.active);
    setError(null);
    setConfirmDelete(false);
  }, [open, supp, kind]);

  const k = supp?.kind ?? kind;
  const showNutrition = k !== "creatine";

  function save() {
    const amount = num(v.servingAmount ?? "");
    const daily = num(v.dailyServings ?? "");
    if (!v.name?.trim()) return setError("Enter a name.");
    if (!amount || amount <= 0) return setError("Enter the serving amount.");
    if (!daily || daily <= 0 || daily > 20) return setError("Daily servings should be between 1 and 20.");
    const rec = {
      name: v.name.trim(),
      kind: k,
      servingAmount: amount,
      servingUnit: v.servingUnit?.trim() || "serving",
      dailyServings: daily,
      calories: num(v.calories ?? "") ?? 0,
      protein: num(v.protein ?? "") ?? 0,
      carbs: num(v.carbs ?? "") ?? 0,
      fat: num(v.fat ?? "") ?? 0,
      containerCost: num(v.containerCost ?? ""),
      servingsPerContainer: num(v.servingsPerContainer ?? ""),
      reminderTime: v.reminderTime || undefined,
      active,
    };
    if (supp) put("supplements", { ...supp, ...rec });
    else add("supplements", rec);
    onClose();
  }

  const f = (key: string) => ({ value: v[key] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [key]: e.target.value }) });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={supp ? `Edit ${supp.name}` : `Add ${SUPPLEMENT_LABEL[kind].toLowerCase()}`}
      footer={
        <div className="flex gap-2">
          {supp &&
            (confirmDelete ? (
              <Button
                variant="danger"
                onClick={() => {
                  remove("supplements", supp.id);
                  onClose();
                }}
              >
                Confirm delete
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            ))}
          <Button block onClick={save}>
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Input id="s-name" label="Name" {...f("name")} />
        <div className="grid grid-cols-3 gap-3">
          <Input id="s-amount" label="Serving" type="number" inputMode="decimal" {...f("servingAmount")} />
          <Input id="s-unit" label="Unit" {...f("servingUnit")} />
          <Input id="s-daily" label="Per day" type="number" inputMode="numeric" {...f("dailyServings")} hint="servings" />
        </div>
        {k === "creatine" && <p className="text-xs text-mist-400">Set the daily amount you've chosen. A loading phase isn't required; a steady daily dose works.</p>}
        {showNutrition && (
          <div className="rounded-2xl border border-ink-700 bg-ink-900 p-3">
            <p className="mb-1 text-sm font-semibold">Nutrition per serving</p>
            <p className="mb-3 text-xs text-mist-400">Copy these from your product label. Brands differ a lot, especially mass gainers.</p>
            <div className="grid grid-cols-2 gap-3">
              <Input id="s-cal" label="Calories" type="number" inputMode="decimal" suffix="kcal" {...f("calories")} />
              <Input id="s-p" label="Protein" type="number" inputMode="decimal" suffix="g" {...f("protein")} />
              <Input id="s-c" label="Carbs" type="number" inputMode="decimal" suffix="g" {...f("carbs")} />
              <Input id="s-f" label="Fat" type="number" inputMode="decimal" suffix="g" {...f("fat")} />
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input id="s-cost" label="Container price (optional)" type="number" inputMode="decimal" suffix="$" {...f("containerCost")} />
          <Input id="s-spc" label="Servings per container" type="number" inputMode="numeric" {...f("servingsPerContainer")} />
        </div>
        <Input id="s-reminder" label={<span className="inline-flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" /> Reminder time (optional)</span>} type="time" {...f("reminderTime")} hint="Turn on supplement reminders in Settings > Notifications." />
        <Toggle label="Active" description="Paused supplements are hidden from today's list." checked={active} onChange={setActive} />
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      </div>
    </Sheet>
  );
}
