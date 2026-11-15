import { useState, type FormEvent } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Trash2 } from "lucide-react";
import { useProfile, useStore } from "@/data/store";
import { addDays, dateRange, formatDay, today, friendlyDay } from "@/lib/dates";
import { waterOn } from "@/lib/stats";
import { ml } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, num } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/misc";
import { WaterCard } from "./WaterCard";

export default function WaterPage() {
  const { data, add, remove, saveProfile } = useStore();
  const profile = useProfile();
  const t = today();
  const [custom, setCustom] = useState("");
  const [goal, setGoal] = useState(String(profile.targets.waterMl));
  const series = dateRange(addDays(t, -13), t).map((d) => ({ date: d, ml: waterOn(data, d) }));
  const logs = data.waterLogs.filter((w) => w.date === t).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function addCustom(e: FormEvent) {
    e.preventDefault();
    const n = num(custom);
    if (!n || n <= 0 || n > 5000) return;
    add("waterLogs", { date: t, ml: Math.round(n) });
    setCustom("");
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Water" subtitle="Hydration supports training and appetite" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <WaterCard date={t} />
          <Card>
            <form onSubmit={addCustom} className="flex items-end gap-2">
              <Input id="water-custom" className="flex-1" label="Custom amount" type="number" inputMode="numeric" suffix="ml" value={custom} onChange={(e) => setCustom(e.target.value)} />
              <Button type="submit" variant="secondary">Add</Button>
            </form>
            <form
              className="mt-4 flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const n = num(goal);
                if (n && n >= 500 && n <= 10000) saveProfile({ ...profile, targets: { ...profile.targets, waterMl: Math.round(n) } });
              }}
            >
              <Input id="water-goal" className="flex-1" label="Daily goal" type="number" inputMode="numeric" step="250" suffix="ml" value={goal} onChange={(e) => setGoal(e.target.value)} />
              <Button type="submit" variant="secondary">Save goal</Button>
            </form>
          </Card>
          {logs.length > 0 && (
            <Card>
              <CardHeader title="Today's entries" />
              <ul className="divide-y divide-ink-700/70">
                {logs.map((l) => (
                  <li key={l.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-mist-400">{new Date(l.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                    <span className="flex items-center gap-2 font-semibold tabular-nums">
                      {l.ml} ml
                      <Button size="icon" variant="ghost" aria-label="Delete entry" onClick={() => remove("waterLogs", l.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <Card>
          <CardHeader title="Last 14 days" />
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={series} margin={{ top: 10, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#1c212b" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d: string) => formatDay(d, { day: "numeric" })} tick={{ fill: "#646e82", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v: number) => `${v / 1000}L`} tick={{ fill: "#646e82", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "rgba(31,117,255,.08)" }} contentStyle={{ background: "#141820", border: "1px solid #272d39", borderRadius: 12 }} labelFormatter={(d) => friendlyDay(String(d))} formatter={(v) => [ml(Number(v)), "Water"]} />
                <ReferenceLine y={profile.targets.waterMl} stroke="#2fd38a" strokeDasharray="4 4" />
                <Bar dataKey="ml" fill="#1f75ff" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 divide-y divide-ink-700/70 text-sm">
            {[...series].reverse().slice(1, 8).map((s) => (
              <li key={s.date} className="flex justify-between py-1.5">
                <span className="text-mist-400">{friendlyDay(s.date)}</span>
                <span className={`tabular-nums ${s.ml >= profile.targets.waterMl ? "text-good" : "text-mist-300"}`}>{ml(s.ml)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
