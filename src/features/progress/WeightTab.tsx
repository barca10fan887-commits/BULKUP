import { useMemo, useState, type FormEvent } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Scale, Trash2 } from "lucide-react";
import { useProfile, useStore } from "@/data/store";
import { addDays, formatDay, today } from "@/lib/dates";
import { currentWeight, goalStatus, targetProgress, weightAsOf, weightEntries, weightTrendPerWeek } from "@/lib/stats";
import { kg, round, signed } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, num } from "@/components/ui/Field";
import { ProgressBar } from "@/components/ui/Progress";
import { EmptyState, Segmented, Stat } from "@/components/ui/misc";
import { useToast } from "@/components/ui/Toast";

type Range = "4w" | "3m" | "1y" | "all";

export function WeightTab() {
  const { data, add, remove } = useStore();
  const profile = useProfile();
  const toast = useToast();
  const [range, setRange] = useState<Range>("3m");
  const [date, setDate] = useState(today());
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const t = today();
  const all = weightEntries(data.bodyEntries);
  const current = currentWeight(data.bodyEntries, profile);
  const from = range === "4w" ? addDays(t, -27) : range === "3m" ? addDays(t, -90) : range === "1y" ? addDays(t, -365) : all[0]?.date ?? t;
  const series = useMemo(() => all.filter((e) => e.date >= from), [all, from]);
  const weekAgo = weightAsOf(data.bodyEntries, addDays(t, -7));
  const monthAgo = weightAsOf(data.bodyEntries, addDays(t, -30));
  const trend = weightTrendPerWeek(data.bodyEntries, addDays(t, -27), t);
  const status = goalStatus(profile, current);

  function submit(e: FormEvent) {
    e.preventDefault();
    const w = num(value);
    if (w == null || w < 30 || w > 300) return setError("Enter a weight between 30 and 300 kg.");
    if (date > t) return setError("You can't log a weight in the future.");
    setError(null);
    add("bodyEntries", { date, weightKg: w, custom: {} });
    setValue("");
    toast.show({ message: `Logged ${w} kg` });
  }

  const domain = series.length
    ? [Math.floor(Math.min(...series.map((s) => s.weightKg), profile.targetWeightKg) - 1), Math.ceil(Math.max(...series.map((s) => s.weightKg), profile.targetWeightKg) + 1)]
    : [0, 100];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            icon={<Scale className="h-4 w-4" />}
            title="Body weight"
            action={
              <Segmented
                className="text-xs"
                value={range}
                onChange={setRange}
                options={[
                  { value: "4w", label: "4W" },
                  { value: "3m", label: "3M" },
                  { value: "1y", label: "1Y" },
                  { value: "all", label: "All" },
                ]}
              />
            }
          />
          {series.length < 2 ? (
            <EmptyState title="Not enough data for a graph yet" body="Log your weight a few mornings a week. Two or more weigh-ins will draw your progress line." />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <AreaChart data={series} margin={{ top: 10, right: 8, bottom: 0, left: -18 }}>
                  <defs>
                    <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1f75ff" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#1f75ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1c212b" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => formatDay(d, { day: "numeric", month: "short" })} tick={{ fill: "#646e82", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis domain={domain} tick={{ fill: "#646e82", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip
                    contentStyle={{ background: "#141820", border: "1px solid #272d39", borderRadius: 12, color: "#eef2f8" }}
                    labelFormatter={(d) => formatDay(String(d))}
                    formatter={(v) => [`${v} kg`, "Weight"]}
                  />
                  <ReferenceLine y={profile.targetWeightKg} stroke="#2fd38a" strokeDasharray="5 5" label={{ value: `Target ${profile.targetWeightKg}`, fill: "#2fd38a", fontSize: 11, position: "insideTopRight" }} />
                  <Area type="monotone" dataKey="weightKg" stroke="#4d95ff" strokeWidth={2.5} fill="url(#wfill)" dot={{ r: 2.5, fill: "#4d95ff", strokeWidth: 0 }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Log weigh-in" subtitle="Morning, before food, for consistency" />
          <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
            <Input id="w-date" label="Date" type="date" value={date} max={t} onChange={(e) => setDate(e.target.value)} />
            <Input id="w-value" label="Weight" type="number" inputMode="decimal" step="0.1" value={value} onChange={(e) => setValue(e.target.value)} suffix="kg" error={error} placeholder={String(current)} />
            <Button type="submit" block>
              Save weight
            </Button>
          </form>
        </Card>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Stat label="Start" value={kg(profile.startWeightKg)} />
          <Stat label="Current" value={kg(current)} sub={`${signed(current - profile.startWeightKg)} kg total`} />
          <Stat label="This week" value={weekAgo != null ? `${signed(current - weekAgo)} kg` : "–"} sub="vs 7 days ago" />
          <Stat label="This month" value={monthAgo != null ? `${signed(current - monthAgo)} kg` : "–"} sub="vs 30 days ago" />
          <Stat label="Trend" value={trend != null ? `${signed(trend, 2)}` : "–"} sub={`kg/wk · plan ${signed(profile.targets.weeklyGainKg, 2)}`} />
        </div>
        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="text-mist-300">Progress to {kg(profile.targetWeightKg)} goal</span>
            <span className="tabular-nums text-mist-400">{status.label}</span>
          </div>
          <ProgressBar value={targetProgress(profile, current)} max={100} label="Progress to target weight" />
        </div>
      </Card>

      <WeeklyTable />

      {all.length > 0 && (
        <Card>
          <CardHeader title="Weigh-in log" />
          <ul className="divide-y divide-ink-700/70">
            {data.bodyEntries
              .filter((e) => e.weightKg)
              .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
              .slice(0, 30)
              .map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2">
                  <span className="text-sm text-mist-300">{formatDay(e.date)}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums">{e.weightKg} kg</span>
                    <Button size="icon" variant="ghost" aria-label={`Delete weigh-in on ${e.date}`} onClick={() => remove("bodyEntries", e.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** Average weight per week for the last 8 weeks. */
function WeeklyTable() {
  const { data } = useStore();
  const profile = useProfile();
  const t = today();
  const rows = Array.from({ length: 8 }, (_, i) => {
    const end = addDays(t, -7 * i);
    const start = addDays(end, -6);
    const ws = weightEntries(data.bodyEntries).filter((e) => e.date >= start && e.date <= end);
    const avg = ws.length ? round(ws.reduce((a, e) => a + e.weightKg, 0) / ws.length, 1) : null;
    return { start, end, avg, n: ws.length };
  });
  if (rows.every((r) => r.avg == null)) return null;
  return (
    <Card>
      <CardHeader title="Weekly averages" subtitle="Averages smooth out daily water swings" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[360px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[.08em] text-mist-500">
              <th className="py-2 font-semibold">Week</th>
              <th className="py-2 font-semibold">Average</th>
              <th className="py-2 font-semibold">Change</th>
              <th className="py-2 font-semibold">Weigh-ins</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const prev = rows.slice(i + 1).find((x) => x.avg != null);
              const change = r.avg != null && prev?.avg != null ? r.avg - prev.avg : null;
              return (
                <tr key={r.start} className="border-t border-ink-700/60">
                  <td className="py-2 text-mist-300">{formatDay(r.start, { day: "numeric", month: "short" })}</td>
                  <td className="py-2 font-semibold tabular-nums">{r.avg != null ? `${r.avg} kg` : "–"}</td>
                  <td className={`py-2 tabular-nums ${change == null ? "text-mist-500" : Math.sign(change) === Math.sign(profile.targets.weeklyGainKg) || profile.targets.weeklyGainKg === 0 ? "text-good" : "text-warn"}`}>{change != null ? `${signed(change)} kg` : "–"}</td>
                  <td className="py-2 tabular-nums text-mist-400">{r.n}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
