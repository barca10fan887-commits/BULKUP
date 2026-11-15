import { useMemo, useState } from "react";
import type { FoodItem } from "@/lib/foodDb";
import { scaleFood } from "@/lib/foodDb";
import type { MealType } from "@/lib/types";
import { Input, Select, num } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/misc";
import { MEALS, MEAL_LABEL, fmt1 } from "./shared";

export interface PickedFood {
  meal: MealType;
  name: string;
  brand?: string;
  servingLabel: string;
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  barcode?: string;
}

const isMass = (unit: string) => /^(g|ml)$/i.test(unit.trim());

export function ServingPicker({ food, meal: initialMeal, onAdd, onBack, submitLabel = "Add to diary" }: { food: FoodItem; meal: MealType; onAdd(p: PickedFood): void; onBack?(): void; submitLabel?: string }) {
  const massUnit = isMass(food.servingUnit);
  const [mode, setMode] = useState<"servings" | "amount">(massUnit && food.servingSize !== 1 ? "amount" : "servings");
  const [servings, setServings] = useState("1");
  const [amount, setAmount] = useState(String(food.servingSize));
  const [meal, setMeal] = useState<MealType>(initialMeal);

  const factor = mode === "servings" ? num(servings) ?? 0 : (num(amount) ?? 0) / (food.servingSize || 1);
  const macros = useMemo(() => scaleFood(food, factor), [food, factor]);
  const label =
    mode === "servings"
      ? `${fmt1(num(servings) ?? 0)} x ${food.servingSize} ${food.servingUnit}`
      : `${fmt1(num(amount) ?? 0)} ${food.servingUnit}`;
  const valid = factor > 0 && factor < 100;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-display text-lg font-semibold leading-snug">{food.name}</p>
        <p className="text-sm text-mist-400">
          {food.brand ? `${food.brand} · ` : ""}
          {food.calories} kcal per {food.servingSize} {food.servingUnit}
        </p>
      </div>
      {massUnit && (
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "amount", label: `Amount (${food.servingUnit})` },
            { value: "servings", label: "Servings" },
          ]}
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        {mode === "servings" ? (
          <Input id="sp-servings" label="Servings" type="number" inputMode="decimal" step="0.25" min="0" value={servings} onChange={(e) => setServings(e.target.value)} error={valid ? null : "Enter an amount above 0."} />
        ) : (
          <Input id="sp-amount" label="Amount" type="number" inputMode="decimal" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} suffix={food.servingUnit} error={valid ? null : "Enter an amount above 0."} />
        )}
        <Select id="sp-meal" label="Meal" value={meal} onChange={(e) => setMeal(e.target.value as MealType)}>
          {MEALS.map((m) => (
            <option key={m} value={m}>
              {MEAL_LABEL[m]}
            </option>
          ))}
        </Select>
      </div>
      <MacroPreview {...macros} />
      <div className="flex gap-2">
        {onBack && (
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
        )}
        <Button
          block
          disabled={!valid}
          onClick={() => onAdd({ meal, name: food.name, brand: food.brand, servingLabel: label, quantity: factor, barcode: food.barcode, ...macros })}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

export function MacroPreview({ calories, protein, carbs, fat }: { calories: number; protein: number; carbs: number; fat: number }) {
  const cells = [
    { k: "kcal", v: Math.round(calories) },
    { k: "protein", v: `${fmt1(protein)}g` },
    { k: "carbs", v: `${fmt1(carbs)}g` },
    { k: "fat", v: `${fmt1(fat)}g` },
  ];
  return (
    <div className="grid grid-cols-4 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
      {cells.map((c, i) => (
        <div key={c.k} className={`px-2 py-3 text-center ${i ? "border-l border-ink-700" : ""}`}>
          <p className={`font-display text-lg font-semibold tabular-nums ${i === 0 ? "text-volt-300" : "text-mist-100"}`}>{c.v}</p>
          <p className="text-[11px] uppercase tracking-wide text-mist-500">{c.k}</p>
        </div>
      ))}
    </div>
  );
}
