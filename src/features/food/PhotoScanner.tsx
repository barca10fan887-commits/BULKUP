import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Plus, Sparkles, Trash2, AlertTriangle } from "lucide-react";
import type { FoodScanItem } from "@shared/api";
import type { MealType } from "@/lib/types";
import { resizeImage } from "@/lib/image";
import { ApiError, getStatus, scanFood } from "@/lib/api";
import { useProfile } from "@/data/store";
import { Button } from "@/components/ui/Button";
import { Input, Select, num } from "@/components/ui/Field";
import { Disclaimer, Pill } from "@/components/ui/misc";
import { MEALS, MEAL_LABEL } from "./shared";
import type { PickedFood } from "./ServingPicker";
import { MacroPreview } from "./ServingPicker";
import { AiConsent } from "@/components/AiConsent";

interface EditableItem {
  key: number;
  name: string;
  portion: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  confidence: FoodScanItem["confidence"];
}

type Phase = { kind: "idle" } | { kind: "analysing" } | { kind: "review"; notes: string } | { kind: "error"; message: string };

export function PhotoScanner({ meal: initialMeal, onAddMany, onManual }: { meal: MealType; onAddMany(items: PickedFood[]): void; onManual(): void }) {
  const profile = useProfile();
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [preview, setPreview] = useState<string | null>(null);
  const [hint, setHint] = useState("");
  const [items, setItems] = useState<EditableItem[]>([]);
  const [meal, setMeal] = useState(initialMeal);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    getStatus().then((s) => setAiAvailable(s.ai));
    return () => abort.current?.abort();
  }, []);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setPhase({ kind: "error", message: "Choose a photo file." });
    setPreview(URL.createObjectURL(file));
    setPhase({ kind: "analysing" });
    abort.current?.abort();
    abort.current = new AbortController();
    try {
      const img = await resizeImage(file);
      const result = await scanFood(img.base64, img.mediaType, hint.trim() || undefined, abort.current.signal);
      if (!result.is_food || result.items.length === 0) {
        setPhase({ kind: "error", message: result.notes || "No food was recognised in that photo. Try a clearer, top-down photo or add the food manually." });
        return;
      }
      setItems(
        result.items.map((it, i) => ({
          key: i,
          name: it.name,
          portion: it.portion + (it.estimated_grams ? ` (~${Math.round(it.estimated_grams)} g)` : ""),
          calories: String(Math.round(it.calories)),
          protein: String(Math.round(it.protein_g)),
          carbs: String(Math.round(it.carbs_g)),
          fat: String(Math.round(it.fat_g)),
          confidence: it.confidence,
        })),
      );
      setPhase({ kind: "review", notes: result.notes });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setPhase({ kind: "error", message: e instanceof ApiError ? e.message : (e as Error).message || "The scan failed. Try again." });
    }
  }

  const totals = items.reduce(
    (a, it) => ({ calories: a.calories + (num(it.calories) ?? 0), protein: a.protein + (num(it.protein) ?? 0), carbs: a.carbs + (num(it.carbs) ?? 0), fat: a.fat + (num(it.fat) ?? 0) }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const update = (key: number, patch: Partial<EditableItem>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  if (aiAvailable && !profile.privacy.aiDataSharing) return <AiConsent feature="scanner" />;
  if (aiAvailable === false) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-5">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-5 w-5 text-warn" /> Photo scanner unavailable
        </div>
        <p className="text-sm text-mist-400">The photo scanner isn't switched on yet. Use search, barcode or manual entry for now.</p>
        <Button variant="secondary" onClick={onManual}>Add manually instead</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />

      {phase.kind !== "review" && (
        <>
          {preview ? (
            <div className="relative overflow-hidden rounded-2xl border border-ink-700">
              <img src={preview} alt="Your meal" className="max-h-72 w-full object-cover" />
              {phase.kind === "analysing" && (
                <div className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-[2px]">
                  <span className="inline-flex items-center gap-2 rounded-full bg-ink-850/90 px-4 py-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 animate-pulse text-volt-400" /> Estimating nutrition…
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => cameraInput.current?.click()} className="flex flex-col items-center gap-2 rounded-2xl border border-volt-500/40 bg-volt-500/[.08] px-3 py-6 font-semibold text-mist-100 transition hover:bg-volt-500/15">
                <Camera className="h-7 w-7 text-volt-400" /> Take photo
              </button>
              <button onClick={() => fileInput.current?.click()} className="flex flex-col items-center gap-2 rounded-2xl border border-ink-600 bg-ink-900 px-3 py-6 font-semibold text-mist-100 transition hover:border-ink-500">
                <ImagePlus className="h-7 w-7 text-mist-400" /> Upload image
              </button>
            </div>
          )}
          {phase.kind === "idle" && (
            <Input id="ps-hint" label="Add details (optional)" placeholder="e.g. cooked in olive oil, large bowl" value={hint} onChange={(e) => setHint(e.target.value)} maxLength={300} />
          )}
          {phase.kind === "error" && (
            <div className="rounded-2xl border border-bad/30 bg-bad/10 p-4 text-sm">
              <p className="text-bad">{phase.message}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => { setPreview(null); setPhase({ kind: "idle" }); }}>Try another photo</Button>
                <Button size="sm" variant="ghost" onClick={onManual}>Add manually</Button>
              </div>
            </div>
          )}
          <Disclaimer>Photo estimates are approximate. Portion sizes, oils and sauces are hard to judge from a picture, so review and correct the numbers before adding them.</Disclaimer>
        </>
      )}

      {phase.kind === "review" && (
        <>
          <div className="flex items-center gap-3">
            {preview && <img src={preview} alt="" className="h-16 w-16 rounded-xl object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Review the estimate</p>
              <p className="text-xs text-mist-400">Edit anything that looks wrong. These are AI estimates, not measurements.</p>
            </div>
          </div>
          {phase.notes && <p className="rounded-xl bg-ink-900 px-3 py-2 text-xs text-mist-400">{phase.notes}</p>}
          <ul className="flex flex-col gap-3">
            {items.map((it) => (
              <li key={it.key} className="rounded-2xl border border-ink-700 bg-ink-900 p-3">
                <div className="flex items-start gap-2">
                  <Input id={`ps-name-${it.key}`} className="flex-1" aria-label="Food name" value={it.name} onChange={(e) => update(it.key, { name: e.target.value })} />
                  <Button size="icon" variant="ghost" aria-label={`Remove ${it.name}`} onClick={() => setItems((xs) => xs.filter((x) => x.key !== it.key))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Input id={`ps-portion-${it.key}`} className="flex-1" aria-label="Portion" value={it.portion} onChange={(e) => update(it.key, { portion: e.target.value })} />
                  <Pill tone={it.confidence === "high" ? "good" : it.confidence === "medium" ? "volt" : "warn"}>{it.confidence} confidence</Pill>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  <Input id={`ps-cal-${it.key}`} label="kcal" type="number" inputMode="numeric" value={it.calories} onChange={(e) => update(it.key, { calories: e.target.value })} />
                  <Input id={`ps-p-${it.key}`} label="P (g)" type="number" inputMode="numeric" value={it.protein} onChange={(e) => update(it.key, { protein: e.target.value })} />
                  <Input id={`ps-c-${it.key}`} label="C (g)" type="number" inputMode="numeric" value={it.carbs} onChange={(e) => update(it.key, { carbs: e.target.value })} />
                  <Input id={`ps-f-${it.key}`} label="F (g)" type="number" inputMode="numeric" value={it.fat} onChange={(e) => update(it.key, { fat: e.target.value })} />
                </div>
              </li>
            ))}
          </ul>
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setItems((xs) => [...xs, { key: Date.now(), name: "", portion: "", calories: "0", protein: "0", carbs: "0", fat: "0", confidence: "high" }])}
          >
            <Plus className="h-4 w-4" /> Add item
          </Button>
          <MacroPreview {...totals} />
          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <Select id="ps-meal" label="Meal" value={meal} onChange={(e) => setMeal(e.target.value as MealType)}>
              {MEALS.map((m) => (
                <option key={m} value={m}>{MEAL_LABEL[m]}</option>
              ))}
            </Select>
            <Button variant="secondary" onClick={() => { setPreview(null); setItems([]); setPhase({ kind: "idle" }); }}>Retake</Button>
          </div>
          <Button
            size="lg"
            block
            disabled={!items.length || items.some((i) => !i.name.trim())}
            onClick={() =>
              onAddMany(
                items.map((it) => ({
                  meal,
                  name: it.name.trim(),
                  servingLabel: it.portion || "1 portion",
                  quantity: 1,
                  calories: Math.max(0, num(it.calories) ?? 0),
                  protein: Math.max(0, num(it.protein) ?? 0),
                  carbs: Math.max(0, num(it.carbs) ?? 0),
                  fat: Math.max(0, num(it.fat) ?? 0),
                })),
              )
            }
          >
            Confirm and add {items.length} item{items.length === 1 ? "" : "s"}
          </Button>
        </>
      )}
    </div>
  );
}
