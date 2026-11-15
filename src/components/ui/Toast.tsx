import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "./cn";

type Tone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  tone: Tone;
  message: string;
  action?: { label: string; onClick(): void };
}

interface ToastApi {
  show(t: Omit<ToastItem, "id" | "tone"> & { tone?: Tone }): void;
}

const ToastContext = createContext<ToastApi>({ show: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const api = useMemo<ToastApi>(
    () => ({
      show(t) {
        const id = Date.now() + Math.random();
        setItems((xs) => [...xs.slice(-2), { tone: "success", ...t, id }]);
        setTimeout(() => dismiss(id), t.action ? 6000 : 3500);
      },
    }),
    [dismiss],
  );
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 92px)" }}
      >
        {items.map((t) => {
          const Icon = t.tone === "error" ? AlertTriangle : t.tone === "info" ? Info : CheckCircle2;
          return (
            <div
              key={t.id}
              role={t.tone === "error" ? "alert" : "status"}
              className="pointer-events-auto flex w-full max-w-md animate-rise items-center gap-3 rounded-2xl border border-ink-600 bg-ink-800/95 px-4 py-3 text-sm shadow-card backdrop-blur"
            >
              <Icon className={cn("h-5 w-5 shrink-0", t.tone === "error" ? "text-bad" : t.tone === "info" ? "text-volt-400" : "text-good")} aria-hidden />
              <span className="flex-1 text-mist-100">{t.message}</span>
              {t.action && (
                <button
                  className="font-semibold text-volt-400 hover:text-volt-300"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button aria-label="Dismiss" className="text-mist-500 hover:text-mist-100" onClick={() => dismiss(t.id)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
