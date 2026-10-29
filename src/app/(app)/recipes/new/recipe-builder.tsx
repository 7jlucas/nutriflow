"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Search, Trash2, X } from "lucide-react";
import { searchFoods } from "@/app/(app)/actions/diary";
import { createRecipe } from "@/app/(app)/actions/recipes";
import { recipeNutrition, canLog } from "@/lib/nutrition/calc";
import { DEFAULT_MEALS } from "@/lib/nutrition/meals";
import { fmt0, fmt1 } from "@/lib/format";
import { FormMessage } from "@/components/ui/form";
import { tagLabel } from "@/lib/tags";
import type { Food } from "@/lib/types";

interface Ing { key: string; food: Food; grams: number; label: string }
const TAGS = ["vegetariano", "vegano", "sem-lactose", "sem-gluten", "sem-ovo", "sem-peixe", "sem-castanhas", "sem-soja", "alto-proteina"];

export function RecipeBuilder() {
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [servings, setServings] = useState(2);
  const [prep, setPrep] = useState("");
  const [cost, setCost] = useState<number | null>(null);
  const [mealTypes, setMealTypes] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [steps, setSteps] = useState<string[]>([""]);
  const [ings, setIngs] = useState<Ing[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const req = useRef(0);

  useEffect(() => {
    if (q.trim().length < 2) return setResults([]);
    const id = ++req.current;
    const t = setTimeout(async () => { const r = await searchFoods(q); if (id === req.current && r.ok) setResults(r.data.slice(0, 8)); }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const n = useMemo(() => recipeNutrition(ings.map((i) => ({ id: i.key, grams: i.grams || 0, food: i.food })), servings || 1), [ings, servings]);

  function save() {
    setError(null);
    start(async () => {
      const r = await createRecipe({
        name, summary: summary || null, servings, prep_minutes: prep ? Number(prep) : null, cost_level: cost,
        meal_types: mealTypes as never, tags, steps: steps.map((s) => s.trim()).filter(Boolean),
        ingredients: ings.filter((i) => i.grams > 0).map((i) => ({ food_id: i.food.id, grams: i.grams, display_quantity: i.label || null })),
      });
      if (!r.ok) return setError(r.error);
      router.push(`/recipes/${r.data.id}`);
    });
  }

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const chip = (on: boolean) => `h-8 border px-3 text-xs uppercase tracking-wider ${on ? "border-volt bg-volt-dim" : "border-line-strong text-mute hover:text-bone"}`;

  return (
    <div className="mx-auto max-w-[1300px] px-5 py-6 md:px-10 md:py-10">
      <Link href="/recipes" className="flex w-fit items-center gap-1.5 text-xs uppercase tracking-wider text-mute hover:text-bone"><ArrowLeft size={14} /> Receitas</Link>
      <h1 className="display mt-4 text-[clamp(2.8rem,7vw,5rem)]">Nova receita</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <label className="block text-sm text-mute">Nome<input className="field mt-2" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></label>
          <label className="block text-sm text-mute">Resumo (opcional)<input className="field mt-2" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={240} /></label>
          <div className="grid grid-cols-3 gap-3">
            <label className="text-sm text-mute">Rendimento (porções)<input type="number" min={0.5} step={0.5} className="field num mt-2" value={servings} onChange={(e) => setServings(Number(e.target.value))} /></label>
            <label className="text-sm text-mute">Preparo (min)<input type="number" min={0} className="field num mt-2" value={prep} onChange={(e) => setPrep(e.target.value)} /></label>
            <label className="text-sm text-mute">Custo
              <select className="field mt-2" value={cost ?? ""} onChange={(e) => setCost(e.target.value ? Number(e.target.value) : null)}><option value="">-</option><option value="1">Econômico</option><option value="2">Moderado</option><option value="3">Flexível</option></select>
            </label>
          </div>
          <div><p className="text-sm text-mute">Refeições</p><div className="mt-2 flex flex-wrap gap-1.5">{DEFAULT_MEALS.map((m) => <button key={m.slot} type="button" aria-pressed={mealTypes.includes(m.slot)} className={chip(mealTypes.includes(m.slot))} onClick={() => toggle(mealTypes, m.slot, setMealTypes)}>{m.label}</button>)}</div></div>
          <div><p className="text-sm text-mute">Características (você declara)</p><div className="mt-2 flex flex-wrap gap-1.5">{TAGS.map((t) => <button key={t} type="button" aria-pressed={tags.includes(t)} className={chip(tags.includes(t))} onClick={() => toggle(tags, t, setTags)}>{tagLabel(t)}</button>)}</div></div>

          <section aria-labelledby="ing-h">
            <h2 id="ing-h" className="display text-3xl">Ingredientes</h2>
            <div className="relative mt-3">
              <Search size={16} className="absolute left-3 top-[1.4rem] -translate-y-1/2 text-mute" />
              <input className="field pl-10" placeholder="Buscar ingrediente na base" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar ingrediente" />
              {results.length > 0 && (
                <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto border border-line-strong bg-graphite-2 shadow-[var(--shadow-pop)]">
                  {results.map((f) => (
                    <li key={f.id}>
                      <button type="button" disabled={!canLog(f)} className="flex w-full justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-graphite-3 disabled:opacity-40" onClick={() => { setIngs([...ings, { key: `${f.id}-${Date.now()}`, food: f, grams: 100, label: "" }]); setQ(""); setResults([]); }}>
                        <span>{f.name}</span><span className="num text-mute">{fmt1(f.kcal)} kcal/100 {f.ref_unit}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {ings.map((i, idx) => (
                <li key={i.key} className="grid grid-cols-[1fr_6rem_8rem_auto] items-center gap-2 py-2">
                  <span className="truncate text-sm">{i.food.name}</span>
                  <label className="relative"><span className="sr-only">Gramas de {i.food.name}</span><input type="number" min={0} className="field num h-9 py-0 pr-6" value={i.grams} onChange={(e) => setIngs(ings.map((x, j) => (j === idx ? { ...x, grams: Number(e.target.value) } : x)))} /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-dim">{i.food.ref_unit === "ml" ? "g*" : "g"}</span></label>
                  <input className="field h-9 py-0 text-xs" placeholder="Medida (ex.: 1 xíc.)" value={i.label} onChange={(e) => setIngs(ings.map((x, j) => (j === idx ? { ...x, label: e.target.value } : x)))} aria-label="Medida caseira exibida" />
                  <button type="button" className="btn btn-quiet h-8 w-8 p-0 hover:text-danger" aria-label={`Remover ${i.food.name}`} onClick={() => setIngs(ings.filter((_, j) => j !== idx))}><Trash2 size={14} /></button>
                </li>
              ))}
              {!ings.length && <li className="py-6 text-center text-sm text-dim">Adicione ingredientes pesados no estado em que entram na receita (cru ou cozido, conforme o alimento escolhido).</li>}
            </ul>
          </section>

          <section aria-labelledby="steps-h">
            <h2 id="steps-h" className="display text-3xl">Modo de preparo</h2>
            <ol className="mt-3 space-y-2">
              {steps.map((s, i) => (
                <li key={i} className="grid grid-cols-[2rem_1fr_auto] items-start gap-2">
                  <span className="num pt-3 text-sm text-volt">{String(i + 1).padStart(2, "0")}</span>
                  <textarea className="field min-h-[3rem]" value={s} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Passo ${i + 1}`} maxLength={600} />
                  <button type="button" className="btn btn-quiet h-9 w-9 p-0" aria-label={`Remover passo ${i + 1}`} onClick={() => setSteps(steps.filter((_, j) => j !== i))} disabled={steps.length === 1}><X size={14} /></button>
                </li>
              ))}
            </ol>
            <button type="button" className="btn btn-quiet btn-sm mt-2" onClick={() => setSteps([...steps, ""])}><Plus size={12} /> Passo</button>
          </section>
        </div>

        <aside className="lg:col-span-5">
          <div className="panel sticky top-20 p-5 md:p-6 lg:top-6" aria-live="polite">
            <p className="eyebrow">Por porção · cálculo em tempo real</p>
            <div className="display mt-3 text-7xl text-volt">{fmt0(n.perServing.kcal)}<span className="ml-2 text-lg text-mute">kcal</span></div>
            <dl className="mt-5 grid grid-cols-4 gap-3 text-sm">
              {[["Prot.", n.perServing.protein_g], ["Carb.", n.perServing.carbs_g], ["Gord.", n.perServing.fat_g], ["Fibras", n.perServing.fiber_g]].map(([l, v]) => <div key={l as string}><dt className="eyebrow">{l}</dt><dd className="num mt-1 text-lg font-semibold">{fmt1(v as number)} g</dd></div>)}
            </dl>
            <p className="mt-4 text-xs text-dim">Total da receita: {fmt0(n.total.kcal)} kcal · {fmt0(n.gramsPerServing * (servings || 1))} g de ingredientes ÷ {fmt1(servings)} porção(ões).{n.incomplete && <span className="text-amber"> Algum ingrediente tem nutrientes ausentes na fonte.</span>}</p>
            {error && <div className="mt-4"><FormMessage tone="error">{error}</FormMessage></div>}
            <button className="btn btn-volt mt-6 w-full" onClick={save} disabled={pending || name.trim().length < 2 || !ings.length || !(servings > 0)}>{pending ? "Salvando…" : "Salvar receita"}</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
