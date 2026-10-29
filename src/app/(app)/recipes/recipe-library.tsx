"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Clock, Heart, Plus, SlidersHorizontal } from "lucide-react";
import { PlateArt } from "@/components/app/plate-art";
import { SpotlightCard } from "@/components/ui/spotlight";
import { toggleFavoriteRecipe } from "@/app/(app)/actions/recipes";
import { requiredTags, matchesTags } from "@/lib/nutrition/plan";
import { DEFAULT_MEALS } from "@/lib/nutrition/meals";
import { fmt0 } from "@/lib/format";
import type { GoalKind } from "@/lib/types";

export interface RecipeCard { id: string; name: string; summary: string | null; meal_types: string[]; prep: number | null; cost: number | null; tags: string[]; goals: GoalKind[]; mine: boolean; favorite: boolean; kcal: number; protein: number; image: string | null; art: { grams: number; category: string | null; name: string }[] }

const TAGS = [["vegetariano", "Vegetariano"], ["vegano", "Vegano"], ["sem-lactose", "Sem lactose"], ["sem-gluten", "Sem glúten"], ["sem-ovo", "Sem ovo"], ["sem-peixe", "Sem peixe"], ["sem-castanhas", "Sem castanhas"], ["alto-proteina", "Mais proteína"]] as const;

