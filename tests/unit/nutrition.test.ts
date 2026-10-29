import { describe, expect, it } from "vitest";
import { nutrientsFor, scaleNutrient, sumNutrients, totalsByMeal, recipeNutrition, canLog, macroEnergySplit } from "@/lib/nutrition/calc";
import { toBaseAmount, availableUnits } from "@/lib/nutrition/units";
import { estimateEnergy, mifflinStJeor, tdee, KCAL_FLOOR } from "@/lib/nutrition/energy";
import { diaryReducer } from "@/lib/nutrition/diary-state";
import { generatePlan, fitServings, requiredTags, shoppingList, type PlanRecipe } from "@/lib/nutrition/plan";
import type { DiaryEntry, Food } from "@/lib/types";

const food = (over: Partial<Food> = {}): Food => ({
  id: "f1", owner_id: null, name: "Teste", brand: null, category: null, source: "TACO", source_ref: "1",
  source_version: null, verified: true, ref_amount: 100, ref_unit: "g", kcal: 150, protein_g: 10, carbs_g: 20,
  fat_g: 5, fiber_g: 2, sodium_mg: null, nutrient_flags: {}, density_g_per_ml: null, density_is_estimate: false, ...over,
});

// valores TACO reais (4ª ed.) usados como fixtures
const arrozCozido = food({ id: "arroz", kcal: 128.3, protein_g: 2.5, carbs_g: 28.1, fat_g: 0.2, fiber_g: 1.6 });
const frangoGrelhado = food({ id: "frango", kcal: 159.2, protein_g: 32.0, carbs_g: 0, fat_g: 2.5, fiber_g: 0 });

describe("cálculo por porção", () => {
  it("150 kcal/100 g × 200 g = 300 kcal (exemplo da especificação)", () => {
    expect(scaleNutrient(150, 200, 100)).toBe(300);
    expect(nutrientsFor(food(), 200).kcal).toBe(300);
  });
  it("aplica a mesma regra a todos os macronutrientes", () => {
    const n = nutrientsFor(food(), 250);
    expect(n).toMatchObject({ kcal: 375, protein_g: 25, carbs_g: 50, fat_g: 12.5, fiber_g: 5, incomplete: false });
  });
  it("respeita porções de referência diferentes de 100", () => {
    const rotulo = food({ ref_amount: 30, kcal: 120, protein_g: 3, carbs_g: 21, fat_g: 2.4 }); // rótulo: porção 30 g
    expect(nutrientsFor(rotulo, 45).kcal).toBe(180);
    expect(nutrientsFor(rotulo, 45).fat_g).toBe(3.6);
  });
  it("valores ausentes continuam ausentes e marcam o item como incompleto", () => {
    const n = nutrientsFor(food({ fat_g: null }), 100);
    expect(n.fat_g).toBeNull();
    expect(n.incomplete).toBe(true);
  });
  it("alimento sem energia conhecida não pode ser registrado", () => {
    expect(canLog(food({ kcal: null }))).toBe(false);
    expect(canLog(food())).toBe(true);
  });
  it("valores TACO reais: 120 g de frango grelhado", () => {
    const n = nutrientsFor(frangoGrelhado, 120);
    expect(n.kcal).toBe(191);
    expect(n.protein_g).toBe(38.4);
  });
});

describe("conversão de unidades", () => {
  it("kg → g", () => {
    expect(toBaseAmount(0.25, "kg", food())).toEqual({ ok: true, baseAmount: 250, isEstimate: false });
  });
  it("L → ml em alimento por ml", () => {
    expect(toBaseAmount(1.5, "l", food({ ref_unit: "ml" }))).toMatchObject({ ok: true, baseAmount: 1500 });
  });
  it("não trata ml como grama sem densidade", () => {
    const r = toBaseAmount(200, "ml", food());
    expect(r.ok).toBe(false);
  });
  it("usa densidade e sinaliza estimativa", () => {
    const r = toBaseAmount(200, "ml", food({ density_g_per_ml: 1.03, density_is_estimate: true }));
    expect(r).toMatchObject({ ok: true, baseAmount: 206, isEstimate: true });
  });
  it("medida caseira só com conversão cadastrada", () => {
    expect(toBaseAmount(2, "portion", food()).ok).toBe(false);
    const r = toBaseAmount(2, "portion", food(), { amount: 50, amount_unit: "g", label: "1 ovo" });
    expect(r).toMatchObject({ ok: true, baseAmount: 100 });
  });
  it("rejeita quantidades inválidas", () => {
    expect(toBaseAmount(0, "g", food()).ok).toBe(false);
    expect(toBaseAmount(-5, "g", food()).ok).toBe(false);
    expect(toBaseAmount(Number.NaN, "g", food()).ok).toBe(false);
  });
  it("unidades disponíveis dependem da conversão existente", () => {
    expect(availableUnits(food())).toEqual(["g", "kg"]);
    expect(availableUnits(food({ density_g_per_ml: 1 }), [{ id: "p" }])).toEqual(["g", "kg", "ml", "l", "portion"]);
  });
});

