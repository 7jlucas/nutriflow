import "server-only";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSessionToken, LOCAL_SESSION_COOKIE, sessionCookieOptions, verifySessionToken } from "./session";
import {
  type AuthUser, DEFAULTS, getDb, ON_DELETE, PRIMARY_KEYS, prepareRow, RELATIONS, type Row, saveDb, TABLES, unaccent, UNIQUES,
} from "./store";

/**
 * Cliente que imita o subconjunto da API do supabase-js usado pelo app, sobre o banco
 * local em arquivo. Aplica as mesmas regras de acesso das policies RLS do esquema.
 */

export interface CookieJar {
  get(name: string): string | undefined;
  set(name: string, value: string, options: Record<string, unknown>): void;
}

interface PgError { message: string; code: string; details: string | null; hint: string | null }
const pgError = (code: string, message: string): PgError => ({ code, message, details: null, hint: null });

const USER_TABLES = new Set([
  "nutrition_targets", "weight_goals", "favorite_foods", "meal_types", "favorite_recipes", "diary_entries", "meal_plans",
  "meal_plan_items", "weight_logs", "body_measurements", "milestones", "water_logs", "ai_conversations", "ai_messages",
]);

type Ctx = { uid: string | null; admin: boolean };

// ---------------------------------------------------------------------------
// Regras de acesso (espelho das policies RLS)
// ---------------------------------------------------------------------------
function findById(table: string, id: unknown) {
  return getDb().tables[table].find((r) => r.id === id);
}

function canRead(ctx: Ctx, table: string, r: Row): boolean {
  if (ctx.admin) return true;
  const uid = ctx.uid;
  if (!uid) return false;
  if (table === "profiles") return r.id === uid;
  if (table === "foods" || table === "recipes" || table === "food_portions") return r.owner_id === null || r.owner_id === uid;
  if (table === "recipe_ingredients") {
    const rec = findById("recipes", r.recipe_id);
    return Boolean(rec && (rec.owner_id === null || rec.owner_id === uid));
  }
  if (table === "meal_plan_items") return r.user_id === uid && findById("meal_plans", r.plan_id)?.user_id === uid;
  if (table === "ai_messages") return r.user_id === uid && findById("ai_conversations", r.conversation_id)?.user_id === uid;
  if (USER_TABLES.has(table)) return r.user_id === uid;
  return false;
}

function canWrite(ctx: Ctx, table: string, r: Row, op: "insert" | "update" | "delete"): boolean {
  if (ctx.admin) return true;
  const uid = ctx.uid;
  if (!uid) return false;
  if (table === "profiles") return r.id === uid;
  if (table === "foods") return r.owner_id === uid && (op === "delete" || (r.source === "USER" && r.verified === false));
  if (table === "recipes") return r.owner_id === uid;
  if (table === "food_portions") {
    if (op === "update") return false;
    if (op === "delete") return r.owner_id === uid;
    const food = findById("foods", r.food_id);
    return r.owner_id === uid && r.source === "user" && Boolean(food && (food.owner_id === null || food.owner_id === uid));
  }
  if (table === "recipe_ingredients") {
    const rec = findById("recipes", r.recipe_id);
    if (!rec || rec.owner_id !== uid) return false;
    if (op === "delete") return true;
    const food = findById("foods", r.food_id);
    return Boolean(food && (food.owner_id === null || food.owner_id === uid));
  }
  return canRead(ctx, table, r);
}

// ---------------------------------------------------------------------------
// Comparação e filtros
// ---------------------------------------------------------------------------
const isNil = (v: unknown) => v === null || v === undefined;

function cmp(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  const na = Number(a), nb = Number(b);
  if (typeof a !== "string" || typeof b !== "string") {
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  }
  const sa = String(a), sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}
const eq = (a: unknown, b: unknown) => !isNil(a) && !isNil(b) && (a === b || String(a) === String(b));

// ---------------------------------------------------------------------------
// Select com embeds: "*, alias:tabela(col, outra:tabela(*))"
// ---------------------------------------------------------------------------
type SelItem = { kind: "all" } | { kind: "col"; name: string; alias: string } | { kind: "embed"; alias: string; table: string; inner: SelItem[] };

