"use client";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChefHat, Copy, Download, Loader2, Minus, Plus, RefreshCw, ShoppingCart, Star, Trash2, Undo2 } from "lucide-react";
import { deletePlan, generatePlanAction, logPlanItem, swapPlanItem, undoPlanItemDone, updatePlan, updatePlanItem } from "@/app/(app)/actions/plan";
import { useToast } from "@/components/app/toast";
import { Sheet } from "@/components/ui/sheet";
import { FormMessage } from "@/components/ui/form";
import { recipeNutrition, sumNutrients } from "@/lib/nutrition/calc";
import { shoppingList } from "@/lib/nutrition/plan";
import { mealLabel } from "@/lib/nutrition/meals";
import { addDays, formatDateShort } from "@/lib/dates";
import { fmt0, fmt1 } from "@/lib/format";
import type { MealPlan, MealPlanItem, NutritionTarget, RecipeWithIngredients } from "@/lib/types";

const WEEKDAY = (iso: string) => new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z")).replace(".", "");

export function PlanView({ today, plans, plan, items, recipes, target, mealsPerDay }: { today: string; plans: MealPlan[]; plan: MealPlan | null; items: MealPlanItem[]; recipes: RecipeWithIngredients[]; target: NutritionTarget | null; mealsPerDay: number }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [day, setDay] = useState(() => (plan ? Math.max(0, Math.min(plan.days - 1, Math.round((Date.parse(today) - Date.parse(plan.start_date)) / 86400000))) : 0));
  const [shopOpen, setShopOpen] = useState(false);
  const [genDays, setGenDays] = useState<1 | 7>(7);
  const [genStart, setGenStart] = useState(today);
  const [warnings, setWarnings] = useState<string[]>([]);
  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  const itemNut = (it: MealPlanItem) => {
    const r = it.recipe_id ? byId.get(it.recipe_id) : null;
    if (!r) return null;
    return recipeNutrition(r.ingredients.map((i) => ({ id: i.id, grams: Number(i.grams), food: i.food })), Number(r.servings), { excludeIds: it.excluded_ingredient_ids, scale: Number(it.servings ?? 1) });
  };
  const dayItems = items.filter((i) => i.day_index === day);
  const dayTotal = sumNutrients(dayItems.map((i) => itemNut(i)?.perServing ?? {}));
  const weekTotals = plan ? Array.from({ length: plan.days }, (_, d) => sumNutrients(items.filter((i) => i.day_index === d).map((i) => itemNut(i)?.perServing ?? {}))) : [];
  const goalKcal = plan?.target_kcal ?? target?.kcal ?? null;

  const shopping = useMemo(() => {
    const meta = new Map<string, { name: string; category: string | null }>();
    recipes.forEach((r) => r.ingredients.forEach((i) => meta.set(i.food_id, { name: i.food.name, category: i.food.category })));
    return shoppingList(
      items.map((it) => {
        const r = it.recipe_id ? byId.get(it.recipe_id) : null;
        return { servings: it.servings, grams: it.grams, food_id: it.food_id, excluded: it.excluded_ingredient_ids, recipe: r ? { id: r.id, name: r.name, meal_types: r.meal_types, tags: r.tags, goals: r.goals, cost_level: r.cost_level, servings: Number(r.servings), ingredients: r.ingredients.map((i) => ({ id: i.id, food_id: i.food_id, grams: Number(i.grams), food: i.food })) } : null };
      }),
      meta,
    );
  }, [items, recipes, byId]);
  const shoppingText = shopping.map((s) => `- ${s.name}: ${s.grams >= 1000 ? `${fmt1(s.grams / 1000)} kg` : `${s.grams} g`}`).join("\n");

  function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) {
    setBusyItem(id);
    start(async () => {
      const r = await fn();
      setBusyItem(null);
      if (!r.ok) return toast({ tone: "error", message: r.error ?? "Erro" });
      if (ok) toast({ tone: "success", message: ok });
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-6 md:px-10 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Planejado · separado do consumo registrado</p>
          <h1 className="display mt-2 text-[clamp(2.8rem,7vw,5rem)]">Plano alimentar</h1>
        </div>
        <Link href="/lab" className="btn btn-ghost">Montar com o AI Nutrition Lab</Link>
      </div>

      {/* gerador */}
      <section className="mt-6 grid gap-4 border-y border-line py-5 lg:grid-cols-[1fr_auto] lg:items-end" aria-labelledby="gen-title">
        <div>
          <h2 id="gen-title" className="font-semibold">Gerar plano a partir da sua meta</h2>
          <p className="mt-1 text-sm text-mute">
            Gerador determinístico: escolhe receitas compatíveis com suas restrições e {mealsPerDay} refeições/dia, ajusta porções à meta {goalKcal ? `de ${fmt0(goalKcal)} kcal` : "(defina no perfil)"} e calcula tudo pelos ingredientes. Não usa IA.
          </p>
          {warnings.length > 0 && <div className="mt-3"><FormMessage tone="info">{warnings.join(" ")}</FormMessage></div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex" role="group" aria-label="Duração">
            {([1, 7] as const).map((d) => <button key={d} aria-pressed={genDays === d} onClick={() => setGenDays(d)} className={`h-11 border px-4 text-sm ${genDays === d ? "border-volt bg-volt-dim" : "border-line-strong text-mute"}`}>{d === 1 ? "1 dia" : "Semana"}</button>)}
          </div>
          <input type="date" className="field num h-11 w-40 py-0" value={genStart} onChange={(e) => setGenStart(e.target.value)} aria-label="Início do plano" />
          <button
            className="btn btn-volt h-11"
            disabled={pending || !goalKcal}
            onClick={() =>
              start(async () => {
                const r = await generatePlanAction({ days: genDays, start_date: genStart });
                if (!r.ok) return toast({ tone: "error", message: r.error });
                setWarnings(r.data.warnings);
                setDay(0);
                router.push(`/plan?id=${r.data.id}`);
                toast({ tone: "success", message: "Plano gerado" });
              })
            }
          >
            {pending && !busyItem ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Gerar plano
          </button>
        </div>
      </section>

      {!plan ? (
        <div className="py-20 text-center">
          <p className="display text-4xl text-mute">Nenhum plano ainda.</p>
          <p className="mt-2 text-sm text-dim">Gere um cardápio acima ou peça ao AI Nutrition Lab.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-12">
          <aside className="order-2 space-y-3 lg:order-1 lg:col-span-3">
            <p className="eyebrow">Seus planos</p>
            <ul className="divide-y divide-line border-y border-line">
              {plans.map((p) => (
                <li key={p.id}>
                  <Link href={`/plan?id=${p.id}`} className={`flex items-center justify-between gap-2 px-2 py-2.5 text-sm ${p.id === plan.id ? "bg-graphite text-bone" : "text-mute hover:text-bone"}`}>
                    <span className="truncate">{p.is_favorite && <Star size={11} className="mr-1 inline fill-volt text-volt" />}{p.name}</span>
                    <span className="num shrink-0 text-xs text-dim">{formatDateShort(p.start_date)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>

          <div className="order-1 lg:order-2 lg:col-span-9">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold">{plan.name}</h2>
                <p className="text-sm text-mute">{formatDateShort(plan.start_date)}{plan.days > 1 ? ` a ${formatDateShort(addDays(plan.start_date, plan.days - 1))}` : ""} · meta {plan.target_kcal ? `${fmt0(plan.target_kcal)} kcal/dia` : "-"} · {plan.origin === "ai" ? "sugerido pela IA" : plan.origin === "generator" ? "gerador determinístico" : "manual"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-ghost btn-sm" aria-pressed={plan.is_favorite} onClick={() => run(plan.id, () => updatePlan(plan.id, { is_favorite: !plan.is_favorite }), plan.is_favorite ? "Removido dos favoritos" : "Plano salvo nos favoritos")}><Star size={13} className={plan.is_favorite ? "fill-volt text-volt" : ""} /> {plan.is_favorite ? "Favorito" : "Favoritar"}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShopOpen(true)}><ShoppingCart size={13} /> Lista de compras</button>
                <button className="btn btn-quiet btn-sm hover:text-danger" onClick={() => run(plan.id, async () => { const r = await deletePlan(plan.id); if (r.ok) router.push("/plan"); return r; }, "Plano excluído")} aria-label="Excluir plano"><Trash2 size={13} /></button>
              </div>
            </div>

            {/* semana */}
            {plan.days > 1 && (
              <div className="mt-6 grid grid-cols-7 gap-1" role="tablist" aria-label="Dias do plano">
                {weekTotals.map((t, d) => {
                  const date = addDays(plan.start_date, d);
                  const pctv = goalKcal ? Math.min(1.2, t.kcal / goalKcal) : 0;
                  return (
                    <button key={d} role="tab" aria-selected={day === d} onClick={() => setDay(d)} className={`border p-2 text-left transition-colors ${day === d ? "border-volt bg-volt-dim" : "border-line hover:border-line-strong"}`}>
                      <span className="block text-[11px] uppercase tracking-wider text-mute">{WEEKDAY(date)}</span>
                      <span className="num block text-sm font-semibold">{fmt0(t.kcal)}</span>
                      <span className="mt-1.5 block h-1 bg-graphite-3"><span className="block h-full bg-volt" style={{ width: `${(pctv / 1.2) * 100}%` }} /></span>
                      {date === today && <span className="mt-1 block text-[10px] text-volt">hoje</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* resumo do dia */}
            <dl className="mt-4 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-5">
              {[["Planejado", `${fmt0(dayTotal.kcal)} kcal`], ["Meta", goalKcal ? `${fmt0(goalKcal)} kcal` : "-"], ["Proteínas", `${fmt0(dayTotal.protein_g)} g${target ? ` / ${target.protein_g}` : ""}`], ["Carboidratos", `${fmt0(dayTotal.carbs_g)} g${target ? ` / ${target.carbs_g}` : ""}`], ["Gorduras", `${fmt0(dayTotal.fat_g)} g${target ? ` / ${target.fat_g}` : ""}`]].map(([l, v]) => (
                <div key={l} className="bg-ink p-3"><dt className="eyebrow">{l}</dt><dd className="num mt-1 font-semibold">{v}</dd></div>
              ))}
            </dl>

            <ol className="mt-4 space-y-3">
              <AnimatePresence initial={false}>
                {dayItems.map((it) => {
                  const r = it.recipe_id ? byId.get(it.recipe_id) : null;
                  const n = itemNut(it);
                  const busy = busyItem === it.id && pending;
                  return (
                    <motion.li key={it.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`panel p-4 md:p-5 ${it.done_at ? "opacity-70" : ""}`}>
                      <div className="grid gap-4 md:grid-cols-[5rem_1fr_auto]">
                        <div>
                          <span className="display text-3xl text-mute">{it.suggested_time?.slice(0, 5) ?? "-"}</span>
                          <span className="eyebrow block">{mealLabel(it.meal_slot)}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-start gap-2">
                            <ChefHat size={14} className="mt-1 shrink-0 text-mute" aria-hidden />
                            {r ? <Link href={`/recipes/${r.id}`} className="text-lg font-semibold leading-snug hover:text-volt">{r.name}</Link> : <span className="text-mute">Receita indisponível</span>}
                            {it.done_at && <span className="chip chip-volt shrink-0"><Check size={10} /> Realizada</span>}
                          </div>
                          {n && <p className="num mt-1 text-sm text-mute">{fmt0(n.perServing.kcal)} kcal · P {fmt1(n.perServing.protein_g)} · C {fmt1(n.perServing.carbs_g)} · G {fmt1(n.perServing.fat_g)} g</p>}
                          {r && (
                            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Ingredientes (toque para remover ou restaurar)">
                              {r.ingredients.map((ing) => {
                                const off = it.excluded_ingredient_ids.includes(ing.id);
                                const g = (Number(ing.grams) / Number(r.servings)) * Number(it.servings ?? 1);
                                return (
                                  <li key={ing.id}>
                                    <button
                                      disabled={!!it.done_at || busy}
                                      aria-pressed={!off}
                                      title={off ? "Restaurar ingrediente" : "Remover ingrediente"}
                                      onClick={() => run(it.id, () => updatePlanItem(it.id, { excluded_ingredient_ids: off ? it.excluded_ingredient_ids.filter((x) => x !== ing.id) : [...it.excluded_ingredient_ids, ing.id] }))}
                                      className={`border px-2 py-1 text-xs ${off ? "border-line text-dim line-through" : "border-line-strong text-bone hover:border-danger/60"}`}
                                    >
                                      {ing.food.name.split(",")[0]} <span className="num text-dim">{fmt0(g)} g</span>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                        <div className="flex flex-row flex-wrap items-center gap-2 md:flex-col md:items-end">
                          <div className="flex items-center border border-line-strong" role="group" aria-label="Porções">
                            <button className="h-9 w-9 text-mute hover:text-bone disabled:opacity-30" disabled={!!it.done_at || busy || Number(it.servings) <= 0.25} onClick={() => run(it.id, () => updatePlanItem(it.id, { servings: Math.max(0.25, Number(it.servings) - 0.25) }))} aria-label="Diminuir porção"><Minus size={14} className="mx-auto" /></button>
                            <span className="num w-14 text-center text-sm">{fmt1(Number(it.servings))}×</span>
                            <button className="h-9 w-9 text-mute hover:text-bone disabled:opacity-30" disabled={!!it.done_at || busy || Number(it.servings) >= 4} onClick={() => run(it.id, () => updatePlanItem(it.id, { servings: Math.min(4, Number(it.servings) + 0.25) }))} aria-label="Aumentar porção"><Plus size={14} className="mx-auto" /></button>
                          </div>
                          {!it.done_at ? (
                            <>
                              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(it.id, () => swapPlanItem(it.id), "Refeição trocada")}><RefreshCw size={12} /> Trocar</button>
                              <button className="btn btn-volt btn-sm" disabled={busy} onClick={() => run(it.id, () => logPlanItem(it.id, { log: true }), "Registrado no diário")}>{busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Registrar</button>
                              <button className="btn btn-quiet btn-sm" disabled={busy} onClick={() => run(it.id, () => logPlanItem(it.id, { log: false }), "Marcada como realizada")}><Check size={12} /> Só marcar</button>
                            </>
                          ) : (
                            <button className="btn btn-quiet btn-sm" onClick={() => run(it.id, () => undoPlanItemDone(it.id))}><Undo2 size={12} /> Desmarcar</button>
                          )}
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ol>
            <p className="mt-4 text-xs text-dim">Valores recalculados pelos ingredientes a cada troca, ajuste de porção ou remoção. “Registrar” cria um item no diário (consumo real); desmarcar não apaga o que já foi registrado.</p>
          </div>
        </div>
      )}

      <Sheet open={shopOpen} onClose={() => setShopOpen(false)} title="Lista de compras" description={plan ? `${plan.name} · ${plan.days} dia(s) · quantidades somadas` : undefined}>
        <div className="px-5 py-5 md:px-7">
          {shopping.length ? (
            <>
              <ul className="divide-y divide-line border-y border-line">
                {shopping.map((s, i) => (
                  <li key={s.food_id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <label className="flex items-center gap-3"><input type="checkbox" className="accent-[var(--color-volt)]" aria-label={`Comprado: ${s.name}`} /> <span>{s.name}{(i === 0 || shopping[i - 1].category !== s.category) && <span className="ml-2 text-[10px] uppercase tracking-wider text-dim">{s.category}</span>}</span></label>
                    <span className="num text-mute">{s.grams >= 1000 ? `${fmt1(s.grams / 1000)} kg` : `${s.grams} g`}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex gap-2">
                <button className="btn btn-ghost flex-1" onClick={async () => { await navigator.clipboard.writeText(shoppingText); toast({ tone: "success", message: "Lista copiada" }); }}><Copy size={14} /> Copiar</button>
                <button className="btn btn-ghost flex-1" onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([`Lista de compras: ${plan?.name}\n\n${shoppingText}\n`], { type: "text/plain;charset=utf-8" })); a.download = "lista-de-compras.txt"; a.click(); }}><Download size={14} /> Baixar .txt</button>
              </div>
              <p className="mt-3 text-xs text-dim">Pesos no estado listado nas receitas (ex.: arroz cozido). Ingredientes removidos não entram.</p>
            </>
          ) : <p className="text-sm text-mute">Sem itens.</p>}
        </div>
      </Sheet>
    </div>
  );
}
