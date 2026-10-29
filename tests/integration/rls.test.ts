/**
 * Testes de integração contra um Supabase REAL (local `supabase start` ou projeto de teste).
 * Rode com: SUPABASE_TEST_URL=... SUPABASE_TEST_ANON_KEY=... npm run test:integration
 * Verificam isolamento por usuário (RLS), integridade do diário e a base nutricional.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const URL = process.env.SUPABASE_TEST_URL;
const KEY = process.env.SUPABASE_TEST_ANON_KEY;
const run = URL && KEY ? describe : describe.skip;

async function newUser(): Promise<{ sb: SupabaseClient; id: string }> {
  const sb = createClient(URL!, KEY!, { auth: { persistSession: false } });
  const email = `rls${Date.now()}${Math.floor(Math.random() * 1e6)}@teste.dev`;
  const { data, error } = await sb.auth.signUp({ email, password: "senha1234" });
  if (error || !data.session) throw new Error(`signup falhou (confirmação de e-mail precisa estar desativada no projeto de teste): ${error?.message}`);
  return { sb, id: data.user!.id };
}

run("RLS e integridade de dados", () => {
  let a: { sb: SupabaseClient; id: string };
  let b: { sb: SupabaseClient; id: string };
  let foodId: string;

  beforeAll(async () => {
    a = await newUser();
    b = await newUser();
    const { data } = await a.sb.rpc("search_foods", { q: "arroz tipo 1 cozido", max_results: 5 });
    foodId = (data as { id: string; name: string }[]).find((f) => f.name === "Arroz, tipo 1, cozido")!.id;
  });

  it("anônimo não lê dados (nem a base de alimentos)", async () => {
    const anon = createClient(URL!, KEY!, { auth: { persistSession: false } });
    const { data } = await anon.from("foods").select("id").limit(1);
    expect(data ?? []).toHaveLength(0);
  });

  it("a base TACO está carregada e a busca ignora acentos", async () => {
    const { data } = await a.sb.rpc("search_foods", { q: "feijao preto", max_results: 5 });
    expect((data as { name: string }[]).map((f) => f.name)).toContain("Feijão, preto, cozido");
    const { count } = await a.sb.from("foods").select("id", { count: "exact", head: true }).eq("source", "TACO");
    expect(count).toBe(597);
  });

  it("perfil é criado no cadastro e só o dono o vê", async () => {
    const own = await a.sb.from("profiles").select("id").eq("id", a.id);
    expect(own.data).toHaveLength(1);
    const other = await b.sb.from("profiles").select("id").eq("id", a.id);
    expect(other.data).toHaveLength(0);
  });

  it("um usuário não lê, edita nem apaga o diário de outro", async () => {
    const ins = await a.sb
      .from("diary_entries")
      .insert({ user_id: a.id, entry_date: "2026-10-27", meal_slot: "lunch", food_id: foodId, name: "Arroz", quantity: 100, unit: "g", base_amount: 100, kcal: 128.3, source: "TACO" })
      .select("id")
      .single();
    expect(ins.error).toBeNull();
    const id = ins.data!.id;
    expect((await b.sb.from("diary_entries").select("id").eq("id", id)).data).toHaveLength(0);
    const upd = await b.sb.from("diary_entries").update({ kcal: 1 }).eq("id", id).select("id");
    expect(upd.data ?? []).toHaveLength(0);
    const del = await b.sb.from("diary_entries").delete({ count: "exact" }).eq("id", id);
    expect(del.count ?? 0).toBe(0);
    // e não consegue inserir em nome de outro
    const forged = await b.sb.from("diary_entries").insert({ user_id: a.id, entry_date: "2026-10-27", meal_slot: "lunch", food_id: foodId, name: "x", quantity: 1, unit: "g", base_amount: 1, kcal: 1, source: "TACO" });
    expect(forged.error).not.toBeNull();
    const still = await a.sb.from("diary_entries").select("kcal").eq("id", id).single();
    expect(Number(still.data!.kcal)).toBe(128.3);
  });

  it("ninguém altera alimentos verificados; alimentos próprios são privados", async () => {
    const upd = await a.sb.from("foods").update({ kcal: 1 }).eq("id", foodId).select("id");
    expect(upd.data ?? []).toHaveLength(0);
    const fake = await a.sb.from("foods").insert({ owner_id: a.id, name: "Falso TACO", source: "TACO", verified: true, kcal: 1 });
    expect(fake.error).not.toBeNull();
    const mine = await a.sb.from("foods").insert({ owner_id: a.id, name: "Meu iogurte", source: "USER", kcal: 90 }).select("id").single();
    expect(mine.error).toBeNull();
    expect((await b.sb.from("foods").select("id").eq("id", mine.data!.id)).data).toHaveLength(0);
  });

  it("totais diários (RPC) somam só os registros do próprio usuário", async () => {
    await a.sb.from("diary_entries").insert({ user_id: a.id, entry_date: "2026-10-27", meal_slot: "dinner", food_id: foodId, name: "Arroz", quantity: 50, unit: "g", base_amount: 50, kcal: 64.2, source: "TACO" });
    const { data } = await a.sb.rpc("daily_totals", { from_date: "2026-10-27", to_date: "2026-10-27" });
    expect(Number((data as { kcal: number }[])[0].kcal)).toBe(192.5);
    const other = await b.sb.rpc("daily_totals", { from_date: "2026-10-27", to_date: "2026-10-27" });
    expect(other.data).toHaveLength(0);
  });

  it("itens de plano não podem apontar para plano de outro usuário", async () => {
    const plan = await a.sb.from("meal_plans").insert({ user_id: a.id, name: "Plano A" }).select("id").single();
    const recipe = (await b.sb.from("recipes").select("id").limit(1).single()).data!;
    const res = await b.sb.from("meal_plan_items").insert({ plan_id: plan.data!.id, user_id: b.id, meal_slot: "lunch", recipe_id: recipe.id, servings: 1 });
    expect(res.error).not.toBeNull();
  });
});
