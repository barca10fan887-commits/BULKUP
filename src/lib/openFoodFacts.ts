// Open Food Facts lookups. OFF is a free community database, so results can be
// missing or incomplete; every function returns null/[] rather than throwing on gaps.
import type { FoodItem } from "./foodDb";

export interface OffNutriments {
  "energy-kcal_100g"?: number;
  "energy-kcal_serving"?: number;
  energy_100g?: number; // kJ
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
}

export interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: OffNutriments;
  image_front_small_url?: string;
}

export interface ParsedProduct {
  barcode: string;
  name: string;
  brand?: string;
  per100: { calories: number; protein: number; carbs: number; fat: number };
  servingGrams: number | null;
  servingLabel: string | null;
  imageUrl?: string;
}

const FIELDS = "code,product_name,product_name_en,brands,serving_size,serving_quantity,nutriments,image_front_small_url";

export class OffError extends Error {}

export function parseOffProduct(p: OffProduct | undefined, fallbackCode = ""): ParsedProduct | null {
  if (!p) return null;
  const n = p.nutriments ?? {};
  const kcal = n["energy-kcal_100g"] ?? (n.energy_100g != null ? n.energy_100g / 4.184 : undefined);
  const name = (p.product_name || p.product_name_en || "").trim();
  if (kcal == null || !name) return null;
  const sq = typeof p.serving_quantity === "string" ? parseFloat(p.serving_quantity) : p.serving_quantity;
  return {
    barcode: p.code || fallbackCode,
    name,
    brand: p.brands?.split(",")[0]?.trim() || undefined,
    per100: {
      calories: Math.round(kcal),
      protein: round1(n.proteins_100g ?? 0),
      carbs: round1(n.carbohydrates_100g ?? 0),
      fat: round1(n.fat_100g ?? 0),
    },
    servingGrams: sq && sq > 0 ? sq : null,
    servingLabel: p.serving_size?.trim() || null,
    imageUrl: p.image_front_small_url,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new OffError("Couldn't reach Open Food Facts. Check your connection and try again.");
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new OffError(`Open Food Facts returned an error (${res.status}). Try again shortly.`);
  return res.json();
}

export async function lookupBarcode(baseUrl: string, code: string, signal?: AbortSignal): Promise<ParsedProduct | null> {
  const clean = code.replace(/\D/g, "");
  if (clean.length < 6) throw new OffError("That barcode looks too short. Check the digits and try again.");
  const data = (await getJson(`${baseUrl}/api/v2/product/${clean}.json?fields=${FIELDS}`, signal)) as
    | { status?: number; product?: OffProduct }
    | null;
  if (!data || data.status === 0) return null;
  return parseOffProduct(data.product, clean);
}

export async function searchProducts(baseUrl: string, query: string, signal?: AbortSignal): Promise<FoodItem[]> {
  const q = encodeURIComponent(query.trim());
  if (!q) return [];
  const data = (await getJson(
    `${baseUrl}/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=24&fields=${FIELDS}`,
    signal,
  )) as { products?: OffProduct[] } | null;
  return (data?.products ?? [])
    .map((p) => parseOffProduct(p))
    .filter((p): p is ParsedProduct => !!p)
    .map(productToFoodItem);
}

/** Represent an OFF product as a food with a 100 g serving (or its labelled serving). */
export function productToFoodItem(p: ParsedProduct): FoodItem {
  const size = p.servingGrams ?? 100;
  const f = size / 100;
  return {
    key: `off-${p.barcode}`,
    name: p.name,
    brand: p.brand,
    servingSize: size,
    servingUnit: "g",
    calories: Math.round(p.per100.calories * f),
    protein: round1(p.per100.protein * f),
    carbs: round1(p.per100.carbs * f),
    fat: round1(p.per100.fat * f),
    barcode: p.barcode,
    source: "openfoodfacts",
  };
}
