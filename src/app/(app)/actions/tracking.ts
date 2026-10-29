"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { todayISO } from "@/lib/dates";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function addWater(date: string, ml: number): Promise<Result<{ id: string; ml: number }>> {
  const p = z.object({ date: z.iso.date(), ml: z.number().int().min(1).max(5000) }).safeParse({ date, ml });
  if (!p.success) return { ok: false, error: "Quantidade inválida." };
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("water_logs").insert({ user_id: user.id, entry_date: p.data.date, ml: p.data.ml }).select("id,ml").single();
  if (error) return { ok: false, error: "Não foi possível registrar a água." };
  revalidatePath("/dashboard");
  return { ok: true, data };
}

export async function deleteWater(id: string): Promise<Result<null>> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Inválido." };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("water_logs").delete().eq("id", id);
  if (error) return { ok: false, error: "Não foi possível desfazer." };
  revalidatePath("/dashboard");
  return { ok: true, data: null };
}

const weightSchema = z.object({
  measured_on: z.iso.date(),
  weight_kg: z.number().min(25).max(400),
  note: z.string().trim().max(200).optional().nullable(),
});

export async function logWeight(input: z.input<typeof weightSchema>): Promise<Result<{ id: string }>> {
  const p = weightSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Informe um peso entre 25 e 400 kg e uma data válida." };
  if (p.data.measured_on > todayISO()) return { ok: false, error: "A data da pesagem não pode estar no futuro." };
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("weight_logs")
    .upsert({ user_id: user.id, ...p.data, weight_kg: Math.round(p.data.weight_kg * 10) / 10 }, { onConflict: "user_id,measured_on" })
    .select("id")
    .single();
  if (error) return { ok: false, error: "Não foi possível salvar a pesagem." };
  // meta atingida?
  const { data: goal } = await supabase.from("weight_goals").select("*").eq("status", "active").maybeSingle();
  if (goal) {
    const losing = Number(goal.target_weight_kg) < Number(goal.start_weight_kg);
    const reached = losing ? p.data.weight_kg <= Number(goal.target_weight_kg) : p.data.weight_kg >= Number(goal.target_weight_kg);
    if (reached) await supabase.from("weight_goals").update({ status: "achieved", closed_at: new Date().toISOString() }).eq("id", goal.id);
  }
  revalidatePath("/progress");
  revalidatePath("/dashboard");
  return { ok: true, data };
}

export async function deleteWeight(id: string): Promise<Result<null>> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Inválido." };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("weight_logs").delete().eq("id", id);
  if (error) return { ok: false, error: "Não foi possível remover." };
  revalidatePath("/progress");
  return { ok: true, data: null };
}

const measSchema = z.object({
  measured_on: z.iso.date(),
  waist_cm: z.number().min(30).max(300).nullable(),
  hip_cm: z.number().min(30).max(300).nullable(),
  chest_cm: z.number().min(30).max(300).nullable(),
  arm_cm: z.number().min(10).max(100).nullable(),
  thigh_cm: z.number().min(20).max(150).nullable(),
});

export async function logMeasurements(input: z.input<typeof measSchema>): Promise<Result<null>> {
  const p = measSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Revise as medidas (valores em cm)." };
  if (!Object.entries(p.data).some(([k, v]) => k !== "measured_on" && v !== null)) return { ok: false, error: "Informe pelo menos uma medida." };
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("body_measurements").upsert({ user_id: user.id, ...p.data }, { onConflict: "user_id,measured_on" });
  if (error) return { ok: false, error: "Não foi possível salvar as medidas." };
  revalidatePath("/progress");
  return { ok: true, data: null };
}

export async function addMilestone(title: string, date: string): Promise<Result<null>> {
  const p = z.object({ title: z.string().trim().min(1).max(120), date: z.iso.date() }).safeParse({ title, date });
  if (!p.success) return { ok: false, error: "Descreva o marco (até 120 caracteres)." };
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("milestones").insert({ user_id: user.id, title: p.data.title, happened_on: p.data.date });
  if (error) return { ok: false, error: "Não foi possível salvar." };
  revalidatePath("/progress");
  return { ok: true, data: null };
}

export async function deleteMilestone(id: string): Promise<Result<null>> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Inválido." };
  const { supabase } = await requireUser();
  await supabase.from("milestones").delete().eq("id", id);
  revalidatePath("/progress");
  return { ok: true, data: null };
}
