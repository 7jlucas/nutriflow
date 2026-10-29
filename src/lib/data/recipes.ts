import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recipeNutrition } from "../nutrition/calc";
import type { RecipeWithIngredients } from "../types";

export async function loadRecipes(sb: SupabaseClient) {
  const [{ data }, { data: favs }] = await Promise.all([
    sb.from("recipes").select("*, ingredients:recipe_ingredients(id, recipe_id, food_id, grams, display_quantity, position, food:foods(*))").order("name"),
    sb.from("favorite_recipes").select("recipe_id"),
  ]);
  const fav = new Set(((favs ?? []) as { recipe_id: string }[]).map((f) => f.recipe_id));
  return ((data ?? []) as unknown as RecipeWithIngredients[]).map((r) => {
    r.ingredients.sort((a, b) => a.position - b.position);
    const n = recipeNutrition(r.ingredients.map((i) => ({ id: i.id, grams: Number(i.grams), food: i.food })), Number(r.servings));
    return { recipe: r, perServing: n.perServing, gramsPerServing: n.gramsPerServing, incomplete: n.incomplete, favorite: fav.has(r.id) };
  });
}
export type LoadedRecipe = Awaited<ReturnType<typeof loadRecipes>>[number];
