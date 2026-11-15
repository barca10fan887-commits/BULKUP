import { useEffect, useMemo, useRef, useState } from "react";
import { Barcode, Camera, Clock, Globe, PenLine, Search, Star, User } from "lucide-react";
import type { FoodEntry, FoodSource, ISODate, MealType } from "@/lib/types";
import { useStore } from "@/data/store";
import { searchBuiltin, type FoodItem } from "@/lib/foodDb";
import { searchProducts, OffError } from "@/lib/openFoodFacts";
import { config } from "@/lib/config";
import { getStatus } from "@/lib/api";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { EmptyState, Spinner } from "@/components/ui/misc";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/Toast";
import { ServingPicker, type PickedFood } from "./ServingPicker";
import { ManualFoodForm, type ManualFoodValues } from "./ManualFoodForm";
import { BarcodeScanner } from "./BarcodeScanner";
import { PhotoScanner } from "./PhotoScanner";
import { MEAL_LABEL } from "./shared";
import { Art } from "@/components/Art";
import { foodArt } from "@/lib/art";

export type AddMode = "search" | "barcode" | "photo" | "manual" | "favourites";

const TABS: { value: AddMode; label: string; icon: typeof Search }[] = [
  { value: "search", label: "Search", icon: Search },
  { value: "barcode", label: "Barcode", icon: Barcode },
  { value: "photo", label: "Photo", icon: Camera },
  { value: "manual", label: "Manual", icon: PenLine },
  { value: "favourites", label: "Saved", icon: Star },
];

