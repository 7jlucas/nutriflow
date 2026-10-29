"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fieldErrors, profileSchema } from "@/lib/validation";
import { estimateEnergy } from "@/lib/nutrition/energy";
import { todayISO } from "@/lib/dates";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; errors?: Record<string, string> };

/**
 * Salva o perfil nutricional. Na conclusão do onboarding também registra a primeira
 * pesagem, a meta de peso e a meta nutricional estimada (quando apropriado).
 */
export async function saveProfile(input: unknown, opts: { onboarding?: boolean; recalcTarget?: boolean } = {}): Promise<Result<{ targetKcal: number | null }>> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os campos destacados.", errors: fieldErrors(parsed.error) };
  const d = parsed.data;
  const { supabase, user } = await requireUser();
  const today = todayISO();

  if (d.goal === "lose" && d.target_weight_kg && d.target_weight_kg >= d.weight_kg) {
    return { ok: false, error: "Para emagrecer, a meta de peso deve ser menor que o peso atual.", errors: { target_weight_kg: "Meta deve ser menor que o peso atual." } };
  }
  if (d.goal === "gain" && d.target_weight_kg && d.target_weight_kg <= d.weight_kg) {
    return { ok: false, error: "Para ganhar peso, a meta deve ser maior que o peso atual.", errors: { target_weight_kg: "Meta deve ser maior que o peso atual." } };
  }
  if (d.target_date && d.target_date <= today) {
    return { ok: false, error: "O prazo precisa ser uma data futura.", errors: { target_date: "Escolha uma data futura." } };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: d.display_name,
      age: d.age,
      sex: d.sex,
      height_cm: d.height_cm,
      activity: d.activity,
      goal: d.goal,
      target_weight_kg: d.goal === "maintain" ? null : d.target_weight_kg,
      target_date: d.goal === "maintain" ? null : d.target_date,
      meals_per_day: d.meals_per_day,
      diet_preferences: d.diet_preferences,
      allergies: d.allergies,
      restrictions: d.restrictions,
      budget: d.budget,
      needs_professional_guidance: d.needs_professional_guidance,
      ...(opts.onboarding ? { onboarding_completed_at: new Date().toISOString() } : {}),
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Não foi possível salvar o perfil." };

  // pesagem do dia (upsert pela chave usuário+data)
  await supabase.from("weight_logs").upsert({ user_id: user.id, measured_on: today, weight_kg: d.weight_kg }, { onConflict: "user_id,measured_on" });

  // meta de peso: arquiva a ativa e cria nova se mudou
  if (d.goal !== "maintain" && d.target_weight_kg) {
    const { data: active } = await supabase.from("weight_goals").select("*").eq("status", "active").maybeSingle();
    const changed = !active || Number(active.target_weight_kg) !== d.target_weight_kg || (active.target_date ?? null) !== (d.target_date ?? null);
    if (changed) {
      if (active) await supabase.from("weight_goals").update({ status: "archived", closed_at: new Date().toISOString() }).eq("id", active.id);
      await supabase.from("weight_goals").insert({ user_id: user.id, start_weight_kg: d.weight_kg, target_weight_kg: d.target_weight_kg, start_date: today, target_date: d.target_date });
    }
  } else {
    await supabase.from("weight_goals").update({ status: "archived", closed_at: new Date().toISOString() }).eq("status", "active");
  }

  let targetKcal: number | null = null;
  if (opts.onboarding || opts.recalcTarget) {
    const e = estimateEnergy({
      weightKg: d.weight_kg, heightCm: d.height_cm, age: d.age, sex: d.sex, activity: d.activity, goal: d.goal,
      needsProfessionalGuidance: d.needs_professional_guidance, targetWeightKg: d.target_weight_kg, targetDate: d.target_date,
    });
    if (e.targetKcal && e.macros) {
      targetKcal = e.targetKcal;
      await supabase.from("nutrition_targets").insert({
        user_id: user.id, effective_from: today, kcal: e.targetKcal, protein_g: e.macros.protein_g, carbs_g: e.macros.carbs_g,
        fat_g: e.macros.fat_g, bmr: e.bmr, tdee: e.tdee, method: "mifflin_st_jeor", is_manual: false,
      });
    }
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { targetKcal } };
}

const manualSchema = z.object({
  kcal: z.number().int().min(800).max(6000),
  protein_g: z.number().int().min(0).max(500),
  carbs_g: z.number().int().min(0).max(1000),
  fat_g: z.number().int().min(0).max(400),
});

/** Meta definida manualmente (ex.: orientada por profissional). Abaixo do piso exige confirmação na UI. */
export async function setManualTarget(input: z.input<typeof manualSchema>): Promise<Result<null>> {
  const parsed = manualSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Valores fora do intervalo aceito (800 a 6000 kcal)." };
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("nutrition_targets").insert({ user_id: user.id, effective_from: todayISO(), ...parsed.data, method: "manual", is_manual: true });
  if (error) return { ok: false, error: "Não foi possível salvar a meta." };
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

const prefsSchema = z.object({
  water_enabled: z.boolean(),
  water_goal_ml: z.number().int().min(250).max(8000),
  reminders_enabled: z.boolean(),
  reminder_times: z.array(z.string().regex(/^\d{2}:\d{2}$/)).max(8),
});

export async function savePreferences(input: z.input<typeof prefsSchema>): Promise<Result<null>> {
  const parsed = prefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Preferências inválidas.", errors: fieldErrors(parsed.error) };
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) return { ok: false, error: "Não foi possível salvar." };
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

/** Exclusão definitiva da conta e de TODOS os dados (cascata via FK em auth.users). */
export async function deleteAccount(confirmEmail: string): Promise<Result<null>> {
  const { supabase, user } = await requireUser();
  if (!user.email || confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, error: "Digite exatamente o e-mail da conta para confirmar." };
  }
  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: "Exclusão indisponível: o servidor não tem SUPABASE_SERVICE_ROLE_KEY configurada." };
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, error: "Não foi possível excluir a conta agora. Tente novamente." };
  await supabase.auth.signOut();
  return { ok: true, data: null };
}

/** Portabilidade (LGPD art. 18): exporta todos os dados do usuário em JSON. */
export async function exportMyData() {
  const { supabase, user } = await requireUser();
  const tables = ["profiles", "nutrition_targets", "weight_goals", "weight_logs", "body_measurements", "milestones", "water_logs", "diary_entries", "meal_types", "favorite_foods", "favorite_recipes", "meal_plans", "meal_plan_items", "ai_conversations", "ai_messages"] as const;
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), account: { id: user.id, email: user.email, created_at: user.created_at } };
  for (const t of tables) {
    const { data } = await supabase.from(t).select("*");
    out[t] = data ?? [];
  }
  const { data: foods } = await supabase.from("foods").select("*").eq("owner_id", user.id);
  out.custom_foods = foods ?? [];
  const { data: recipes } = await supabase.from("recipes").select("*, recipe_ingredients(*)").eq("owner_id", user.id);
  out.custom_recipes = recipes ?? [];
  return JSON.stringify(out, null, 2);
}
