-- ============================================================================
-- NUTRI//FLOW — esquema inicial
-- Postgres 15+ / Supabase. Todas as tabelas de usuário usam RLS por auth.uid().
-- ============================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- unaccent() não é IMMUTABLE; wrapper para permitir índices de busca.
create or replace function public.f_unaccent(text)
returns text
language sql immutable parallel safe strict
set search_path = ''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.goal_kind as enum ('lose', 'maintain', 'gain');
create type public.activity_level as enum ('sedentary', 'light', 'moderate', 'active', 'very_active');
create type public.sex_for_equation as enum ('female', 'male', 'unspecified');
create type public.food_source as enum ('TACO', 'TBCA', 'LABEL', 'USER');
create type public.base_unit as enum ('g', 'ml');
create type public.entry_unit as enum ('g', 'kg', 'ml', 'l', 'portion', 'serving');
create type public.budget_level as enum ('low', 'medium', 'high');

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

-- ---------------------------------------------------------------------------
-- Perfil nutricional (1:1 com auth.users). Minimização de dados (LGPD):
-- coletamos só o que alimenta os cálculos.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  age smallint check (age between 13 and 110),
  sex public.sex_for_equation not null default 'unspecified',
  height_cm numeric(5,1) check (height_cm between 100 and 250),
  activity public.activity_level not null default 'light',
  goal public.goal_kind not null default 'maintain',
  target_weight_kg numeric(5,1) check (target_weight_kg between 30 and 350),
  target_date date,
  meals_per_day smallint not null default 4 check (meals_per_day between 1 and 8),
  diet_preferences text[] not null default '{}',
  allergies text[] not null default '{}',
  restrictions text[] not null default '{}',
  budget public.budget_level,
  -- Gestação/lactação, condição médica relevante ou histórico de TA:
  -- quando true, o app NÃO gera metas automáticas de déficit/superávit.
  needs_professional_guidance boolean not null default false,
  water_enabled boolean not null default true,
  water_goal_ml integer not null default 2000 check (water_goal_ml between 250 and 8000),
  reminders_enabled boolean not null default false,
  reminder_times time[] not null default '{}',
  units_locale text not null default 'pt-BR',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Cria o perfil automaticamente quando um usuário se cadastra.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60), ''))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Metas nutricionais (histórico versionado — nunca sobrescrevemos)
-- ---------------------------------------------------------------------------
create table public.nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  effective_from date not null default current_date,
  kcal integer not null check (kcal between 800 and 6000),
  protein_g integer not null check (protein_g between 0 and 500),
  carbs_g integer not null check (carbs_g between 0 and 1000),
  fat_g integer not null check (fat_g between 0 and 400),
  bmr integer,
  tdee integer,
  method text not null default 'mifflin_st_jeor',
  is_manual boolean not null default false,
  created_at timestamptz not null default now()
);
create index nutrition_targets_user_date on public.nutrition_targets (user_id, effective_from desc, created_at desc);

