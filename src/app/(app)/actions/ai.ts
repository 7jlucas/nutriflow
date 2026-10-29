"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import type { AiCard } from "@/lib/ai/nutrition-agent";

export async function loadConversation(id: string) {
  if (!z.uuid().safeParse(id).success) return [];
  const { supabase } = await requireUser();
  const { data } = await supabase.from("ai_messages").select("id, role, content, payload, created_at").eq("conversation_id", id).order("created_at");
  return ((data ?? []) as { id: string; role: "user" | "assistant"; content: string; payload: { cards?: AiCard[] } | null; created_at: string }[]).map((m) => ({ id: m.id, role: m.role, content: m.content, cards: m.payload?.cards ?? [] }));
}

export async function deleteConversation(id: string) {
  if (!z.uuid().safeParse(id).success) return { ok: false as const };
  const { supabase } = await requireUser();
  await supabase.from("ai_conversations").delete().eq("id", id);
  revalidatePath("/lab");
  return { ok: true as const };
}
