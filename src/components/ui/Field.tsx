import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

const control =
  "w-full rounded-xl border border-ink-600 bg-ink-900 px-3.5 py-2.5 text-[16px] text-mist-100 placeholder:text-mist-500 transition focus:border-volt-500 focus:outline-none focus:ring-2 focus:ring-volt-500/30 disabled:opacity-60";

interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  suffix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(function Input(
  { label, hint, error, suffix, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const fid = id ?? autoId;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={fid} className="text-[13px] font-medium text-mist-300">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={fid}
          aria-invalid={!!error}
          aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined}
          className={cn(control, suffix ? "pr-12" : "", error && "border-bad focus:border-bad focus:ring-bad/30")}
          {...rest}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-mist-500">{suffix}</span>}
      </div>
      {error ? (
        <p id={`${fid}-err`} className="text-xs text-bad">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fid}-hint`} className="text-xs text-mist-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export function Select({ label, hint, className, id, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & FieldProps) {
  const autoId = useId();
  const fid = id ?? autoId;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={fid} className="text-[13px] font-medium text-mist-300">
          {label}
        </label>
      )}
      <select id={fid} className={cn(control, "appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9")} style={{ backgroundImage: CHEVRON }} {...rest}>
        {children}
      </select>
      {hint && <p className="text-xs text-mist-500">{hint}</p>}
    </div>
  );
}

const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238b95a8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;

export function Textarea({ label, className, id, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps) {
  const autoId = useId();
  const fid = id ?? autoId;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={fid} className="text-[13px] font-medium text-mist-300">
          {label}
        </label>
      )}
      <textarea id={fid} className={cn(control, "min-h-[88px] resize-y")} {...rest} />
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, id }: { checked: boolean; onChange(v: boolean): void; label: ReactNode; description?: ReactNode; id?: string }) {
  const autoId = useId();
  const fid = id ?? autoId;
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <label htmlFor={fid} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-[15px] text-mist-100">{label}</span>
        {description && <span className="block text-xs text-mist-400">{description}</span>}
      </label>
      <button
        id={fid}
        role="switch"
        type="button"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative h-7 w-12 shrink-0 rounded-full transition", checked ? "bg-volt-500" : "bg-ink-600")}
      >
        <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}

/** Parses an input value to a number or undefined. */
export const num = (v: string): number | undefined => {
  if (v.trim() === "") return undefined;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
};
