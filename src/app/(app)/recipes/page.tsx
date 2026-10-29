import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data/queries";
import { loadRecipes } from "@/lib/data/recipes";
import { RecipeLibrary } from "./recipe-library";

export const metadata: Metadata = { title: "Receitas" };

export default async function RecipesPage() {
  const { supabase, user } = await requireUser();
  const [recipes, profile] = await Promise.all([loadRecipes(supabase), getProfile(supabase, user.id)]);
  const cards = recipes.map((r) => ({
    id: r.recipe.id,
    name: r.recipe.name,
    summary: r.recipe.summary,
    meal_types: r.recipe.meal_types,
    prep: r.recipe.prep_minutes,
    cost: r.recipe.cost_level,
    tags: r.recipe.tags,
    goals: r.recipe.goals,
    mine: Boolean(r.recipe.owner_id),
    favorite: r.favorite,
    kcal: r.perServing.kcal,
    protein: r.perServing.protein_g,
    image: r.recipe.image_url,
    art: r.recipe.ingredients.map((i) => ({ grams: Number(i.grams), category: i.food.category, name: i.food.name })),
  }));
  return <RecipeLibrary cards={cards} profile={{ allergies: profile?.allergies ?? [], restrictions: profile?.restrictions ?? [], prefs: profile?.diet_preferences ?? [], goal: profile?.goal ?? "maintain" }} />;
}
