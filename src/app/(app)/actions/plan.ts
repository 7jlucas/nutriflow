"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { loadRecipes } from "@/lib/data/recipes";
import { getProfile, getTargetFor } from "@/lib/data/queries";
import { fitServings, generatePlan, matchesTags, requiredTags, type PlanRecipe } from "@/lib/nutrition/plan";
import { DEFAULT_MEALS, SLOT_SHARE, slotsForMealsPerDay, type DefaultSlot } from "@/lib/nutrition/meals";
import { recipeNutrition } from "@/lib/nutrition/calc";
import { addDays, nowTime, todayISO } from "@/lib/dates";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function toPlanRecipes(loaded: Awaited<ReturnType<typeof loadRecipes>>): PlanRecipe[] {
  return loaded.map(({ recipe }) => ({
    id: recipe.id,
    name: recipe.name,
    meal_types: recipe.meal_types,
    tags: recipe.tags,
    goals: recipe.goals,
    cost_level: recipe.cost_level,
    servings: Number(recipe.servings),
    ingredients: recipe.ingredients.map((i) => ({ id: i.id, food_id: i.food_id, grams: Number(i.grams), food: i.food })),
  }));
}

const genSchema = z.object({ days: z.union([z.literal(1), z.literal(7)]), start_date: z.iso.date(), target_kcal: z.number().int().min(1000).max(5000).optional() });

/** Gera um plano com o gerador determinístico (sem IA). Totais sempre calculados pelos ingredientes. */
export async function generatePlanAction(input: z.input<typeof genSchema>): Promise<Result<{ id: string; warnings: string[] }>> {
  const p = genSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Parâmetros inválidos." };
  const { supabase, user } = await requireUser();
  const [profile, target, loaded] = await Promise.all([getProfile(supabase, user.id), getTargetFor(supabase, todayISO()), loadRecipes(supabase)]);
  if (!profile) return { ok: false, error: "Perfil não encontrado." };
  const kcal = p.data.target_kcal ?? target?.kcal;
  if (!kcal) return { ok: false, error: "Defina uma meta calórica (no perfil) ou informe uma meta para o plano." };
  const recipes = toPlanRecipes(loaded);
  const tags = requiredTags(profile.allergies, profile.restrictions, profile.diet_preferences);
  const plan = generatePlan({ recipes, targetKcal: kcal, mealsPerDay: profile.meals_per_day, days: p.data.days, goal: profile.goal, requiredTags: tags, budget: profile.budget, seed: `${user.id}-${p.data.start_date}-${Date.now() % 997}` });
  if (!plan.meals.length) return { ok: false, error: "Nenhuma receita compatível com suas restrições. Crie receitas próprias ou ajuste as restrições." };

  const { data: mp, error } = await supabase
    .from("meal_plans")
    .insert({ user_id: user.id, name: p.data.days === 7 ? "Plano semanal" : "Cardápio do dia", start_date: p.data.start_date, days: p.data.days, target_kcal: kcal, origin: "generator" })
    .select("id")
    .single();
  if (error || !mp) return { ok: false, error: "Não foi possível salvar o plano." };
  const timeOf = (s: string) => DEFAULT_MEALS.find((m) => m.slot === s)?.time ?? null;
  const { error: e2 } = await supabase.from("meal_plan_items").insert(
    plan.meals.map((m, i) => ({ plan_id: mp.id, user_id: user.id, day_index: m.day_index, meal_slot: m.meal_slot, suggested_time: timeOf(m.meal_slot), recipe_id: m.recipe_id, servings: m.servings, position: i })),
  );
  if (e2) return { ok: false, error: "Não foi possível salvar os itens do plano." };
  revalidatePath("/plan");
  return { ok: true, data: { id: mp.id, warnings: [...new Set(plan.warnings)] } };
}

async function loadItem(itemId: string) {
  if (!z.uuid().safeParse(itemId).success) return null;
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("meal_plan_items").select("*, plan:meal_plans(*)").eq("id", itemId).maybeSingle();
  return data ? { supabase, user, item: data as Record<string, unknown> & { id: string; plan_id: string; recipe_id: string | null; meal_slot: string; day_index: number; servings: number | null; excluded_ingredient_ids: string[]; plan: { target_kcal: number | null; start_date: string } } } : null;
}

