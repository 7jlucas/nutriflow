import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import { aiConfig } from "@/lib/ai/anthropic";
import { getMealTypes } from "@/lib/data/queries";
import { allMeals } from "@/lib/nutrition/meals";
import { todayISO } from "@/lib/dates";
import { LabView } from "./lab-view";

export const metadata: Metadata = { title: "AI Nutrition Lab" };

export default async function LabPage() {
  const { supabase } = await requireUser();
  const cfg = aiConfig();
  const [{ data: convs }, mealTypes] = await Promise.all([
    supabase.from("ai_conversations").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(30),
    getMealTypes(supabase),
  ]);
  return <LabView configured={Boolean(cfg)} model={cfg?.model ?? null} conversations={(convs ?? []) as { id: string; title: string; updated_at: string }[]} meals={allMeals(mealTypes)} today={todayISO()} />;
}
