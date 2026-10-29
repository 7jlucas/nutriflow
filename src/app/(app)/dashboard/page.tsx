import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import { getDailyTotals, getDiary, getLatestWeight, getMealTypes, getProfile, getTargetFor, getWaterTotal } from "@/lib/data/queries";
import { addDays, rangeDays, todayISO } from "@/lib/dates";
import { allMeals } from "@/lib/nutrition/meals";
import { DashboardView } from "./dashboard-view";

export const metadata: Metadata = { title: "Painel" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ bemvindo?: string; senha?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await requireUser();
  const today = todayISO();
  const from14 = addDays(today, -13);
  const [profile, target, weight, entries, water, totals, mealTypes, weights, top, plan] = await Promise.all([
    getProfile(supabase, user.id),
    getTargetFor(supabase, today),
    getLatestWeight(supabase),
    getDiary(supabase, today),
    getWaterTotal(supabase, today),
    getDailyTotals(supabase, from14, today),
    getMealTypes(supabase),
    supabase.from("weight_logs").select("measured_on, weight_kg").gte("measured_on", addDays(today, -90)).order("measured_on"),
    supabase.rpc("top_foods", { from_date: addDays(today, -29), to_date: today, max_results: 5 }),
    supabase
      .from("meal_plans")
      .select("id, name, start_date, days, items:meal_plan_items(id, day_index, meal_slot, suggested_time, servings, grams, done_at, recipe:recipes(name), food:foods(name))")
      .lte("start_date", today)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const byDate = new Map(totals.map((t) => [t.entry_date, t]));
  const last7 = rangeDays(addDays(today, -6), today).map((d) => ({ date: d, kcal: byDate.has(d) ? Number(byDate.get(d)!.kcal) : null }));
  const logged7 = last7.filter((d) => d.kcal !== null && d.date !== today);
  const avg7 = logged7.length ? logged7.reduce((a, d) => a + (d.kcal ?? 0), 0) / logged7.length : null;
  const freq = rangeDays(from14, today).map((d) => ({ date: d, logged: byDate.has(d) }));

  // próximas refeições do plano ativo (planejado ≠ consumido)
  type PlanRow = { id: string; name: string; start_date: string; days: number; items: { id: string; day_index: number; meal_slot: string; suggested_time: string | null; servings: number | null; grams: number | null; done_at: string | null; recipe: { name: string } | null; food: { name: string } | null }[] };
  const activePlan = ((plan.data ?? []) as unknown as PlanRow[]).find((p) => {
    const idx = Math.round((Date.parse(today) - Date.parse(p.start_date)) / 86400000);
    return idx >= 0 && idx < p.days;
  });
  const dayIdx = activePlan ? Math.round((Date.parse(today) - Date.parse(activePlan.start_date)) / 86400000) : -1;
  const next = activePlan
    ? activePlan.items
        .filter((i) => i.day_index === dayIdx && !i.done_at)
        .sort((a, b) => (a.suggested_time ?? "").localeCompare(b.suggested_time ?? ""))
        .slice(0, 3)
        .map((i) => ({ id: i.id, slot: i.meal_slot, time: i.suggested_time?.slice(0, 5) ?? null, name: i.recipe?.name ?? i.food?.name ?? "Item" }))
    : [];

  return (
    <DashboardView
      today={today}
      name={profile?.display_name ?? ""}
      goal={profile?.goal ?? "maintain"}
      needsPro={profile?.needs_professional_guidance ?? false}
      weight={weight}
      target={target}
      entries={entries}
      meals={allMeals(mealTypes)}
      water={{ enabled: profile?.water_enabled ?? true, goal: profile?.water_goal_ml ?? 2000, list: water.list }}
      week={last7}
      avg7={avg7}
      loggedDays7={logged7.length}
      freq={freq}
      weights={((weights.data ?? []) as { measured_on: string; weight_kg: number }[]).map((w) => ({ x: w.measured_on, y: Number(w.weight_kg) }))}
      top={(top.data ?? []) as { food_id: string; name: string; times: number; kcal: number }[]}
      next={next}
      planName={activePlan?.name ?? null}
      welcome={sp.bemvindo === "1"}
      passwordUpdated={sp.senha === "atualizada"}
    />
  );
}
