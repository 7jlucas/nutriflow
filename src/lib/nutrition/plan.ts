import { recipeNutrition, sumNutrients, type IngredientLike, type Nutrients } from "./calc";
import { DEFAULT_MEALS, SLOT_SHARE, slotsForMealsPerDay, type DefaultSlot } from "./meals";

const SLOT_LABEL = Object.fromEntries(DEFAULT_MEALS.map((m) => [m.slot, m.label.toLowerCase()])) as Record<DefaultSlot, string>;
import type { BudgetLevel, GoalKind } from "../types";

/** Restrições declaradas → tags que a receita precisa ter. */
const RESTRICTION_TAG: Record<string, string> = {
  lactose: "sem-lactose",
  leite: "sem-lactose",
  gluten: "sem-gluten",
  "glúten": "sem-gluten",
  ovo: "sem-ovo",
  peixe: "sem-peixe",
  "frutos do mar": "sem-peixe",
  castanhas: "sem-castanhas",
  amendoim: "sem-castanhas",
  soja: "sem-soja",
  vegetariano: "vegetariano",
  vegano: "vegano",
};

export const RESTRICTION_OPTIONS = [
  { value: "lactose", label: "Lactose" },
  { value: "gluten", label: "Glúten" },
  { value: "ovo", label: "Ovo" },
  { value: "peixe", label: "Peixes e frutos do mar" },
  { value: "castanhas", label: "Castanhas e amendoim" },
  { value: "soja", label: "Soja" },
];
export const PREFERENCE_OPTIONS = [
  { value: "vegetariano", label: "Vegetariano" },
  { value: "vegano", label: "Vegano" },
  { value: "alto-proteina", label: "Mais proteína" },
];

export function requiredTags(allergies: string[], restrictions: string[], preferences: string[]): string[] {
  const tags = new Set<string>();
  for (const v of [...allergies, ...restrictions]) {
    const t = RESTRICTION_TAG[v.toLowerCase().trim()];
    if (t) tags.add(t);
  }
  for (const p of preferences) {
    if (p === "vegano") tags.add("vegano");
    if (p === "vegetariano") tags.add("vegetariano");
  }
  return [...tags];
}

export interface PlanRecipe {
  id: string;
  name: string;
  meal_types: string[];
  tags: string[];
  goals: GoalKind[];
  cost_level: number | null;
  servings: number;
  ingredients: (IngredientLike & { id: string; food_id: string })[];
}

export interface PlannedMeal {
  day_index: number;
  meal_slot: DefaultSlot;
  recipe_id: string;
  servings: number;
  nutrients: Nutrients;
}

