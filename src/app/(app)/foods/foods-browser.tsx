"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, Star, Trash2 } from "lucide-react";
import { searchFoods, toggleFavorite, getFoodDetail } from "@/app/(app)/actions/diary";
import { deleteCustomFood, listFoodsByCategory } from "@/app/(app)/actions/foods";
import { useQuickLog } from "@/components/app/quick-log";
import { useToast } from "@/components/app/toast";
import { Sheet } from "@/components/ui/sheet";
import { CustomFoodForm } from "@/components/app/custom-food-form";
import { canLog } from "@/lib/nutrition/calc";
import { SOURCE_LABEL, fmt1 } from "@/lib/format";
import type { Food, FoodPortion } from "@/lib/types";

const FLAG_TEXT: Record<string, string> = { Tr: "Traço (abaixo do limite de quantificação)", NA: "Não aplicável", "*": "Amostra em reavaliação na fonte, sem valor", missing: "Sem dado na fonte" };
const ROWS: [keyof Food, string, string][] = [
  ["kcal", "Energia", "kcal"],
  ["protein_g", "Proteínas", "g"],
  ["carbs_g", "Carboidratos", "g"],
  ["fat_g", "Gorduras", "g"],
  ["fiber_g", "Fibras", "g"],
  ["sodium_mg", "Sódio", "mg"],
];

