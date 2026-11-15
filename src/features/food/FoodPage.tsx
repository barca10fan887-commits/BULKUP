import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Copy, MoreVertical, Plus, Star, Trash2, UtensilsCrossed, User } from "lucide-react";
import type { CustomFood, FoodEntry, MealType } from "@/lib/types";
import { useProfile, useStore } from "@/data/store";
import { addDays, friendlyDay, today } from "@/lib/dates";
import { dailyTotals, entriesOn } from "@/lib/stats";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/Progress";
import { EmptyState, PageHeader, Segmented } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/Sheet";
import { Input, Select, num } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { AddFoodSheet, type AddMode } from "./AddFoodSheet";
import { ManualFoodForm } from "./ManualFoodForm";
import { MEALS, MEAL_LABEL, defaultMeal, fmt1 } from "./shared";

export default function FoodPage() {
  const [params, setParams] = useSearchParams();
  const [date, setDate] = useState(today());
  const [tab, setTab] = useState<"diary" | "foods" | "saved">("diary");
  const [sheet, setSheet] = useState<{ open: boolean; meal: MealType; mode: AddMode }>({ open: false, meal: defaultMeal(), mode: "search" });

  // Deep links from the dashboard quick actions: /food?add=barcode
  useEffect(() => {
    const add = params.get("add") as AddMode | null;
    if (add && ["search", "barcode", "photo", "manual", "favourites"].includes(add)) {
      setSheet({ open: true, meal: defaultMeal(), mode: add });
      params.delete("add");
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  return (
    <div>
      <PageHeader
        title="Food"
        subtitle="Your food diary and saved foods"
        action={
          <Button onClick={() => setSheet({ open: true, meal: defaultMeal(), mode: "search" })}>
            <Plus className="h-4 w-4" /> Add food
          </Button>
        }
      />
      <Segmented
        className="mb-4 max-w-md"
        value={tab}
        onChange={setTab}
        options={[
          { value: "diary", label: "Diary" },
          { value: "foods", label: "My foods" },
          { value: "saved", label: "Saved meals" },
        ]}
      />
      {tab === "diary" && <Diary date={date} setDate={setDate} onAdd={(meal) => setSheet({ open: true, meal, mode: "search" })} />}
      {tab === "foods" && <MyFoods />}
      {tab === "saved" && <SavedMeals />}
      <AddFoodSheet open={sheet.open} onClose={() => setSheet((s) => ({ ...s, open: false }))} date={date} meal={sheet.meal} mode={sheet.mode} />
    </div>
  );
}

function Diary({ date, setDate, onAdd }: { date: string; setDate(d: string): void; onAdd(m: MealType): void }) {
  const { data, addMany, add, remove } = useStore();
  const profile = useProfile();
  const toast = useToast();
  const t = profile.targets;
  const totals = dailyTotals(data.foodEntries, date);
  const entries = entriesOn(data.foodEntries, date);
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const [menu, setMenu] = useState<MealType | null>(null);
  const [favName, setFavName] = useState("");

  const yesterday = addDays(date, -1);

  function copyMeal(meal: MealType) {
    const src = data.foodEntries.filter((e) => e.date === yesterday && e.meal === meal);
    if (!src.length) {
      toast.show({ tone: "info", message: `No ${MEAL_LABEL[meal].toLowerCase()} logged on ${friendlyDay(yesterday).toLowerCase()}.` });
      return;
    }
    const recs = addMany(
      "foodEntries",
      src.map(({ id: _id, createdAt: _c, updatedAt: _u, ...rest }) => ({ ...rest, date })),
    );
    toast.show({ message: `Copied ${recs.length} item${recs.length === 1 ? "" : "s"}`, action: { label: "Undo", onClick: () => recs.forEach((r) => remove("foodEntries", r.id)) } });
    setMenu(null);
  }

  function saveFavourite(meal: MealType) {
    const items = entries.filter((e) => e.meal === meal);
    if (!items.length || !favName.trim()) return;
    add("favouriteMeals", { name: favName.trim(), meal, items: items.map((e) => ({ name: e.name, servingLabel: e.servingLabel, quantity: e.quantity, calories: e.calories, protein: e.protein, carbs: e.carbs, fat: e.fat })) });
    toast.show({ message: `Saved "${favName.trim()}"` });
    setFavName("");
    setMenu(null);
  }

  function deleteEntry(e: FoodEntry) {
    remove("foodEntries", e.id);
    toast.show({ message: `Removed ${e.name}`, action: { label: "Undo", onClick: () => add("foodEntries", { ...e }) } });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="secondary" size="icon" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col items-center">
          <input
            type="date"
            aria-label="Choose date"
            value={date}
            max={addDays(today(), 1)}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="absolute h-0 w-0 opacity-0"
            id="diary-date"
          />
          <label htmlFor="diary-date" className="cursor-pointer font-display text-lg font-semibold" onClick={() => (document.getElementById("diary-date") as HTMLInputElement)?.showPicker?.()}>
            {friendlyDay(date)}
          </label>
          {date !== today() && (
            <button className="text-xs font-semibold text-volt-400" onClick={() => setDate(today())}>
              Back to today
            </button>
          )}
        </div>
        <Button variant="secondary" size="icon" aria-label="Next day" onClick={() => setDate(addDays(date, 1))} disabled={date >= today()}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(
            [
              ["Calories", totals.calories, t.calories, "kcal"],
              ["Protein", totals.protein, t.protein, "g"],
              ["Carbs", totals.carbs, t.carbs, "g"],
              ["Fat", totals.fat, t.fat, "g"],
            ] as const
          ).map(([label, v, goal, unit], i) => (
            <div key={label}>
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-mist-500">{label}</p>
                <p className="text-[11px] tabular-nums text-mist-500">{Math.max(0, Math.round(goal - v))} left</p>
              </div>
              <p className="my-1 font-display text-lg font-semibold tabular-nums">
                {Math.round(v).toLocaleString()} <span className="text-xs font-normal text-mist-500">/ {goal.toLocaleString()} {unit}</span>
              </p>
              <ProgressBar value={v} max={goal} tone={v >= goal ? "good" : i < 2 ? "volt" : "muted"} label={`${label} progress`} />
            </div>
          ))}
        </div>
      </Card>

      {MEALS.map((meal) => {
        const items = entries.filter((e) => e.meal === meal);
        const kcal = Math.round(items.reduce((a, e) => a + e.calories, 0));
        const protein = Math.round(items.reduce((a, e) => a + e.protein, 0));
        return (
          <Card key={meal} className="p-0 sm:p-0">
            <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4 sm:px-5">
              <div>
                <h2 className="font-display font-semibold">{MEAL_LABEL[meal]}</h2>
                <p className="text-xs tabular-nums text-mist-400">
                  {kcal} kcal · {protein} g protein
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" aria-label={`${MEAL_LABEL[meal]} options`} onClick={() => setMenu(meal)}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onAdd(meal)} aria-label={`Add to ${MEAL_LABEL[meal]}`}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            </div>
            {items.length > 0 && (
              <ul className="divide-y divide-ink-700/70 border-t border-ink-700/70">
                {items.map((e) => (
                  <li key={e.id} className="group flex items-center gap-2 px-4 sm:px-5">
                    <button className="flex min-w-0 flex-1 items-center justify-between gap-3 py-3 text-left" onClick={() => setEditing(e)}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{e.name}</p>
                        <p className="truncate text-xs text-mist-500">
                          {e.servingLabel}
                          {e.source === "photo_ai" ? " · AI estimate" : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums">{Math.round(e.calories)}</p>
                        <p className="text-[11px] tabular-nums text-mist-500">
                          P{fmt1(e.protein)} C{fmt1(e.carbs)} F{fmt1(e.fat)}
                        </p>
                      </div>
                    </button>
                    <Button size="icon" variant="ghost" aria-label={`Delete ${e.name}`} onClick={() => deleteEntry(e)} className="text-mist-500 hover:text-bad">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}

      <EntryEditor entry={editing} onClose={() => setEditing(null)} />

      <Sheet open={menu !== null} onClose={() => setMenu(null)} title={menu ? MEAL_LABEL[menu] : ""}>
        {menu && (
          <div className="flex flex-col gap-4">
            <Button variant="secondary" block onClick={() => copyMeal(menu)}>
              <Copy className="h-4 w-4" /> Copy from {friendlyDay(yesterday).toLowerCase()}
            </Button>
            <div className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
              <p className="mb-3 flex items-center gap-2 font-semibold">
                <Star className="h-4 w-4 text-volt-400" /> Save as favourite meal
              </p>
              {entries.some((e) => e.meal === menu) ? (
                <div className="flex items-end gap-2">
                  <Input id="fav-name" className="flex-1" label="Name" placeholder="e.g. Usual breakfast" value={favName} onChange={(e) => setFavName(e.target.value)} />
                  <Button onClick={() => saveFavourite(menu)} disabled={!favName.trim()}>
                    Save
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-mist-400">Add food to this meal first.</p>
              )}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function EntryEditor({ entry, onClose }: { entry: FoodEntry | null; onClose(): void }) {
  const { update, remove } = useStore();
  const [v, setV] = useState<Record<string, string>>({});
  const [scale, setScale] = useState("1");

  useEffect(() => {
    if (entry)
      setV({ name: entry.name, servingLabel: entry.servingLabel, meal: entry.meal, calories: String(Math.round(entry.calories)), protein: fmt1(entry.protein), carbs: fmt1(entry.carbs), fat: fmt1(entry.fat) });
    setScale("1");
  }, [entry]);

  if (!entry) return null;
  const f = num(scale) ?? 1;
  const save = () => {
    update("foodEntries", entry.id, {
      name: v.name.trim() || entry.name,
      servingLabel: f !== 1 ? `${fmt1(f)} x (${v.servingLabel})` : v.servingLabel,
      meal: v.meal as MealType,
      quantity: entry.quantity * f,
      calories: Math.round((num(v.calories) ?? 0) * f),
      protein: (num(v.protein) ?? 0) * f,
      carbs: (num(v.carbs) ?? 0) * f,
      fat: (num(v.fat) ?? 0) * f,
    });
    onClose();
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title="Edit entry"
      footer={
        <div className="flex gap-2">
          <Button
            variant="danger"
            onClick={() => {
              remove("foodEntries", entry.id);
              onClose();
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
          <Button block onClick={save}>
            Save changes
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Input id="ee-name" label="Name" value={v.name ?? ""} onChange={(e) => setV({ ...v, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input id="ee-serving" label="Serving" value={v.servingLabel ?? ""} onChange={(e) => setV({ ...v, servingLabel: e.target.value })} />
          <Select id="ee-meal" label="Meal" value={v.meal} onChange={(e) => setV({ ...v, meal: e.target.value })}>
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {MEAL_LABEL[m]}
              </option>
            ))}
          </Select>
          <Input id="ee-cal" label="Calories" type="number" inputMode="decimal" value={v.calories ?? ""} onChange={(e) => setV({ ...v, calories: e.target.value })} suffix="kcal" />
          <Input id="ee-p" label="Protein" type="number" inputMode="decimal" value={v.protein ?? ""} onChange={(e) => setV({ ...v, protein: e.target.value })} suffix="g" />
          <Input id="ee-c" label="Carbs" type="number" inputMode="decimal" value={v.carbs ?? ""} onChange={(e) => setV({ ...v, carbs: e.target.value })} suffix="g" />
          <Input id="ee-f" label="Fat" type="number" inputMode="decimal" value={v.fat ?? ""} onChange={(e) => setV({ ...v, fat: e.target.value })} suffix="g" />
        </div>
        <Input id="ee-scale" label="Multiply portion" type="number" inputMode="decimal" step="0.25" value={scale} onChange={(e) => setScale(e.target.value)} hint="e.g. 1.5 if you ate half as much again. Scales all values above." />
      </div>
    </Sheet>
  );
}

function MyFoods() {
  const { data, add, update, remove } = useStore();
  const [editing, setEditing] = useState<CustomFood | "new" | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> Create custom food
        </Button>
      </div>
      {data.customFoods.length === 0 ? (
        <EmptyState icon={<User className="h-5 w-5" />} title="No custom foods yet" body="Create foods you eat often, like your own recipes or a product from its label, and find them instantly in search." />
      ) : (
        <ul className="divide-y divide-ink-700 overflow-hidden rounded-2xl border border-ink-700 bg-ink-850">
          {[...data.customFoods]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((f) => (
              <li key={f.id}>
                <button className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-ink-800" onClick={() => setEditing(f)}>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{f.name}</p>
                    <p className="truncate text-xs text-mist-500">
                      {f.brand ? `${f.brand} · ` : ""}
                      {f.servingSize} {f.servingUnit}
                      {f.barcode ? ` · ${f.barcode}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">{f.calories} kcal</p>
                </button>
              </li>
            ))}
        </ul>
      )}
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New custom food" : "Edit custom food"}>
        {editing && (
          <>
            <ManualFoodForm
              customOnly
              meal="snacks"
              submitLabel="Save food"
              initial={editing === "new" ? undefined : editing}
              onSubmit={(v) => {
                const rec = { name: v.name, brand: v.brand, servingSize: v.servingSize, servingUnit: v.servingUnit, calories: v.calories, protein: v.protein, carbs: v.carbs, fat: v.fat };
                if (editing === "new") add("customFoods", rec);
                else update("customFoods", editing.id, rec);
                setEditing(null);
              }}
            />
            {editing !== "new" && (
              <Button
                variant="danger"
                block
                className="mt-3"
                onClick={() => {
                  remove("customFoods", editing.id);
                  setEditing(null);
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete food
              </Button>
            )}
          </>
        )}
      </Sheet>
    </div>
  );
}

function SavedMeals() {
  const { data, remove } = useStore();
  if (!data.favouriteMeals.length)
    return <EmptyState icon={<UtensilsCrossed className="h-5 w-5" />} title="No saved meals yet" body="In the diary, tap the menu on a meal and choose 'Save as favourite meal'. Then add it again in one tap from Add food > Saved." />;
  return (
    <ul className="flex flex-col gap-2">
      {data.favouriteMeals.map((f) => (
        <li key={f.id} className="flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-850 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{f.name}</p>
            <p className="truncate text-xs text-mist-400">{f.items.map((i) => i.name).join(", ")}</p>
          </div>
          <p className="shrink-0 text-sm font-semibold tabular-nums">{Math.round(f.items.reduce((a, i) => a + i.calories, 0))} kcal</p>
          <Button size="icon" variant="ghost" aria-label={`Delete ${f.name}`} onClick={() => remove("favouriteMeals", f.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
