import { useState, type FormEvent } from "react";
import type { MealType } from "@/lib/types";
import { Input, Select, Toggle, num } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { caloriesFromMacros } from "@/lib/calc";
import { MEALS, MEAL_LABEL } from "./shared";

export interface ManualFoodValues {
  meal: MealType;
  name: string;
  brand?: string;
  servingSize: number;
  servingUnit: string;
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  saveAsCustom: boolean;
}

/** Manual entry. Nutrition is per serving; quantity multiplies it. */
export function ManualFoodForm({
  meal,
  initial,
  onSubmit,
  submitLabel = "Add to diary",
  customOnly,
}: {
  meal: MealType;
  initial?: Partial<ManualFoodValues>;
  onSubmit(v: ManualFoodValues): void;
  submitLabel?: string;
  customOnly?: boolean;
}) {
  const [v, setV] = useState({
    meal: initial?.meal ?? meal,
    name: initial?.name ?? "",
    brand: initial?.brand ?? "",
    servingSize: String(initial?.servingSize ?? 1),
    servingUnit: initial?.servingUnit ?? "serving",
    quantity: String(initial?.quantity ?? 1),
    calories: initial?.calories != null ? String(initial.calories) : "",
    protein: initial?.protein != null ? String(initial.protein) : "",
    carbs: initial?.carbs != null ? String(initial.carbs) : "",
    fat: initial?.fat != null ? String(initial.fat) : "",
    saveAsCustom: customOnly ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof v, val: string | boolean) => setV((x) => ({ ...x, [k]: val }));

  const p = num(v.protein) ?? 0;
  const c = num(v.carbs) ?? 0;
  const f = num(v.fat) ?? 0;
  const estimated = Math.round(caloriesFromMacros(p, c, f));
  const kcal = num(v.calories);

  function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!v.name.trim()) errs.name = "Give the food a name.";
    if (kcal == null || kcal < 0 || kcal > 5000) errs.calories = "Enter calories between 0 and 5000.";
    for (const k of ["protein", "carbs", "fat"] as const) {
      const n = num(v[k]);
      if (v[k] !== "" && (n == null || n < 0 || n > 500)) errs[k] = "0-500 g";
    }
    const size = num(v.servingSize);
    if (!size || size <= 0) errs.servingSize = "Above 0";
    const qty = num(v.quantity);
    if (!customOnly && (!qty || qty <= 0)) errs.quantity = "Above 0";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSubmit({
      meal: v.meal,
      name: v.name.trim(),
      brand: v.brand.trim() || undefined,
      servingSize: size!,
      servingUnit: v.servingUnit.trim() || "serving",
      quantity: customOnly ? 1 : qty!,
      calories: kcal!,
      protein: p,
      carbs: c,
      fat: f,
      saveAsCustom: v.saveAsCustom,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
      <Input id="mf-name" label="Food name" value={v.name} onChange={(e) => set("name", e.target.value)} error={errors.name} placeholder="e.g. Homemade chicken pasta" />
      <Input id="mf-brand" label="Brand (optional)" value={v.brand} onChange={(e) => set("brand", e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Input id="mf-size" label="Serving size" type="number" inputMode="decimal" value={v.servingSize} onChange={(e) => set("servingSize", e.target.value)} error={errors.servingSize} />
        <Input id="mf-unit" label="Unit" value={v.servingUnit} onChange={(e) => set("servingUnit", e.target.value)} placeholder="g, ml, cup, serving" />
      </div>
      <p className="-mt-1 text-xs text-mist-500">Enter nutrition for one serving, as shown on the label.</p>
      <div className="grid grid-cols-2 gap-3">
        <Input id="mf-cal" label="Calories" type="number" inputMode="decimal" value={v.calories} onChange={(e) => set("calories", e.target.value)} suffix="kcal" error={errors.calories} hint={kcal == null && estimated > 0 ? `From macros: ~${estimated} kcal` : undefined} />
        <Input id="mf-p" label="Protein" type="number" inputMode="decimal" value={v.protein} onChange={(e) => set("protein", e.target.value)} suffix="g" error={errors.protein} />
        <Input id="mf-c" label="Carbs" type="number" inputMode="decimal" value={v.carbs} onChange={(e) => set("carbs", e.target.value)} suffix="g" error={errors.carbs} />
        <Input id="mf-f" label="Fat" type="number" inputMode="decimal" value={v.fat} onChange={(e) => set("fat", e.target.value)} suffix="g" error={errors.fat} />
      </div>
      {kcal == null && estimated > 0 && (
        <button type="button" className="self-start text-sm font-semibold text-volt-400" onClick={() => set("calories", String(estimated))}>
          Use {estimated} kcal from macros
        </button>
      )}
      {!customOnly && (
        <div className="grid grid-cols-2 gap-3">
          <Input id="mf-qty" label="Servings eaten" type="number" inputMode="decimal" step="0.25" value={v.quantity} onChange={(e) => set("quantity", e.target.value)} error={errors.quantity} />
          <Select id="mf-meal" label="Meal" value={v.meal} onChange={(e) => set("meal", e.target.value)}>
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {MEAL_LABEL[m]}
              </option>
            ))}
          </Select>
        </div>
      )}
      {!customOnly && <Toggle label="Save to My foods" description="Reuse it later from search." checked={v.saveAsCustom} onChange={(x) => set("saveAsCustom", x)} />}
      <Button type="submit" block size="lg">
        {submitLabel}
      </Button>
    </form>
  );
}