describe("somas", () => {
  const entries = [
    { meal_slot: "lunch", kcal: 191, protein_g: 38.4, carbs_g: 0, fat_g: 3, fiber_g: 0 },
    { meal_slot: "lunch", kcal: 154, protein_g: 3, carbs_g: 33.7, fat_g: 0.2, fiber_g: 1.9 },
    { meal_slot: "breakfast", kcal: 98.2, protein_g: 1.3, carbs_g: 26, fat_g: 0.1, fiber_g: 2 },
  ];
  it("soma por refeição e do dia", () => {
    const t = totalsByMeal(entries);
    expect(t.meals.lunch.kcal).toBe(345);
    expect(t.meals.breakfast.kcal).toBe(98.2);
    expect(t.day.kcal).toBe(443.2);
    expect(t.day.protein_g).toBe(42.7);
  });
  it("não acumula erro de ponto flutuante", () => {
    expect(sumNutrients([{ kcal: 0.1 }, { kcal: 0.2 }]).kcal).toBe(0.3);
  });
  it("distribuição energética dos macros", () => {
    const s = macroEnergySplit({ protein_g: 25, carbs_g: 50, fat_g: 10 });
    expect(Math.round(s.protein * 100)).toBe(26);
    expect(Math.round((s.protein + s.carbs + s.fat) * 100)).toBe(100);
  });
});

describe("receitas", () => {
  const ing = [
    { id: "i1", grams: 120, food: frangoGrelhado },
    { id: "i2", grams: 120, food: arrozCozido },
  ];
  it("soma ingredientes e divide pelo rendimento", () => {
    const r = recipeNutrition(ing, 2);
    expect(r.total.kcal).toBe(345);
    expect(r.perServing.kcal).toBe(172.5);
    expect(r.gramsPerServing).toBe(120);
  });
  it("remover ingrediente recalcula", () => {
    const r = recipeNutrition(ing, 1, { excludeIds: ["i2"] });
    expect(r.perServing.kcal).toBe(191);
  });
  it("escala por porções consumidas", () => {
    expect(recipeNutrition(ing, 1, { scale: 1.5 }).perServing.kcal).toBe(517.5);
  });
});

describe("gasto energético", () => {
  it("Mifflin-St Jeor", () => {
    expect(mifflinStJeor(70, 175, 30, "male")).toBeCloseTo(1648.75);
    expect(mifflinStJeor(60, 165, 30, "female")).toBeCloseTo(1320.25);
    expect(tdee(1648.75, "moderate")).toBeCloseTo(2555.56, 1);
  });
  it("emagrecimento: déficit limitado a 500 kcal e piso de segurança", () => {
    const r = estimateEnergy({ weightKg: 90, heightCm: 180, age: 35, sex: "male", activity: "moderate", goal: "lose" });
    expect(r.status).toBe("ok");
    expect(r.tdee - (r.targetKcal ?? 0)).toBeLessThanOrEqual(505);
    const small = estimateEnergy({ weightKg: 45, heightCm: 150, age: 60, sex: "female", activity: "sedentary", goal: "lose" });
    expect(small.targetKcal).toBeGreaterThanOrEqual(Math.min(KCAL_FLOOR.female, small.tdee));
  });
  it("macros fecham com a meta (±10 kcal)", () => {
    const r = estimateEnergy({ weightKg: 70, heightCm: 175, age: 30, sex: "male", activity: "light", goal: "maintain" });
    const m = r.macros!;
    expect(Math.abs(m.protein_g * 4 + m.carbs_g * 4 + m.fat_g * 9 - r.targetKcal!)).toBeLessThanOrEqual(10);
  });
  it("menores de idade e casos que exigem profissional não recebem meta automática", () => {
    expect(estimateEnergy({ weightKg: 55, heightCm: 165, age: 16, sex: "female", activity: "light", goal: "lose" }).targetKcal).toBeNull();
    expect(
      estimateEnergy({ weightKg: 65, heightCm: 165, age: 30, sex: "female", activity: "light", goal: "lose", needsProfessionalGuidance: true }).targetKcal,
    ).toBeNull();
  });
  it("alerta quando o prazo exigiria perda rápida demais", () => {
    const r = estimateEnergy({
      weightKg: 80, heightCm: 170, age: 30, sex: "female", activity: "light", goal: "lose",
      targetWeightKg: 70, targetDate: "2026-02-01", today: new Date("2026-01-01"),
    });
    expect(r.warnings.join(" ")).toMatch(/kg\/semana/);
  });
});

