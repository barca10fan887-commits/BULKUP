export const round = (n: number, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

export const kcal = (n: number) => `${Math.round(n).toLocaleString()} kcal`;
export const grams = (n: number) => `${Math.round(n)} g`;
export const kg = (n: number, dp = 1) => `${round(n, dp).toFixed(dp)} kg`;
export const ml = (n: number) => (n >= 1000 ? `${round(n / 1000, 2)} L` : `${Math.round(n)} ml`);
export const signed = (n: number, dp = 1) => `${n > 0 ? "+" : ""}${round(n, dp).toFixed(dp)}`;
export const pct = (n: number) => `${Math.round(n)}%`;
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
