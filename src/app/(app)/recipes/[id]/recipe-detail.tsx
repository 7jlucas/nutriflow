"use client";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, Heart, Plus, Trash2, Users } from "lucide-react";
import { PlateArt } from "@/components/app/plate-art";
import { tagLabel } from "@/lib/tags";
import { useToast } from "@/components/app/toast";
import { addDiaryEntry } from "@/app/(app)/actions/diary";
import { deleteRecipe, toggleFavoriteRecipe } from "@/app/(app)/actions/recipes";
import { recipeNutrition, nutrientsFor } from "@/lib/nutrition/calc";
import { suggestSlot, type MealDef } from "@/lib/nutrition/meals";
import { SOURCE_LABEL, fmt0, fmt1 } from "@/lib/format";
import type { RecipeWithIngredients } from "@/lib/types";

const COST = ["", "Econômico", "Moderado", "Flexível"];

export function RecipeDetail({ recipe, meals, today, favorite }: { recipe: RecipeWithIngredients; meals: MealDef[]; today: string; favorite: boolean }) {
  const [servings, setServings] = useState(1);
  const [slot, setSlot] = useState(() => (recipe.meal_types[0] as string) ?? suggestSlot());
  const [date, setDate] = useState(today);
  const [fav, setFav] = useState(favorite);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const n = useMemo(() => recipeNutrition(recipe.ingredients.map((i) => ({ id: i.id, grams: Number(i.grams), food: i.food })), Number(recipe.servings), { scale: servings }), [recipe, servings]);
  const sources = [...new Set(recipe.ingredients.map((i) => SOURCE_LABEL[i.food.source]))];

  return (
    <div className="mx-auto max-w-[1300px] px-5 py-6 md:px-10 md:py-10">
      <Link href="/recipes" className="flex w-fit items-center gap-1.5 text-xs uppercase tracking-wider text-mute hover:text-bone"><ArrowLeft size={14} /> Receitas</Link>
      <div className="mt-6 grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="panel overflow-hidden">
            {recipe.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={recipe.image_url} alt={recipe.name} className="aspect-square w-full object-cover" />
            ) : (
              <PlateArt seed={recipe.id} ingredients={recipe.ingredients.map((i) => ({ grams: Number(i.grams), category: i.food.category, name: i.food.name }))} className="aspect-square w-full" label={`Ilustração do prato ${recipe.name}`} />
            )}
          </div>
          <p className="mt-2 text-[11px] text-dim">{recipe.image_credit ?? "Ilustração gerada a partir dos ingredientes (proporção por peso)."}</p>
        </div>
        <div className="lg:col-span-7">
          <div className="flex flex-wrap gap-1.5">
            {recipe.tags.map((t) => <span key={t} className="chip">{tagLabel(t)}</span>)}
          </div>
          <h1 className="display mt-4 text-[clamp(2.6rem,6vw,4.5rem)]">{recipe.name}</h1>
          {recipe.summary && <p className="mt-3 text-lg text-mute">{recipe.summary}</p>}
          <dl className="mt-6 flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2"><Clock size={14} className="text-mute" /><dt className="sr-only">Preparo</dt><dd>{recipe.prep_minutes ?? "-"} min</dd></div>
            <div className="flex items-center gap-2"><Users size={14} className="text-mute" /><dt className="sr-only">Rendimento</dt><dd>Rende {fmt1(Number(recipe.servings))} porção(ões) · ~{fmt0(n.gramsPerServing / servings)} g cada</dd></div>
            {recipe.cost_level && <div><dt className="sr-only">Custo</dt><dd className="text-mute">Custo: {COST[recipe.cost_level]} (estimado)</dd></div>}
          </dl>

          {/* nutrição por porção */}
          <section className="panel mt-8 p-5 md:p-6" aria-labelledby="nut-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="nut-title" className="eyebrow">Por {servings === 1 ? "porção" : `${fmt1(servings)} porções`}</h2>
              <div className="flex gap-1" role="group" aria-label="Porções">
                {[0.5, 1, 1.5, 2].map((s) => <button key={s} aria-pressed={servings === s} onClick={() => setServings(s)} className={`num h-8 min-w-11 border px-2 text-sm ${servings === s ? "border-volt bg-volt-dim" : "border-line-strong text-mute"}`}>{s.toLocaleString("pt-BR")}×</button>)}
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-5">
              {[["Energia", fmt0(n.perServing.kcal), "kcal", "var(--color-volt)"], ["Proteínas", fmt1(n.perServing.protein_g), "g", "var(--color-protein)"], ["Carboidratos", fmt1(n.perServing.carbs_g), "g", "var(--color-carbs)"], ["Gorduras", fmt1(n.perServing.fat_g), "g", "var(--color-fat)"], ["Fibras", fmt1(n.perServing.fiber_g), "g", "var(--color-dim)"]].map(([l, v, u, c]) => (
                <div key={l} className="border-t-2 pt-2" style={{ borderColor: c }}>
                  <dt className="eyebrow">{l}</dt>
                  <dd className="num mt-1 text-2xl font-semibold">{v}<span className="ml-1 text-xs font-normal text-mute">{u}</span></dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-dim">
              Base do cálculo: {recipe.basis_note ?? "soma dos ingredientes no estado listado"} Fonte: {sources.join(", ")}.
              {n.incomplete && <span className="text-amber"> Algum ingrediente não tem todos os nutrientes na fonte.</span>}
            </p>
          </section>

          {/* registrar */}
          <section className="mt-3 border border-volt/30 p-5" aria-labelledby="log-title">
            <h2 id="log-title" className="eyebrow text-bone">Registrar no diário</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
              <select className="field h-11 py-0" value={slot} onChange={(e) => setSlot(e.target.value)} aria-label="Refeição">{meals.map((m) => <option key={m.slot} value={m.slot}>{m.label}</option>)}</select>
              <input type="date" className="field num h-11 py-0" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data" />
              <button
                className="btn btn-volt h-11"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await addDiaryEntry({ entry_date: date, meal_slot: slot, recipe_id: recipe.id, quantity: servings, unit: "serving" });
                    if (!r.ok) return toast({ tone: "error", message: r.error });
                    toast({ tone: "success", message: `${fmt1(servings)} porção(ões) · ${fmt0(r.data.kcal)} kcal registradas` });
                    router.refresh();
                  })
                }
              >
                <Plus size={16} /> Adicionar {fmt1(servings)}×
              </button>
            </div>
          </section>

          <div className="mt-10 grid gap-10 md:grid-cols-2">
            <section aria-labelledby="ing-title">
              <h2 id="ing-title" className="display text-3xl">Ingredientes</h2>
              <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
                {recipe.ingredients.map((i) => {
                  const g = (Number(i.grams) / Number(recipe.servings)) * servings;
                  const k = nutrientsFor(i.food, g).kcal;
                  return (
                    <li key={i.id} className="grid grid-cols-[1fr_auto] gap-3 py-2.5">
                      <span><span className="block">{i.food.name}</span><span className="text-xs text-dim">{i.display_quantity ? `${i.display_quantity} · ` : ""}{SOURCE_LABEL[i.food.source]}{i.food.source === "TACO" ? ` nº ${i.food.source_ref}` : ""}</span></span>
                      <span className="num text-right"><span className="block">{fmt0(g)} g</span><span className="text-xs text-dim">{k === null ? "-" : `${fmt0(k)} kcal`}</span></span>
                    </li>
                  );
                })}
              </ul>
            </section>
            <section aria-labelledby="steps-title">
              <h2 id="steps-title" className="display text-3xl">Preparo</h2>
              <ol className="mt-4 space-y-4">
                {recipe.steps.map((s, i) => (
                  <li key={i} className="grid grid-cols-[2rem_1fr] gap-2 text-sm leading-relaxed">
                    <span className="num text-volt">{String(i + 1).padStart(2, "0")}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <div className="mt-10 flex flex-wrap gap-2 border-t border-line pt-6">
            <button className="btn btn-ghost" aria-pressed={fav} onClick={async () => { const r = await toggleFavoriteRecipe(recipe.id); if (r.ok) setFav(r.data.favorite); }}>
              <Heart size={14} className={fav ? "fill-volt text-volt" : ""} /> {fav ? "Favorita" : "Favoritar"}
            </button>
            {recipe.owner_id && (
              <button className="btn btn-danger" onClick={() => start(async () => { const r = await deleteRecipe(recipe.id); if (!r.ok) return toast({ tone: "error", message: r.error }); router.push("/recipes"); })}>
                <Trash2 size={14} /> Excluir receita
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
