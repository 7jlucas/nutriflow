import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { streamTurn, type AiConfig, type ApiMessage, type ContentBlock, type ToolDef } from "./anthropic";
import { loadRecipes } from "../data/recipes";
import { getDiary, getProfile, getTargetFor } from "../data/queries";
import { matchesTags, requiredTags } from "../nutrition/plan";
import { nutrientsFor, recipeNutrition, sumNutrients, canLog, type Nutrients } from "../nutrition/calc";
import { DEFAULT_MEALS } from "../nutrition/meals";
import { todayISO } from "../dates";
import { GOAL_LABEL } from "../format";
import type { Food } from "../types";

export type AiCard =
  | {
      kind: "plan";
      title: string;
      days: { day_index: number; meals: { meal_slot: string; recipe_id: string; recipe_name: string; servings: number; note?: string; nutrients: Nutrients }[]; totals: Nutrients }[];
      target_kcal: number | null;
    }
  | {
      kind: "meal";
      title: string;
      meal_slot: string;
      note?: string;
      items: { food_id: string; name: string; grams: number; per100: { kcal: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null; fiber_g: number | null; ref_amount: number }; nutrients: Nutrients }[];
      totals: Nutrients;
    };

export type AgentEvent = { type: "text"; delta: string } | { type: "card"; card: AiCard } | { type: "status"; label: string };

const SLOTS = DEFAULT_MEALS.map((m) => m.slot);

const TOOLS: ToolDef[] = [
  {
    name: "search_foods",
    description: "Busca alimentos na base nutricional verificada (TACO 4ª ed. + alimentos do usuário). Retorna id e valores por referência. Use para montar refeições com ingredientes reais.",
    input_schema: { type: "object", properties: { query: { type: "string", description: "nome do alimento em português, ex.: 'feijão preto cozido'" } }, required: ["query"] },
  },
  {
    name: "list_recipes",
    description: "Lista as receitas da biblioteca COMPATÍVEIS com as restrições/alergias do usuário, com kcal e proteína por porção calculadas pelo app.",
    input_schema: { type: "object", properties: { meal_slot: { type: "string", enum: SLOTS } } },
  },
  {
    name: "propose_plan",
    description: "Apresenta ao usuário um cardápio (1 a 7 dias) usando receitas da biblioteca. O app calcula os totais de forma determinística e devolve os valores reais. Nunca informe totais diferentes dos devolvidos.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        days: {
          type: "array",
          maxItems: 7,
          items: {
            type: "object",
            properties: {
              day_index: { type: "integer", minimum: 0, maximum: 6 },
              meals: { type: "array", items: { type: "object", properties: { meal_slot: { type: "string", enum: SLOTS }, recipe_id: { type: "string" }, servings: { type: "number", minimum: 0.5, maximum: 2 }, note: { type: "string" } }, required: ["meal_slot", "recipe_id", "servings"] } },
            },
            required: ["day_index", "meals"],
          },
        },
      },
      required: ["title", "days"],
    },
  },
  {
    name: "propose_meal",
    description: "Apresenta uma refeição montada com alimentos da base (ids de search_foods) e gramas. O app calcula calorias e macros e devolve os valores reais. Use para substituições, orçamento e 'o que tenho em casa'.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        meal_slot: { type: "string", enum: SLOTS },
        note: { type: "string" },
        items: { type: "array", minItems: 1, maxItems: 12, items: { type: "object", properties: { food_id: { type: "string" }, grams: { type: "number", minimum: 1, maximum: 1500 } }, required: ["food_id", "grams"] } },
      },
      required: ["title", "meal_slot", "items"],
    },
  },
];

function systemPrompt(ctx: string) {
  return `Você é o assistente do AI NUTRITION LAB, dentro do app NUTRI//FLOW. Responda em português do Brasil, de forma direta e prática.

Regras obrigatórias:
- Você NÃO substitui nutricionista ou médico. Não faça diagnósticos, não prescreva suplementos/medicamentos e não sugira dietas extremas, jejuns prolongados ou metas abaixo de 1200 kcal/dia.
- Se a pessoa mencionar gestação, doença, transtorno alimentar, uso de medicamentos ou sintomas, recomende acompanhamento profissional e não proponha metas.
- NUNCA invente valores nutricionais nem some calorias você mesmo. Para qualquer número, use as ferramentas: o app calcula de forma determinística com a base TACO e devolve os totais. Cite apenas os totais devolvidos.
- Use somente receitas de list_recipes (já filtradas pelas restrições) e alimentos de search_foods. Respeite alergias e restrições SEMPRE.
- Não prometa resultados (peso, prazos) e não associe valor pessoal ao peso.
- Para cardápios use propose_plan; para refeições avulsas, substituições, "o que tenho em casa" e orçamento use search_foods + propose_meal.
- Depois de propor, explique em 2 a 4 frases curtas as escolhas. Evite listas longas: os cartões já mostram os detalhes.

Contexto do usuário (sem dados de identificação):
${ctx}`;
}

