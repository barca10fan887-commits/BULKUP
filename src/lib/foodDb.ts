// Built-in foods so search works offline and instantly. Values are typical
// per-serving figures from public nutrition tables (rounded); brands vary.
export interface FoodItem {
  key: string;
  name: string;
  brand?: string;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  barcode?: string;
  source: "database" | "openfoodfacts" | "custom" | "recent";
}

type Row = [name: string, size: number, unit: string, kcal: number, p: number, c: number, f: number];

const ROWS: Row[] = [
  // Protein
  ["Chicken breast, cooked", 100, "g", 165, 31, 0, 3.6],
  ["Chicken thigh, cooked, skinless", 100, "g", 209, 26, 0, 10.9],
  ["Beef mince 5 star, cooked", 100, "g", 217, 27, 0, 12],
  ["Lean beef steak, cooked", 100, "g", 200, 30, 0, 8.5],
  ["Salmon fillet, cooked", 100, "g", 206, 22, 0, 12.4],
  ["Tuna in springwater, drained", 95, "g", 105, 24, 0, 1],
  ["Pork loin, cooked", 100, "g", 196, 29, 0, 8],
  ["Turkey breast, sliced", 100, "g", 105, 22, 1.5, 1.2],
  ["Egg, large", 1, "egg", 72, 6.3, 0.4, 4.8],
  ["Egg whites", 100, "g", 52, 11, 0.7, 0.2],
  ["Tofu, firm", 100, "g", 144, 15.7, 2.8, 8.7],
  ["Tempeh", 100, "g", 192, 20, 7.6, 10.8],
  // Dairy
  ["Milk, full cream", 250, "ml", 160, 8.5, 12, 8.5],
  ["Milk, skim", 250, "ml", 90, 9, 12.5, 0.3],
  ["Greek yoghurt, plain", 170, "g", 160, 15, 6, 8],
  ["Greek yoghurt, high protein low fat", 170, "g", 105, 17, 7, 0.5],
  ["Cottage cheese", 100, "g", 98, 11, 3.4, 4.3],
  ["Cheddar cheese", 30, "g", 120, 7.5, 0.1, 10],
  ["Mozzarella", 30, "g", 85, 6.3, 0.7, 6.3],
  // Carbs
  ["White rice, cooked", 1, "cup (185 g)", 240, 4.4, 53, 0.4],
  ["Brown rice, cooked", 1, "cup (195 g)", 248, 5.5, 52, 2],
  ["Pasta, cooked", 1, "cup (140 g)", 220, 8, 43, 1.3],
  ["Rolled oats, dry", 50, "g", 190, 6.5, 32, 3.5],
  ["Wholemeal bread", 1, "slice (40 g)", 95, 4.5, 16, 1.2],
  ["White bread", 1, "slice (35 g)", 90, 3, 17, 0.9],
  ["Bagel, plain", 1, "bagel (95 g)", 260, 10, 50, 1.5],
  ["Wrap, white", 1, "wrap (62 g)", 180, 5, 30, 4],
  ["Potato, boiled", 150, "g", 130, 3, 30, 0.2],
  ["Sweet potato, baked", 150, "g", 135, 3, 31, 0.2],
  ["Weet-Bix style wheat biscuits", 2, "biscuits (30 g)", 107, 3.6, 20, 0.4],
  ["Granola / toasted muesli", 60, "g", 270, 6, 38, 10],
  ["Rice cakes", 2, "cakes", 70, 1.5, 15, 0.5],
  // Fruit & veg
  ["Banana, medium", 1, "banana", 105, 1.3, 27, 0.4],
  ["Apple, medium", 1, "apple", 95, 0.5, 25, 0.3],
  ["Blueberries", 100, "g", 57, 0.7, 14, 0.3],
  ["Avocado", 0.5, "avocado (75 g)", 120, 1.5, 6.4, 11],
  ["Broccoli, cooked", 100, "g", 35, 2.4, 7, 0.4],
  ["Mixed salad leaves", 50, "g", 10, 0.8, 1.5, 0.1],
  ["Frozen mixed vegetables", 100, "g", 65, 3, 13, 0.5],
  ["Dates, medjool", 2, "dates", 133, 0.9, 36, 0.1],
  ["Raisins", 40, "g", 120, 1.2, 32, 0.2],
  // Fats & calorie-dense
  ["Peanut butter", 1, "tbsp (20 g)", 120, 5, 3, 10],
  ["Almonds", 30, "g", 175, 6.3, 6, 15],
  ["Mixed nuts", 30, "g", 180, 5.5, 6, 16],
  ["Olive oil", 1, "tbsp (14 ml)", 120, 0, 0, 14],
  ["Butter", 10, "g", 72, 0.1, 0, 8.1],
  ["Honey", 1, "tbsp (21 g)", 64, 0.1, 17, 0],
  ["Dark chocolate 70%", 25, "g", 150, 2, 11, 11],
  // Meals & snacks
  ["Protein bar (typical)", 1, "bar (60 g)", 220, 20, 22, 7],
  ["Beef burrito", 1, "burrito", 650, 30, 75, 24],
  ["Chicken & rice bowl", 1, "bowl", 600, 42, 70, 14],
  ["Spaghetti bolognese", 1, "plate (400 g)", 560, 30, 70, 17],
  ["Cheeseburger", 1, "burger", 300, 15, 33, 12],
  ["Margherita pizza", 2, "slices", 500, 20, 60, 18],
  ["Meat pie", 1, "pie (175 g)", 450, 14, 37, 27],
  ["Sushi roll, chicken", 1, "roll", 280, 11, 48, 4.5],
  ["Hummus", 2, "tbsp (40 g)", 100, 3, 6, 7],
  // Drinks
  ["Orange juice", 250, "ml", 112, 1.7, 26, 0.5],
  ["Flat white, full cream", 1, "regular", 130, 7, 10, 7],
  ["Chocolate milk", 300, "ml", 230, 10, 33, 7],
];

export const BUILTIN_FOODS: FoodItem[] = ROWS.map(([name, servingSize, servingUnit, calories, protein, carbs, fat], i) => ({
  key: `db-${i}`,
  name,
  servingSize,
  servingUnit,
  calories,
  protein,
  carbs,
  fat,
  source: "database",
}));

export function searchBuiltin(query: string, limit = 20): FoodItem[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return BUILTIN_FOODS.filter((f) => terms.every((t) => f.name.toLowerCase().includes(t))).slice(0, limit);
}

/** Scale a food's per-serving macros by a number of servings. */
export function scaleFood(f: Pick<FoodItem, "calories" | "protein" | "carbs" | "fat">, servings: number) {
  const r = (n: number) => Math.round(n * servings * 10) / 10;
  return { calories: Math.round(f.calories * servings), protein: r(f.protein), carbs: r(f.carbs), fat: r(f.fat) };
}
