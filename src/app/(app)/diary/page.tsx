import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import { getDiary, getMealTypes, getTargetFor } from "@/lib/data/queries";
import { allMeals } from "@/lib/nutrition/meals";
import { isISODate, todayISO } from "@/lib/dates";
import { DiaryPage } from "./diary-page";

export const metadata: Metadata = { title: "Diário alimentar" };

export default async function Page({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const sp = await searchParams;
  const date = isISODate(sp.d) ? sp.d : todayISO();
  const { supabase } = await requireUser();
  const [entries, mealTypes, target] = await Promise.all([getDiary(supabase, date), getMealTypes(supabase), getTargetFor(supabase, date)]);
  return <DiaryPage date={date} today={todayISO()} entries={entries} meals={allMeals(mealTypes)} target={target} />;
}