/** Troca a receita de uma refeição por outra compatível e reajusta a porção. */
export async function swapPlanItem(itemId: string, recipeId?: string): Promise<Result<null>> {
  const ctx = await loadItem(itemId);
  if (!ctx) return { ok: false, error: "Item não encontrado." };
  const { supabase, user, item } = ctx;
  const [profile, loaded, { data: siblings }] = await Promise.all([
    getProfile(supabase, user.id),
    loadRecipes(supabase),
    supabase.from("meal_plan_items").select("recipe_id, meal_slot").eq("plan_id", item.plan_id).eq("day_index", item.day_index),
  ]);
  const recipes = toPlanRecipes(loaded);
  const tags = requiredTags(profile?.allergies ?? [], profile?.restrictions ?? [], profile?.diet_preferences ?? []);
  let pick: PlanRecipe | undefined;
  if (recipeId) pick = recipes.find((r) => r.id === recipeId);
  else {
    const used = new Set(((siblings ?? []) as { recipe_id: string }[]).map((s) => s.recipe_id));
    const pool = recipes.filter((r) => r.meal_types.includes(item.meal_slot) && matchesTags(r, tags) && r.id !== item.recipe_id);
    const fresh = pool.filter((r) => !used.has(r.id));
    const list = fresh.length ? fresh : pool;
    if (!list.length) return { ok: false, error: "Não há outra receita compatível para esta refeição." };
    const curIdx = recipes.findIndex((r) => r.id === item.recipe_id);
    pick = list[(curIdx + 1 + list.length) % list.length];
  }
  if (!pick) return { ok: false, error: "Receita não encontrada." };
  const kcal = item.plan.target_kcal;
  const slots = slotsForMealsPerDay(profile?.meals_per_day ?? 4);
  const share = (SLOT_SHARE[item.meal_slot as DefaultSlot] ?? 0.25) / slots.reduce((a, s) => a + SLOT_SHARE[s], 0);
  const per = recipeNutrition(pick.ingredients, pick.servings).perServing.kcal;
  const servings = kcal ? fitServings(per, kcal * share) : 1;
  const { error } = await supabase.from("meal_plan_items").update({ recipe_id: pick.id, servings, excluded_ingredient_ids: [], done_at: null }).eq("id", itemId);
  if (error) return { ok: false, error: "Não foi possível trocar." };
  revalidatePath("/plan");
  return { ok: true, data: null };
}

export async function updatePlanItem(itemId: string, patch: { servings?: number; excluded_ingredient_ids?: string[] }): Promise<Result<null>> {
  const p = z.object({ servings: z.number().min(0.25).max(4).optional(), excluded_ingredient_ids: z.array(z.uuid()).max(40).optional() }).safeParse(patch);
  if (!p.success) return { ok: false, error: "Valores inválidos." };
  const ctx = await loadItem(itemId);
  if (!ctx) return { ok: false, error: "Item não encontrado." };
  const { error } = await ctx.supabase.from("meal_plan_items").update(p.data).eq("id", itemId);
  if (error) return { ok: false, error: "Não foi possível atualizar." };
  revalidatePath("/plan");
  return { ok: true, data: null };
}

/** Marca como realizada e registra no diário (o diário recebe o CONSUMO; o plano continua planejado). */
export async function logPlanItem(itemId: string, opts: { log: boolean }): Promise<Result<{ entryId: string | null }>> {
  const ctx = await loadItem(itemId);
  if (!ctx) return { ok: false, error: "Item não encontrado." };
  const { supabase, user, item } = ctx;
  let entryId: string | null = null;
  if (opts.log && item.recipe_id) {
    const { data: rec } = await supabase.from("recipes").select("*, ingredients:recipe_ingredients(id, grams, food:foods(*))").eq("id", item.recipe_id).maybeSingle();
    if (!rec) return { ok: false, error: "Receita não encontrada." };
    const r = rec as unknown as { id: string; name: string; servings: number; ingredients: { id: string; grams: number; food: import("@/lib/types").Food }[] };
    const servings = Number(item.servings ?? 1);
    const n = recipeNutrition(r.ingredients.map((i) => ({ id: i.id, grams: Number(i.grams), food: i.food })), Number(r.servings), { excludeIds: item.excluded_ingredient_ids, scale: servings });
    const removed = r.ingredients.filter((i) => item.excluded_ingredient_ids.includes(i.id)).map((i) => i.food.name.split(",")[0].toLowerCase());
    const date = addDays(item.plan.start_date, item.day_index);
    const { data: e, error } = await supabase
      .from("diary_entries")
      .insert({
        user_id: user.id, entry_date: date > todayISO() ? todayISO() : date, meal_slot: item.meal_slot, logged_time: nowTime(),
        recipe_id: r.id, name: removed.length ? `${r.name} (sem ${removed.join(", ")})` : r.name, quantity: servings, unit: "serving",
        unit_label: servings === 1 ? "porção" : "porções", base_amount: Math.max(0.01, n.gramsPerServing), kcal: n.perServing.kcal,
        protein_g: n.perServing.protein_g, carbs_g: n.perServing.carbs_g, fat_g: n.perServing.fat_g, fiber_g: n.perServing.fiber_g,
        incomplete: n.incomplete, plan_item_id: item.id,
      })
      .select("id")
      .single();
    if (error || !e) return { ok: false, error: "Não foi possível registrar no diário." };
    entryId = e.id;
  }
  const { error } = await supabase.from("meal_plan_items").update({ done_at: new Date().toISOString(), diary_entry_id: entryId }).eq("id", itemId);
  if (error) return { ok: false, error: "Não foi possível marcar como realizada." };
  revalidatePath("/plan");
  revalidatePath("/dashboard");
  return { ok: true, data: { entryId } };
}

