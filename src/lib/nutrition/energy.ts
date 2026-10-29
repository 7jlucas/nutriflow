import type { ActivityLevel, GoalKind, SexForEquation } from "../types";

/** Fatores de atividade física (multiplicadores do gasto basal), valores usuais na literatura. */
export const ACTIVITY_FACTORS: Record<ActivityLevel, { factor: number; label: string; hint: string }> = {
  sedentary: { factor: 1.2, label: "Sedentário", hint: "Pouco ou nenhum exercício; trabalho sentado." },
  light: { factor: 1.375, label: "Leve", hint: "Exercício leve 1 a 3 dias por semana." },
  moderate: { factor: 1.55, label: "Moderado", hint: "Exercício moderado 3 a 5 dias por semana." },
  active: { factor: 1.725, label: "Ativo", hint: "Exercício intenso 6 a 7 dias por semana." },
  very_active: { factor: 1.9, label: "Muito ativo", hint: "Treino intenso diário ou trabalho físico pesado." },
};

export interface EnergyInput {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: SexForEquation;
  activity: ActivityLevel;
  goal: GoalKind;
  needsProfessionalGuidance?: boolean;
  targetWeightKg?: number | null;
  targetDate?: string | null;
  today?: Date;
}

/**
 * Mifflin-St Jeor (1990):
 *   homens:   10·peso + 6,25·altura − 5·idade + 5
 *   mulheres: 10·peso + 6,25·altura − 5·idade − 161
 * "unspecified" usa a média das duas constantes (−78) e é sinalizado na UI.
 */
export function mifflinStJeor(weightKg: number, heightCm: number, age: number, sex: SexForEquation): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const k = sex === "male" ? 5 : sex === "female" ? -161 : -78;
  return base + k;
}

export function tdee(bmr: number, activity: ActivityLevel): number {
  return bmr * ACTIVITY_FACTORS[activity].factor;
}

/** Pisos de segurança: nenhuma meta automática fica abaixo disso. */
export const KCAL_FLOOR: Record<SexForEquation, number> = { female: 1200, male: 1500, unspecified: 1350 };
export const MAX_DEFICIT = 500; // kcal/dia
export const MAX_SURPLUS = 350; // kcal/dia
/** Ritmo máximo sugerido de perda: ~1% do peso corporal por semana. */
export const MAX_WEEKLY_LOSS_FRACTION = 0.01;

export type EnergyStatus = "ok" | "professional" | "minor";

export interface EnergyResult {
  status: EnergyStatus;
  bmr: number;
  tdee: number;
  /** meta diária sugerida (null quando não aplicamos metas automáticas) */
  targetKcal: number | null;
  macros: { protein_g: number; carbs_g: number; fat_g: number } | null;
  adjustment: number; // kcal/dia somadas ao gasto (negativo = déficit)
  notes: string[];
  warnings: string[];
}

const round = (n: number, step = 10) => Math.round(n / step) * step;

export function estimateEnergy(input: EnergyInput): EnergyResult {
  const bmr = mifflinStJeor(input.weightKg, input.heightCm, input.age, input.sex);
  const total = tdee(bmr, input.activity);
  const notes: string[] = [
    "Estimativas pela equação de Mifflin-St Jeor com fator de atividade. Resultados individuais podem variar.",
  ];
  const warnings: string[] = [];
  if (input.sex === "unspecified") {
    notes.push("Sem sexo informado para a equação: usamos a média das duas constantes, o que reduz a precisão.");
  }

  if (input.age < 18) {
    return {
      status: "minor",
      bmr: Math.round(bmr),
      tdee: Math.round(total),
      targetKcal: null,
      macros: null,
      adjustment: 0,
      notes,
      warnings: [
        "Para menores de 18 anos não geramos metas automáticas de calorias. Necessidades de crescimento exigem avaliação de nutricionista ou pediatra.",
      ],
    };
  }
  if (input.needsProfessionalGuidance) {
    return {
      status: "professional",
      bmr: Math.round(bmr),
      tdee: Math.round(total),
      targetKcal: null,
      macros: null,
      adjustment: 0,
      notes,
      warnings: [
        "Você indicou gestação/lactação, condição médica relevante ou histórico de transtorno alimentar. Não aplicamos déficit ou superávit automático: defina sua meta com um profissional de saúde e registre-a manualmente, se desejar.",
      ],
    };
  }

  let adjustment = 0;
  if (input.goal === "lose") {
    adjustment = -Math.min(MAX_DEFICIT, total * 0.2);
    // respeita ritmo máximo se houver prazo
    if (input.targetWeightKg && input.targetDate) {
      const today = input.today ?? new Date();
      const weeks = (new Date(input.targetDate).getTime() - today.getTime()) / (7 * 24 * 3600 * 1000);
      const toLose = input.weightKg - input.targetWeightKg;
      if (weeks > 0 && toLose > 0) {
        const weekly = toLose / weeks;
        if (weekly > input.weightKg * MAX_WEEKLY_LOSS_FRACTION) {
          warnings.push(
            `O prazo escolhido exigiria perder ~${weekly.toFixed(1)} kg/semana. Mantivemos um ritmo mais seguro; considere ampliar o prazo.`,
          );
        }
      }
    }
  } else if (input.goal === "gain") {
    adjustment = Math.min(MAX_SURPLUS, total * 0.1);
  }

  let target = round(total + adjustment);
  const floor = KCAL_FLOOR[input.sex];
  if (target < floor) {
    // nunca abaixo do piso, nem acima do gasto quando o objetivo é perder
    target = Math.ceil(Math.min(floor, total) / 10) * 10;
    warnings.push(
      total < floor
        ? `Seu gasto estimado já fica abaixo de ${floor} kcal/dia. Não aplicamos déficit; procure orientação profissional para definir uma meta.`
        : `A meta foi limitada ao piso de segurança de ${floor} kcal/dia.`,
    );
  }

  // Macros: proteína por kg (peso ajustado se IMC ≥ 30), gordura 28% kcal, carboidrato = restante
  const bmi = input.weightKg / (input.heightCm / 100) ** 2;
  const refWeight = bmi >= 30 ? 25 * (input.heightCm / 100) ** 2 : input.weightKg;
  const gPerKg = input.goal === "maintain" ? 1.2 : 1.6;
  const protein = Math.round(refWeight * gPerKg);
  const fat = Math.round((target * 0.28) / 9);
  const carbs = Math.max(0, Math.round((target - protein * 4 - fat * 9) / 4));
  if (bmi >= 30) notes.push("Proteína calculada sobre o peso de referência (IMC 25) por causa do IMC atual.");

  return {
    status: "ok",
    bmr: Math.round(bmr),
    tdee: Math.round(total),
    targetKcal: target,
    macros: { protein_g: protein, carbs_g: carbs, fat_g: fat },
    adjustment: Math.round(target - total),
    notes,
    warnings,
  };
}

export function bmiOf(weightKg: number, heightCm: number) {
  return weightKg / (heightCm / 100) ** 2;
}
