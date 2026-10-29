import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnv } from "@/lib/supabase/env";
import { aiConfig, aiErrorMessage, type ApiMessage } from "@/lib/ai/anthropic";
import { runAgent, type AiCard, type AgentEvent } from "@/lib/ai/nutrition-agent";

export const maxDuration = 60;

const bodySchema = z.object({ conversationId: z.uuid().nullable().optional(), message: z.string().trim().min(1).max(2000) });

function cardSummary(c: AiCard) {
  return c.kind === "plan"
    ? `[Cartão exibido: cardápio "${c.title}": ${c.days.map((d) => `dia ${d.day_index + 1}: ${d.meals.map((m) => `${m.recipe_name} ${m.servings}x`).join(", ")} = ${Math.round(d.totals.kcal)} kcal`).join(" | ")}]`
    : `[Cartão exibido: refeição "${c.title}": ${c.items.map((i) => `${i.name} ${i.grams} g`).join(", ")} = ${Math.round(c.totals.kcal)} kcal]`;
}

/** Chat do AI Nutrition Lab, streaming SSE. A chave da IA nunca sai do servidor. */
export async function POST(req: Request) {
  if (!supabaseEnv().configured && !supabaseEnv().local) return Response.json({ error: "Backend não configurado." }, { status: 503 });
  const cfg = aiConfig();
  if (!cfg) return Response.json({ configured: false, error: "Serviço de IA não configurado (ANTHROPIC_API_KEY ausente)." }, { status: 503 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "Sessão expirada." }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Mensagem inválida." }, { status: 400 });
  const userId = auth.user.id;

  // limite simples de uso: 40 mensagens/hora por usuário
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await supabase.from("ai_messages").select("id", { count: "exact", head: true }).eq("role", "user").gte("created_at", since);
  if ((count ?? 0) >= 40) return Response.json({ error: "Limite de mensagens por hora atingido. Tente mais tarde." }, { status: 429 });

  let conversationId = parsed.data.conversationId ?? null;
  if (conversationId) {
    const { data: conv } = await supabase.from("ai_conversations").select("id").eq("id", conversationId).maybeSingle();
    if (!conv) conversationId = null;
  }
  if (!conversationId) {
    const { data: conv, error } = await supabase.from("ai_conversations").insert({ user_id: userId, title: parsed.data.message.slice(0, 60) }).select("id").single();
    if (error || !conv) return Response.json({ error: "Não foi possível iniciar a conversa." }, { status: 500 });
    conversationId = conv.id;
  }

  const { data: prev } = await supabase.from("ai_messages").select("role, content, payload").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(12);
  const history: ApiMessage[] = ((prev ?? []) as { role: "user" | "assistant"; content: string; payload: { cards?: AiCard[] } | null }[])
    .reverse()
    .map((m) => ({ role: m.role, content: [m.content, ...(m.payload?.cards ?? []).map(cardSummary)].filter(Boolean).join("\n") || "(vazio)" }));
  // a API exige alternância começando por "user"
  while (history.length && history[0].role !== "user") history.shift();
  history.push({ role: "user", content: parsed.data.message });
  await supabase.from("ai_messages").insert({ conversation_id: conversationId, user_id: userId, role: "user", content: parsed.data.message });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      send({ type: "meta", conversationId });
      try {
        const result = await runAgent({ cfg, sb: supabase, userId, history, emit: (e: AgentEvent) => send(e), signal: req.signal });
        await supabase.from("ai_messages").insert({ conversation_id: conversationId, user_id: userId, role: "assistant", content: result.text, payload: result.cards.length ? { cards: result.cards } : null });
        await supabase.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
        send({ type: "done" });
      } catch (e) {
        // não registra conteúdo pessoal em log; apenas o tipo de falha
        console.error("[ai] falha na rodada:", e instanceof Error ? e.message : "erro");
        send({ type: "error", message: aiErrorMessage(e) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" } });
}
