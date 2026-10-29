import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import { getFavorites } from "@/lib/data/queries";
import type { Food } from "@/lib/types";
import { FoodsBrowser } from "./foods-browser";

export const metadata: Metadata = { title: "Busca de alimentos" };

export default async function FoodsPage() {
  const { supabase, user } = await requireUser();
  const [favorites, mine, cats] = await Promise.all([
    getFavorites(supabase),
    supabase.from("foods").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
    supabase.from("foods").select("category").is("owner_id", null),
  ]);
  const categories = [...new Set(((cats.data ?? []) as { category: string | null }[]).map((c) => c.category).filter(Boolean) as string[])].sort();
  return <FoodsBrowser favorites={favorites} mine={(mine.data ?? []) as Food[]} categories={categories} />;
}