-- Metas de peso (histórico de metas)
create table public.weight_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  start_weight_kg numeric(5,1) not null check (start_weight_kg between 25 and 400),
  target_weight_kg numeric(5,1) not null check (target_weight_kg between 25 and 400),
  start_date date not null default current_date,
  target_date date,
  status text not null default 'active' check (status in ('active', 'achieved', 'archived')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create unique index weight_goals_one_active on public.weight_goals (user_id) where status = 'active';

-- ---------------------------------------------------------------------------
-- Alimentos (globais = owner_id null; personalizados = owner_id do usuário)
-- Valores nutricionais por ref_amount ref_unit (TACO: por 100 g).
-- null = dado ausente (não inventado). nutrient_flags guarda legendas da fonte.
-- ---------------------------------------------------------------------------
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  brand text check (char_length(brand) <= 80),
  category text,
  source public.food_source not null,
  source_ref text,
  source_version text,
  verified boolean not null default false,
  ref_amount numeric(8,2) not null default 100 check (ref_amount > 0),
  ref_unit public.base_unit not null default 'g',
  kcal numeric(7,1) check (kcal >= 0),
  protein_g numeric(6,1) check (protein_g >= 0),
  carbs_g numeric(6,1) check (carbs_g >= 0),
  fat_g numeric(6,1) check (fat_g >= 0),
  fiber_g numeric(6,1) check (fiber_g >= 0),
  sodium_mg numeric(7,0) check (sodium_mg >= 0),
  nutrient_flags jsonb not null default '{}'::jsonb,
  density_g_per_ml numeric(5,3) check (density_g_per_ml > 0),
  density_is_estimate boolean not null default false,
  search_text text generated always as (public.f_unaccent(lower(name || ' ' || coalesce(brand, '')))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_food_source check ((owner_id is null) = (source <> 'USER'))
);
create trigger foods_touch before update on public.foods
  for each row execute function public.touch_updated_at();
create unique index foods_source_ref_global on public.foods (source, source_ref) where owner_id is null;
create index foods_search_trgm on public.foods using gin (search_text extensions.gin_trgm_ops);
create index foods_owner on public.foods (owner_id) where owner_id is not null;

-- Medidas caseiras / porções com conversão explícita em gramas (ou ml).
-- owner_id null = medida publicada pela fonte; não-null = definida pelo usuário.
create table public.food_portions (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods (id) on delete cascade,
  owner_id uuid references auth.users (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  amount numeric(8,2) not null check (amount > 0),
  amount_unit public.base_unit not null default 'g',
  source text not null default 'user',
  created_at timestamptz not null default now()
);
create index food_portions_food on public.food_portions (food_id);

create table public.favorite_foods (
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, food_id)
);

-- ---------------------------------------------------------------------------
-- Tipos de refeição personalizados (os 6 padrões são constantes do app)
-- ---------------------------------------------------------------------------
create table public.meal_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  default_time time,
  position smallint not null default 100,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- ---------------------------------------------------------------------------
-- Receitas (globais = owner_id null) e ingredientes
-- ---------------------------------------------------------------------------
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  slug text unique,
  name text not null check (char_length(name) between 2 and 120),
  summary text,
  meal_types text[] not null default '{}',
  prep_minutes smallint check (prep_minutes between 0 and 600),
  servings numeric(5,1) not null default 1 check (servings > 0),
  cost_level smallint check (cost_level between 1 and 3),
  tags text[] not null default '{}',
  goals public.goal_kind[] not null default '{}',
  steps text[] not null default '{}',
  -- Base do cálculo: 'ingredients_as_listed' = soma dos ingredientes no estado listado
  -- (ex.: arroz já cozido). Explicitado na UI.
  nutrition_basis text not null default 'ingredients_as_listed',
  basis_note text,
  -- Foto opcional (URL https com licença adequada). Sem foto, o app gera uma ilustração do prato.
  image_url text check (image_url is null or image_url ~ '^https://'),
  image_credit text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger recipes_touch before update on public.recipes
  for each row execute function public.touch_updated_at();

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete restrict,
  grams numeric(8,1) not null check (grams > 0),
  display_quantity text,
  position smallint not null default 0
);
create index recipe_ingredients_recipe on public.recipe_ingredients (recipe_id);

create table public.favorite_recipes (
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

-- ---------------------------------------------------------------------------
-- Diário alimentar — CONSUMO REAL.
-- Cada item guarda um snapshot nutricional calculado no servidor no momento do
-- registro (calorias da porção = ref × quantidade ÷ quantidade de referência).
-- ---------------------------------------------------------------------------
create table public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  meal_slot text not null check (char_length(meal_slot) between 1 and 60),
  logged_time time,
  food_id uuid references public.foods (id) on delete set null,
  recipe_id uuid references public.recipes (id) on delete set null,
  portion_id uuid references public.food_portions (id) on delete set null,
  name text not null,
  brand text,
  quantity numeric(9,2) not null check (quantity > 0),
  unit public.entry_unit not null,
  unit_label text,
  base_amount numeric(9,2) not null check (base_amount > 0), -- em g ou ml da referência
  kcal numeric(7,1) not null check (kcal >= 0),
  protein_g numeric(6,1),
  carbs_g numeric(6,1),
  fat_g numeric(6,1),
  fiber_g numeric(6,1),
  source public.food_source,
  is_estimate boolean not null default false,
  incomplete boolean not null default false,
  plan_item_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diary_has_origin check (food_id is not null or recipe_id is not null or source is not null)
);
create trigger diary_touch before update on public.diary_entries
  for each row execute function public.touch_updated_at();
create index diary_user_date on public.diary_entries (user_id, entry_date);
create index diary_user_food on public.diary_entries (user_id, food_id);

