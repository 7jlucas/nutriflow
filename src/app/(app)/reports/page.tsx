import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import { getDailyTotals, getProfile, getTargets } from "@/lib/data/queries";
import { addDays, isISODate, todayISO } from "@/lib/dates";
import type { DiaryEntry } from "@/lib/types";
import { ReportsView } from "./reports-view";

export const metadata: Metadata = { title: "Relatórios" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ p?: string; from?: string; to?: string }> }) {
  const sp = await searchParams;
  const today = todayISO();
  const period = sp.p === "day" || sp.p === "month" || sp.p === "custom" ? sp.p : "week";
  let from = period === "day" ? today : period === "month" ? addDays(today, -29) : addDays(today, -6);
  let to = today;
  if (period === "custom" && isISODate(sp.from) && isISODate(sp.to) && sp.from <= sp.to) {
    from = sp.from;
    to = sp.to;
    if (Date.parse(to) - Date.parse(from) > 366 * 86400000) from = addDays(to, -366);
  }
  const { supabase, user } = await requireUser();
  const [profile, totals, targets, entries, top, weights] = await Promise.all([
    getProfile(supabase, user.id),
    getDailyTotals(supabase, from, to),
    getTargets(supabase),
    supabase.from("diary_entries").select("*").gte("entry_date", from).lte("entry_date", to).order("entry_date").order("logged_time"),
    supabase.rpc("top_foods", { from_date: from, to_date: to, max_results: 10 }),
    supabase.from("weight_logs").select("measured_on, weight_kg").gte("measured_on", from).lte("measured_on", to).order("measured_on"),
  ]);
  return (
    <ReportsView
      period={period}
      from={from}
      to={to}
      name={profile?.display_name ?? ""}
      totals={totals.map((t) => ({ ...t, kcal: Number(t.kcal), protein_g: Number(t.protein_g), carbs_g: Number(t.carbs_g), fat_g: Number(t.fat_g), fiber_g: Number(t.fiber_g) }))}
      targets={targets}
      entries={(entries.data ?? []) as DiaryEntry[]}
      top={(top.data ?? []) as { food_id: string; name: string; times: number; kcal: number }[]}
      weights={((weights.data ?? []) as { measured_on: string; weight_kg: number }[]).map((w) => ({ date: w.measured_on, kg: Number(w.weight_kg) }))}
    />
  );
}