export function AddFoodSheet({ open, onClose, date, meal, mode: initialMode }: { open: boolean; onClose(): void; date: ISODate; meal: MealType; mode: AddMode }) {
  const [mode, setMode] = useState<AddMode>(initialMode);
  // The photo scanner needs an AI service; hide it entirely when there isn't one.
  const [aiOn, setAiOn] = useState(false);
  useEffect(() => {
    getStatus().then((st) => setAiOn(st.ai));
  }, []);
  const tabs = TABS.filter((t) => t.value !== "photo" || aiOn);
  const activeMode: AddMode = mode === "photo" && !aiOn ? "search" : mode;
  const [manualBarcode, setManualBarcode] = useState<string | undefined>();
  const { addMany, add, remove, data } = useStore();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setManualBarcode(undefined);
    }
  }, [open, initialMode]);

  function addEntries(items: PickedFood[], source: FoodSource) {
    const recs = addMany(
      "foodEntries",
      items.map<Omit<FoodEntry, "id" | "createdAt" | "updatedAt">>((p) => ({ date, ...p, source })),
    );
    const kcal = Math.round(items.reduce((a, i) => a + i.calories, 0));
    toast.show({
      message: items.length === 1 ? `Added ${items[0].name} (${kcal} kcal)` : `Added ${items.length} items (${kcal} kcal)`,
      action: { label: "Undo", onClick: () => recs.forEach((r) => remove("foodEntries", r.id)) },
    });
    onClose();
  }

  function addManual(v: ManualFoodValues) {
    if (v.saveAsCustom || manualBarcode) {
      add("customFoods", { name: v.name, brand: v.brand, servingSize: v.servingSize, servingUnit: v.servingUnit, calories: v.calories, protein: v.protein, carbs: v.carbs, fat: v.fat, barcode: manualBarcode });
    }
    const q = v.quantity;
    const r = (n: number) => Math.round(n * q * 10) / 10;
    addEntries(
      [{ meal: v.meal, name: v.name, brand: v.brand, servingLabel: `${q} x ${v.servingSize} ${v.servingUnit}`, quantity: q, calories: Math.round(v.calories * q), protein: r(v.protein), carbs: r(v.carbs), fat: r(v.fat), barcode: manualBarcode }],
      manualBarcode ? "barcode" : v.saveAsCustom ? "custom" : "manual",
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Add to ${MEAL_LABEL[meal].toLowerCase()}`} wide>
      <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={activeMode === t.value}
            onClick={() => setMode(t.value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition",
              activeMode === t.value ? "bg-volt-500 text-white shadow-glow" : "bg-ink-900 text-mist-400 hover:text-mist-100",
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>
      {activeMode === "search" && <FoodSearch meal={meal} onAdd={(p, src) => addEntries([p], src)} onManual={() => setMode("manual")} />}
      {activeMode === "barcode" && (
        <BarcodeScanner
          meal={meal}
          onAdd={(p) => addEntries([p], "barcode")}
          onManual={(code) => {
            setManualBarcode(code);
            setMode("manual");
          }}
        />
      )}
      {activeMode === "photo" && <PhotoScanner meal={meal} onAddMany={(items) => addEntries(items, "photo_ai")} onManual={() => setMode("manual")} />}
      {activeMode === "manual" && (
        <>
          {manualBarcode && <p className="mb-3 rounded-xl bg-ink-900 px-3 py-2 text-xs text-mist-400">Barcode {manualBarcode} will be saved with this food so it's found next time.</p>}
          <ManualFoodForm meal={meal} onSubmit={addManual} />
        </>
      )}
      {activeMode === "favourites" && (
        <div className="flex flex-col gap-2">
          {data.favouriteMeals.length === 0 ? (
            <EmptyState icon={<Star className="h-5 w-5" />} title="No saved meals yet" body="In your diary, open a meal's menu and choose 'Save as favourite' to reuse it in one tap." />
          ) : (
            data.favouriteMeals.map((f) => {
              const kcal = Math.round(f.items.reduce((a, i) => a + i.calories, 0));
              const protein = Math.round(f.items.reduce((a, i) => a + i.protein, 0));
              return (
                <button
                  key={f.id}
                  onClick={() => addEntries(f.items.map((i) => ({ ...i, meal })), "favourite")}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-ink-700 bg-ink-900 px-4 py-3 text-left transition hover:border-volt-500/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{f.name}</p>
                    <p className="truncate text-xs text-mist-400">{f.items.map((i) => i.name).join(", ")}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums">{kcal} kcal</p>
                    <p className="text-xs tabular-nums text-mist-400">{protein} g protein</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </Sheet>
  );
}

function FoodSearch({ meal, onAdd, onManual }: { meal: MealType; onAdd(p: PickedFood, src: FoodSource): void; onManual(): void }) {
  const { data } = useStore();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [online, setOnline] = useState<{ status: "idle" | "loading" | "done" | "error"; items: FoodItem[]; error?: string }>({ status: "idle", items: [] });
  const abort = useRef<AbortController | null>(null);

  const recent = useMemo<FoodItem[]>(() => {
    const seen = new Set<string>();
    const out: FoodItem[] = [];
    for (const e of [...data.foodEntries].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      const key = e.name.toLowerCase();
      if (seen.has(key) || e.quantity <= 0) continue;
      seen.add(key);
      out.push({ key: `recent-${e.id}`, name: e.name, brand: e.brand, servingSize: 1, servingUnit: e.servingLabel || "serving", calories: Math.round(e.calories), protein: e.protein, carbs: e.carbs, fat: e.fat, source: "recent" });
      if (out.length >= 30) break;
    }
    return out;
  }, [data.foodEntries]);

  const custom = useMemo<FoodItem[]>(
    () => data.customFoods.map((f) => ({ key: `custom-${f.id}`, name: f.name, brand: f.brand, servingSize: f.servingSize, servingUnit: f.servingUnit, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat, barcode: f.barcode, source: "custom" })),
    [data.customFoods],
  );

  const term = q.trim().toLowerCase();
  const match = (f: FoodItem) => term.split(/\s+/).every((t) => `${f.name} ${f.brand ?? ""}`.toLowerCase().includes(t));
  const local = term ? [...custom.filter(match), ...recent.filter(match).slice(0, 8), ...searchBuiltin(term)] : [];

  // Debounced Open Food Facts search.
  useEffect(() => {
    abort.current?.abort();
    if (term.length < 3) {
      setOnline({ status: "idle", items: [] });
      return;
    }
    const ctrl = new AbortController();
    abort.current = ctrl;
    const timer = setTimeout(async () => {
      setOnline((o) => ({ ...o, status: "loading" }));
      try {
        const items = await searchProducts(config.offBaseUrl, term, ctrl.signal);
        if (!ctrl.signal.aborted) setOnline({ status: "done", items });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setOnline({ status: "error", items: [], error: e instanceof OffError ? e.message : "Online search is unavailable right now." });
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [term]);

  if (selected)
    return (
      <ServingPicker
        food={selected}
        meal={meal}
        onBack={() => setSelected(null)}
        onAdd={(p) => onAdd(p, selected.source === "openfoodfacts" ? "openfoodfacts" : selected.source === "custom" ? "custom" : "database")}
      />
    );

  return (
    <div className="flex flex-col gap-4">
      <Input id="food-search" type="search" placeholder="Search foods, e.g. chicken breast" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" enterKeyHint="search" />
      {!term ? (
        <>
          {custom.length > 0 && <FoodList title="My foods" icon={<User className="h-3.5 w-3.5" />} items={custom.slice(0, 10)} onPick={setSelected} />}
          {recent.length > 0 ? (
            <FoodList title="Recent" icon={<Clock className="h-3.5 w-3.5" />} items={recent.slice(0, 12)} onPick={setSelected} />
          ) : (
            <p className="text-center text-sm text-mist-500">Search the built-in food list and Open Food Facts.</p>
          )}
        </>
      ) : (
        <>
          {local.length > 0 && <FoodList title="Foods" items={local} onPick={setSelected} />}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-mist-500">
              <Globe className="h-3.5 w-3.5" /> Open Food Facts
            </p>
            {term.length < 3 ? (
              <p className="text-sm text-mist-500">Type at least 3 letters to search packaged products.</p>
            ) : online.status === "loading" ? (
              <Spinner label="Searching products" />
            ) : online.status === "error" ? (
              <p className="text-sm text-warn">{online.error}</p>
            ) : online.status === "done" && online.items.length === 0 ? (
              <p className="text-sm text-mist-500">No packaged products found. Try different words, scan the barcode, or add it manually.</p>
            ) : (
              <FoodList items={online.items} onPick={setSelected} />
            )}
          </div>
          {local.length === 0 && online.status === "done" && online.items.length === 0 && (
            <Button variant="secondary" onClick={onManual}>
              Add "{q.trim()}" manually
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function FoodList({ title, icon, items, onPick }: { title?: string; icon?: React.ReactNode; items: FoodItem[]; onPick(f: FoodItem): void }) {
  return (
    <div>
      {title && (
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-mist-500">
          {icon}
          {title}
        </p>
      )}
      <ul className="divide-y divide-ink-700 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        {items.map((f) => (
          <li key={f.key}>
            <button onClick={() => onPick(f)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-ink-800">
              <Art name={foodArt(f.name)} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-mist-100">{f.name}</p>
                <p className="truncate text-xs text-mist-500">
                  {f.brand ? `${f.brand} · ` : ""}
                  {f.servingSize} {f.servingUnit}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums">{Math.round(f.calories)} kcal</p>
                <p className="text-xs tabular-nums text-mist-500">{Math.round(f.protein)} g protein</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
