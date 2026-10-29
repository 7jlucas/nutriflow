"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function toggleFavoriteRecipe(recipeId: string): Promise<Result<{ favorite: boolean }>> {
  if (!z.uuid().safeParse(recipeId).success) return { ok: false, error: "Receita inválida." };
  const { supabase, user } = await requireUser();
  const { data: ex } = await supabase.from("favorite_recipes").select("recipe_id").eq("recipe_id", recipeId).maybeSingle();
  if (ex) {
    await supabase.from("favorite_recipes").delete().eq("recipe_id", recipeId).eq("user_id", user.id);
    revalidatePath("/recipes");
    return { ok: true, data: { favorite: false } };
  }
  const { error } = await supabase.from("favorite_recipes").insert({ user_id: user.id, recipe_id: recipeId });
  if (error) return { ok: false, error: "Não foi possível favoritar." };
  revalidatePath("/recipes");
  return { ok: true, data: { favorite: true } };
}

const recipeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  summary: z.string().trim().max(240).optional().nullable(),
  servings: z.number().min(0.5).max(50),
  prep_minutes: z.number().int().min(0).max(600).nullable(),
  cost_level: z.number().int().min(1).max(3).nullable(),
  meal_types: z.array(z.enum(["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner", "supper"])).max(6),
  tags: z.array(z.string().max(30)).max(12),
  steps: z.array(z.string().trim().min(1).max(600)).max(30),
  basis_note: z.string().trim().max(300).optional().nullable(),
  ingredients: z.array(z.object({ food_id: z.uuid(), grams: z.number().positive().max(10000), display_quantity: z.string().max(60).optional().nullable() })).min(1, { error: "Adicione pelo menos um ingrediente." }).max(40),
});

export async function createRecipe(input: z.input<typeof recipeSchema>): Promise<Result<{ id: string }>> {
  const p = recipeSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Revise a receita." };
  const { supabase, user } = await requireUser();
  const { ingredients, ...rest } = p.data;
  const { data: rec, error } = await supabase
    .from("recipes")
    .insert({ ...rest, owner_id: user.id, basis_note: rest.basis_note || "Soma dos ingredientes no estado em que foram pesados." })
    .select("id")
    .single();
  if (error || !rec) return { ok: false, error: "Não foi possível salvar a receita." };
  const { error: e2 } = await supabase.from("recipe_ingredients").insert(ingredients.map((i, idx) => ({ ...i, recipe_id: rec.id, position: idx })));
  if (e2) {
    await supabase.from("recipes").delete().eq("id", rec.id);
    return { ok: false, error: "Algum ingrediente não pôde ser usado. Tente novamente." };
  }
  revalidatePath("/recipes");
  return { ok: true, data: { id: rec.id } };
}

export async function deleteRecipe(id: string): Promise<Result<null>> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Inválido." };
  const { supabase } = await requireUser();
  const { error, count } = await supabase.from("recipes").delete({ count: "exact" }).eq("id", id);
  if (error || !count) return { ok: false, error: "Não foi possível excluir (somente receitas suas podem ser excluídas)." };
  revalidatePath("/recipes");
  return { ok: true, data: null };
}
