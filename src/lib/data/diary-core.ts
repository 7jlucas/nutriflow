import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nutrientsFor, recipeNutrition, canLog } from "../nutrition/calc";
import { toBaseAmount, UNIT_LABEL } from "../nutrition/units";
import type { EntryUnit, Food, FoodPortion, RecipeWithIngredients } from "../types";

export type ComputeResult =
  | {
      ok: true;
      row: {
        food_id: string | null;
        recipe_id: string | null;
        portion_id: string | null;
        name: string;
        brand: string | null;
        quantity: number;
        unit: EntryUnit;
        unit_label: string | null;
        base_amount: number;
        kcal: number;
        protein_g: number | null;
        carbs_g: number | null;
        fat_g: number | null;
        fiber_g: number | null;
        source: Food["source"] | null;
        is_estimate: boolean;
        incomplete: boolean;
      };
    }
  | { ok: false; error: string };

export async function loadRecipe(sb: SupabaseClient, id: string): Promise<RecipeWithIngredients | null> {
  const { data } = await sb
    .from("recipes")
    .select("*, ingredients:recipe_ingredients(id, recipe_id, food_id, grams, display_quantity, position, food:foods(*))")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const r = data as unknown as RecipeWithIngredients;
  r.ingredients.sort((a, b) => a.position - b.position);
  return r;
}

/**
 * Cálculo AUTORITATIVO no servidor: lê o alimento/receita do banco (com RLS) e
 * calcula o snapshot nutricional. O cliente nunca envia valores de calorias.
 */
export async function computeEntry(
  sb: SupabaseClient,
  input: { food_id?: string | null; recipe_id?: string | null; portion_id?: string | null; quantity: number; unit: EntryUnit },
): Promise<ComputeResult> {
  if (input.recipe_id) {
    if (input.unit !== "serving") return { ok: false, error: "Receitas são registradas em porções." };
    const recipe = await loadRecipe(sb, input.recipe_id);
    if (!recipe) return { ok: false, error: "Receita não encontrada." };
    const n = recipeNutrition(
      recipe.ingredients.map((i) => ({ id: i.id, grams: Number(i.grams), food: i.food })),
      Number(recipe.servings),
      { scale: input.quantity },
    );
    return {
      ok: true,
      row: {
        food_id: null,
        recipe_id: recipe.id,
        portion_id: null,
        name: recipe.name,
        brand: null,
        quantity: input.quantity,
        unit: "serving",
        unit_label: input.quantity === 1 ? "porção" : "porções",
        base_amount: Math.max(0.01, n.gramsPerServing),
        kcal: n.perServing.kcal,
        protein_g: n.perServing.protein_g,
        carbs_g: n.perServing.carbs_g,
        fat_g: n.perServing.fat_g,
        fiber_g: n.perServing.fiber_g,
        source: null,
        is_estimate: false,
        incomplete: n.incomplete,
      },
    };
  }

  if (!input.food_id) return { ok: false, error: "Selecione um alimento." };
  const { data: food } = await sb.from("foods").select("*").eq("id", input.food_id).maybeSingle();
  if (!food) return { ok: false, error: "Alimento não encontrado." };
  const f = food as Food;
  if (!canLog(f)) {
    return {
      ok: false,
      error: "Este alimento não tem valor energético confiável na fonte (amostra em reavaliação). Escolha outro ou cadastre os dados do rótulo.",
    };
  }
  let portion: FoodPortion | null = null;
  if (input.unit === "portion") {
    if (!input.portion_id) return { ok: false, error: "Selecione a medida caseira." };
    const { data: p } = await sb.from("food_portions").select("*").eq("id", input.portion_id).eq("food_id", f.id).maybeSingle();
    if (!p) return { ok: false, error: "Medida caseira não encontrada para este alimento." };
    portion = p as FoodPortion;
  }
  const conv = toBaseAmount(input.quantity, input.unit, f, portion);
  if (!conv.ok) return { ok: false, error: conv.reason };
  const n = nutrientsFor(f, conv.baseAmount);
  return {
    ok: true,
    row: {
      food_id: f.id,
      recipe_id: null,
      portion_id: portion?.id ?? null,
      name: f.name,
      brand: f.brand,
      quantity: input.quantity,
      unit: input.unit,
      unit_label: portion ? portion.label : UNIT_LABEL[input.unit],
      base_amount: conv.baseAmount,
      kcal: n.kcal ?? 0,
      protein_g: n.protein_g,
      carbs_g: n.carbs_g,
      fat_g: n.fat_g,
      fiber_g: n.fiber_g,
      source: f.source,
      is_estimate: conv.isEstimate,
      incomplete: n.incomplete,
    },
  };
}
