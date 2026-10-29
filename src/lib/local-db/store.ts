import "server-only";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Banco local do modo demo: um arquivo JSON em .local-db/ com as mesmas tabelas do
 * esquema Supabase (supabase/migrations/20261027000100_init.sql). Carregado com os
 * seeds da TACO e das receitas na primeira execução.
 */
export type Row = Record<string, unknown>;
export interface AuthUser {
  id: string;
  email: string;
  password_hash: string;
  user_metadata: Record<string, unknown>;
  created_at: string;
}
export interface LocalDb {
  version: 1;
  auth_users: AuthUser[];
  tables: Record<string, Row[]>;
}

const DIR = process.env.LOCAL_DB_DIR ?? path.join(process.cwd(), ".local-db");
const FILE = path.join(DIR, "nutriflow.json");

export const TABLES = [
  "profiles", "nutrition_targets", "weight_goals", "foods", "food_portions", "favorite_foods", "meal_types",
  "recipes", "recipe_ingredients", "favorite_recipes", "diary_entries", "meal_plans", "meal_plan_items",
  "weight_logs", "body_measurements", "milestones", "water_logs", "ai_conversations", "ai_messages",
] as const;

const today = () => new Date().toISOString().slice(0, 10);

/** Valores default das colunas (equivalente aos DEFAULT do SQL). */
export const DEFAULTS: Record<string, () => Row> = {
  profiles: () => ({
    display_name: null, age: null, sex: "unspecified", height_cm: null, activity: "light", goal: "maintain",
    target_weight_kg: null, target_date: null, meals_per_day: 4, diet_preferences: [], allergies: [], restrictions: [],
    budget: null, needs_professional_guidance: false, water_enabled: true, water_goal_ml: 2000, reminders_enabled: false,
    reminder_times: [], units_locale: "pt-BR", onboarding_completed_at: null,
  }),
  nutrition_targets: () => ({ effective_from: today(), bmr: null, tdee: null, method: "mifflin_st_jeor", is_manual: false }),
  weight_goals: () => ({ start_date: today(), target_date: null, status: "active", closed_at: null }),
  foods: () => ({
    owner_id: null, brand: null, category: null, source_ref: null, source_version: null, verified: false, ref_amount: 100,
    ref_unit: "g", kcal: null, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null, sodium_mg: null,
    nutrient_flags: {}, density_g_per_ml: null, density_is_estimate: false,
  }),
  food_portions: () => ({ owner_id: null, amount_unit: "g", source: "user" }),
  meal_types: () => ({ default_time: null, position: 100 }),
  recipes: () => ({
    owner_id: null, slug: null, summary: null, meal_types: [], prep_minutes: null, servings: 1, cost_level: null, tags: [],
    goals: [], steps: [], nutrition_basis: "ingredients_as_listed", basis_note: null, image_url: null, image_credit: null,
  }),
  recipe_ingredients: () => ({ display_quantity: null, position: 0 }),
  diary_entries: () => ({
    logged_time: null, food_id: null, recipe_id: null, portion_id: null, brand: null, unit_label: null, protein_g: null,
    carbs_g: null, fat_g: null, fiber_g: null, source: null, is_estimate: false, incomplete: false, plan_item_id: null,
  }),
  meal_plans: () => ({ start_date: today(), days: 1, target_kcal: null, origin: "generator", is_favorite: false, notes: null }),
  meal_plan_items: () => ({
    day_index: 0, suggested_time: null, recipe_id: null, food_id: null, servings: null, grams: null,
    excluded_ingredient_ids: [], done_at: null, diary_entry_id: null, position: 0,
  }),
  weight_logs: () => ({ note: null }),
  body_measurements: () => ({ waist_cm: null, hip_cm: null, chest_cm: null, arm_cm: null, thigh_cm: null }),
  milestones: () => ({ happened_on: today() }),
  water_logs: () => ({}),
  ai_conversations: () => ({ title: "Nova conversa" }),
  ai_messages: () => ({ content: "", payload: null }),
  favorite_foods: () => ({}),
  favorite_recipes: () => ({}),
};

/** Tabelas sem coluna id (chave primária composta). */
export const PRIMARY_KEYS: Record<string, string[]> = {
  favorite_foods: ["user_id", "food_id"],
  favorite_recipes: ["user_id", "recipe_id"],
};

/** Restrições UNIQUE (where = índice parcial). */
export const UNIQUES: Record<string, { cols: string[]; where?: (r: Row) => boolean }[]> = {
  meal_types: [{ cols: ["user_id", "name"] }],
  recipes: [{ cols: ["slug"], where: (r) => r.slug !== null && r.slug !== undefined }],
  weight_logs: [{ cols: ["user_id", "measured_on"] }],
  body_measurements: [{ cols: ["user_id", "measured_on"] }],
  weight_goals: [{ cols: ["user_id"], where: (r) => r.status === "active" }],
};

