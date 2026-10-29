import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import { getProfile, getTargetFor } from "@/lib/data/queries";
import { loadRecipes } from "@/lib/data/recipes";
import { todayISO } from "@/lib/dates";
import type { MealPlan, MealPlanItem } from "@/lib/types";
import { PlanView } from "./plan-view";

export const metadata: Metadata = { title: "Plano alimentar" };

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await requireUser();
  const today = todayISO();
  const [profile, target, recipes, plans] = await Promise.all([
    getProfile(supabase, user.id),
    getTargetFor(supabase, today),
    loadRecipes(supabase),
    supabase.from("meal_plans").select("*").order("is_favorite", { ascending: false }).order("created_at", { ascending: false }).limit(30),
  ]);
  const list = (plans.data ?? []) as MealPlan[];
  const current = list.find((p) => p.id === sp.id) ?? list[0] ?? null;
  const { data: items } = current ? await supabase.from("meal_plan_items").select("*").eq("plan_id", current.id).order("day_index").order("suggested_time").order("position") : { data: [] };
  return (
    <PlanView
      key={current?.id ?? "none"}
      today={today}
      plans={list}
      plan={current}
      items={(items ?? []) as MealPlanItem[]}
      recipes={recipes.map((r) => ({ ...r.recipe, ingredients: r.recipe.ingredients }))}
      target={target}
      mealsPerDay={profile?.meals_per_day ?? 4}
    />
  );
}
