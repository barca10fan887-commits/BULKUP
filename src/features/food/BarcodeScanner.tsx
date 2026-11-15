import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, CameraOff, Keyboard, SearchX } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
import { lookupBarcode, productToFoodItem, OffError, type ParsedProduct } from "@/lib/openFoodFacts";
import { config } from "@/lib/config";
import type { MealType } from "@/lib/types";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/misc";
import { ServingPicker, type PickedFood } from "./ServingPicker";
import { useStore } from "@/data/store";

type State = { kind: "scan" } | { kind: "looking"; code: string } | { kind: "found"; product: ParsedProduct } | { kind: "missing"; code: string } | { kind: "error"; message: string; code?: string };

interface DetectorLike {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

export function BarcodeScanner({ meal, onAdd, onManual }: { meal: MealType; onAdd(p: PickedFood): void; onManual(barcode: string): void }) {
  const [state, setState] = useState<State>({ kind: "scan" });
  const [manual, setManual] = useState("");
  const { data } = useStore();

  async function lookup(code: string) {
    setState({ kind: "looking", code });
    // Check the user's own foods first.
    const own = data.customFoods.find((f) => f.barcode === code);
    if (own) {
      setState({
        kind: "found",
        product: { barcode: code, name: own.name, brand: own.brand, per100: { calories: (own.calories / own.servingSize) * 100, protein: (own.protein / own.servingSize) * 100, carbs: (own.carbs / own.servingSize) * 100, fat: (own.fat / own.servingSize) * 100 }, servingGrams: own.servingSize, servingLabel: null },
      });
      return;
    }
    try {
      const product = await lookupBarcode(config.offBaseUrl, code);
      setState(product ? { kind: "found", product } : { kind: "missing", code });
    } catch (e) {
      setState({ kind: "error", message: e instanceof OffError ? e.message : "Lookup failed. Try again.", code });
    }
  }

  function submitManual(e: FormEvent) {
    e.preventDefault();
    const code = manual.replace(/\D/g, "");
    if (code.length < 6) return setState({ kind: "error", message: "Enter the full number printed under the barcode." });
    lookup(code);
  }

  if (state.kind === "found") {
    const food = productToFoodItem(state.product);
    return (
      <div className="flex flex-col gap-3">
        {state.product.servingLabel && <p className="text-xs text-mist-500">Label serving: {state.product.servingLabel}</p>}
        <ServingPicker food={food} meal={meal} onAdd={onAdd} onBack={() => setState({ kind: "scan" })} />
        <p className="text-xs text-mist-500">Nutrition from Open Food Facts, a community database. Check it against the pack if something looks off.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {state.kind === "scan" && <CameraView onDetected={lookup} />}
      {state.kind === "looking" && <Spinner label={`Looking up ${state.code}`} />}
      {state.kind === "missing" && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-ink-700 bg-ink-900 p-5 text-center">
          <SearchX className="h-6 w-6 text-mist-400" />
          <p className="font-semibold">Product not found</p>
          <p className="text-sm text-mist-400">Barcode {state.code} isn't in Open Food Facts yet. Add it manually from the label and it'll be saved to My foods.</p>
          <div className="mt-2 flex gap-2">
            <Button variant="secondary" onClick={() => setState({ kind: "scan" })}>Scan again</Button>
            <Button onClick={() => onManual(state.code)}>Enter manually</Button>
          </div>
        </div>
      )}
      {state.kind === "error" && (
        <div className="rounded-2xl border border-bad/30 bg-bad/10 p-4 text-sm">
          <p className="text-bad">{state.message}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setState({ kind: "scan" })}>Scan again</Button>
            {state.code && <Button size="sm" onClick={() => lookup(state.code!)}>Retry</Button>}
          </div>
        </div>
      )}
      <form onSubmit={submitManual} className="flex items-end gap-2">
        <Input id="bc-manual" className="flex-1" label={<span className="inline-flex items-center gap-1.5"><Keyboard className="h-3.5 w-3.5" /> Type the barcode number</span>} inputMode="numeric" autoComplete="off" placeholder="e.g. 9300633603263" value={manual} onChange={(e) => setManual(e.target.value)} />
        <Button type="submit" variant="secondary" className="mb-px">Look up</Button>
      </form>
    </div>
  );
}

function CameraView({ onDetected }: { onDetected(code: string): void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const detected = useRef(false);
  const callback = useRef(onDetected);
  callback.current = onDetected;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let controls: IScannerControls | null = null;
    let raf = 0;
    let cancelled = false;
    const done = (code: string) => {
      if (detected.current) return;
      detected.current = true;
      navigator.vibrate?.(60);
      callback.current(code);
    };

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError("Camera scanning needs a secure (https) connection. Type the barcode number below instead.");
        return;
      }
      const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => DetectorLike }).BarcodeDetector;
      try {
        if (Detector) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
          if (cancelled) return;
          const v = video.current!;
          v.srcObject = stream;
          await v.play();
          setActive(true);
          const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
          const tick = async () => {
            if (cancelled || detected.current) return;
            try {
              const codes = await detector.detect(v);
              if (codes[0]?.rawValue) return done(codes[0].rawValue);
            } catch {
              /* frame not ready */
            }
            raf = requestAnimationFrame(tick);
          };
          tick();
        } else {
          // iOS Safari and others: ZXing decoder.
          const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128]);
          const reader = new BrowserMultiFormatReader(hints);
          controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } }, audio: false }, video.current!, (result) => {
            if (result) done(result.getText());
          });
          if (cancelled) controls.stop();
          else setActive(true);
        }
      } catch (e) {
        const name = (e as Error).name;
        setError(
          name === "NotAllowedError"
            ? "Camera access was blocked. Allow camera access for this app in your browser settings, or type the barcode below."
            : name === "NotFoundError"
              ? "No camera was found on this device. Type the barcode number below."
              : "Couldn't start the camera. Type the barcode number below.",
        );
      }
    }
    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      controls?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (error)
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-4 text-sm text-mist-300">
        <CameraOff className="mt-0.5 h-5 w-5 shrink-0 text-mist-500" />
        {error}
      </div>
    );

  return (
    <div className="relative aspect-[4/3] max-w-full overflow-hidden rounded-2xl border border-ink-700 bg-black">
      <video ref={video} className="h-full w-full object-cover" playsInline muted aria-label="Camera preview" />
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="relative h-[38%] w-[78%] rounded-2xl border-2 border-volt-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,.45)]">
          <span className="absolute inset-x-4 top-1/2 h-0.5 animate-pulse bg-volt-400 shadow-[0_0_12px_#4d95ff]" />
        </div>
      </div>
      {!active && (
        <div className="absolute inset-0 grid place-items-center text-sm text-mist-300">
          <span className="inline-flex items-center gap-2"><Camera className="h-4 w-4" /> Starting camera…</span>
        </div>
      )}
      <p className="absolute inset-x-0 bottom-3 text-center text-xs font-medium text-white/80">Line the barcode up inside the frame</p>
    </div>
  );
}
