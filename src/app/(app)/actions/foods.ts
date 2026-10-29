"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { customFoodSchema, fieldErrors } from "@/lib/validation";
import { recipeNutrition } from "@/lib/nutrition/calc";
import type { Food, FoodPortion, RecipeWithIngredients } from "@/lib/types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; errors?: Record<string, string> };

/** Cria um alimento personalizado (rótulo ou dados próprios). Campos ausentes ficam ausentes. */
export async function createCustomFood(input: unknown): Promise<Result<{ food: Food; portion: FoodPortion | null }>> {
  const parsed = customFoodSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os campos destacados.", errors: fieldErrors(parsed.error) };
  const { supabase, user } = await requireUser();
  const d = parsed.data;
  const flags: Record<string, string> = {};
  for (const k of ["protein_g", "carbs_g", "fat_g", "fiber_g"] as const) if (d[k] === null) flags[k] = "missing";
  const { data: food, error } = await supabase
    .from("foods")
    .insert({
      owner_id: user.id,
      name: d.name,
      brand: d.brand || null,
      category: d.source === "LABEL" ? "Rótulo" : "Personalizado",
      source: "USER",
      source_ref: d.source === "LABEL" ? "rotulo" : null,
      verified: false,
      ref_amount: d.ref_amount,
      ref_unit: d.ref_unit,
      kcal: d.kcal,
      protein_g: d.protein_g,
      carbs_g: d.carbs_g,
      fat_g: d.fat_g,
      fiber_g: d.fiber_g,
      sodium_mg: d.sodium_mg,
      nutrient_flags: flags,
    })
    .select("*")
    .single();
  if (error || !food) return { ok: false, error: "Não foi possível salvar o alimento." };
  let portion: FoodPortion | null = null;
  if (d.serving_label && d.serving_amount) {
    const { data: p } = await supabase
      .from("food_portions")
      .insert({ food_id: food.id, owner_id: user.id, label: d.serving_label, amount: d.serving_amount, amount_unit: d.ref_unit, source: "user" })
      .select("*")
      .single();
    portion = (p as FoodPortion) ?? null;
  }
  revalidatePath("/foods");
  return { ok: true, data: { food: food as Food, portion } };
}

export async function deleteCustomFood(id: string): Promise<Result<{ id: string }>> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Inválido." };
  const { supabase } = await requireUser();
  const { error, count } = await supabase.from("foods").delete({ count: "exact" }).eq("id", id);
  if (error) {
    return { ok: false, error: error.code === "23503" ? "Este alimento é usado em uma receita. Remova-o da receita antes." : "Não foi possível excluir." };
  }
  if (!count) return { ok: false, error: "Alimento não encontrado ou não é seu." };
  revalidatePath("/foods");
  return { ok: true, data: { id } };
}

export interface RecipeLite {
  id: string;
  name: string;
  servings: number;
  meal_types: string[];
  kcal: number;
  protein_g: number;
  gramsPerServing: number;
  incomplete: boolean;
  owner_id: string | null;
}

export async function listRecipesLite(): Promise<RecipeLite[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("recipes")
    .select("*, ingredients:recipe_ingredients(id, food_id, grams, position, food:foods(*))")
    .order("name");
  return ((data ?? []) as unknown as RecipeWithIngredients[]).map((r) => {
    const n = recipeNutrition(r.ingredients.map((i) => ({ id: i.id, grams: Number(i.grams), food: i.food })), Number(r.servings));
    return {
      id: r.id,
      name: r.name,
      servings: Number(r.servings),
      meal_types: r.meal_types,
      kcal: n.perServing.kcal,
      protein_g: n.perServing.protein_g,
      gramsPerServing: n.gramsPerServing,
      incomplete: n.incomplete,
      owner_id: r.owner_id,
    };
  });
}

export async function listFoodsByCategory(category: string): Promise<Food[]> {
  const c = category.slice(0, 80);
  const { supabase } = await requireUser();
  const { data } = await supabase.from("foods").select("*").eq("category", c).order("name").limit(150);
  return (data ?? []) as Food[];
}