describe("estado do diário (edição e remoção)", () => {
  const entry = (id: string, kcal: number): DiaryEntry => ({
    id, entry_date: "2026-10-27", meal_slot: "lunch", logged_time: "12:00", food_id: "f", recipe_id: null, portion_id: null,
    name: "x", brand: null, quantity: 100, unit: "g", unit_label: null, base_amount: 100, kcal, protein_g: 1, carbs_g: 1,
    fat_g: 1, fiber_g: 0, source: "TACO", is_estimate: false, incomplete: false, plan_item_id: null, created_at: `2026-10-27T12:00:0${id.length}Z`,
  });
  it("editar um alimento NÃO duplica valores", () => {
    let s = diaryReducer([], { type: "add", entry: entry("a", 100) });
    s = diaryReducer(s, { type: "add", entry: entry("b", 50) });
    s = diaryReducer(s, { type: "update", entry: entry("a", 300) });
    s = diaryReducer(s, { type: "update", entry: entry("a", 200) });
    expect(s).toHaveLength(2);
    expect(sumNutrients(s).kcal).toBe(250);
  });
  it("confirmar item otimista substitui o temporário", () => {
    let s = diaryReducer([], { type: "add", entry: entry("temp-1", 100) });
    s = diaryReducer(s, { type: "confirm", tempId: "temp-1", entry: entry("real", 100) });
    expect(s.map((e) => e.id)).toEqual(["real"]);
    s = diaryReducer(s, { type: "add", entry: entry("real", 100) }); // eco do servidor
    expect(s).toHaveLength(1);
  });
  it("remover atualiza os totais corretamente", () => {
    let s = diaryReducer([], { type: "set", entries: [entry("a", 100), entry("b", 50), entry("c", 25)] });
    s = diaryReducer(s, { type: "remove", id: "b" });
    expect(sumNutrients(s).kcal).toBe(125);
    s = diaryReducer(s, { type: "remove", id: "nao-existe" });
    expect(sumNutrients(s).kcal).toBe(125);
  });
});

describe("gerador de plano", () => {
  const mk = (id: string, slot: string[], tags: string[], kcalFood: Food, grams: number): PlanRecipe => ({
    id, name: id, meal_types: slot, tags, goals: ["lose", "maintain", "gain"], cost_level: 1, servings: 1,
    ingredients: [{ id: `${id}-i`, food_id: kcalFood.id, grams, food: kcalFood }],
  });
  const recipes = [
    mk("cafe1", ["breakfast"], ["vegetariano"], arrozCozido, 200),
    mk("cafe2", ["breakfast"], ["vegano", "sem-lactose"], arrozCozido, 250),
    mk("almoco1", ["lunch", "dinner"], ["sem-lactose"], frangoGrelhado, 250),
    mk("almoco2", ["lunch", "dinner"], ["vegano", "sem-lactose"], arrozCozido, 400),
    mk("lanche", ["afternoon_snack"], ["vegano", "sem-lactose"], arrozCozido, 100),
  ];
  it("é determinístico e respeita restrições", () => {
    const input = { recipes, targetKcal: 2000, mealsPerDay: 4, days: 3, goal: "maintain" as const, requiredTags: ["sem-lactose"], seed: "u1" };
    const a = generatePlan(input);
    const b = generatePlan(input);
    expect(a).toEqual(b);
    expect(a.meals.every((m) => recipes.find((r) => r.id === m.recipe_id)!.tags.includes("sem-lactose"))).toBe(true);
    expect(a.meals.filter((m) => m.day_index === 0)).toHaveLength(4);
  });
  it("ajuste de porções limitado entre 0,5 e 2", () => {
    expect(fitServings(100, 1000)).toBe(2);
    expect(fitServings(1000, 100)).toBe(0.5);
    expect(fitServings(400, 500)).toBe(1.25);
  });
  it("mapeia alergias para tags", () => {
    expect(requiredTags(["lactose", "Amendoim"], [], ["vegano"]).sort()).toEqual(["sem-castanhas", "sem-lactose", "vegano"]);
  });
  it("lista de compras soma ingredientes entre refeições", () => {
    const meta = new Map([["arroz", { name: "Arroz", category: "Cereais" }], ["frango", { name: "Frango", category: "Carnes" }]]);
    const list = shoppingList(
      [
        { servings: 1, grams: null, food_id: null, excluded: [], recipe: recipes[0] },
        { servings: 2, grams: null, food_id: null, excluded: [], recipe: recipes[3] },
        { servings: null, grams: 50, food_id: "frango", excluded: [], recipe: null },
      ],
      meta,
    );
    expect(list.find((l) => l.food_id === "arroz")!.grams).toBe(1000);
    expect(list.find((l) => l.food_id === "frango")!.grams).toBe(50);
  });
});

describe("exportação CSV", async () => {
  const { diaryCsv } = await import("@/lib/report");
  it("usa ; e vírgula decimal, escapa aspas e marca estimativas", () => {
    const csv = diaryCsv([
      { id: "1", entry_date: "2026-10-27", meal_slot: "lunch", logged_time: "12:30:00", food_id: "f", recipe_id: null, portion_id: null, name: 'Arroz, "tipo 1"', brand: null, quantity: 150, unit: "g", unit_label: "g", base_amount: 150, kcal: 192.5, protein_g: 3.8, carbs_g: 42.2, fat_g: 0.3, fiber_g: 2.4, source: "TACO", is_estimate: false, incomplete: false, plan_item_id: null, created_at: "" },
    ]);
    const [head, row] = csv.replace("﻿", "").split("\r\n");
    expect(head.split(";")[0]).toBe("data");
    expect(row).toContain('"Arroz, ""tipo 1"""');
    expect(row).toContain(";192,5;");
    expect(row).toContain("Almoço");
  });
});
