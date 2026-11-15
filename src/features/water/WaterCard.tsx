import { Droplets, Undo2 } from "lucide-react";
import { useStore, useProfile } from "@/data/store";
import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/Progress";
import { Button } from "@/components/ui/Button";
import { waterOn } from "@/lib/stats";
import { ml } from "@/lib/format";
import type { ISODate } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";

export const QUICK_ADD = [250, 500, 750];

export function WaterCard({ date, compact }: { date: ISODate; compact?: boolean }) {
  const { data, add, remove } = useStore();
  const profile = useProfile();
  const toast = useToast();
  const total = waterOn(data, date);
  const goal = profile.targets.waterMl;
  const logs = data.waterLogs.filter((w) => w.date === date).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const addWater = (amount: number) => {
    const rec = add("waterLogs", { date, ml: amount });
    toast.show({ message: `Added ${amount} ml`, action: { label: "Undo", onClick: () => remove("waterLogs", rec.id) } });
  };

  return (
    <Card>
      <CardHeader
        icon={<Droplets className="h-4 w-4" />}
        title="Water"
        subtitle={`${ml(total)} of ${ml(goal)}`}
        action={
          logs.length > 0 && !compact ? (
            <Button size="sm" variant="ghost" onClick={() => remove("waterLogs", logs[0].id)} aria-label="Undo last water entry">
              <Undo2 className="h-4 w-4" />
            </Button>
          ) : undefined
        }
      />
      <ProgressBar value={total} max={goal} label="Water progress" tone={total >= goal ? "good" : "volt"} />
      <div className="mt-4 grid grid-cols-3 gap-2">
        {QUICK_ADD.map((a) => (
          <Button key={a} variant="secondary" size="sm" onClick={() => addWater(a)}>
            +{a} ml
          </Button>
        ))}
      </div>
    </Card>
  );
}
