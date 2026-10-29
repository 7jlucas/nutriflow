"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { computeEntry } from "@/lib/data/diary-core";
import { diaryEntrySchema } from "@/lib/validation";
import type { DiaryEntry, Food } from "@/lib/types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const fail = (error: string) => ({ ok: false as const, error });

export async function addDiaryEntry(input: z.input<typeof diaryEntrySchema>): Promise<Result<DiaryEntry>> {
  const parsed = diaryEntrySchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos para o registro.");
  const { supabase, user } = await requireUser();
  const calc = await computeEntry(supabase, parsed.data);
  if (!calc.ok) return fail(calc.error);
  const { data, error } = await supabase
    .from("diary_entries")
    .insert({
      ...calc.row,
      user_id: user.id,
      entry_date: parsed.data.entry_date,
      meal_slot: parsed.data.meal_slot,
      logged_time: parsed.data.logged_time ?? null,
    })
    .select("*")
    .single();
  if (error) return fail("Não foi possível salvar o registro. Tente novamente.");
  revalidatePath("/dashboard");
  return { ok: true, data: data as DiaryEntry };
}

const updateSchema = z.object({
  id: z.uuid(),
  quantity: z.number().positive().max(100000),
  unit: z.enum(["g", "kg", "ml", "l", "portion", "serving"]),
  portion_id: z.uuid().nullable().optional(),
  meal_slot: z.string().min(1).max(60).optional(),
  logged_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
});

/** Edita quantidade/unidade/refeição, recalcula a partir da fonte e SUBSTITUI o item (nunca duplica). */
export async function updateDiaryEntry(input: z.input<typeof updateSchema>): Promise<Result<DiaryEntry>> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos para a edição.");
  const { supabase } = await requireUser();
  const { data: existing } = await supabase.from("diary_entries").select("*").eq("id", parsed.data.id).maybeSingle();
  if (!existing) return fail("Registro não encontrado.");
  const e = existing as DiaryEntry;

  let patch: Record<string, unknown> = {};
  const changedAmount = parsed.data.quantity !== Number(e.quantity) || parsed.data.unit !== e.unit || (parsed.data.portion_id ?? null) !== e.portion_id;
  if (changedAmount) {
    if (!e.food_id && !e.recipe_id) {
      // alimento original foi removido: só permite reescalar proporcionalmente na mesma unidade
      if (parsed.data.unit !== e.unit) return fail("A unidade não pode ser alterada: o alimento de origem não existe mais.");
      const k = parsed.data.quantity / Number(e.quantity);
      const s = (v: number | null) => (v === null ? null : Math.round(v * k * 10) / 10);
      patch = { quantity: parsed.data.quantity, base_amount: Math.round(Number(e.base_amount) * k * 100) / 100, kcal: s(Number(e.kcal)), protein_g: s(e.protein_g), carbs_g: s(e.carbs_g), fat_g: s(e.fat_g), fiber_g: s(e.fiber_g) };
    } else {
      const calc = await computeEntry(supabase, {
        food_id: e.food_id,
        recipe_id: e.recipe_id,
        portion_id: parsed.data.portion_id ?? null,
        quantity: parsed.data.quantity,
        unit: parsed.data.unit,
      });
      if (!calc.ok) return fail(calc.error);
      const { food_id: _f, recipe_id: _r, ...rest } = calc.row;
      patch = rest;
    }
  }
  if (parsed.data.meal_slot) patch.meal_slot = parsed.data.meal_slot;
  if (parsed.data.logged_time !== undefined) patch.logged_time = parsed.data.logged_time;

  const { data, error } = await supabase.from("diary_entries").update(patch).eq("id", e.id).select("*").single();
  if (error) return fail("Não foi possível salvar a edição.");
  revalidatePath("/dashboard");
  return { ok: true, data: data as DiaryEntry };
}

export async function deleteDiaryEntry(id: string): Promise<Result<{ id: string }>> {
  if (!z.uuid().safeParse(id).success) return fail("Registro inválido.");
  const { supabase } = await requireUser();
  const { error, count } = await supabase.from("diary_entries").delete({ count: "exact" }).eq("id", id);
  if (error) return fail("Não foi possível remover.");
  if (!count) return fail("Registro não encontrado.");
  revalidatePath("/dashboard");
  return { ok: true, data: { id } };
}

/** Restaura um item removido (desfazer). Recalcula pela fonte quando possível. */
export async function restoreDiaryEntry(entry: DiaryEntry): Promise<Result<DiaryEntry>> {
  return addOrCopy(entry, entry.entry_date, entry.meal_slot);
}