export function FoodsBrowser({ favorites, mine, categories }: { favorites: Food[]; mine: Food[]; categories: string[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [list, setList] = useState<Food[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<{ food: Food; portions: FoodPortion[]; favorite: boolean } | null>(null);
  const [creating, setCreating] = useState(false);
  const [, start] = useTransition();
  const quickLog = useQuickLog();
  const toast = useToast();
  const router = useRouter();
  const req = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2 && !cat) {
      setList(null);
      return;
    }
    const id = ++req.current;
    setLoading(true);
    const t = setTimeout(async () => {
      let data: Food[] = [];
      if (term.length >= 2) {
        const r = await searchFoods(term);
        data = r.ok ? (cat ? r.data.filter((f) => f.category === cat) : r.data) : [];
      } else if (cat) data = await listFoodsByCategory(cat);
      if (id !== req.current) return;
      setLoading(false);
      setList(data);
    }, 220);
    return () => clearTimeout(t);
  }, [q, cat]);

  async function open(f: Food) {
    setSel({ food: f, portions: [], favorite: favorites.some((x) => x.id === f.id) });
    const d = await getFoodDetail(f.id);
    if (d) setSel(d);
  }

  const shown = list ?? (q.trim() ? [] : favorites);

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-6 md:px-10 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Base nutricional · TACO 4ª ed. + seus alimentos</p>
          <h1 className="display mt-2 text-[clamp(2.8rem,7vw,5rem)]">Alimentos</h1>
        </div>
        <button className="btn btn-ghost" onClick={() => setCreating(true)}><Plus size={16} /> Criar alimento</button>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-mute" aria-hidden />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome ou marca, ex.: banana prata, iogurte" className="field h-14 pl-12 text-lg" aria-label="Buscar alimento" />
            {loading && <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-mute" />}
          </div>
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none" role="group" aria-label="Filtrar por categoria">
            <button aria-pressed={!cat} onClick={() => setCat(null)} className={`chip shrink-0 ${!cat ? "chip-volt" : ""}`}>Todas</button>
            {categories.map((c) => (
              <button key={c} aria-pressed={cat === c} onClick={() => setCat(cat === c ? null : c)} className={`chip shrink-0 ${cat === c ? "chip-volt" : ""}`}>{c}</button>
            ))}
          </div>
          <p className="mt-6 eyebrow">{list ? `${shown.length} resultado(s)${cat ? ` · ${cat}` : ""}` : q.trim() ? "Buscando…" : `Favoritos · ${favorites.length}`}</p>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {loading && !list && Array.from({ length: 6 }).map((_, i) => <li key={i} className="skeleton my-1 h-12" />)}
            {shown.map((f) => (
              <li key={f.id}>
                <button onClick={() => open(f)} className={`grid w-full grid-cols-[1fr_auto] items-center gap-4 px-2 py-3 text-left hover:bg-graphite ${sel?.food.id === f.id ? "bg-graphite" : ""}`}>
                  <span className="min-w-0">
                    <span className="block truncate">{f.name}</span>
                    <span className="text-xs text-dim">{f.category} · {SOURCE_LABEL[f.source]}{f.brand ? ` · ${f.brand}` : ""}</span>
                  </span>
                  {canLog(f) ? (
                    <span className="num text-right text-sm">{fmt1(f.kcal)} <span className="block text-[10px] text-dim">kcal/{fmt1(f.ref_amount)} {f.ref_unit}</span></span>
                  ) : (
                    <span className="chip chip-amber">Sem energia</span>
                  )}
                </button>
              </li>
            ))}
            {!loading && list && !list.length && <li className="py-8 text-center text-sm text-mute">Nada encontrado. Você pode criar o alimento com os dados do rótulo.</li>}
            {!list && !q.trim() && !favorites.length && <li className="py-8 text-center text-sm text-mute">Busque um alimento. Os que você favoritar aparecem aqui.</li>}
          </ul>

          {mine.length > 0 && (
            <section className="mt-10" aria-labelledby="mine-title">
              <h2 id="mine-title" className="eyebrow">Meus alimentos · {mine.length}</h2>
              <ul className="mt-2 divide-y divide-line border-y border-line">
                {mine.map((f) => (
                  <li key={f.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-2 py-2.5">
                    <button onClick={() => open(f)} className="min-w-0 text-left">
                      <span className="block truncate text-sm">{f.name}</span>
                      <span className="text-xs text-dim">{f.source_ref === "rotulo" ? "Rótulo" : "Dados próprios"}{f.brand ? ` · ${f.brand}` : ""}</span>
                    </button>
                    <span className="num text-sm">{fmt1(f.kcal)} kcal</span>
                    <button
                      className="btn btn-quiet h-8 w-8 p-0 hover:text-danger"
                      aria-label={`Excluir ${f.name}`}
                      onClick={() =>
                        start(async () => {
                          const r = await deleteCustomFood(f.id);
                          if (!r.ok) return toast({ tone: "error", message: r.error });
                          if (sel?.food.id === f.id) setSel(null);
                          router.refresh();
                          toast({ tone: "info", message: "Alimento excluído. Registros antigos do diário foram mantidos." });
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* detalhe */}
        <aside className="lg:col-span-5" aria-live="polite">
          <div className="panel sticky top-20 p-5 md:p-7 lg:top-6">
            {!sel ? (
              <div className="py-16 text-center">
                <p className="display text-3xl text-mute">Selecione um alimento</p>
                <p className="mt-2 text-sm text-dim">Veja a composição completa, a fonte e as legendas de cada valor.</p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow">{sel.food.category}</p>
                    <h2 className="mt-1 text-2xl font-semibold leading-tight">{sel.food.name}</h2>
                    {sel.food.brand && <p className="text-sm text-mute">{sel.food.brand}</p>}
                  </div>
                  <button
                    className="btn btn-quiet h-10 w-10 p-0"
                    aria-pressed={sel.favorite}
                    aria-label={sel.favorite ? "Remover dos favoritos" : "Favoritar"}
                    onClick={async () => {
                      const r = await toggleFavorite(sel.food.id);
                      if (r.ok) {
                        setSel({ ...sel, favorite: r.data.favorite });
                        router.refresh();
                      }
                    }}
                  >
                    <Star size={18} className={sel.favorite ? "fill-volt text-volt" : ""} />
                  </button>
                </div>
                <table className="mt-6 w-full text-sm">
                  <caption className="mb-2 text-left eyebrow">Por {fmt1(sel.food.ref_amount)} {sel.food.ref_unit}</caption>
                  <tbody className="divide-y divide-line border-y border-line">
                    {ROWS.map(([k, label, unit]) => {
                      const v = sel.food[k] as number | null;
                      const flag = sel.food.nutrient_flags?.[k as string];
                      return (
                        <tr key={k as string}>
                          <th scope="row" className="py-2.5 text-left font-normal text-mute">{label}</th>
                          <td className="num py-2.5 text-right">
                            {v === null ? <span className="text-amber">sem dado</span> : `${fmt1(v)} ${unit}`}
                            {flag && <span className="ml-2 chip chip-amber h-5" title={FLAG_TEXT[flag]}>{flag}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {Object.values(sel.food.nutrient_flags ?? {}).length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-dim">
                    {[...new Set(Object.values(sel.food.nutrient_flags ?? {}))].map((f) => <li key={f}><b className="text-amber">{f}</b>: {FLAG_TEXT[f as string]}</li>)}
                  </ul>
                )}
                {sel.portions.length > 0 && (
                  <div className="mt-5">
                    <p className="eyebrow">Medidas caseiras</p>
                    <ul className="mt-2 text-sm">{sel.portions.map((p) => <li key={p.id} className="flex justify-between py-1"><span>{p.label}</span><span className="num text-mute">{fmt1(p.amount)} {p.amount_unit}</span></li>)}</ul>
                  </div>
                )}
                <p className="mt-5 text-xs text-dim">
                  Fonte: {SOURCE_LABEL[sel.food.source]}{sel.food.source === "TACO" ? ` · alimento nº ${sel.food.source_ref} · ${sel.food.source_version}` : sel.food.source_ref === "rotulo" ? " · dados de rótulo informados por você" : " · informado por você"}
                  {sel.food.density_is_estimate && " · conversão ml→g estimada (densidade ≈ 1)"}
                </p>
                <button className="btn btn-volt mt-6 w-full" disabled={!canLog(sel.food)} onClick={() => quickLog({ food: sel.food })}>
                  <Plus size={16} /> Registrar no diário
                </button>
                {!canLog(sel.food) && <p className="mt-2 text-xs text-amber">A fonte não informa energia para este alimento. Escolha um similar ou crie um alimento com os dados do rótulo.</p>}
              </>
            )}
          </div>
        </aside>
      </div>

      <Sheet open={creating} onClose={() => setCreating(false)} title="Criar alimento" description="Use os dados do rótulo ou valores que você conhece.">
        <div className="px-5 py-5 md:px-7">
          {creating && (
            <CustomFoodForm
              onCreated={(f) => {
                setCreating(false);
                router.refresh();
                setSel({ food: f, portions: [], favorite: false });
                toast({ tone: "success", message: "Alimento criado" });
              }}
            />
          )}
        </div>
      </Sheet>
    </div>
  );
}