export async function buildContext(sb: SupabaseClient, userId: string) {
  const today = todayISO();
  const [profile, target, diary] = await Promise.all([getProfile(sb, userId), getTargetFor(sb, today), getDiary(sb, today)]);
  const consumed = sumNutrients(diary);
  const lines = [
    `- Objetivo: ${profile ? GOAL_LABEL[profile.goal] : "não informado"}`,
    `- Meta diária: ${target ? `${target.kcal} kcal (P ${target.protein_g} g, C ${target.carbs_g} g, G ${target.fat_g} g)` : "sem meta automática"}`,
    `- Consumido hoje: ${Math.round(consumed.kcal)} kcal${target ? `; restante ${Math.round(target.kcal - consumed.kcal)} kcal` : ""}`,
    `- Refeições por dia: ${profile?.meals_per_day ?? 4}`,
    `- Preferências: ${profile?.diet_preferences.join(", ") || "nenhuma"}`,
    `- Alergias/intolerâncias: ${profile?.allergies.join(", ") || "nenhuma"}`,
    `- Restrições: ${profile?.restrictions.join(", ") || "nenhuma"}`,
    `- Orçamento: ${profile?.budget ?? "não informado"}`,
    profile?.needs_professional_guidance ? "- ATENÇÃO: o usuário indicou condição que exige acompanhamento profissional. Não proponha metas calóricas; ofereça ideias de refeições equilibradas e recomende profissional." : "",
  ].filter(Boolean);
  return { text: lines.join("\n"), profile, target };
}

/**
 * Executa uma rodada de conversa com tool use. Cálculos ficam 100% no app.
 */
