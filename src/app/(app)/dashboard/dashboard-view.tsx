"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { ArrowUpRight, Plus, Scale } from "lucide-react";
import { CalorieInstrument, MacroBars } from "@/components/app/calorie-instrument";
import { DiaryView } from "@/components/app/diary-view";
import { useQuickLog } from "@/components/app/quick-log";
import { WaterWidget } from "@/components/app/water-widget";
import { FrequencyStrip, Sparkline, WeekBars } from "@/components/app/mini-charts";
import { FormMessage } from "@/components/ui/form";
import { sumNutrients, type Nutrients } from "@/lib/nutrition/calc";
import { formatDateLong, formatDateShort } from "@/lib/dates";
import { GOAL_LABEL, fmt0, fmtKg } from "@/lib/format";
import { mealLabel, type MealDef } from "@/lib/nutrition/meals";
import type { DiaryEntry, GoalKind, NutritionTarget, WeightLog } from "@/lib/types";

interface Props {
  today: string;
  name: string;
  goal: GoalKind;
  needsPro: boolean;
  weight: WeightLog | null;
  target: NutritionTarget | null;
  entries: DiaryEntry[];
  meals: MealDef[];
  water: { enabled: boolean; goal: number; list: { id: string; ml: number }[] };
  week: { date: string; kcal: number | null }[];
  avg7: number | null;
  loggedDays7: number;
  freq: { date: string; logged: boolean }[];
  weights: { x: string; y: number }[];
  top: { food_id: string; name: string; times: number; kcal: number }[];
  next: { id: string; slot: string; time: string | null; name: string }[];
  planName: string | null;
  welcome: boolean;
  passwordUpdated: boolean;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export function DashboardView(p: Props) {
  const [totals, setTotals] = useState<Nutrients>(() => sumNutrients(p.entries));
  const onTotals = useCallback((n: Nutrients) => setTotals(n), []);
  const quickLog = useQuickLog();
  const first = p.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-6 md:px-10 md:py-10">
      {/* cabeçalho */}
      <header className="grid gap-6 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-8">
          <p className="eyebrow">{formatDateLong(p.today)}</p>
          <h1 className="display mt-2 text-[clamp(2.8rem,7.5vw,6.5rem)]">
            Your daily <span className="text-volt">performance</span>
          </h1>
          <p className="mt-3 text-mute" suppressHydrationWarning>
            {greeting()}, <span className="text-bone">{first}</span>.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-px border border-line bg-line lg:col-span-4">
          <div className="bg-ink p-4">
            <dt className="eyebrow">Objetivo</dt>
            <dd className="mt-1 font-semibold">{GOAL_LABEL[p.goal]}</dd>
          </div>
          <div className="bg-ink p-4">
            <dt className="eyebrow">Peso mais recente</dt>
            <dd className="mt-1 font-semibold num">{p.weight ? fmtKg(Number(p.weight.weight_kg)) : "-"}</dd>
            {p.weight && <dd className="text-[11px] text-dim">{formatDateShort(p.weight.measured_on)}</dd>}
          </div>
        </dl>
      </header>

      {p.welcome && <div className="mt-6"><FormMessage tone="success">Perfil configurado. Sua meta foi estimada. Registre a primeira refeição para começar.</FormMessage></div>}
      {p.passwordUpdated && <div className="mt-6"><FormMessage tone="success">Senha atualizada com sucesso.</FormMessage></div>}

      {/* instrumento + macros + timeline */}
      <div className="mt-8 grid gap-3 lg:grid-cols-12">
        <section className="panel p-5 md:p-8 lg:col-span-7" aria-labelledby="kcal-title">
          <div className="flex items-center justify-between">
            <h2 id="kcal-title" className="eyebrow">Calorias · hoje</h2>
            {p.target ? (
              <span className="chip">{p.target.is_manual ? "Meta manual" : "Meta estimada"}</span>
            ) : (
              <Link href="/profile" className="chip chip-amber">Definir meta</Link>
            )}
          </div>
          <div className="mt-4 grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <CalorieInstrument consumed={totals.kcal} target={p.target?.kcal ?? null} />
            <div>
              <MacroBars consumed={totals} target={p.target} />
              <button onClick={() => quickLog()} className="btn btn-volt mt-8 h-12 w-full">
                <Plus size={16} strokeWidth={2.5} /> Registrar alimento
              </button>
              {p.target && (
                <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-4 text-xs">
                  <div><dt className="text-dim">TMB est.</dt><dd className="num mt-0.5 text-sm">{p.target.bmr ? fmt0(p.target.bmr) : "-"}</dd></div>
                  <div><dt className="text-dim">Gasto est.</dt><dd className="num mt-0.5 text-sm">{p.target.tdee ? fmt0(p.target.tdee) : "-"}</dd></div>
                  <div><dt className="text-dim">Fibras hoje</dt><dd className="num mt-0.5 text-sm">{Math.round(totals.fiber_g)} g</dd></div>
                </dl>
              )}
              {!p.target && (
                <p className="mt-4 text-xs text-mute">
                  {p.needsPro
                    ? "Sem meta automática conforme sua indicação de saúde. Você pode registrar uma meta definida com seu profissional no perfil."
                    : "Complete o perfil para estimarmos sua meta."}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="panel flex flex-col p-5 md:p-6 lg:col-span-5" aria-labelledby="tl-title">
          <div className="flex items-center justify-between">
            <h2 id="tl-title" className="eyebrow">Timeline de refeições</h2>
            <Link href="/diary" className="flex items-center gap-1 text-xs uppercase tracking-wider text-mute hover:text-bone">Diário <ArrowUpRight size={12} /></Link>
          </div>
          <div className="mt-5 max-h-[520px] flex-1 overflow-y-auto pr-1">
            <DiaryView date={p.today} initial={p.entries} meals={p.meals} variant="timeline" onTotals={onTotals} />
          </div>
        </section>
      </div>

      {/* indicadores complementares */}
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {p.water.enabled && (
          <Tile title="Água">
            <WaterWidget date={p.today} initial={p.water.list} goal={p.water.goal} />
          </Tile>
        )}
        <Tile title="Últimos 7 dias" aside={p.avg7 !== null ? `${p.loggedDays7} ${p.loggedDays7 === 1 ? "dia" : "dias"} com registro` : undefined}>
          <div className="mb-4">
            <span className="display text-5xl">{p.avg7 !== null ? fmt0(p.avg7) : "-"}</span>
            <span className="ml-1 text-sm text-mute">kcal/dia em média</span>
          </div>
          <WeekBars days={p.week} target={p.target?.kcal ?? null} />
          <p className="mt-2 text-[11px] text-dim">Média só dos dias anteriores com registros. Linha tracejada: meta.</p>
        </Tile>
        <Tile title="Evolução do peso" aside={<Link href="/progress" className="hover:text-bone" aria-label="Abrir progresso">→</Link>}>
          <div className="mb-3 flex items-end justify-between">
            <span className="display text-5xl">{p.weight ? Number(p.weight.weight_kg).toLocaleString("pt-BR", { minimumFractionDigits: 1 }) : "-"}<span className="ml-1 text-sm text-mute">kg</span></span>
            <Scale size={18} className="mb-2 text-mute" aria-hidden />
          </div>
          <Sparkline points={p.weights} label="Tendência do peso nos últimos 90 dias" />
        </Tile>
        <Tile title="Frequência de registros" aside="14 dias">
          <div className="mb-4">
            <span className="display text-5xl">{p.freq.filter((d) => d.logged).length}</span>
            <span className="ml-1 text-sm text-mute">/ 14 dias</span>
          </div>
          <FrequencyStrip days={p.freq} />
        </Tile>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Tile title="Próximas refeições sugeridas" aside={p.planName ?? undefined}>
          {p.next.length ? (
            <ul className="divide-y divide-line">
              {p.next.map((n) => (
                <li key={n.id} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 py-3">
                  <span className="num text-sm text-mute">{n.time ?? "-"}</span>
                  <span>
                    <span className="eyebrow block">{mealLabel(n.slot, p.meals)}</span>
                    <span className="text-sm">{n.name}</span>
                  </span>
                  <Link href="/plan" className="btn btn-quiet btn-sm">Ver plano</Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-4">
              <p className="text-sm text-mute">Nenhum plano ativo para hoje. Gere um cardápio a partir da sua meta e das suas restrições.</p>
              <Link href="/plan" className="btn btn-ghost btn-sm mt-4">Montar plano alimentar</Link>
            </div>
          )}
        </Tile>
        <Tile title="Mais consumidos" aside="30 dias">
          {p.top.length ? (
            <ol className="space-y-2.5">
              {p.top.map((t, i) => {
                const max = p.top[0].times;
                return (
                  <li key={t.food_id} className="grid grid-cols-[1.25rem_1fr_auto] items-center gap-3 text-sm">
                    <span className="num text-dim">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate">{t.name}</span>
                      <span className="mt-1 block h-1 bg-graphite-3"><span className="block h-full bg-bone/60" style={{ width: `${(t.times / max) * 100}%` }} /></span>
                    </span>
                    <span className="num text-mute">{t.times}×</span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="py-4 text-sm text-mute">Aparece depois dos primeiros registros.</p>
          )}
        </Tile>
      </div>
    </div>
  );
}

function Tile({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel p-5 md:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="eyebrow">{title}</h2>
        {aside && <span className="text-[11px] uppercase tracking-wider text-dim">{aside}</span>}
      </div>
      {children}
    </section>
  );
}