function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

function parseSelect(s: string): SelItem[] {
  return splitTop(s).map((part): SelItem => {
    if (part === "*") return { kind: "all" };
    const m = /^(?:([a-z_]+):)?([a-z_]+)(?:!\w+)?\(([\s\S]*)\)$/.exec(part);
    if (m) return { kind: "embed", alias: m[1] ?? m[2], table: m[2], inner: parseSelect(m[3]) };
    const [alias, name] = part.includes(":") ? part.split(":").map((x) => x.trim()) : [part, part];
    return { kind: "col", name, alias };
  });
}

function project(ctx: Ctx, table: string, row: Row, items: SelItem[]): Row {
  const out: Row = {};
  for (const it of items) {
    if (it.kind === "all") {
      Object.assign(out, row);
      if (table === "foods") delete out.search_text;
    } else if (it.kind === "col") {
      out[it.alias] = row[it.name] ?? null;
    } else {
      const rel = RELATIONS[table]?.[it.table];
      if (!rel) throw new Error(`[local-db] relação desconhecida: ${table} -> ${it.table}`);
      const rows = getDb().tables[it.table];
      if (rel.kind === "one") {
        const target = rows.find((r) => r.id === row[rel.fk] && canRead(ctx, it.table, r));
        out[it.alias] = target ? project(ctx, it.table, target, it.inner) : null;
      } else {
        out[it.alias] = rows.filter((r) => r[rel.fk] === row.id && canRead(ctx, it.table, r)).map((r) => project(ctx, it.table, r, it.inner));
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------------
type Result = { data: unknown; error: PgError | null; count: number | null; status: number; statusText: string };

class LocalQuery implements PromiseLike<Result> {
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private filters: ((r: Row) => boolean)[] = [];
  private orders: { col: string; asc: boolean; nullsFirst: boolean }[] = [];
  private limitN: number | null = null;
  private offset = 0;
  private returning: string | null = null;
  private countMode = false;
  private head = false;
  private mode: "many" | "single" | "maybe" = "many";
  private payload: Row[] = [];
  private patch: Row = {};
  private onConflict: string[] | null = null;
  private ignoreDuplicates = false;

  constructor(private ctx: Ctx, private table: string) {
    if (!(TABLES as readonly string[]).includes(table)) throw new Error(`[local-db] tabela desconhecida: ${table}`);
  }

  select(cols = "*", opts?: { count?: string; head?: boolean }) {
    this.returning = cols;
    if (opts?.count) this.countMode = true;
    if (opts?.head) this.head = true;
    return this;
  }
  insert(values: Row | Row[]) { this.op = "insert"; this.payload = Array.isArray(values) ? values : [values]; return this; }
  upsert(values: Row | Row[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.op = "upsert";
    this.payload = Array.isArray(values) ? values : [values];
    this.onConflict = opts?.onConflict ? opts.onConflict.split(",").map((c) => c.trim()) : null;
    this.ignoreDuplicates = Boolean(opts?.ignoreDuplicates);
    return this;
  }
  update(values: Row, opts?: { count?: string }) { this.op = "update"; this.patch = values; if (opts?.count) this.countMode = true; return this; }
  delete(opts?: { count?: string }) { this.op = "delete"; if (opts?.count) this.countMode = true; return this; }

  eq(col: string, v: unknown) { this.filters.push((r) => eq(r[col], v)); return this; }
  neq(col: string, v: unknown) { this.filters.push((r) => !isNil(r[col]) && !eq(r[col], v)); return this; }
  gt(col: string, v: unknown) { this.filters.push((r) => !isNil(r[col]) && cmp(r[col], v) > 0); return this; }
  gte(col: string, v: unknown) { this.filters.push((r) => !isNil(r[col]) && cmp(r[col], v) >= 0); return this; }
  lt(col: string, v: unknown) { this.filters.push((r) => !isNil(r[col]) && cmp(r[col], v) < 0); return this; }
  lte(col: string, v: unknown) { this.filters.push((r) => !isNil(r[col]) && cmp(r[col], v) <= 0); return this; }
  in(col: string, vs: unknown[]) { this.filters.push((r) => vs.some((v) => eq(r[col], v))); return this; }
  is(col: string, v: null | boolean) { this.filters.push((r) => (v === null ? isNil(r[col]) : r[col] === v)); return this; }
  ilike(col: string, pattern: string) {
    const re = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".")}$`, "i");
    this.filters.push((r) => typeof r[col] === "string" && re.test(r[col] as string));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    const asc = opts?.ascending ?? true;
    this.orders.push({ col, asc, nullsFirst: opts?.nullsFirst ?? !asc });
    return this;
  }
  limit(n: number) { this.limitN = n; return this; }
  range(from: number, to: number) { this.offset = from; this.limitN = to - from + 1; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }

  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, fail?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve().then(() => this.run()).then(ok, fail);
  }

  private matches(r: Row) { return this.filters.every((f) => f(r)); }

  private uniqueViolation(row: Row, ignore?: Row): PgError | null {
    const rows = getDb().tables[this.table];
    const keys = PRIMARY_KEYS[this.table] ?? ["id"];
    const all = [{ cols: keys }, ...(UNIQUES[this.table] ?? [])] as { cols: string[]; where?: (r: Row) => boolean }[];
    for (const u of all) {
      if (u.where && !u.where(row)) continue;
      const clash = rows.find((o) => o !== ignore && (!u.where || u.where(o)) && u.cols.every((c) => eq(o[c], row[c])));
      if (clash) return pgError("23505", `duplicate key value violates unique constraint (${this.table}: ${u.cols.join(", ")})`);
    }
    return null;
  }

  private doInsert(raw: Row): { row?: Row; error?: PgError } {
    const row = prepareRow(this.table, { ...(DEFAULTS[this.table]?.() ?? {}), ...raw }, true);
    if (!canWrite(this.ctx, this.table, row, "insert")) return { error: pgError("42501", `new row violates row-level security policy for table "${this.table}"`) };
    const dup = this.uniqueViolation(row);
    if (dup) return { error: dup };
    getDb().tables[this.table].push(row);
    return { row };
  }

  private applyUpdate(target: Row, patch: Row): PgError | null {
    const next = prepareRow(this.table, { ...target, ...patch }, false);
    if (!canWrite(this.ctx, this.table, next, "update")) return pgError("42501", `new row violates row-level security policy for table "${this.table}"`);
    const dup = this.uniqueViolation(next, target);
    if (dup) return dup;
    Object.assign(target, next);
    return null;
  }

  private run(): Result {
    const db = getDb();
    const rows = db.tables[this.table];
    let affected: Row[] = [];
    let error: PgError | null = null;

    if (this.op === "select") {
      affected = rows.filter((r) => canRead(this.ctx, this.table, r) && this.matches(r));
    } else if (this.op === "insert") {
      for (const p of this.payload) {
        const res = this.doInsert(p);
        if (res.error) { error = res.error; break; }
        affected.push(res.row!);
      }
    } else if (this.op === "upsert") {
      const keys = this.onConflict ?? PRIMARY_KEYS[this.table] ?? ["id"];
      for (const p of this.payload) {
        const existing = keys.every((k) => !isNil(p[k])) ? rows.find((r) => keys.every((k) => eq(r[k], p[k]))) : undefined;
        if (existing) {
          if (this.ignoreDuplicates) continue;
          if (!canWrite(this.ctx, this.table, existing, "update")) { error = pgError("42501", "row-level security"); break; }
          const e = this.applyUpdate(existing, p);
          if (e) { error = e; break; }
          affected.push(existing);
        } else {
          const res = this.doInsert(p);
          if (res.error) { error = res.error; break; }
          affected.push(res.row!);
        }
      }
    } else if (this.op === "update") {
      const targets = rows.filter((r) => canRead(this.ctx, this.table, r) && canWrite(this.ctx, this.table, r, "update") && this.matches(r));
      for (const t of targets) {
        const e = this.applyUpdate(t, this.patch);
        if (e) { error = e; break; }
        affected.push(t);
      }
    } else {
      const targets = rows.filter((r) => canRead(this.ctx, this.table, r) && canWrite(this.ctx, this.table, r, "delete") && this.matches(r));
      error = deleteRows(this.table, targets);
      if (!error) affected = targets;
    }

    if (this.op !== "select" && !error) saveDb();
    if (error) return { data: null, error, count: null, status: error.code === "42501" ? 403 : 409, statusText: "Error" };

    if (this.op === "select") {
      for (const o of [...this.orders].reverse()) {
        affected = [...affected].sort((a, b) => {
          const va = a[o.col], vb = b[o.col];
          if (isNil(va) && isNil(vb)) return 0;
          if (isNil(va)) return o.nullsFirst ? -1 : 1;
          if (isNil(vb)) return o.nullsFirst ? 1 : -1;
          return o.asc ? cmp(va, vb) : cmp(vb, va);
        });
      }
    }
    const count = this.countMode ? affected.length : null;
    if (this.op === "select") affected = affected.slice(this.offset, this.limitN === null ? undefined : this.offset + this.limitN);

    const wantsRows = this.op === "select" || this.returning !== null;
    if (this.head || !wantsRows) return { data: null, error: null, count, status: this.op === "insert" ? 201 : 200, statusText: "OK" };

    const items = parseSelect(this.returning ?? "*");
    const data = affected.map((r) => project(this.ctx, this.table, r, items));
    if (this.mode === "single" && data.length !== 1) {
      return { data: null, error: pgError("PGRST116", "JSON object requested, multiple (or no) rows returned"), count, status: 406, statusText: "Not Acceptable" };
    }
    if (this.mode === "maybe" && data.length > 1) {
      return { data: null, error: pgError("PGRST116", "JSON object requested, multiple rows returned"), count, status: 406, statusText: "Not Acceptable" };
    }
    return { data: this.mode === "many" ? data : (data[0] ?? null), error: null, count, status: 200, statusText: "OK" };
  }
}

/** Exclui linhas aplicando ON DELETE (cascade / set null / restrict). Não grava no arquivo. */
function deleteRows(table: string, targets: Row[]): PgError | null {
  if (!targets.length) return null;
  const db = getDb();
  const ids = new Set(targets.map((t) => t.id));
  for (const fk of ON_DELETE[table] ?? []) {
    if (fk.action === "restrict" && db.tables[fk.table].some((r) => ids.has(r[fk.fk]))) {
      return pgError("23503", `update or delete on table "${table}" violates foreign key constraint on table "${fk.table}"`);
    }
  }
  for (const fk of ON_DELETE[table] ?? []) {
    const children = db.tables[fk.table].filter((r) => ids.has(r[fk.fk]));
    if (fk.action === "set null") children.forEach((c) => { c[fk.fk] = null; });
    if (fk.action === "cascade") {
      const e = deleteRows(fk.table, children);
      if (e) return e;
    }
  }
  const set = new Set(targets);
  db.tables[table] = db.tables[table].filter((r) => !set.has(r));
  return null;
}

// ---------------------------------------------------------------------------
// RPCs (espelho das funções SQL)
// ---------------------------------------------------------------------------
const round1 = (n: number) => Math.round(n * 10) / 10;

function rpc(ctx: Ctx, name: string, args: Record<string, unknown>): { data: unknown; error: PgError | null } {
  const db = getDb();
  const uid = ctx.uid;
  if (!uid && !ctx.admin) return { data: null, error: pgError("42501", "permission denied") };
  const diary = db.tables.diary_entries.filter((d) => d.user_id === uid);
  const strip = (f: Row) => { const { search_text: _s, ...rest } = f; return rest; };

  if (name === "search_foods") {
    const t = unaccent(String(args.q ?? "").trim().toLowerCase());
    if (t.length < 2) return { data: [], error: null };
    const words = t.split(/\s+/).filter(Boolean);
    const max = Math.min(Math.max(Number(args.max_results ?? 30), 1), 60);
    const hits = db.tables.foods
      .filter((f) => canRead(ctx, "foods", f))
      .map((f) => ({ f, s: String(f.search_text ?? "") }))
      .filter(({ s }) => s.includes(t) || words.every((w) => s.includes(w)))
      .sort((a, b) =>
        Number(b.f.owner_id !== null) - Number(a.f.owner_id !== null) ||
        Number(b.s.startsWith(t)) - Number(a.s.startsWith(t)) ||
        Number(b.s.includes(t)) - Number(a.s.includes(t)) ||
        String(a.f.name).length - String(b.f.name).length);
    return { data: hits.slice(0, max).map(({ f }) => strip(f)), error: null };
  }
  if (name === "daily_totals") {
    const from = String(args.from_date), to = String(args.to_date);
    const by = new Map<string, Row[]>();
    for (const d of diary) {
      const day = String(d.entry_date);
      if (day < from || day > to) continue;
      by.set(day, [...(by.get(day) ?? []), d]);
    }
    const sum = (xs: Row[], c: string) => round1(xs.reduce((a, x) => a + Number(x[c] ?? 0), 0));
    const data = [...by.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([entry_date, xs]) => ({
      entry_date, kcal: sum(xs, "kcal"), protein_g: sum(xs, "protein_g"), carbs_g: sum(xs, "carbs_g"), fat_g: sum(xs, "fat_g"),
      fiber_g: sum(xs, "fiber_g"), items: xs.length, incomplete: xs.filter((x) => x.incomplete).length,
    }));
    return { data, error: null };
  }
  if (name === "top_foods") {
    const from = String(args.from_date), to = String(args.to_date);
    const by = new Map<string, Row[]>();
    for (const d of diary) {
      const day = String(d.entry_date);
      if (day < from || day > to || !d.food_id) continue;
      by.set(String(d.food_id), [...(by.get(String(d.food_id)) ?? []), d]);
    }
    const data = [...by.entries()]
      .map(([food_id, xs]) => ({
        food_id, name: xs.map((x) => String(x.name)).sort()[0], times: xs.length, kcal: round1(xs.reduce((a, x) => a + Number(x.kcal ?? 0), 0)),
      }))
      .sort((a, b) => b.times - a.times || b.kcal - a.kcal)
      .slice(0, Number(args.max_results ?? 8));
    return { data, error: null };
  }
  if (name === "recent_foods") {
    const last = new Map<string, string>();
    for (const d of diary) {
      if (!d.food_id) continue;
      const k = String(d.food_id), at = String(d.created_at);
      if (!last.has(k) || at > last.get(k)!) last.set(k, at);
    }
    const data = [...last.entries()]
      .sort((a, b) => (a[1] < b[1] ? 1 : -1))
      .map(([id]) => db.tables.foods.find((f) => f.id === id))
      .filter((f): f is Row => Boolean(f))
      .slice(0, Number(args.max_results ?? 12))
      .map(strip);
    return { data, error: null };
  }
  return { data: null, error: pgError("PGRST202", `função ${name} não existe no modo local`) };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 32).toString("hex")}`;
}
function checkPassword(pw: string, stored: string) {
  const [salt, hash] = stored.split(":");
  const a = Buffer.from(hash, "hex"), b = scryptSync(pw, salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}
const publicUser = (u: AuthUser) => ({
  id: u.id, email: u.email, user_metadata: u.user_metadata, app_metadata: { provider: "email" }, aud: "authenticated",
  role: "authenticated", created_at: u.created_at,
});
const authError = (message: string, code: string, status: number) => ({ name: "AuthApiError", message, code, status });

/** Remove o usuário e tudo que é dele (equivalente ao ON DELETE CASCADE de auth.users). */
function deleteUserData(uid: string) {
  const db = getDb();
  for (const t of TABLES) {
    const owned = db.tables[t].filter((r) => (t === "profiles" ? r.id === uid : r.user_id === uid || ((t === "foods" || t === "recipes" || t === "food_portions") && r.owner_id === uid)));
    // receitas antes de alimentos para não esbarrar no restrict de recipe_ingredients
    if (t === "foods") continue;
    deleteRows(t, owned);
  }
  deleteRows("foods", db.tables.foods.filter((r) => r.owner_id === uid));
  db.auth_users = db.auth_users.filter((u) => u.id !== uid);
  saveDb();
}

function createAuth(jar: CookieJar | null) {
  const currentId = () => verifySessionToken(jar?.get(LOCAL_SESSION_COOKIE));
  const currentUser = () => {
    const id = currentId();
    return id ? getDb().auth_users.find((u) => u.id === id) ?? null : null;
  };
  const startSession = (u: AuthUser) => jar?.set(LOCAL_SESSION_COOKIE, createSessionToken(u.id), sessionCookieOptions);
  const missing = () => ({ data: { user: null }, error: authError("Auth session missing!", "session_missing", 401) });

  return {
    async getUser() {
      const u = currentUser();
      return u ? { data: { user: publicUser(u) }, error: null } : missing();
    },
    async getClaims() {
      const u = currentUser();
      return u ? { data: { claims: { sub: u.id, email: u.email, role: "authenticated" } }, error: null } : { data: null, error: null };
    },
    async signUp({ email, password, options }: { email: string; password: string; options?: { data?: Record<string, unknown> } }) {
      const db = getDb();
      const norm = email.trim().toLowerCase();
      if (db.auth_users.some((u) => u.email === norm)) return { data: { user: null, session: null }, error: authError("User already registered", "user_already_exists", 422) };
      const u: AuthUser = { id: randomUUID(), email: norm, password_hash: hashPassword(password), user_metadata: options?.data ?? {}, created_at: new Date().toISOString() };
      db.auth_users.push(u);
      // trigger handle_new_user
      const name = String(u.user_metadata.display_name ?? "").slice(0, 60);
      db.tables.profiles.push(prepareRow("profiles", { ...DEFAULTS.profiles(), id: u.id, display_name: name || null }, true));
      saveDb();
      startSession(u);
      return { data: { user: publicUser(u), session: { user: publicUser(u) } }, error: null };
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const u = getDb().auth_users.find((x) => x.email === email.trim().toLowerCase());
      if (!u || !checkPassword(password, u.password_hash)) return { data: { user: null, session: null }, error: authError("Invalid login credentials", "invalid_credentials", 400) };
      startSession(u);
      return { data: { user: publicUser(u), session: { user: publicUser(u) } }, error: null };
    },
    async signOut() {
      jar?.set(LOCAL_SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
      return { error: null };
    },
    async updateUser({ password }: { password?: string }) {
      const u = currentUser();
      if (!u) return missing();
      if (password) {
        if (checkPassword(password, u.password_hash)) return { data: { user: null }, error: authError("New password should be different", "same_password", 422) };
        u.password_hash = hashPassword(password);
        saveDb();
      }
      return { data: { user: publicUser(u) }, error: null };
    },
    // Sem envio de e-mail no modo local: a recuperação de senha não tem efeito.
    async resetPasswordForEmail() { return { data: {}, error: null }; },
    async exchangeCodeForSession() { return { data: { session: null }, error: authError("Links de e-mail não existem no modo local", "unsupported", 400) }; },
    admin: {
      async deleteUser(id: string) { deleteUserData(id); return { data: {}, error: null }; },
    },
  };
}

// ---------------------------------------------------------------------------
function buildClient(ctxFn: () => Ctx, jar: CookieJar | null) {
  const auth = createAuth(jar);
  return {
    auth,
    from: (table: string) => new LocalQuery(ctxFn(), table),
    rpc: async (name: string, args: Record<string, unknown> = {}) => ({ ...rpc(ctxFn(), name, args), count: null, status: 200, statusText: "OK" }),
  };
}

/** Cliente com a sessão do cookie (equivalente ao createServerClient). */
export function createLocalClient(jar: CookieJar): SupabaseClient {
  const ctx = (): Ctx => ({ uid: verifySessionToken(jar.get(LOCAL_SESSION_COOKIE)), admin: false });
  return buildClient(ctx, jar) as unknown as SupabaseClient;
}

/** Cliente administrativo (ignora as regras de acesso, como a service role). */
export function createLocalAdminClient(): SupabaseClient {
  return buildClient(() => ({ uid: null, admin: true }), null) as unknown as SupabaseClient;
}
