export function Logo({ small }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" aria-label="BULKUP">
      <LogoMark className={small ? "h-7 w-7" : "h-9 w-9"} />
      <span className={`font-display font-extrabold tracking-[.12em] text-mist-100 ${small ? "text-base" : "text-lg"}`}>
        BULK<span className="text-volt-400">UP</span>
      </span>
    </div>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="#0f1217" />
      <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" fill="none" stroke="#1f75ff" strokeOpacity=".5" />
      <path d="M14 40 L26 28 L34 34 L48 18" fill="none" stroke="#1f75ff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M40 18 H48 V26" fill="none" stroke="#1f75ff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="12" y="45" width="40" height="5" rx="2.5" fill="#eef2f8" />
    </svg>
  );
}
