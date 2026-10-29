import type { Food, NutrientKey } from "../types";

export interface Nutrients {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export interface NutrientResult {
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  /** algum macronutriente principal sem dado na fonte */
  incomplete: boolean;
}

export const ZERO: Nutrients = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
export const NUTRIENT_KEYS: NutrientKey[] = ["kcal", "protein_g", "carbs_g", "fat_g", "fiber_g"];

/** arredonda para 1 casa sem acumular erro binário */
export const r1 = (n: number) => Math.round((n + Number.EPSILON) * 10) / 10;

/**
 * Valor da porção = valor da referência × quantidade consumida ÷ quantidade de referência.
 * Ex.: 150 kcal/100 g, 200 g → 300 kcal.
 */
export function scaleNutrient(refValue: number, consumed: number, refAmount: number): number {
  if (refAmount <= 0) throw new Error("Quantidade de referência inválida");
  return (refValue * consumed) / refAmount;
}

/** Calcula os nutrientes de um alimento para uma quantidade na unidade de referência. */
export function nutrientsFor(
  food: Pick<Food, NutrientKey | "ref_amount">,
  baseAmount: number,
): NutrientResult {
  const calc = (k: NutrientKey) => {
    const v = food[k];
    return v === null || v === undefined ? null : r1(scaleNutrient(Number(v), baseAmount, Number(food.ref_amount)));
  };
  const out = {
    kcal: calc("kcal"),
    protein_g: calc("protein_g"),
    carbs_g: calc("carbs_g"),
    fat_g: calc("fat_g"),
    fiber_g: calc("fiber_g"),
  };
  return {
    ...out,
    incomplete: out.protein_g === null || out.carbs_g === null || out.fat_g === null,
  };
}

/** Um alimento só pode ser registrado se tem energia conhecida. */
export function canLog(food: Pick<Food, "kcal">): boolean {
  return food.kcal !== null && food.kcal !== undefined;
}

type Summable = Partial<Record<NutrientKey, number | null>>;

/** Soma itens tratando ausentes como 0, arredondando só no final. */
export function sumNutrients(items: Summable[]): Nutrients {
  const acc = { ...ZERO };
  for (const it of items) {
    for (const k of NUTRIENT_KEYS) acc[k] += Number(it[k] ?? 0);
  }
  return { kcal: r1(acc.kcal), protein_g: r1(acc.protein_g), carbs_g: r1(acc.carbs_g), fat_g: r1(acc.fat_g), fiber_g: r1(acc.fiber_g) };
}

/** Agrupa entradas por refeição e devolve totais por refeição + total do dia. */
export function totalsByMeal<T extends Summable & { meal_slot: string }>(entries: T[]) {
  const map = new Map<string, T[]>();
  for (const e of entries) {
    const list = map.get(e.meal_slot) ?? [];
    list.push(e);
    map.set(e.meal_slot, list);
  }
  const meals: Record<string, Nutrients> = {};
  for (const [slot, list] of map) meals[slot] = sumNutrients(list);
  return { meals, day: sumNutrients(entries) };
}

/** Energia dos macros (Atwater 4/4/9), usado para distribuição percentual. */
export function macroEnergySplit(n: Pick<Nutrients, "protein_g" | "carbs_g" | "fat_g">) {
  const p = n.protein_g * 4;
  const c = n.carbs_g * 4;
  const f = n.fat_g * 9;
  const total = p + c + f;
  if (total <= 0) return { protein: 0, carbs: 0, fat: 0 };
  return { protein: p / total, carbs: c / total, fat: f / total };
}

export interface IngredientLike {
  grams: number;
  food: Pick<Food, NutrientKey | "ref_amount" | "ref_unit" | "density_g_per_ml">;
  id?: string;
}

/**
 * Nutrição de receita: soma dos ingredientes (no estado listado) ÷ rendimento.
 * Ingredientes excluídos (substituições/remoções) não entram.
 */
export function recipeNutrition(
  ingredients: IngredientLike[],
  servings: number,
  opts: { excludeIds?: string[]; scale?: number } = {},
) {
  const exclude = new Set(opts.excludeIds ?? []);
  let incomplete = false;
  const parts = ingredients
    .filter((i) => !(i.id && exclude.has(i.id)))
    .map((i) => {
      // ingredientes são sempre em gramas; se o alimento for por ml, usa densidade
      let base = i.grams;
      if (i.food.ref_unit === "ml") {
        if (!i.food.density_g_per_ml) {
          incomplete = true;
          return ZERO;
        }
        base = i.grams / Number(i.food.density_g_per_ml);
      }
      const n = nutrientsFor(i.food, base);
      if (n.incomplete || n.kcal === null) incomplete = true;
      return n;
    });
  const total = sumNutrients(parts);
  const s = servings > 0 ? servings : 1;
  const scale = opts.scale ?? 1;
  const perServing: Nutrients = {
    kcal: r1((total.kcal / s) * scale),
    protein_g: r1((total.protein_g / s) * scale),
    carbs_g: r1((total.carbs_g / s) * scale),
    fat_g: r1((total.fat_g / s) * scale),
    fiber_g: r1((total.fiber_g / s) * scale),
  };
  const totalGrams = ingredients.filter((i) => !(i.id && exclude.has(i.id))).reduce((a, i) => a + i.grams, 0);
  return { total, perServing, incomplete, gramsPerServing: r1((totalGrams / s) * scale) };
}

export function pct(value: number, target: number): number {
  if (!target || target <= 0) return 0;
  return Math.max(0, (value / target) * 100);
}
