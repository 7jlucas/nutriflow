"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ChefHat, Clock, Loader2, Plus, Search, Star } from "lucide-react";
import { PortionSelector, type PortionValue } from "./portion-selector";
import { CustomFoodForm } from "./custom-food-form";
import { useToast } from "./toast";
import { addDiaryEntry, addPortion, getFoodDetail, searchFoods, toggleFavorite } from "@/app/(app)/actions/diary";
import { listRecipesLite, type RecipeLite } from "@/app/(app)/actions/foods";
import { canLog } from "@/lib/nutrition/calc";
import { SOURCE_LABEL, fmt0, fmt1 } from "@/lib/format";
import { nowTime } from "@/lib/dates";
import type { DiaryEntry, Food, FoodPortion } from "@/lib/types";
import type { MealDef } from "@/lib/nutrition/meals";

type Tab = "search" | "favorites" | "recent" | "recipes" | "create";

export interface LoggerProps {
  date: string;
  slot: string;
  meals: MealDef[];
  favorites: Food[];
  recent: Food[];
  onAdded: (e: DiaryEntry) => void;
  initialFood?: Food | null;
}

/** Registro rápido: buscar → escolher porção → adicionar. Máximo de 3 interações para o caso comum. */
export function FoodLogger({ date, slot: initialSlot, meals, favorites, recent, onAdded, initialFood }: LoggerProps) {
  const [tab, setTab] = useState<Tab>("search");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Food[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ food: Food; portions: FoodPortion[]; favorite: boolean } | null>(null);
  const [recipe, setRecipe] = useState<RecipeLite | null>(null);
  const [recipes, setRecipes] = useState<RecipeLite[] | null>(null);
  const [value, setValue] = useState<PortionValue>({ quantity: 100, unit: "g", portion_id: null });
  const [servings, setServings] = useState(1);
  const [slot, setSlot] = useState(initialSlot);
  const [time, setTime] = useState(() => nowTime());
  const [pending, start] = useTransition();
  const [favIds, setFavIds] = useState(() => new Set(favorites.map((f) => f.id)));
  const [last, setLast] = useState<{ text: string; key: number } | null>(null);
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);

  useEffect(() => {
    setSlot(initialSlot);
  }, [initialSlot]);

  // busca com debounce + descarte de respostas antigas
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      setSearchError(null);
      return;
    }
    const id = ++reqId.current;
    setSearching(true);
    const t = window.setTimeout(async () => {
      const r = await searchFoods(term);
      if (id !== reqId.current) return;
      setSearching(false);
      if (r.ok) {
        setResults(r.data);
        setSearchError(null);
      } else setSearchError(r.error);
    }, 220);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (tab === "recipes" && !recipes) listRecipesLite().then(setRecipes);
  }, [tab, recipes]);


  const pick = useCallback(async (food: Food) => {
    setSelected({ food, portions: [], favorite: favIds.has(food.id) });
    setValue({ quantity: food.ref_unit === "ml" ? 200 : 100, unit: food.ref_unit, portion_id: null });
    const d = await getFoodDetail(food.id);
    if (d) {
      setSelected(d);
      // se houver medida caseira, ela vira o padrão (mais rápido para o usuário)
      if (d.portions.length) setValue({ quantity: 1, unit: "portion", portion_id: d.portions[0].id });
    }
  }, [favIds]);

  // aberto a partir de um alimento específico (página de alimentos)
  useEffect(() => {
    if (initialFood) pick(initialFood);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFood]);

  function back() {
    setSelected(null);
    setRecipe(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function submit() {
    start(async () => {
      const r = selected
        ? await addDiaryEntry({ entry_date: date, meal_slot: slot, logged_time: time || null, food_id: selected.food.id, quantity: value.quantity, unit: value.unit, portion_id: value.portion_id })
        : recipe
          ? await addDiaryEntry({ entry_date: date, meal_slot: slot, logged_time: time || null, recipe_id: recipe.id, quantity: servings, unit: "serving" })
          : null;
      if (!r) return;
      if (!r.ok) {
        toast({ tone: "error", message: r.error });
        return;
      }
      onAdded(r.data);
      setLast({ text: `${r.data.name} · ${fmt0(r.data.kcal)} kcal em ${meals.find((m) => m.slot === slot)?.label ?? "refeição"}`, key: Date.now() });
      setSelected(null);
      setRecipe(null);
      setQ("");
      requestAnimationFrame(() => inputRef.current?.focus());
    });
  }

  async function onFav() {
    if (!selected) return;
    const r = await toggleFavorite(selected.food.id);
    if (r.ok) {
      setSelected({ ...selected, favorite: r.data.favorite });
      setFavIds((s) => {
        const n = new Set(s);
        if (r.data.favorite) n.add(selected.food.id);
        else n.delete(selected.food.id);
        return n;
      });
      toast({ tone: "info", message: r.data.favorite ? "Adicionado aos favoritos" : "Removido dos favoritos" });
    }
  }

  const list = useMemo(() => (tab === "favorites" ? favorites : tab === "recent" ? recent : results ?? []), [tab, favorites, recent, results]);
  const showDetail = Boolean(selected || recipe);

  return (
    <div className="flex h-full flex-col">
      {/* contexto: refeição + horário (sempre visível) */}
      <div className="grid grid-cols-[1fr_8.5rem] gap-2 border-b border-line px-5 py-3 md:px-7">
        <label className="sr-only" htmlFor="log-slot">Refeição</label>
        <select id="log-slot" value={slot} onChange={(e) => setSlot(e.target.value)} className="field h-10 py-0">
          {meals.map((m) => (
            <option key={m.slot} value={m.slot}>{m.label}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="log-time">Horário</label>
        <input id="log-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="field num h-10 py-0" />
      </div>

      <div aria-live="polite" className="px-5 md:px-7">
        <AnimatePresence>
          {last && !showDetail && (
            <motion.p key={last.key} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 flex items-center gap-2 border border-volt/40 bg-volt-dim px-3 py-2 text-sm">
              <span className="grid h-4 w-4 place-items-center bg-volt text-volt-ink" aria-hidden>✓</span>
              <span className="truncate">Adicionado: {last.text}</span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {!showDetail ? (
          <motion.div key="list" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }} className="flex min-h-0 flex-1 flex-col">
            <div className="px-5 pt-4 md:px-7">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" aria-hidden />
                <input
                  ref={inputRef}
                  autoFocus
                  type="search"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    if (tab !== "search") setTab("search");
                  }}
                  placeholder="Buscar alimento ou marca (ex.: feijão, iogurte)"
                  className="field h-12 pl-10"
                  aria-label="Buscar alimento"
                />
                {searching && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-mute" aria-label="Buscando" />}
              </div>
              <div role="tablist" aria-label="Origem" className="mt-3 flex gap-1 overflow-x-auto scrollbar-none">
                {([
                  ["search", "Busca"],
                  ["favorites", `Favoritos · ${favorites.length}`],
                  ["recent", "Recentes"],
                  ["recipes", "Receitas"],
                  ["create", "Criar alimento"],
                ] as [Tab, string][]).map(([k, l]) => (
                  <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`h-8 shrink-0 px-3 text-xs uppercase tracking-wider ${tab === k ? "bg-bone text-ink" : "text-mute hover:text-bone"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-5 pb-6 md:px-7">
              {tab === "create" ? (
                <CustomFoodForm
                  onCreated={(food, portion) => {
                    setSelected({ food, portions: portion ? [portion] : [], favorite: false });
                    setValue(portion ? { quantity: 1, unit: "portion", portion_id: portion.id } : { quantity: food.ref_amount, unit: food.ref_unit, portion_id: null });
                  }}
                />
              ) : tab === "recipes" ? (
                <RecipeList recipes={recipes} onPick={(r) => { setRecipe(r); setServings(1); }} />
              ) : (
                <FoodList
                  foods={list}
                  favIds={favIds}
                  onPick={pick}
                  empty={
                    tab === "search"
                      ? q.trim().length < 2
                        ? "Digite pelo menos 2 letras. A busca ignora acentos e aceita erros de digitação."
                        : searching
                          ? null
                          : searchError ?? "Nada encontrado. Tente outro termo ou crie um alimento com os dados do rótulo."
                      : tab === "favorites"
                        ? "Sem favoritos ainda. Toque na estrela ao registrar um alimento."
                        : "Os alimentos que você registrar aparecem aqui."
                  }
                  loading={tab === "search" && searching && !results}
                />
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="detail" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2 }} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-5 py-4 md:px-7">
              <button onClick={back} className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-mute hover:text-bone">
                <ArrowLeft size={14} /> Voltar à busca
              </button>
              {selected && (
                <>
                  <div className="mt-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold leading-tight">{selected.food.name}</h3>
                      <p className="mt-1 text-sm text-mute">{selected.food.brand ?? selected.food.category}</p>
                    </div>
                    <button onClick={onFav} aria-pressed={selected.favorite} aria-label={selected.favorite ? "Remover dos favoritos" : "Favoritar"} className="btn btn-quiet h-10 w-10 p-0">
                      <Star size={18} className={selected.favorite ? "fill-volt text-volt" : ""} />
                    </button>
                  </div>
                  <div className="mt-6">
                    <PortionSelector
                      food={selected.food}
                      portions={selected.portions}
                      value={value}
                      onChange={setValue}
                      onAddPortion={async (p) => {
                        const r = await addPortion({ food_id: selected.food.id, ...p });
                        if (r.ok) {
                          setSelected({ ...selected, portions: [...selected.portions, r.data] });
                          setValue({ quantity: 1, unit: "portion", portion_id: r.data.id });
                          toast({ tone: "success", message: "Medida caseira salva" });
                        } else toast({ tone: "error", message: r.error });
                      }}
                    />
                  </div>
                </>
              )}
              {recipe && <RecipeServing recipe={recipe} servings={servings} setServings={setServings} />}
            </div>
            <div className="border-t border-line px-5 py-4 md:px-7">
              <button onClick={submit} disabled={pending || (selected ? !canLog(selected.food) || !(value.quantity > 0) : !(servings > 0))} className="btn btn-volt h-12 w-full">
                {pending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Adicionar ao diário
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FoodList({ foods, onPick, empty, loading, favIds }: { foods: Food[]; onPick: (f: Food) => void; empty: string | null; loading: boolean; favIds: Set<string> }) {
  if (loading)
    return (
      <ul className="space-y-2" aria-busy>
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="skeleton h-14" />
        ))}
      </ul>
    );
  if (!foods.length) return empty ? <p className="py-10 text-center text-sm text-mute">{empty}</p> : null;
  return (
    <ul className="divide-y divide-line border-y border-line">
      {foods.map((f) => {
        const disabled = !canLog(f);
        return (
          <li key={f.id}>
            <button
              onClick={() => onPick(f)}
              className="group grid w-full grid-cols-[1fr_auto] items-center gap-3 px-1 py-3 text-left hover:bg-graphite"
              aria-describedby={disabled ? `nf-${f.id}` : undefined}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  {favIds.has(f.id) && <Star size={12} className="shrink-0 fill-volt text-volt" aria-label="Favorito" />}
                  <span className="truncate text-sm group-hover:text-bone">{f.name}</span>
                </span>
                <span className="mt-0.5 flex items-center gap-2 text-xs text-dim">
                  <span>{SOURCE_LABEL[f.source]}{f.source_ref === "rotulo" ? " · rótulo" : ""}</span>
                  {f.brand && <span>· {f.brand}</span>}
                </span>
              </span>
              <span className="text-right">
                {disabled ? (
                  <span id={`nf-${f.id}`} className="chip chip-amber">Sem dado de energia</span>
                ) : (
                  <>
                    <span className="num text-sm">{fmt1(f.kcal)}</span>
                    <span className="block text-[10px] text-dim">kcal/{fmt0(f.ref_amount)} {f.ref_unit}</span>
                  </>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function RecipeList({ recipes, onPick }: { recipes: RecipeLite[] | null; onPick: (r: RecipeLite) => void }) {
  if (!recipes) return <ul className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <li key={i} className="skeleton h-14" />)}</ul>;
  if (!recipes.length) return <p className="py-10 text-center text-sm text-mute">Nenhuma receita disponível.</p>;
  return (
    <ul className="divide-y divide-line border-y border-line">
      {recipes.map((r) => (
        <li key={r.id}>
          <button onClick={() => onPick(r)} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-1 py-3 text-left hover:bg-graphite">
            <ChefHat size={16} className="text-mute" aria-hidden />
            <span className="text-sm">
              {r.name}
              {r.owner_id && <span className="ml-2 chip">Minha</span>}
            </span>
            <span className="text-right">
              <span className="num text-sm">{fmt0(r.kcal)}</span>
              <span className="block text-[10px] text-dim">kcal/porção</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function RecipeServing({ recipe, servings, setServings }: { recipe: RecipeLite; servings: number; setServings: (n: number) => void }) {
  const kcal = recipe.kcal * servings;
  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 text-mute"><ChefHat size={14} /> <span className="eyebrow">Receita</span></div>
      <h3 className="mt-2 text-xl font-semibold">{recipe.name}</h3>
      <p className="mt-1 text-sm text-mute">1 porção ≈ {fmt0(recipe.gramsPerServing)} g · rendimento {fmt1(recipe.servings)} porção(ões)</p>
      <div className="mt-8 grid grid-cols-[1fr_auto] items-end gap-4">
        <div>
          <span className="eyebrow">Porções consumidas</span>
          <div className="mt-2 flex items-center gap-2">
            {[0.5, 1, 1.5, 2].map((s) => (
              <button key={s} onClick={() => setServings(s)} aria-pressed={servings === s} className={`h-11 min-w-14 border px-3 num ${servings === s ? "border-volt bg-volt-dim" : "border-line-strong text-mute"}`}>
                {s.toLocaleString("pt-BR")}
              </button>
            ))}
          </div>
        </div>
        <div className="text-right" aria-live="polite">
          <div className="eyebrow">Energia</div>
          <div className="display text-5xl text-volt">{fmt0(kcal)}</div>
          <div className="text-xs text-mute">kcal</div>
        </div>
      </div>
      {recipe.incomplete && <p className="mt-4 text-xs text-amber">Algum ingrediente não tem todos os nutrientes na fonte; os totais podem estar subestimados.</p>}
      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-dim"><Clock size={11} /> Calculado pelos ingredientes cadastrados (TACO) ÷ rendimento.</p>
    </div>
  );
}