async function addOrCopy(src: DiaryEntry, date: string, slot: string): Promise<Result<DiaryEntry>> {
  const { supabase, user } = await requireUser();
  const row = {
    user_id: user.id,
    entry_date: date,
    meal_slot: slot,
    logged_time: src.logged_time,
    food_id: src.food_id,
    recipe_id: src.recipe_id,
    portion_id: src.portion_id,
    name: src.name,
    brand: src.brand,
    quantity: src.quantity,
    unit: src.unit,
    unit_label: src.unit_label,
    base_amount: src.base_amount,
    kcal: src.kcal,
    protein_g: src.protein_g,
    carbs_g: src.carbs_g,
    fat_g: src.fat_g,
    fiber_g: src.fiber_g,
    source: src.source ?? (src.food_id ? null : "USER"),
    is_estimate: src.is_estimate,
    incomplete: src.incomplete,
  };
  const { data, error } = await supabase.from("diary_entries").insert(row).select("*").single();
  if (error) return fail("Não foi possível copiar o item.");
  return { ok: true, data: data as DiaryEntry };
}

const copySchema = z.object({
  fromDate: z.iso.date(),
  fromSlot: z.string().min(1).max(60).nullable(), // null = dia inteiro
  toDate: z.iso.date(),
  toSlot: z.string().min(1).max(60).nullable(),
});

/** Duplica uma refeição (ou o dia inteiro) para outra data/refeição. Lê os itens do banco. */
export async function copyMeals(input: z.input<typeof copySchema>): Promise<Result<DiaryEntry[]>> {
  const parsed = copySchema.safeParse(input);
  if (!parsed.success) return fail("Parâmetros inválidos.");
  const { supabase, user } = await requireUser();
  let q = supabase.from("diary_entries").select("*").eq("entry_date", parsed.data.fromDate);
  if (parsed.data.fromSlot) q = q.eq("meal_slot", parsed.data.fromSlot);
  const { data: src } = await q.order("created_at");
  const list = (src ?? []) as DiaryEntry[];
  if (!list.length) return fail("Não há itens para copiar nessa refeição/dia.");
  const rows = list.map((s) => {
    const { id: _id, created_at: _c, user_id: _u, plan_item_id: _p, ...rest } = s as DiaryEntry & { updated_at?: string };
    delete (rest as Record<string, unknown>).updated_at;
    return { ...rest, user_id: user.id, entry_date: parsed.data.toDate, meal_slot: parsed.data.toSlot ?? s.meal_slot };
  });
  const { data, error } = await supabase.from("diary_entries").insert(rows).select("*");
  if (error) return fail("Não foi possível copiar.");
  revalidatePath("/dashboard");
  return { ok: true, data: (data ?? []) as DiaryEntry[] };
}

export async function searchFoods(q: string): Promise<Result<Food[]>> {
  const query = q.trim().slice(0, 80);
  if (query.length < 2) return { ok: true, data: [] };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("search_foods", { q: query, max_results: 30 });
  if (error) return fail("A busca falhou. Tente novamente.");
  return { ok: true, data: (data ?? []) as Food[] };
}

export async function getFoodDetail(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const { supabase, user } = await requireUser();
  const [{ data: food }, { data: portions }, { data: fav }] = await Promise.all([
    supabase.from("foods").select("*").eq("id", id).maybeSingle(),
    supabase.from("food_portions").select("*").eq("food_id", id).order("amount"),
    supabase.from("favorite_foods").select("food_id").eq("food_id", id).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!food) return null;
  return { food: food as Food, portions: (portions ?? []) as import("@/lib/types").FoodPortion[], favorite: Boolean(fav) };
}

export async function toggleFavorite(foodId: string): Promise<Result<{ favorite: boolean }>> {
  if (!z.uuid().safeParse(foodId).success) return fail("Alimento inválido.");
  const { supabase, user } = await requireUser();
  const { data: existing } = await supabase.from("favorite_foods").select("food_id").eq("food_id", foodId).maybeSingle();
  if (existing) {
    await supabase.from("favorite_foods").delete().eq("food_id", foodId).eq("user_id", user.id);
    return { ok: true, data: { favorite: false } };
  }
  const { error } = await supabase.from("favorite_foods").insert({ user_id: user.id, food_id: foodId });
  if (error) return fail("Não foi possível favoritar.");
  return { ok: true, data: { favorite: true } };
}

export async function addPortion(input: { food_id: string; label: string; amount: number; amount_unit: "g" | "ml" }) {
  const schema = z.object({ food_id: z.uuid(), label: z.string().trim().min(1).max(60), amount: z.number().positive().max(5000), amount_unit: z.enum(["g", "ml"]) });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("Medida inválida.");
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("food_portions")
    .insert({ ...parsed.data, owner_id: user.id, source: "user" })
    .select("*")
    .single();
  if (error) return fail("Não foi possível salvar a medida.");
  return { ok: true as const, data: data as import("@/lib/types").FoodPortion };
}

export async function addCustomMealType(name: string, time: string | null) {
  const n = name.trim();
  if (n.length < 1 || n.length > 40) return fail("Nome de refeição inválido.");
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("meal_types").insert({ user_id: user.id, name: n, default_time: time });
  if (error) return fail(error.code === "23505" ? "Você já tem uma refeição com esse nome." : "Não foi possível criar a refeição.");
  revalidatePath("/diary");
  return { ok: true as const, data: { slot: `custom:${n}` } };
}