/** Colunas com updated_at automático (trigger touch_updated_at). */
export const TOUCHED = new Set(["profiles", "foods", "recipes", "diary_entries", "meal_plans", "ai_conversations"]);
const NO_CREATED_AT = new Set<string>();

/**
 * Relações para select com embed (alias:tabela(colunas)).
 * one = esta tabela tem a FK; many = a outra tabela aponta para esta.
 */
export const RELATIONS: Record<string, Record<string, { kind: "one" | "many"; fk: string }>> = {
  recipe_ingredients: { foods: { kind: "one", fk: "food_id" }, recipes: { kind: "one", fk: "recipe_id" } },
  recipes: { recipe_ingredients: { kind: "many", fk: "recipe_id" } },
  meal_plan_items: {
    meal_plans: { kind: "one", fk: "plan_id" },
    recipes: { kind: "one", fk: "recipe_id" },
    foods: { kind: "one", fk: "food_id" },
  },
  meal_plans: { meal_plan_items: { kind: "many", fk: "plan_id" } },
  favorite_foods: { foods: { kind: "one", fk: "food_id" } },
  favorite_recipes: { recipes: { kind: "one", fk: "recipe_id" } },
  diary_entries: { foods: { kind: "one", fk: "food_id" }, recipes: { kind: "one", fk: "recipe_id" } },
  foods: { food_portions: { kind: "many", fk: "food_id" } },
  ai_conversations: { ai_messages: { kind: "many", fk: "conversation_id" } },
};

/** Efeitos de exclusão das FKs: cascade, set null ou restrict (erro 23503). */
export const ON_DELETE: Record<string, { table: string; fk: string; action: "cascade" | "set null" | "restrict" }[]> = {
  foods: [
    { table: "food_portions", fk: "food_id", action: "cascade" },
    { table: "favorite_foods", fk: "food_id", action: "cascade" },
    { table: "recipe_ingredients", fk: "food_id", action: "restrict" },
    { table: "diary_entries", fk: "food_id", action: "set null" },
    { table: "meal_plan_items", fk: "food_id", action: "set null" },
  ],
  food_portions: [{ table: "diary_entries", fk: "portion_id", action: "set null" }],
  recipes: [
    { table: "recipe_ingredients", fk: "recipe_id", action: "cascade" },
    { table: "favorite_recipes", fk: "recipe_id", action: "cascade" },
    { table: "diary_entries", fk: "recipe_id", action: "set null" },
    { table: "meal_plan_items", fk: "recipe_id", action: "set null" },
  ],
  diary_entries: [{ table: "meal_plan_items", fk: "diary_entry_id", action: "set null" }],
  meal_plans: [{ table: "meal_plan_items", fk: "plan_id", action: "cascade" }],
  meal_plan_items: [{ table: "diary_entries", fk: "plan_item_id", action: "set null" }],
  ai_conversations: [{ table: "ai_messages", fk: "conversation_id", action: "cascade" }],
};

/** Colunas do tipo time: o Postgres devolve sempre HH:MM:SS. */
const TIME_COLS = new Set(["logged_time", "default_time", "suggested_time"]);

export const unaccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Normaliza a linha como o Postgres faria (time, colunas geradas, timestamps). */
export function prepareRow(table: string, row: Row, isInsert: boolean): Row {
  const out: Row = { ...row };
  for (const c of TIME_COLS) {
    if (typeof out[c] === "string" && /^\d{2}:\d{2}$/.test(out[c] as string)) out[c] = `${out[c]}:00`;
  }
  if (Array.isArray(out.reminder_times)) {
    out.reminder_times = (out.reminder_times as string[]).map((t) => (/^\d{2}:\d{2}$/.test(t) ? `${t}:00` : t));
  }
  const now = new Date().toISOString();
  if (isInsert) {
    if (!PRIMARY_KEYS[table] && !out.id) out.id = randomUUID();
    if (!NO_CREATED_AT.has(table) && !out.created_at) out.created_at = now;
    if (TOUCHED.has(table) && !out.updated_at) out.updated_at = now;
  } else if (TOUCHED.has(table)) {
    out.updated_at = now;
  }
  if (table === "foods") {
    out.search_text = unaccent(`${String(out.name ?? "")} ${String(out.brand ?? "")}`.toLowerCase()).trim();
  }
  return out;
}

// ---------------------------------------------------------------------------
// Seeds
// ---------------------------------------------------------------------------

