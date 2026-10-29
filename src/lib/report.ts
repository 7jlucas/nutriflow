import type { DiaryEntry, NutritionTarget } from "./types";
import { mealLabel } from "./nutrition/meals";

/** Meta vigente em uma data (histórico versionado). */
export function targetOn(targets: NutritionTarget[], date: string): NutritionTarget | null {
  let t: NutritionTarget | null = null;
  for (const x of targets) if (x.effective_from <= date) t = x;
  return t;
}

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV (separador ;, decimal com vírgula, abre corretamente no Excel pt-BR). */
export function diaryCsv(entries: DiaryEntry[]): string {
  const num = (n: number | null) => (n === null || n === undefined ? "" : String(n).replace(".", ","));
  const head = ["data", "refeicao", "horario", "alimento", "marca", "quantidade", "unidade", "base_g_ml", "kcal", "proteinas_g", "carboidratos_g", "gorduras_g", "fibras_g", "fonte", "estimativa", "dados_incompletos"];
  const rows = entries.map((e) => [
    e.entry_date, mealLabel(e.meal_slot), e.logged_time?.slice(0, 5) ?? "", e.name, e.brand ?? "", num(Number(e.quantity)), e.unit_label ?? e.unit,
    num(Number(e.base_amount)), num(Number(e.kcal)), num(e.protein_g), num(e.carbs_g), num(e.fat_g), num(e.fiber_g),
    e.recipe_id ? "Receita (ingredientes TACO)" : e.source ?? "", e.is_estimate ? "sim" : "nao", e.incomplete ? "sim" : "nao",
  ]);
  return "﻿" + [head, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
}
