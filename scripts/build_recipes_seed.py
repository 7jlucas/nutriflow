"""Gera supabase/migrations/20261027000300_seed_recipes.sql a partir de scripts/recipes.json.
Ingredientes referenciam alimentos TACO por número (source_ref). Gramas no estado listado."""
import json, sys

def q(s):
    return "'" + str(s).replace("'", "''") + "'"

def arr(xs, cast="text[]"):
    return "array[" + ",".join(q(x) for x in xs) + "]::" + cast

recipes = json.load(open(sys.argv[1]))
out = ["-- Gerado por scripts/build_recipes_seed.py — receitas da biblioteca NUTRI//FLOW.",
       "-- Valores nutricionais NÃO são digitados: são calculados pelo app a partir dos ingredientes (TACO)."]
for r in recipes:
    basis = r.get("basis", "Soma dos ingredientes no estado listado (ex.: arroz e feijão já cozidos). Temperos sem valor energético relevante não entram no cálculo.")
    out.append(f"""with rec as (
  insert into public.recipes (slug, name, summary, meal_types, prep_minutes, servings, cost_level, tags, goals, steps, basis_note)
  values ({q(r['slug'])}, {q(r['name'])}, {q(r['summary'])}, {arr(r['meal_types'])}, {r['prep']}, {r['servings']}, {r['cost']},
          {arr(r['tags'])}, {arr(r['goals'], 'public.goal_kind[]')}, {arr(r['steps'])}, {q(basis)})
  on conflict (slug) do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, position)
select rec.id, f.id, v.grams, v.label, v.pos from rec
join (values {", ".join(f"({q(ref)}, {g}, {q(lbl)}, {i})" for i, (ref, g, lbl) in enumerate(r['ing']))}) as v(ref, grams, label, pos) on true
join public.foods f on f.source = 'TACO' and f.source_ref = v.ref and f.owner_id is null;""")
print("\n\n".join(out))
