"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { DiaryView } from "@/components/app/diary-view";
import { useQuickLog } from "@/components/app/quick-log";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { sumNutrients, type Nutrients } from "@/lib/nutrition/calc";
import { addDays, formatDateLong } from "@/lib/dates";
import type { DiaryEntry, NutritionTarget } from "@/lib/types";
import type { MealDef } from "@/lib/nutrition/meals";

export function DiaryPage({ date, today, entries, meals, target }: { date: string; today: string; entries: DiaryEntry[]; meals: MealDef[]; target: NutritionTarget | null }) {
  const [totals, setTotals] = useState<Nutrients>(() => sumNutrients(entries));
  const onTotals = useCallback((n: Nutrients) => setTotals(n), []);
  const quickLog = useQuickLog();
  const router = useRouter();
  const remaining = target ? target.kcal - totals.kcal : null;

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-6 md:px-10 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Diário alimentar · consumo registrado</p>
          <h1 className="display mt-2 text-[clamp(2.8rem,7vw,5rem)] first-letter:uppercase">{date === today ? "Hoje" : formatDateLong(date)}</h1>
          {date === today && <p className="mt-1 text-sm capitalize text-mute">{formatDateLong(date)}</p>}
        </div>
        <nav className="flex items-center gap-1" aria-label="Navegar entre dias">
          <Link href={`/diary?d=${addDays(date, -1)}`} className="btn btn-ghost h-10 w-10 p-0" aria-label="Dia anterior"><ChevronLeft size={18} /></Link>
          <input type="date" value={date} max={addDays(today, 30)} onChange={(e) => e.target.value && router.push(`/diary?d=${e.target.value}`)} className="field num h-10 w-40 py-0" aria-label="Escolher data" />
          <Link href={`/diary?d=${addDays(date, 1)}`} className="btn btn-ghost h-10 w-10 p-0" aria-label="Próximo dia"><ChevronRight size={18} /></Link>
          {date !== today && <Link href="/diary" className="btn btn-quiet h-10">Hoje</Link>}
        </nav>
      </div>

      {/* barra de totais, sempre visível ao rolar */}
      <div className="sticky top-14 z-20 -mx-5 mt-6 border-y border-line bg-ink/90 px-5 py-3 backdrop-blur-md md:mx-0 md:border md:px-5 lg:top-0">
        <div className="grid grid-cols-3 items-center gap-3 md:grid-cols-[auto_1fr_auto]">
        <dl className="col-span-3 grid grid-cols-3 items-center gap-3 md:col-span-2 md:grid-cols-[auto_auto_auto_1fr]">
          <div>
            <dt className="eyebrow">Consumido</dt>
            <dd className="num text-xl font-semibold"><AnimatedNumber value={Math.round(totals.kcal)} /> <span className="text-xs font-normal text-mute">kcal</span></dd>
          </div>
          <div>
            <dt className="eyebrow">Meta</dt>
            <dd className="num text-xl font-semibold">{target ? target.kcal.toLocaleString("pt-BR") : "-"}</dd>
          </div>
          <div>
            <dt className="eyebrow">{remaining !== null && remaining < 0 ? "Acima" : "Restante"}</dt>
            <dd className={`num text-xl font-semibold ${remaining !== null && remaining < 0 ? "text-amber" : "text-volt"}`}>{remaining === null ? "-" : <AnimatedNumber value={Math.abs(Math.round(remaining))} />}</dd>
          </div>
          <div className="col-span-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute md:col-span-1 md:justify-center">
            <dt className="sr-only">Macronutrientes</dt>
            <dd className="contents">
            <span className="num">P <b className="text-bone">{Math.round(totals.protein_g)}</b>{target ? `/${target.protein_g}` : ""} g</span>
            <span className="num">C <b className="text-bone">{Math.round(totals.carbs_g)}</b>{target ? `/${target.carbs_g}` : ""} g</span>
            <span className="num">G <b className="text-bone">{Math.round(totals.fat_g)}</b>{target ? `/${target.fat_g}` : ""} g</span>
            <span className="num">Fibra <b className="text-bone">{Math.round(totals.fiber_g)}</b> g</span>
            </dd>
          </div>
        </dl>
          <button onClick={() => quickLog({ date })} className="btn btn-volt col-span-3 md:col-span-1"><Plus size={16} /> Registrar alimento</button>
        </div>
      </div>

      <div className="mt-8">
        <DiaryView date={date} initial={entries} meals={meals} onTotals={onTotals} />
      </div>
    </div>
  );
}