export function RecipeLibrary({ cards, profile }: { cards: RecipeCard[]; profile: { allergies: string[]; restrictions: string[]; prefs: string[]; goal: GoalKind } }) {
  const [meal, setMeal] = useState<string | null>(null);
  const [maxPrep, setMaxPrep] = useState<number | null>(null);
  const [maxKcal, setMaxKcal] = useState<number | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [useProfile, setUseProfile] = useState(true);
  const [goal, setGoal] = useState<GoalKind | null>(null);
  const [onlyFav, setOnlyFav] = useState(false);
  const [favs, setFavs] = useState(() => new Set(cards.filter((c) => c.favorite).map((c) => c.id)));
  const [showFilters, setShowFilters] = useState(false);
  const profileTags = useMemo(() => requiredTags(profile.allergies, profile.restrictions, profile.prefs), [profile]);

  const list = cards.filter((c) => {
    if (meal && !c.meal_types.includes(meal)) return false;
    if (maxPrep && (c.prep ?? 999) > maxPrep) return false;
    if (maxKcal && c.kcal > maxKcal) return false;
    if (cost && (c.cost ?? 3) > cost) return false;
    if (goal && !c.goals.includes(goal)) return false;
    if (onlyFav && !favs.has(c.id)) return false;
    const req = [...tags, ...(useProfile ? profileTags : [])];
    return matchesTags(c, req);
  });

  const chip = (on: boolean) => `h-8 shrink-0 border px-3 text-xs uppercase tracking-wider ${on ? "border-volt bg-volt-dim text-bone" : "border-line-strong text-mute hover:text-bone"}`;

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-6 md:px-10 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Biblioteca · valores calculados pelos ingredientes (TACO)</p>
          <h1 className="display mt-2 text-[clamp(2.8rem,7vw,5rem)]">Receitas</h1>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost lg:hidden" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}><SlidersHorizontal size={14} /> Filtros</button>
          <Link href="/recipes/new" className="btn btn-volt"><Plus size={16} /> Nova receita</Link>
        </div>
      </div>

      <div className={`mt-6 space-y-3 border-y border-line py-4 ${showFilters ? "" : "max-lg:hidden"}`}>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none" role="group" aria-label="Tipo de refeição">
          <button aria-pressed={!meal} className={chip(!meal)} onClick={() => setMeal(null)}>Todas</button>
          {DEFAULT_MEALS.map((m) => <button key={m.slot} aria-pressed={meal === m.slot} className={chip(meal === m.slot)} onClick={() => setMeal(meal === m.slot ? null : m.slot)}>{m.label}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <label className="flex items-center gap-2 text-mute">Preparo até
            <select className="field h-8 w-28 py-0" value={maxPrep ?? ""} onChange={(e) => setMaxPrep(e.target.value ? Number(e.target.value) : null)}>
              <option value="">qualquer</option><option value="5">5 min</option><option value="15">15 min</option><option value="30">30 min</option><option value="45">45 min</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-mute">kcal/porção até
            <select className="field h-8 w-28 py-0" value={maxKcal ?? ""} onChange={(e) => setMaxKcal(e.target.value ? Number(e.target.value) : null)}>
              <option value="">qualquer</option><option value="200">200</option><option value="350">350</option><option value="500">500</option><option value="700">700</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-mute">Custo
            <select className="field h-8 w-36 py-0" value={cost ?? ""} onChange={(e) => setCost(e.target.value ? Number(e.target.value) : null)}>
              <option value="">qualquer</option><option value="1">econômico</option><option value="2">até moderado</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-mute">Objetivo
            <select className="field h-8 w-36 py-0" value={goal ?? ""} onChange={(e) => setGoal((e.target.value || null) as GoalKind | null)}>
              <option value="">qualquer</option><option value="lose">Emagrecer</option><option value="maintain">Manter</option><option value="gain">Ganhar</option>
            </select>
          </label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={onlyFav} onChange={(e) => setOnlyFav(e.target.checked)} className="accent-[var(--color-volt)]" /> Só favoritas</label>
          {profileTags.length > 0 && <label className="flex items-center gap-2"><input type="checkbox" checked={useProfile} onChange={(e) => setUseProfile(e.target.checked)} className="accent-[var(--color-volt)]" /> Respeitar minhas restrições ({profileTags.join(", ")})</label>}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Preferências e restrições">
          {TAGS.map(([k, l]) => <button key={k} aria-pressed={tags.includes(k)} className={chip(tags.includes(k))} onClick={() => setTags(tags.includes(k) ? tags.filter((t) => t !== k) : [...tags, k])}>{l}</button>)}
        </div>
      </div>

      <p className="mt-6 eyebrow" aria-live="polite">{list.length} receita(s)</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((c, i) => (
          <motion.li key={c.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}>
            <SpotlightCard className="panel group relative flex h-full flex-col overflow-hidden">
              <Link href={`/recipes/${c.id}`} className="absolute inset-0 z-10" aria-label={c.name} />
              <div className="relative aspect-[4/3] overflow-hidden border-b border-line">
                {c.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <PlateArt seed={c.id} ingredients={c.art} className="h-full w-full transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.04]" label={`Ilustração: ${c.art.map((a) => a.name.split(",")[0]).join(", ")}`} />
                )}
                <div className="absolute left-3 top-3 flex gap-1.5">
                  {c.mine && <span className="chip bg-ink/80">Minha</span>}
                  {c.prep !== null && <span className="chip bg-ink/80"><Clock size={10} /> {c.prep} min</span>}
                </div>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h2 className="text-lg font-semibold leading-snug">{c.name}</h2>
                {c.summary && <p className="mt-1 text-sm text-mute">{c.summary}</p>}
                <div className="mt-auto flex items-end justify-between pt-4">
                  <span className="num"><span className="text-2xl font-semibold">{fmt0(c.kcal)}</span> <span className="text-xs text-mute">kcal/porção · {fmt0(c.protein)} g prot.</span></span>
                  <button
                    className="relative z-20 btn btn-quiet h-9 w-9 p-0"
                    aria-pressed={favs.has(c.id)}
                    aria-label={favs.has(c.id) ? "Remover dos favoritos" : "Favoritar receita"}
                    onClick={async () => {
                      const r = await toggleFavoriteRecipe(c.id);
                      if (r.ok) setFavs((s) => { const n = new Set(s); if (r.data.favorite) n.add(c.id); else n.delete(c.id); return n; });
                    }}
                  >
                    <Heart size={16} className={favs.has(c.id) ? "fill-volt text-volt" : ""} />
                  </button>
                </div>
              </div>
            </SpotlightCard>
          </motion.li>
        ))}
      </ul>
      {!list.length && <p className="py-16 text-center text-mute">Nenhuma receita com esses filtros.</p>}
      <p className="mt-8 text-xs text-dim">Imagens: ilustrações geradas a partir dos ingredientes de cada receita (proporção por peso). Receitas podem receber foto própria com crédito.</p>
    </div>
  );
}
