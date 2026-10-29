import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { loadRecipe } from "@/lib/data/diary-core";
import { getMealTypes } from "@/lib/data/queries";
import { allMeals } from "@/lib/nutrition/meals";
import { todayISO } from "@/lib/dates";
import { RecipeDetail } from "./recipe-detail";

export const metadata: Metadata = { title: "Receita" };

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireUser();
  const [recipe, mealTypes, fav] = await Promise.all([loadRecipe(supabase, id), getMealTypes(supabase), supabase.from("favorite_recipes").select("recipe_id").eq("recipe_id", id).maybeSingle()]);
  if (!recipe) notFound();
  return <RecipeDetail recipe={recipe} meals={allMeals(mealTypes)} today={todayISO()} favorite={Boolean(fav.data)} />;
}