export async function undoPlanItemDone(itemId: string): Promise<Result<null>> {
  const ctx = await loadItem(itemId);
  if (!ctx) return { ok: false, error: "Item não encontrado." };
  // o registro no diário é consumo real: não é apagado automaticamente
  await ctx.supabase.from("meal_plan_items").update({ done_at: null, diary_entry_id: null }).eq("id", itemId);
  revalidatePath("/plan");
  return { ok: true, data: null };
}

export async function updatePlan(planId: string, patch: { name?: string; is_favorite?: boolean }): Promise<Result<null>> {
  const p = z.object({ name: z.string().trim().min(1).max(80).optional(), is_favorite: z.boolean().optional() }).safeParse(patch);
  if (!p.success || !z.uuid().safeParse(planId).success) return { ok: false, error: "Valores inválidos." };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("meal_plans").update(p.data).eq("id", planId);
  if (error) return { ok: false, error: "Não foi possível salvar." };
  revalidatePath("/plan");
  return { ok: true, data: null };
}

export async function deletePlan(planId: string): Promise<Result<null>> {
  if (!z.uuid().safeParse(planId).success) return { ok: false, error: "Inválido." };
  const { supabase } = await requireUser();
  await supabase.from("meal_plans").delete().eq("id", planId);
  revalidatePath("/plan");
  return { ok: true, data: null };
}

/** Salva um plano montado pela IA (lista de receitas por refeição), totais recalculados no app. */
export async function savePlanFromSuggestion(input: { name: string; start_date: string; items: { day_index: number; meal_slot: string; recipe_id: string; servings: number }[] }): Promise<Result<{ id: string }>> {
  const p = z.object({
    name: z.string().trim().min(1).max(80), start_date: z.iso.date(),
    items: z.array(z.object({ day_index: z.number().int().min(0).max(13), meal_slot: z.string().min(1).max(60), recipe_id: z.uuid(), servings: z.number().min(0.25).max(4) })).min(1).max(60),
  }).safeParse(input);
  if (!p.success) return { ok: false, error: "Plano inválido." };
  const { supabase, user } = await requireUser();
  const target = await getTargetFor(supabase, todayISO());
  const days = Math.max(...p.data.items.map((i) => i.day_index)) + 1;
  const { data: mp, error } = await supabase.from("meal_plans").insert({ user_id: user.id, name: p.data.name, start_date: p.data.start_date, days, target_kcal: target?.kcal ?? null, origin: "ai" }).select("id").single();
  if (error || !mp) return { ok: false, error: "Não foi possível salvar o plano." };
  const timeOf = (s: string) => DEFAULT_MEALS.find((m) => m.slot === s)?.time ?? null;
  const { error: e2 } = await supabase.from("meal_plan_items").insert(p.data.items.map((i, idx) => ({ ...i, plan_id: mp.id, user_id: user.id, suggested_time: timeOf(i.meal_slot), position: idx })));
  if (e2) return { ok: false, error: "Alguma receita sugerida não está disponível." };
  revalidatePath("/plan");
  return { ok: true, data: { id: mp.id } };
}