export async function runAgent(opts: {
  cfg: AiConfig;
  sb: SupabaseClient;
  userId: string;
  history: ApiMessage[];
  emit: (e: AgentEvent) => void;
  signal?: AbortSignal;
}): Promise<{ text: string; cards: AiCard[] }> {
  const { cfg, sb, userId, emit } = opts;
  const ctx = await buildContext(sb, userId);
  const tags = requiredTags(ctx.profile?.allergies ?? [], ctx.profile?.restrictions ?? [], ctx.profile?.diet_preferences ?? []);
  let recipesCache: Awaited<ReturnType<typeof loadRecipes>> | null = null;
  const recipes = async () => (recipesCache ??= await loadRecipes(sb));
  const foodCache = new Map<string, Food>();

  const messages: ApiMessage[] = [...opts.history];
  const cards: AiCard[] = [];
  let finalText = "";

  async function runTool(name: string, input: Record<string, unknown>): Promise<{ content: string; isError?: boolean }> {
    if (name === "search_foods") {
      const q = String(input.query ?? "").slice(0, 80);
      emit({ type: "status", label: `Consultando a base TACO: “${q}”` });
      const { data } = await sb.rpc("search_foods", { q, max_results: 8 });
      const foods = ((data ?? []) as Food[]).filter(canLog);
      foods.forEach((f) => foodCache.set(f.id, f));
      return { content: JSON.stringify(foods.map((f) => ({ id: f.id, name: f.name, source: f.source, per: `${f.ref_amount} ${f.ref_unit}`, kcal: f.kcal, protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g }))) };
    }
    if (name === "list_recipes") {
      emit({ type: "status", label: "Filtrando receitas compatíveis" });
      const slot = input.meal_slot ? String(input.meal_slot) : null;
      const list = (await recipes()).filter((r) => matchesTags(r.recipe, tags) && (!slot || r.recipe.meal_types.includes(slot)));
      return { content: JSON.stringify(list.map((r) => ({ id: r.recipe.id, name: r.recipe.name, meal_slots: r.recipe.meal_types, kcal_per_serving: r.perServing.kcal, protein_g: r.perServing.protein_g, prep_minutes: r.recipe.prep_minutes, cost_level: r.recipe.cost_level }))) };
    }
    if (name === "propose_plan") {
      emit({ type: "status", label: "Calculando o cardápio pelos ingredientes" });
      const all = await recipes();
      const byId = new Map(all.map((r) => [r.recipe.id, r]));
      const rawDays = (Array.isArray(input.days) ? input.days : []) as { day_index: number; meals: { meal_slot: string; recipe_id: string; servings: number; note?: string }[] }[];
      const errors: string[] = [];
      const days = rawDays.slice(0, 7).map((d) => {
        const meals = (d.meals ?? []).flatMap((m) => {
          const r = byId.get(m.recipe_id);
          if (!r) { errors.push(`receita ${m.recipe_id} inexistente`); return []; }
          if (!matchesTags(r.recipe, tags)) { errors.push(`${r.recipe.name} viola restrições`); return []; }
          const servings = Math.min(2, Math.max(0.5, Math.round(Number(m.servings || 1) * 4) / 4));
          const n = recipeNutrition(r.recipe.ingredients.map((i) => ({ id: i.id, grams: Number(i.grams), food: i.food })), Number(r.recipe.servings), { scale: servings });
          return [{ meal_slot: SLOTS.includes(m.meal_slot as never) ? m.meal_slot : "lunch", recipe_id: r.recipe.id, recipe_name: r.recipe.name, servings, note: m.note?.slice(0, 200), nutrients: n.perServing }];
        });
        return { day_index: Math.max(0, Math.min(6, Number(d.day_index) || 0)), meals, totals: sumNutrients(meals.map((m) => m.nutrients)) };
      });
      if (!days.some((d) => d.meals.length)) return { content: `Nenhuma refeição válida. Erros: ${errors.join("; ")}`, isError: true };
      const card: AiCard = { kind: "plan", title: String(input.title ?? "Cardápio").slice(0, 80), days, target_kcal: ctx.target?.kcal ?? null };
      cards.push(card);
      emit({ type: "card", card });
      return { content: JSON.stringify({ shown_to_user: true, computed_totals_per_day: days.map((d) => ({ day_index: d.day_index, kcal: d.totals.kcal, protein_g: d.totals.protein_g })), target_kcal: ctx.target?.kcal ?? null, rejected: errors }) };
    }
    if (name === "propose_meal") {
      emit({ type: "status", label: "Calculando a refeição" });
      const rawItems = (Array.isArray(input.items) ? input.items : []) as { food_id: string; grams: number }[];
      const missing = rawItems.filter((i) => !foodCache.has(i.food_id)).map((i) => i.food_id);
      if (missing.length) {
        const { data } = await sb.from("foods").select("*").in("id", missing.filter((id) => /^[0-9a-f-]{36}$/i.test(id)));
        ((data ?? []) as Food[]).forEach((f) => foodCache.set(f.id, f));
      }
      const items = rawItems.flatMap((i) => {
        const f = foodCache.get(i.food_id);
        if (!f || !canLog(f)) return [];
        const grams = Math.min(1500, Math.max(1, Math.round(Number(i.grams))));
        const base = f.ref_unit === "ml" ? (f.density_g_per_ml ? grams / Number(f.density_g_per_ml) : null) : grams;
        if (base === null) return [];
        const n = nutrientsFor(f, base);
        return [{
          food_id: f.id, name: f.name, grams,
          per100: { kcal: Number(f.kcal), protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g, fiber_g: f.fiber_g, ref_amount: Number(f.ref_amount) },
          nutrients: { kcal: n.kcal ?? 0, protein_g: n.protein_g ?? 0, carbs_g: n.carbs_g ?? 0, fat_g: n.fat_g ?? 0, fiber_g: n.fiber_g ?? 0 },
        }];
      });
      if (!items.length) return { content: "Nenhum alimento válido. Use ids retornados por search_foods.", isError: true };
      const card: AiCard = { kind: "meal", title: String(input.title ?? "Refeição").slice(0, 80), meal_slot: SLOTS.includes(String(input.meal_slot) as never) ? String(input.meal_slot) : "lunch", note: input.note ? String(input.note).slice(0, 240) : undefined, items, totals: sumNutrients(items.map((i) => i.nutrients)) };
      cards.push(card);
      emit({ type: "card", card });
      return { content: JSON.stringify({ shown_to_user: true, computed_totals: card.totals }) };
    }
    return { content: `Ferramenta desconhecida: ${name}`, isError: true };
  }

  for (let turn = 0; turn < 6; turn++) {
    const r = await streamTurn(cfg, { system: systemPrompt(ctx.text), messages, tools: TOOLS, max_tokens: 1800 }, (d) => {
      finalText += d;
      emit({ type: "text", delta: d });
    }, opts.signal);
    messages.push({ role: "assistant", content: r.content });
    if (r.stopReason !== "tool_use") break;
    const results: ContentBlock[] = [];
    for (const b of r.content) {
      if (b.type !== "tool_use") continue;
      const out = await runTool(b.name, (b.input ?? {}) as Record<string, unknown>);
      results.push({ type: "tool_result", tool_use_id: b.id, content: out.content, ...(out.isError ? { is_error: true } : {}) });
    }
    messages.push({ role: "user", content: results });
    if (finalText && !finalText.endsWith("\n")) {
      finalText += "\n\n";
      emit({ type: "text", delta: "\n\n" });
    }
  }
  return { text: finalText.trim(), cards };
}
