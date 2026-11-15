// Curated content for the built-in coach (no AI service needed).
// Nutrition values are typical estimates per serving.

export interface Recipe {
  name: string;
  meal: "breakfast" | "lunch" | "dinner" | "snack";
  kcal: number;
  protein: number;
  vegetarian: boolean;
  vegan: boolean;
  ingredients: string[];
  steps: string;
}

export const RECIPES: Recipe[] = [
  { name: "Protein oats", meal: "breakfast", kcal: 520, protein: 38, vegetarian: true, vegan: false, ingredients: ["60 g oats", "250 ml milk", "1 scoop protein powder (or 170 g Greek yoghurt)", "1 banana", "1 tbsp peanut butter"], steps: "Cook the oats in the milk for 2-3 minutes, stir in the protein, top with sliced banana and peanut butter." },
  { name: "Egg and cheese breakfast wrap", meal: "breakfast", kcal: 480, protein: 32, vegetarian: true, vegan: false, ingredients: ["3 eggs", "1 wrap", "30 g cheese", "Spinach", "Salsa"], steps: "Scramble the eggs with spinach, fill the wrap with eggs, cheese and salsa, toast in a pan for a minute." },
  { name: "Greek yoghurt power bowl", meal: "breakfast", kcal: 420, protein: 35, vegetarian: true, vegan: false, ingredients: ["250 g high-protein Greek yoghurt", "40 g granola", "Handful of berries", "1 tsp honey"], steps: "Layer the yoghurt, granola and berries, drizzle with honey." },
  { name: "Tofu scramble on toast", meal: "breakfast", kcal: 450, protein: 28, vegetarian: true, vegan: true, ingredients: ["200 g firm tofu", "2 slices wholemeal bread", "Spinach", "Turmeric, salt, pepper", "1 tsp olive oil"], steps: "Crumble the tofu into a hot oiled pan with turmeric and spinach, cook 5 minutes, serve on toast." },
  { name: "Chicken burrito bowl", meal: "lunch", kcal: 650, protein: 48, vegetarian: false, vegan: false, ingredients: ["150 g chicken breast", "1 cup cooked rice", "1/2 cup black beans", "Salsa, lettuce, 30 g cheese"], steps: "Season and pan-fry the chicken, slice, and pile onto rice with beans, salsa, lettuce and cheese." },
  { name: "Tuna pasta salad", meal: "lunch", kcal: 560, protein: 42, vegetarian: false, vegan: false, ingredients: ["1 tin tuna (95 g)", "1.5 cups cooked pasta", "Sweetcorn, cherry tomatoes", "1 tbsp light mayo or Greek yoghurt"], steps: "Mix everything together. Keeps in the fridge for 2-3 days, so make a few at once." },
  { name: "Lentil and chickpea curry", meal: "dinner", kcal: 580, protein: 26, vegetarian: true, vegan: true, ingredients: ["1/2 cup red lentils", "1/2 tin chickpeas", "1/2 tin coconut milk (light)", "Curry paste, onion, spinach", "1 cup cooked rice"], steps: "Fry onion and curry paste, add lentils, chickpeas, coconut milk and a cup of water, simmer 20 minutes, stir in spinach, serve with rice." },
  { name: "Beef mince stir-fry", meal: "dinner", kcal: 640, protein: 45, vegetarian: false, vegan: false, ingredients: ["150 g lean beef mince", "Frozen stir-fry vegetables", "Soy sauce, garlic, ginger", "1 cup cooked rice or noodles"], steps: "Brown the mince, add vegetables and sauces, cook 5 minutes, serve over rice." },
  { name: "Salmon, potato and greens tray bake", meal: "dinner", kcal: 600, protein: 38, vegetarian: false, vegan: false, ingredients: ["150 g salmon fillet", "250 g baby potatoes", "Broccoli or green beans", "1 tsp olive oil, lemon"], steps: "Roast halved potatoes at 200°C for 20 minutes, add salmon and greens, roast 12-15 minutes more." },
  { name: "Chicken and veg pasta", meal: "dinner", kcal: 700, protein: 50, vegetarian: false, vegan: false, ingredients: ["150 g chicken breast", "100 g dry pasta", "Passata, garlic, mixed vegetables", "Parmesan"], steps: "Cook the pasta, pan-fry diced chicken and vegetables, add passata and garlic, toss through the pasta, top with parmesan." },
  { name: "Mass-gain smoothie", meal: "snack", kcal: 750, protein: 45, vegetarian: true, vegan: false, ingredients: ["400 ml full cream milk", "1 scoop protein powder", "1 banana", "40 g oats", "1 tbsp peanut butter"], steps: "Blend everything. An easy way to add calories when you're not hungry." },
  { name: "Cottage cheese and fruit", meal: "snack", kcal: 230, protein: 25, vegetarian: true, vegan: false, ingredients: ["200 g cottage cheese", "Pineapple or berries"], steps: "Top the cottage cheese with fruit. High protein, low calorie, which suits a cut." },
  { name: "Edamame and hummus plate", meal: "snack", kcal: 320, protein: 20, vegetarian: true, vegan: true, ingredients: ["1 cup shelled edamame", "2 tbsp hummus", "Carrot and cucumber sticks"], steps: "Microwave the edamame, serve with hummus and veg sticks." },
  { name: "Turkey and cheese rice cakes", meal: "snack", kcal: 260, protein: 24, vegetarian: false, vegan: false, ingredients: ["3 rice cakes", "80 g sliced turkey", "1 slice cheese", "Tomato"], steps: "Stack the turkey, cheese and tomato on the rice cakes." },
];