-- ---------------------------------------------------------------------------
-- Planos alimentares — PLANEJADO (separado do consumo real)
-- ---------------------------------------------------------------------------
create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  start_date date not null default current_date,
  days smallint not null default 1 check (days between 1 and 14),
  target_kcal integer,
  origin text not null default 'generator' check (origin in ('generator', 'ai', 'manual')),
  is_favorite boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger meal_plans_touch before update on public.meal_plans
  for each row execute function public.touch_updated_at();
create index meal_plans_user on public.meal_plans (user_id, created_at desc);

create table public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.meal_plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day_index smallint not null default 0 check (day_index between 0 and 13),
  meal_slot text not null,
  suggested_time time,
  recipe_id uuid references public.recipes (id) on delete set null,
  food_id uuid references public.foods (id) on delete set null,
  servings numeric(5,2),
  grams numeric(8,1),
  excluded_ingredient_ids uuid[] not null default '{}',
  done_at timestamptz,
  diary_entry_id uuid references public.diary_entries (id) on delete set null,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint plan_item_target check ((recipe_id is not null and servings > 0) or (food_id is not null and grams > 0))
);
create index meal_plan_items_plan on public.meal_plan_items (plan_id, day_index, position);

alter table public.diary_entries
  add constraint diary_plan_item_fk foreign key (plan_item_id) references public.meal_plan_items (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Peso, medidas, marcos, água
-- ---------------------------------------------------------------------------
create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(5,1) not null check (weight_kg between 25 and 400),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  unique (user_id, measured_on)
);
create index weight_logs_user_date on public.weight_logs (user_id, measured_on);

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measured_on date not null,
  waist_cm numeric(5,1) check (waist_cm between 30 and 300),
  hip_cm numeric(5,1) check (hip_cm between 30 and 300),
  chest_cm numeric(5,1) check (chest_cm between 30 and 300),
  arm_cm numeric(5,1) check (arm_cm between 10 and 100),
  thigh_cm numeric(5,1) check (thigh_cm between 20 and 150),
  created_at timestamptz not null default now(),
  unique (user_id, measured_on)
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  happened_on date not null default current_date,
  title text not null check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  ml integer not null check (ml between 1 and 5000),
  created_at timestamptz not null default now()
);
create index water_logs_user_date on public.water_logs (user_id, entry_date);

-- ---------------------------------------------------------------------------
-- AI Nutrition Lab — histórico de conversas
-- ---------------------------------------------------------------------------
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Nova conversa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_conversations_user on public.ai_conversations (user_id, updated_at desc);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  payload jsonb,
  created_at timestamptz not null default now()
);
create index ai_messages_conv on public.ai_messages (conversation_id, created_at);

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.nutrition_targets enable row level security;
alter table public.weight_goals enable row level security;
alter table public.foods enable row level security;
alter table public.food_portions enable row level security;
alter table public.favorite_foods enable row level security;
alter table public.meal_types enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.favorite_recipes enable row level security;
alter table public.diary_entries enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meal_plan_items enable row level security;
alter table public.weight_logs enable row level security;
alter table public.body_measurements enable row level security;
alter table public.milestones enable row level security;
alter table public.water_logs enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

-- Perfil: só o próprio
create policy profiles_own on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Tabelas com user_id: CRUD do próprio usuário
do $$
declare t text;
begin
  foreach t in array array['nutrition_targets','weight_goals','favorite_foods','meal_types','favorite_recipes',
    'diary_entries','meal_plans','meal_plan_items','weight_logs','body_measurements','milestones','water_logs',
    'ai_conversations','ai_messages']
  loop
    execute format('create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_own', t);
  end loop;
end $$;

-- Alimentos: leitura de globais + próprios; escrita só nos próprios (source USER)
create policy foods_read on public.foods for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy foods_insert on public.foods for insert to authenticated
  with check (owner_id = (select auth.uid()) and source = 'USER' and verified = false);
create policy foods_update on public.foods for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()) and source = 'USER' and verified = false);
create policy foods_delete on public.foods for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Porções: leitura das publicadas + próprias; escrita nas próprias
create policy portions_read on public.food_portions for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy portions_write on public.food_portions for insert to authenticated
  with check (owner_id = (select auth.uid()) and source = 'user'
    and exists (select 1 from public.foods f where f.id = food_id and (f.owner_id is null or f.owner_id = (select auth.uid()))));
