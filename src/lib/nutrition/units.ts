import type { BaseUnit, EntryUnit, Food, FoodPortion } from "../types";

export const UNIT_LABEL: Record<EntryUnit, string> = {
  g: "g",
  kg: "kg",
  ml: "ml",
  l: "L",
  portion: "porção",
  serving: "porção da receita",
};

export type ConversionResult =
  | { ok: true; baseAmount: number; isEstimate: boolean; note?: string }
  | { ok: false; reason: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Converte uma quantidade informada pelo usuário para a unidade de referência
 * do alimento (g ou ml). Nunca assume equivalência sem conversão explícita:
 *  - g ↔ ml só com densidade cadastrada (marcada como estimativa quando aproximada);
 *  - "porção" só com uma medida caseira cadastrada (food_portions) com gramas/ml.
 */
export function toBaseAmount(
  quantity: number,
  unit: EntryUnit,
  food: Pick<Food, "ref_unit" | "density_g_per_ml" | "density_is_estimate">,
  portion?: Pick<FoodPortion, "amount" | "amount_unit" | "label"> | null,
): ConversionResult {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, reason: "Informe uma quantidade maior que zero." };
  }
  if (quantity > 100000) {
    return { ok: false, reason: "Quantidade fora do intervalo aceito." };
  }

  let amount: number;
  let from: BaseUnit;
  switch (unit) {
    case "g":
      amount = quantity;
      from = "g";
      break;
    case "kg":
      amount = quantity * 1000;
      from = "g";
      break;
    case "ml":
      amount = quantity;
      from = "ml";
      break;
    case "l":
      amount = quantity * 1000;
      from = "ml";
      break;
    case "portion":
      if (!portion) return { ok: false, reason: "Selecione uma medida caseira cadastrada." };
      amount = quantity * portion.amount;
      from = portion.amount_unit;
      break;
    case "serving":
      return { ok: false, reason: "Porções de receita são convertidas pela própria receita." };
  }

  if (from === food.ref_unit) {
    return { ok: true, baseAmount: round2(amount), isEstimate: false };
  }

  const density = food.density_g_per_ml;
  if (!density || density <= 0) {
    return {
      ok: false,
      reason:
        from === "ml"
          ? "Este alimento não tem conversão confiável de ml para gramas. Informe em gramas."
          : "Este alimento não tem conversão confiável de gramas para ml. Informe em ml.",
    };
  }
  const converted = from === "ml" ? amount * density : amount / density;
  return {
    ok: true,
    baseAmount: round2(converted),
    isEstimate: food.density_is_estimate,
    note: food.density_is_estimate ? `Conversão estimada (densidade ≈ ${density} g/ml).` : undefined,
  };
}

/** Unidades que fazem sentido para um alimento (exibidas no seletor de porções). */
export function availableUnits(
  food: Pick<Food, "ref_unit" | "density_g_per_ml">,
  portions: Pick<FoodPortion, "id">[] = [],
): EntryUnit[] {
  const units: EntryUnit[] = [];
  const hasDensity = !!food.density_g_per_ml;
  if (food.ref_unit === "g" || hasDensity) units.push("g", "kg");
  if (food.ref_unit === "ml" || hasDensity) units.push("ml", "l");
  if (portions.length) units.push("portion");
  return units;
}
