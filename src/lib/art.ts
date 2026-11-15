// Illustrations bundled in public/art (Microsoft Fluent Emoji 3D, MIT).
export const ART = [
  "bowl", "burrito", "egg", "pancakes", "bagel", "bread", "salad", "curry", "noodles", "spaghetti", "fish", "steak", "taco",
  "stew", "rice", "drink", "cheese", "peas", "ricecracker", "sandwich", "falafel", "peanuts", "apple", "strawberry", "chicken",
  "potato", "broccoli", "banana", "milk", "lifter", "muscle", "water", "scale", "pill", "chart", "fire",
] as const;
export type ArtName = (typeof ART)[number];

export const artUrl = (name: ArtName) => `${import.meta.env.BASE_URL}art/${name}.webp`;

// Checked in order: the first match wins, so more specific dishes come first.
const FOOD_RULES: [RegExp, ArtName][] = [
  [/pancake/, "pancakes"],
  [/bagel/, "bagel"],
  [/fried rice/, "rice"],
  [/rice cake/, "ricecracker"],
  [/smoothie|shake|juice|coffee|flat white|latte|gainer/, "drink"],
  [/soup|chill?i|stew/, "stew"],
  [/curry|dahl|dal\b/, "curry"],
  [/burrito|wrap/, "burrito"],
  [/fajita|taco/, "taco"],
  [/sandwich|\bsub\b|toastie/, "sandwich"],
  [/falafel|hummus/, "falafel"],
  [/edamame|\bpeas?\b/, "peas"],
  [/oat|porridge|granola|power bowl|muesli|weet|cereal/, "bowl"],
  [/omelette|scramble|\beggs?\b/, "egg"],
  [/toast|bread|crumpet/, "bread"],
  [/tuna|salmon|fish|prawn|sushi/, "fish"],
  [/pasta|spaghetti|meatball|bolognese|lasagne|macaroni/, "spaghetti"],
  [/noodle|stir-?fry|teriyaki|ramen/, "noodles"],
  [/steak|beef|mince|lamb/, "steak"],
  [/cottage|cheese/, "cheese"],
  [/\bnuts?\b|trail|peanut|almond|cashew/, "peanuts"],
  [/berr|yoghurt|yogurt/, "strawberry"],
  [/apple/, "apple"],
  [/banana/, "banana"],
  [/milk/, "milk"],
  [/chicken|turkey|pork|ham\b/, "chicken"],
  [/potato|chips|fries/, "potato"],
  [/broccoli/, "broccoli"],
  [/salad|veg|lettuce|spinach|avocado/, "salad"],
  [/rice/, "rice"],
  [/creatine|supplement|pre-?workout|vitamin/, "pill"],
];

export function foodArt(name: string): ArtName {
  const s = name.toLowerCase();
  for (const [re, art] of FOOD_RULES) if (re.test(s)) return art;
  return "bowl";
}