/** Lê uma tupla SQL simples: 'texto', números, null, true/false, '...'::jsonb. */
function parseSqlTuple(src: string): unknown[] {
  const vals: unknown[] = [];
  let i = 0;
  const skipWs = () => { while (i < src.length && /[\s,]/.test(src[i])) i++; };
  while (i < src.length) {
    skipWs();
    if (i >= src.length) break;
    if (src[i] === "'") {
      let s = "";
      i++;
      while (i < src.length) {
        if (src[i] === "'" && src[i + 1] === "'") { s += "'"; i += 2; continue; }
        if (src[i] === "'") { i++; break; }
        s += src[i++];
      }
      if (src.startsWith("::jsonb", i)) { i += 7; vals.push(JSON.parse(s)); } else vals.push(s);
      continue;
    }
    const m = /^[^,]+/.exec(src.slice(i));
    const tok = m ? m[0].trim() : "";
    i += m ? m[0].length : 1;
    if (tok === "null") vals.push(null);
    else if (tok === "true") vals.push(true);
    else if (tok === "false") vals.push(false);
    else vals.push(Number(tok));
  }
  return vals;
}

function seedFoods(): Row[] {
  const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/20261027000200_seed_taco.sql"), "utf8");
  const cols = ["source", "source_ref", "source_version", "verified", "name", "category", "ref_amount", "ref_unit",
    "kcal", "protein_g", "carbs_g", "fat_g", "fiber_g", "sodium_mg", "nutrient_flags", "density_g_per_ml", "density_is_estimate"];
  const rows: Row[] = [];
  for (const line of sql.split(/\r?\n/)) {
    const m = /^\s*\((.*)\),?\s*$/.exec(line);
    if (!m || !line.trimStart().startsWith("('TACO'")) continue;
    const vals = parseSqlTuple(m[1]);
    const r: Row = { ...DEFAULTS.foods() };
    cols.forEach((c, k) => { r[c] = vals[k]; });
    rows.push(prepareRow("foods", r, true));
  }
  return rows;
}

interface RecipeSeed {
  slug: string; name: string; summary: string; meal_types: string[]; prep: number; servings: number; cost: number;
  tags: string[]; goals: string[]; ing: [string, number, string][]; steps: string[]; basis?: string;
}

function seedRecipes(foods: Row[]) {
  const list = JSON.parse(readFileSync(path.join(process.cwd(), "scripts/recipes.json"), "utf8")) as RecipeSeed[];
  const byRef = new Map(foods.map((f) => [f.source_ref as string, f.id as string]));
  const recipes: Row[] = [];
  const ingredients: Row[] = [];
  for (const r of list) {
    const rec = prepareRow("recipes", {
      ...DEFAULTS.recipes(), slug: r.slug, name: r.name, summary: r.summary, meal_types: r.meal_types, prep_minutes: r.prep,
      servings: r.servings, cost_level: r.cost, tags: r.tags, goals: r.goals, steps: r.steps,
      basis_note: r.basis ?? "Soma dos ingredientes no estado listado (ex.: arroz e feijão já cozidos). Temperos sem valor energético relevante não entram no cálculo.",
    }, true);
    recipes.push(rec);
    r.ing.forEach(([ref, grams, label], pos) => {
      const foodId = byRef.get(ref);
      if (!foodId) return;
      ingredients.push(prepareRow("recipe_ingredients", { recipe_id: rec.id, food_id: foodId, grams, display_quantity: label, position: pos }, true));
    });
  }
  return { recipes, ingredients };
}

function freshDb(): LocalDb {
  const tables = Object.fromEntries(TABLES.map((t) => [t, [] as Row[]])) as Record<string, Row[]>;
  tables.foods = seedFoods();
  const { recipes, ingredients } = seedRecipes(tables.foods);
  tables.recipes = recipes;
  tables.recipe_ingredients = ingredients;
  return { version: 1, auth_users: [], tables };
}

// ---------------------------------------------------------------------------
// Persistência (cache em memória por processo + gravação atômica no arquivo)
// ---------------------------------------------------------------------------
const g = globalThis as unknown as { __nfLocalDb?: LocalDb; __nfLocalDbMtime?: number };

export function getDb(): LocalDb {
  const mtime = existsSync(FILE) ? statSync(FILE).mtimeMs : null;
  // recarrega se outro processo (ou o usuário) alterou o arquivo
  if (g.__nfLocalDb && mtime === g.__nfLocalDbMtime) return g.__nfLocalDb;
  if (mtime !== null) {
    g.__nfLocalDb = JSON.parse(readFileSync(FILE, "utf8")) as LocalDb;
    g.__nfLocalDbMtime = mtime;
    for (const t of TABLES) g.__nfLocalDb.tables[t] ??= [];
  } else {
    g.__nfLocalDb = freshDb();
    saveDb();
  }
  return g.__nfLocalDb;
}

export function saveDb() {
  if (!g.__nfLocalDb) return;
  mkdirSync(DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(g.__nfLocalDb));
  renameSync(tmp, FILE);
  g.__nfLocalDbMtime = statSync(FILE).mtimeMs;
}
