import { useState, type FormEvent } from "react";
import { Plus, Ruler, Trash2, X } from "lucide-react";
import type { BodyEntry } from "@/lib/types";
import { useStore } from "@/data/store";
import { formatDay, today } from "@/lib/dates";
import { signed } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, num } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/Toast";

const FIELDS = [
  { key: "chestCm", label: "Chest" },
  { key: "armCm", label: "Arm" },
  { key: "waistCm", label: "Waist" },
  { key: "legCm", label: "Leg (thigh)" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

export function MeasurementsTab() {
  const { data, add, remove } = useStore();
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [values, setValues] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<{ name: string; value: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const entries = data.bodyEntries.filter((e) => FIELDS.some((f) => e[f.key] != null) || Object.keys(e.custom ?? {}).length).sort((a, b) => b.date.localeCompare(a.date));
  const customNames = [...new Set(data.bodyEntries.flatMap((e) => Object.keys(e.custom ?? {})))];
  const first = (k: FieldKey) => [...entries].reverse().find((e) => e[k] != null)?.[k];
  const latest = (k: FieldKey) => entries.find((e) => e[k] != null)?.[k];

  function submit(e: FormEvent) {
    e.preventDefault();
    const rec: Partial<BodyEntry> = {};
    for (const f of FIELDS) {
      const n = num(values[f.key] ?? "");
      if (n != null) {
        if (n <= 0 || n > 250) return setError(`${f.label} should be between 1 and 250 cm.`);
        rec[f.key] = n;
      }
    }
    const c: Record<string, number> = {};
    for (const row of custom) {
      const n = num(row.value);
      if (row.name.trim() && n != null) c[row.name.trim()] = n;
    }
    if (!Object.keys(rec).length && !Object.keys(c).length) return setError("Enter at least one measurement.");
    setError(null);
    add("bodyEntries", { date, ...rec, custom: c });
    setValues({});
    setCustom([]);
    toast.show({ message: "Measurements saved" });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
      <Card>
        <CardHeader icon={<Ruler className="h-4 w-4" />} title="Record measurements" subtitle="Measure relaxed, same spot each time" />
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          <Input id="m-date" label="Date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <Input key={f.key} id={`m-${f.key}`} label={f.label} type="number" inputMode="decimal" step="0.1" suffix="cm" value={values[f.key] ?? ""} placeholder={latest(f.key)?.toString()} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
            ))}
          </div>
          {custom.map((row, i) => (
            <div key={i} className="flex items-end gap-2">
              <Input id={`m-cn-${i}`} className="flex-1" label="Measurement" list="custom-measurements" value={row.name} placeholder="e.g. Calf" onChange={(e) => setCustom(custom.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))} />
              <Input id={`m-cv-${i}`} className="w-28" label="cm" type="number" inputMode="decimal" value={row.value} onChange={(e) => setCustom(custom.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))} />
              <Button size="icon" variant="ghost" aria-label="Remove measurement" onClick={() => setCustom(custom.filter((_, j) => j !== i))}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <datalist id="custom-measurements">
            {[...customNames, "Calf", "Forearm", "Shoulders", "Neck", "Hips"].map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <Button variant="ghost" size="sm" className="self-start" onClick={() => setCustom([...custom, { name: "", value: "" }])}>
            <Plus className="h-4 w-4" /> Custom measurement
          </Button>
          {error && <p role="alert" className="text-sm text-bad">{error}</p>}
          <Button type="submit" block>
            Save measurements
          </Button>
        </form>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="Change since first entry" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {FIELDS.map((f) => {
              const a = first(f.key);
              const b = latest(f.key);
              return (
                <div key={f.key} className="rounded-2xl border border-ink-700 bg-ink-900 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-mist-500">{f.label}</p>
                  <p className="mt-1 font-display text-lg font-semibold tabular-nums">{b != null ? `${b} cm` : "–"}</p>
                  <p className={`text-xs tabular-nums ${a != null && b != null && b - a !== 0 ? (f.key === "waistCm" ? "text-mist-300" : "text-good") : "text-mist-500"}`}>{a != null && b != null ? `${signed(b - a)} cm` : "No data"}</p>
                </div>
              );
            })}
          </div>
        </Card>
        <Card>
          <CardHeader title="History" />
          {entries.length === 0 ? (
            <EmptyState title="No measurements yet" body="Measuring every 2-4 weeks shows where you're adding size." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[.08em] text-mist-500">
                    <th className="py-2 font-semibold">Date</th>
                    {FIELDS.map((f) => (
                      <th key={f.key} className="py-2 font-semibold">{f.label.split(" ")[0]}</th>
                    ))}
                    <th className="py-2 font-semibold">Other</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-t border-ink-700/60">
                      <td className="py-2 text-mist-300">{formatDay(e.date, { day: "numeric", month: "short", year: "2-digit" })}</td>
                      {FIELDS.map((f) => (
                        <td key={f.key} className="py-2 tabular-nums">{e[f.key] ?? "–"}</td>
                      ))}
                      <td className="py-2 text-xs text-mist-400">{Object.entries(e.custom ?? {}).map(([k, v]) => `${k} ${v}`).join(", ") || "–"}</td>
                      <td className="py-1 text-right">
                        <Button size="icon" variant="ghost" aria-label="Delete entry" onClick={() => remove("bodyEntries", e.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
