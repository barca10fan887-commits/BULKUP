import { describe, expect, it } from "vitest";
import { parseOffProduct, productToFoodItem } from "./openFoodFacts";

describe("Open Food Facts parsing", () => {
  it("parses per-100g nutrition and serving", () => {
    const p = parseOffProduct({ code: "123", product_name: "Greek Yoghurt", brands: "Acme, Other", serving_quantity: "170", nutriments: { "energy-kcal_100g": 97, proteins_100g: 9, carbohydrates_100g: 3.9, fat_100g: 5 } });
    expect(p).not.toBeNull();
    expect(p!.brand).toBe("Acme");
    expect(p!.servingGrams).toBe(170);
    const f = productToFoodItem(p!);
    expect(f.calories).toBe(165);
    expect(f.protein).toBeCloseTo(15.3);
  });
  it("converts kJ when kcal is missing", () => {
    const p = parseOffProduct({ product_name: "Bar", nutriments: { energy_100g: 1674 } }, "999");
    expect(p!.per100.calories).toBe(400);
    expect(p!.barcode).toBe("999");
  });
  it("rejects products without nutrition or name", () => {
    expect(parseOffProduct({ product_name: "Mystery" })).toBeNull();
    expect(parseOffProduct({ nutriments: { "energy-kcal_100g": 100 } })).toBeNull();
  });
});
