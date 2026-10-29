// Tipos de domínio; espelham supabase/migrations/20261027000100_init.sql

export type GoalKind = "lose" | "maintain" | "gain";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type SexForEquation = "female" | "male" | "unspecified";
export type FoodSource = "TACO" | "TBCA" | "LABEL" | "USER";
export type BaseUnit = "g" | "ml";
export type EntryUnit = "g" | "kg" | "ml" | "l" | "portion" | "serving";
export type BudgetLevel = "low" | "medium" | "high";

export type NutrientKey = "kcal" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g";
export type NutrientFlag = "NA" | "Tr" | "*" | "missing";

export interface Food {
  id: string;
  owner_id: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  source: FoodSource;
  source_ref: string | null;
  source_version: string | null;
  verified: boolean;
  ref_amount: number;
  ref_unit: BaseUnit;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sodium_mg: number | null;
  nutrient_flags: Partial<Record<string, NutrientFlag>>;
  density_g_per_ml: number | null;
  density_is_estimate: boolean;
}

export interface FoodPortion {
  id: string;
  food_id: string;
  owner_id: string | null;
  label: string;
  amount: number;
  amount_unit: BaseUnit;
  source: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  age: number | null;
  sex: SexForEquation;
  height_cm: number | null;
  activity: ActivityLevel;
  goal: GoalKind;
  target_weight_kg: number | null;
  target_date: string | null;
  meals_per_day: number;
  diet_preferences: string[];
  allergies: string[];
  restrictions: string[];
  budget: BudgetLevel | null;
  needs_professional_guidance: boolean;
  water_enabled: boolean;
  water_goal_ml: number;
  reminders_enabled: boolean;
  reminder_times: string[];
  onboarding_completed_at: string | null;
}

export interface NutritionTarget {
  id: string;
  effective_from: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  bmr: number | null;
  tdee: number | null;
  method: string;
  is_manual: boolean;
  created_at: string;
}

export interface DiaryEntry {
  id: string;
  user_id?: string;
  entry_date: string;
  meal_slot: string;
  logged_time: string | null;
  food_id: string | null;
  recipe_id: string | null;
  portion_id: string | null;
  name: string;
  brand: string | null;
  quantity: number;
  unit: EntryUnit;
  unit_label: string | null;
  base_amount: number;
  kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  source: FoodSource | null;
  is_estimate: boolean;
  incomplete: boolean;
  plan_item_id: string | null;
  created_at: string;
}

export interface Recipe {
  id: string;
  owner_id: string | null;
  slug: string | null;
  name: string;
  summary: string | null;
  meal_types: string[];
  prep_minutes: number | null;
  servings: number;
  cost_level: number | null;
  tags: string[];
  goals: GoalKind[];
  steps: string[];
  nutrition_basis: string;
  basis_note: string | null;
  image_url: string | null;
  image_credit: string | null;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  food_id: string;
  grams: number;
  display_quantity: string | null;
  position: number;
  food: Food;
}

export interface RecipeWithIngredients extends Recipe {
  ingredients: RecipeIngredient[];
}

export interface WeightLog {
  id: string;
  measured_on: string;
  weight_kg: number;
  note: string | null;
}

export interface WeightGoal {
  id: string;
  start_weight_kg: number;
  target_weight_kg: number;
  start_date: string;
  target_date: string | null;
  status: "active" | "achieved" | "archived";
  created_at: string;
  closed_at: string | null;
}

export interface MealPlan {
  id: string;
  name: string;
  start_date: string;
  days: number;
  target_kcal: number | null;
  origin: "generator" | "ai" | "manual";
  is_favorite: boolean;
  notes: string | null;
  created_at: string;
}

export interface MealPlanItem {
  id: string;
  plan_id: string;
  day_index: number;
  meal_slot: string;
  suggested_time: string | null;
  recipe_id: string | null;
  food_id: string | null;
  servings: number | null;
  grams: number | null;
  excluded_ingredient_ids: string[];
  done_at: string | null;
  diary_entry_id: string | null;
  position: number;
}
