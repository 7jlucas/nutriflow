import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DiaryEntry, Food, NutritionTarget, Profile, WeightLog } from "../types";

type SB = SupabaseClient;

export async function getProfile(sb: SB, userId: string): Promise<Profile | null> {
  const { data } = await sb.from("profiles").select("*").eq("id", userId).maybeSingle();
  return data as Profile | null;
}

/** Meta vigente: a mais recente com effective_from ≤ data. */
export async function getTargetFor(sb: SB, date: string): Promise<NutritionTarget | null> {
  const { data } = await sb
    .from("nutrition_targets")
    .select("*")
    .lte("effective_from", date)
    .order("effective_from", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as NutritionTarget | null;
}

export async function getTargets(sb: SB): Promise<NutritionTarget[]> {
  const { data } = await sb.from("nutrition_targets").select("*").order("effective_from", { ascending: true }).order("created_at");
  return (data ?? []) as NutritionTarget[];
}

export async function getLatestWeight(sb: SB): Promise<WeightLog | null> {
  const { data } = await sb.from("weight_logs").select("*").order("measured_on", { ascending: false }).limit(1).maybeSingle();
  return data as WeightLog | null;
}

export async function getDiary(sb: SB, date: string): Promise<DiaryEntry[]> {
  const { data } = await sb
    .from("diary_entries")
    .select("*")
    .eq("entry_date", date)
    .order("logged_time", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  return (data ?? []) as DiaryEntry[];
}

export async function getMealTypes(sb: SB) {
  const { data } = await sb.from("meal_types").select("id,name,default_time,position").order("position").order("name");
  return (data ?? []) as { id: string; name: string; default_time: string | null; position: number }[];
}

export async function getWaterTotal(sb: SB, date: string) {
  const { data } = await sb.from("water_logs").select("id,ml,created_at").eq("entry_date", date).order("created_at");
  const list = (data ?? []) as { id: string; ml: number; created_at: string }[];
  return { total: list.reduce((a, w) => a + w.ml, 0), list };
}

export async function getFavorites(sb: SB): Promise<Food[]> {
  const { data } = await sb.from("favorite_foods").select("food:foods(*)").order("created_at", { ascending: false }).limit(30);
  return ((data ?? []) as unknown as { food: Food }[]).map((r) => r.food).filter(Boolean);
}

export async function getRecent(sb: SB): Promise<Food[]> {
  const { data } = await sb.rpc("recent_foods", { max_results: 12 });
  return (data ?? []) as Food[];
}

export async function getDailyTotals(sb: SB, from: string, to: string) {
  const { data } = await sb.rpc("daily_totals", { from_date: from, to_date: to });
  return (data ?? []) as { entry_date: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number; items: number; incomplete: number }[];
}