create policy portions_delete on public.food_portions for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Receitas
create policy recipes_read on public.recipes for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy recipes_insert on public.recipes for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy recipes_update on public.recipes for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy recipes_delete on public.recipes for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy recipe_ing_read on public.recipe_ingredients for select to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id and (r.owner_id is null or r.owner_id = (select auth.uid()))));
create policy recipe_ing_write on public.recipe_ingredients for all to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.owner_id = (select auth.uid()))
    and exists (select 1 from public.foods f where f.id = food_id and (f.owner_id is null or f.owner_id = (select auth.uid())))) ;

-- Itens de plano só podem apontar para planos do próprio usuário
create policy meal_plan_items_parent on public.meal_plan_items as restrictive for all to authenticated
  using (exists (select 1 from public.meal_plans p where p.id = plan_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.meal_plans p where p.id = plan_id and p.user_id = (select auth.uid())));
create policy ai_messages_parent on public.ai_messages as restrictive for all to authenticated
  using (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = (select auth.uid())));

-- anon não acessa nada
revoke all on all tables in schema public from anon;

-- ============================================================================
-- RPCs (security invoker: respeitam RLS)
-- ============================================================================

-- Busca de alimentos por nome e marca, tolerante a acentos e erros de digitação.
create or replace function public.search_foods(q text, max_results int default 30)
returns setof public.foods
language sql stable security invoker set search_path = public, extensions as $$
  with term as (select public.f_unaccent(lower(trim(q))) as t)
  select f.* from public.foods f, term
  where char_length(term.t) >= 2
    and (f.search_text like '%' || term.t || '%' or f.search_text % term.t
         or (select bool_and(f.search_text like '%' || w || '%') from unnest(string_to_array(term.t, ' ')) w where w <> ''))
  order by
    (f.owner_id is not null) desc,
    (f.search_text like term.t || '%') desc,
    (f.search_text like '%' || term.t || '%') desc,
    similarity(f.search_text, term.t) desc,
    char_length(f.name) asc
  limit least(greatest(max_results, 1), 60);
$$;

-- Totais diários de consumo registrado no intervalo.
create or replace function public.daily_totals(from_date date, to_date date)
returns table (entry_date date, kcal numeric, protein_g numeric, carbs_g numeric, fat_g numeric, fiber_g numeric, items bigint, incomplete bigint)
language sql stable security invoker set search_path = public as $$
  select d.entry_date, round(sum(d.kcal), 1), round(sum(coalesce(d.protein_g, 0)), 1), round(sum(coalesce(d.carbs_g, 0)), 1),
         round(sum(coalesce(d.fat_g, 0)), 1), round(sum(coalesce(d.fiber_g, 0)), 1), count(*), count(*) filter (where d.incomplete)
  from public.diary_entries d
  where d.user_id = (select auth.uid()) and d.entry_date between from_date and to_date
  group by d.entry_date order by d.entry_date;
$$;

-- Alimentos mais consumidos no intervalo.
create or replace function public.top_foods(from_date date, to_date date, max_results int default 8)
returns table (food_id uuid, name text, times bigint, kcal numeric)
language sql stable security invoker set search_path = public as $$
  select d.food_id, min(d.name), count(*), round(sum(d.kcal), 1)
  from public.diary_entries d
  where d.user_id = (select auth.uid()) and d.entry_date between from_date and to_date and d.food_id is not null
  group by d.food_id order by count(*) desc, sum(d.kcal) desc limit max_results;
$$;

-- Alimentos recentes (distintos) do usuário.
create or replace function public.recent_foods(max_results int default 12)
returns setof public.foods
language sql stable security invoker set search_path = public as $$
  select f.* from public.foods f
  join (select food_id, max(created_at) as last_at from public.diary_entries
        where user_id = (select auth.uid()) and food_id is not null group by food_id) r on r.food_id = f.id
  order by r.last_at desc limit max_results;
$$;

grant execute on function public.search_foods(text, int), public.daily_totals(date, date),
  public.top_foods(date, date, int), public.recent_foods(int), public.f_unaccent(text) to authenticated;
revoke execute on function public.search_foods(text, int), public.daily_totals(date, date),
  public.top_foods(date, date, int), public.recent_foods(int) from anon, public;
