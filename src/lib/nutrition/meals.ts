/** Refeições padrão (constantes do app). Refeições personalizadas ficam em public.meal_types. */
export const DEFAULT_MEALS = [
  { slot: "breakfast", label: "Café da manhã", time: "07:30" },
  { slot: "morning_snack", label: "Lanche da manhã", time: "10:00" },
  { slot: "lunch", label: "Almoço", time: "12:30" },
  { slot: "afternoon_snack", label: "Lanche da tarde", time: "16:00" },
  { slot: "dinner", label: "Jantar", time: "19:30" },
  { slot: "supper", label: "Ceia", time: "22:00" },
] as const;

export type DefaultSlot = (typeof DEFAULT_MEALS)[number]["slot"];

export interface MealDef {
  slot: string;
  label: string;
  time: string | null;
  custom?: boolean;
}

export function mealLabel(slot: string, custom: MealDef[] = []): string {
  const d = DEFAULT_MEALS.find((m) => m.slot === slot);
  if (d) return d.label;
  const c = custom.find((m) => m.slot === slot);
  if (c) return c.label;
  return slot.startsWith("custom:") ? slot.slice(7) : slot;
}

export function allMeals(custom: { name: string; default_time: string | null }[] = []): MealDef[] {
  return [
    ...DEFAULT_MEALS.map((m) => ({ slot: m.slot, label: m.label, time: m.time })),
    ...custom.map((c) => ({ slot: `custom:${c.name}`, label: c.name, time: c.default_time?.slice(0, 5) ?? null, custom: true })),
  ];
}

/** Sugere a refeição pelo horário atual, agiliza o registro rápido. */
export function suggestSlot(now = new Date()): DefaultSlot {
  const h = now.getHours() + now.getMinutes() / 60;
  if (h < 9.5) return "breakfast";
  if (h < 11.5) return "morning_snack";
  if (h < 15) return "lunch";
  if (h < 18) return "afternoon_snack";
  if (h < 21.5) return "dinner";
  return "supper";
}

/** Quais refeições usar no plano conforme o número habitual de refeições. */
export function slotsForMealsPerDay(n: number): DefaultSlot[] {
  const map: Record<number, DefaultSlot[]> = {
    1: ["lunch"],
    2: ["lunch", "dinner"],
    3: ["breakfast", "lunch", "dinner"],
    4: ["breakfast", "lunch", "afternoon_snack", "dinner"],
    5: ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner"],
    6: ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner", "supper"],
  };
  return map[Math.min(6, Math.max(1, n))];
}

/** Distribuição de energia por refeição (fração do total diário). */
export const SLOT_SHARE: Record<DefaultSlot, number> = {
  breakfast: 0.22,
  morning_snack: 0.08,
  lunch: 0.32,
  afternoon_snack: 0.1,
  dinner: 0.24,
  supper: 0.06,
};