export const FORM_TIPS: Record<string, string[]> = {
  bench: ["Feet flat, shoulder blades pulled back and down, slight arch.", "Lower the bar to mid-chest with elbows about 45-70° from your body.", "Press up and slightly back towards your face. Keep your bum on the bench.", "Use a spotter or safety bars when going heavy."],
  squat: ["Feet about shoulder width, toes slightly out.", "Brace your core like you're about to be poked in the stomach, then sit down between your hips.", "Knees track over your toes; go as deep as you can while keeping a neutral back.", "Drive up through the whole foot."],
  deadlift: ["Bar over mid-foot, shins close to the bar.", "Hinge at the hips, grip just outside your legs, chest up, back flat.", "Push the floor away and keep the bar dragging up your legs.", "Lock out by squeezing your glutes, don't lean back."],
  "shoulder press": ["Stand tall, squeeze glutes and brace to avoid arching your lower back.", "Bar or dumbbells start at shoulder height, wrists stacked over elbows.", "Press straight up, moving your head back slightly to clear the bar, then through at the top."],
  row: ["Hinge so your torso is about 45° (or use a bench for support).", "Pull your elbows back towards your hips, not your shoulders.", "Pause and squeeze your shoulder blades together, lower with control."],
  "pull-up": ["Start from a dead hang with shoulders pulled down away from your ears.", "Pull your elbows down to your sides until your chin clears the bar.", "Lower all the way with control. Use bands or negatives if you can't do full reps yet."],
  "push-up": ["Hands just wider than shoulders, body in a straight line from head to heels.", "Lower your chest to just above the floor with elbows angled back, not flared.", "Push the floor away. Elevate your hands on a bench to make it easier."],
};

export const SUPPLEMENT_INFO: Record<string, string> = {
  creatine: "**Creatine monohydrate** is the best-researched supplement for strength and muscle. 3-5 g a day, any time of day, every day. A loading phase isn't needed. It can add a little water weight at first, which is normal.",
  protein: "**Protein powder** is just convenient food. Use it if it helps you hit your protein target; it isn't magic. Whey is fast and cheap; plant blends work well if you're dairy-free or vegan.",
  gainer: "**Mass gainers** are mostly carbs plus some protein. They help if you struggle to eat enough, but a homemade smoothie (milk, oats, banana, peanut butter, protein) is usually cheaper and better.",
  "pre-workout": "**Pre-workout** is mostly caffeine. It can help energy, but avoid it within about 6-8 hours of bed and don't rely on it every session.",
  "fish oil": "**Fish oil (omega-3)** is fine for general health if you rarely eat oily fish, but it won't noticeably build muscle.",
  "vitamin d": "**Vitamin D** may help if you get little sun, especially in winter. A blood test from your doctor tells you if you actually need it.",
  bcaa: "**BCAAs** aren't worth buying if you're already eating enough protein. Spend the money on food.",
};