export interface PlanInput {
  recipes: PlanRecipe[];
  targetKcal: number;
  mealsPerDay: number;
  days: number;
  goal: GoalKind;
  requiredTags: string[];
  budget?: BudgetLevel | null;
  seed?: string;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function matchesTags(recipe: Pick<PlanRecipe, "tags">, required: string[]) {
  return required.every((t) => recipe.tags.includes(t) || (t === "vegetariano" && recipe.tags.includes("vegano")));
}

/** Ajusta porções (0,5 a 2, passos de 0,25) para aproximar a meta da refeição. */
export function fitServings(kcalPerServing: number, slotTarget: number) {
  if (kcalPerServing <= 0) return 1;
  const raw = slotTarget / kcalPerServing;
  return Math.min(2, Math.max(0.5, Math.round(raw * 4) / 4));
}

/**
 * Gerador DETERMINÍSTICO de cardápio (sem IA): escolhe receitas compatíveis com
 * refeição/restrições/orçamento, gira para variar entre dias e ajusta porções.
 * Totais calculados a partir dos ingredientes (TACO), nunca estimados por texto.
 */
export function generatePlan(input: PlanInput): { meals: PlannedMeal[]; warnings: string[] } {
  const warnings: string[] = [];
  const compatible = (slot: DefaultSlot) => input.recipes.some((r) => r.meal_types.includes(slot) && matchesTags(r, input.requiredTags));
  const wanted = slotsForMealsPerDay(input.mealsPerDay);
  const slots = wanted.filter(compatible);
  for (const s of wanted) if (!slots.includes(s)) warnings.push(`Sem receitas compatíveis com suas restrições para ${SLOT_LABEL[s]}; a energia foi redistribuída entre as outras refeições.`);
  // a fração de cada refeição é normalizada entre as refeições efetivamente planejadas
  const shareSum = slots.reduce((a, s) => a + SLOT_SHARE[s], 0) || 1;
  const meals: PlannedMeal[] = [];
  const base = hash(input.seed ?? "nutriflow");
  const usedByDay: Set<string>[] = [];

  for (let d = 0; d < input.days; d++) {
    usedByDay[d] = new Set();
    for (const slot of slots) {
      let pool = input.recipes.filter((r) => r.meal_types.includes(slot) && matchesTags(r, input.requiredTags));
      if (input.budget === "low") {
        const cheap = pool.filter((r) => (r.cost_level ?? 2) <= 1);
        if (cheap.length) pool = cheap;
      }
      const goalPool = pool.filter((r) => r.goals.includes(input.goal));
      if (goalPool.length) pool = goalPool;
      if (!pool.length) continue;
      // evita repetir a mesma receita no mesmo dia e a do dia anterior no mesmo slot
      const prev = meals.find((m) => m.day_index === d - 1 && m.meal_slot === slot)?.recipe_id;
      const candidates = pool.filter((r) => !usedByDay[d].has(r.id) && r.id !== prev);
      const list = candidates.length ? candidates : pool;
      const pick = list[(base + d * 7 + slots.indexOf(slot) * 13) % list.length];
      usedByDay[d].add(pick.id);

      const per = recipeNutrition(pick.ingredients, pick.servings).perServing;
      const slotTarget = (input.targetKcal * SLOT_SHARE[slot]) / shareSum;
      const servings = fitServings(per.kcal, slotTarget);
      meals.push({
        day_index: d,
        meal_slot: slot,
        recipe_id: pick.id,
        servings,
        nutrients: recipeNutrition(pick.ingredients, pick.servings, { scale: servings }).perServing,
      });
    }
  }
  return { meals, warnings };
}

export function dayTotals(meals: Pick<PlannedMeal, "day_index" | "nutrients">[], day: number) {
  return sumNutrients(meals.filter((m) => m.day_index === day).map((m) => m.nutrients));
}

export interface ShoppingLine {
  food_id: string;
  name: string;
  grams: number;
  category: string | null;
}

/** Lista de compras: soma das gramas por alimento em todo o plano. */
export function shoppingList(
  items: { servings: number | null; grams: number | null; food_id: string | null; excluded: string[]; recipe: PlanRecipe | null }[],
  foodsMeta: Map<string, { name: string; category: string | null }>,
): ShoppingLine[] {
  const acc = new Map<string, number>();
  for (const it of items) {
    if (it.recipe && it.servings) {
      const factor = it.servings / it.recipe.servings;
      for (const ing of it.recipe.ingredients) {
        if (it.excluded.includes(ing.id)) continue;
        acc.set(ing.food_id, (acc.get(ing.food_id) ?? 0) + ing.grams * factor);
      }
    } else if (it.food_id && it.grams) {
      acc.set(it.food_id, (acc.get(it.food_id) ?? 0) + it.grams);
    }
  }
  return [...acc.entries()]
    .map(([food_id, grams]) => ({
      food_id,
      grams: Math.round(grams),
      name: foodsMeta.get(food_id)?.name ?? "Alimento",
      category: foodsMeta.get(food_id)?.category ?? null,
    }))
    .sort((a, b) => (a.category ?? "").localeCompare(b.category ?? "") || a.name.localeCompare(b.name));
}
