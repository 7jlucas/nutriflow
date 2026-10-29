import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));

// banco isolado em pasta temporária (nunca toca no .local-db do desenvolvedor)
const dir = mkdtempSync(path.join(tmpdir(), "nf-local-db-"));
process.env.LOCAL_DB_DIR = dir;

const { createLocalAdminClient, createLocalClient } = await import("@/lib/local-db/client");

function jar() {
  const store = new Map<string, string>();
  return { get: (n: string) => store.get(n), set: (n: string, v: string) => (v ? store.set(n, v) : store.delete(n)) };
}

let a: SupabaseClient, b: SupabaseClient;
let aId = "", bId = "";

beforeAll(async () => {
  a = createLocalClient(jar());
  b = createLocalClient(jar());
  const ra = await a.auth.signUp({ email: "a@nutriflow.test", password: "senha12345", options: { data: { display_name: "Ana" } } });
  const rb = await b.auth.signUp({ email: "b@nutriflow.test", password: "senha12345" });
  aId = ra.data.user!.id;
  bId = rb.data.user!.id;
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("banco local: auth", () => {
  it("cria perfil no cadastro e mantém a sessão no cookie", async () => {
    const { data } = await a.auth.getUser();
    expect(data.user?.email).toBe("a@nutriflow.test");
    const { data: p } = await a.from("profiles").select("*").eq("id", aId).single();
    expect(p).toMatchObject({ display_name: "Ana", goal: "maintain", water_goal_ml: 2000 });
  });

  it("recusa e-mail repetido e senha errada", async () => {
    const dup = await createLocalClient(jar()).auth.signUp({ email: "A@nutriflow.test", password: "x1234567" });
    expect(dup.error?.code).toBe("user_already_exists");
    const bad = await createLocalClient(jar()).auth.signInWithPassword({ email: "a@nutriflow.test", password: "errada123" });
    expect(bad.error?.code).toBe("invalid_credentials");
  });

  it("sem sessão não lê nada", async () => {
    const anon = createLocalClient(jar());
    expect((await anon.auth.getUser()).data.user).toBeNull();
    expect((await anon.from("foods").select("id").limit(1)).data).toEqual([]);
  });
});

describe("banco local: dados", () => {
  it("carrega a TACO e as receitas com ingredientes embutidos", async () => {
    const { data: foods } = await a.rpc("search_foods", { q: "arroz integral", max_results: 5 });
    expect((foods as { name: string }[])[0].name).toMatch(/Arroz, integral/);
    const { data: rec } = await a
      .from("recipes")
      .select("*, ingredients:recipe_ingredients(id, grams, food:foods(*))")
      .eq("slug", "overnight-aveia-banana")
      .single();
    expect(rec.ingredients).toHaveLength(4);
    expect(rec.ingredients[0].food.name).toBeTruthy();
  });

  it("diário: insert, isolamento entre usuários, totais e top_foods", async () => {
    const { data: food } = await a.from("foods").select("*").eq("source_ref", "1").single();
    const row = { user_id: aId, entry_date: "2026-10-29", meal_slot: "lunch", food_id: food.id, name: food.name, quantity: 150, unit: "g", base_amount: 150, kcal: 185.3, protein_g: 3.9, source: "TACO", logged_time: "12:30" };
    const { data: e, error } = await a.from("diary_entries").insert(row).select("*").single();
    expect(error).toBeNull();
    expect(e.logged_time).toBe("12:30:00");

    expect((await b.from("diary_entries").select("*")).data).toEqual([]);
    const forged = await b.from("diary_entries").insert({ ...row, user_id: aId });
    expect(forged.error?.code).toBe("42501");

    const { data: totals } = await a.rpc("daily_totals", { from_date: "2026-10-01", to_date: "2026-10-31" });
    expect(totals).toEqual([expect.objectContaining({ entry_date: "2026-10-29", kcal: 185.3, items: 1 })]);
    const { data: top } = await a.rpc("top_foods", { from_date: "2026-10-01", to_date: "2026-10-31", max_results: 5 });
    expect((top as { times: number }[])[0].times).toBe(1);

    const del = await b.from("diary_entries").delete({ count: "exact" }).eq("id", e.id);
    expect(del.count).toBe(0);
    const del2 = await a.from("diary_entries").delete({ count: "exact" }).eq("id", e.id);
    expect(del2.count).toBe(1);
  });

  it("upsert por (user_id, measured_on) e unique de meal_types", async () => {
    await a.from("weight_logs").upsert({ user_id: aId, measured_on: "2026-10-29", weight_kg: 80 }, { onConflict: "user_id,measured_on" });
    await a.from("weight_logs").upsert({ user_id: aId, measured_on: "2026-10-29", weight_kg: 79.5 }, { onConflict: "user_id,measured_on" });
    const { data } = await a.from("weight_logs").select("measured_on, weight_kg");
    expect(data).toEqual([{ measured_on: "2026-10-29", weight_kg: 79.5 }]);

    await a.from("meal_types").insert({ user_id: aId, name: "Pré-treino" });
    const again = await a.from("meal_types").insert({ user_id: aId, name: "Pré-treino" });
    expect(again.error?.code).toBe("23505");
  });

  it("alimento usado em receita não pode ser excluído (restrict); receita apaga ingredientes (cascade)", async () => {
    const { data: food } = await a.from("foods").insert({ owner_id: aId, name: "Granola caseira", source: "USER", kcal: 400 }).select("*").single();
    const { data: rec } = (await a.from("recipes").insert({ owner_id: aId, name: "Iogurte com granola" }).select("id").single()) as { data: { id: string } };
    await a.from("recipe_ingredients").insert({ recipe_id: rec.id, food_id: food.id, grams: 40 });

    const blocked = await a.from("foods").delete({ count: "exact" }).eq("id", food.id);
    expect(blocked.error?.code).toBe("23503");
    expect((await b.from("foods").select("id").eq("id", food.id)).data).toEqual([]);

    await a.from("recipes").delete().eq("id", rec.id);
    expect((await a.from("recipe_ingredients").select("id").eq("recipe_id", rec.id)).data).toEqual([]);
    expect((await a.from("foods").delete({ count: "exact" }).eq("id", food.id)).count).toBe(1);
  });

  it("excluir a conta remove o usuário e os dados dele", async () => {
    await b.from("water_logs").insert({ user_id: bId, entry_date: "2026-10-29", ml: 250 });
    await createLocalAdminClient().auth.admin.deleteUser(bId);
    expect((await b.auth.getUser()).data.user).toBeNull();
    const admin = createLocalAdminClient();
    expect((await admin.from("water_logs").select("id").eq("user_id", bId)).data).toEqual([]);
    expect((await admin.from("profiles").select("id").eq("id", bId)).data).toEqual([]);
  });
});
