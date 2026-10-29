import type { ActivityLevel, BudgetLevel, GoalKind, Profile, SexForEquation } from "./types";

export interface ProfileDraft {
  display_name: string;
  age: string;
  sex: SexForEquation;
  height_cm: string;
  weight_kg: string;
  goal: GoalKind;
  target_weight_kg: string;
  target_date: string;
  activity: ActivityLevel;
  meals_per_day: number;
  diet_preferences: string[];
  allergies: string[];
  restrictions: string[];
  budget: BudgetLevel | "";
  needs_professional_guidance: boolean;
}

export function draftFrom(p: Profile | null, weight: number | null, fallbackName = ""): ProfileDraft {
  return {
    display_name: p?.display_name ?? fallbackName,
    age: p?.age?.toString() ?? "",
    sex: p?.sex ?? "unspecified",
    height_cm: p?.height_cm?.toString() ?? "",
    weight_kg: weight?.toString() ?? "",
    goal: p?.goal ?? "maintain",
    target_weight_kg: p?.target_weight_kg?.toString() ?? "",
    target_date: p?.target_date ?? "",
    activity: p?.activity ?? "light",
    meals_per_day: p?.meals_per_day ?? 4,
    diet_preferences: p?.diet_preferences ?? [],
    allergies: p?.allergies ?? [],
    restrictions: p?.restrictions ?? [],
    budget: p?.budget ?? "",
    needs_professional_guidance: p?.needs_professional_guidance ?? false,
  };
}

