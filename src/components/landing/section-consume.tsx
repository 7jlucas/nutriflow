"use client";
import { useId, useMemo, useState } from "react";
import { motion } from "motion/react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { TACO_CITATION, TACO_SAMPLES } from "@/lib/nutrition/taco-samples";
import { scaleNutrient, r1 } from "@/lib/nutrition/calc";
import { RevealGroup, RevealTitle, SectionIndex } from "./reveal";

const fmt = (n: number, d = 1) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

/**
 * Seção 1: contador e diário no centro da experiência.
 * Demonstração interativa com dados REAIS da TACO e a fórmula exibida por extenso.
 */
export function SectionConsume() {
  const [idx, setIdx] = useState(0);
  const [grams, setGrams] = useState(150);
  const food = TACO_SAMPLES[idx];
  const sliderId = useId();
  const res = useMemo(
    () => ({
      kcal: r1(scaleNutrient(food.kcal, grams, 100)),
      p: r1(scaleNutrient(food.protein_g, grams, 100)),
      c: r1(scaleNutrient(food.carbs_g, grams, 100)),
      f: r1(scaleNutrient(food.fat_g, grams, 100)),
    }),
    [food, grams],
  );

  return (
    <section id="consume" className="relative border-t border-line py-24 md:py-36" aria-labelledby="consume-title">
      <div className="mx-auto grid max-w-[1440px] gap-14 px-5 md:px-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SectionIndex n="01" label="Performance nutricional" />
          <RevealTitle id="consume-title" className="mt-6 text-[clamp(3rem,7vw,7rem)]">
            Know what
            <br />
            you consume.
          </RevealTitle>
          <RevealGroup className="mt-8 max-w-[44ch] space-y-5 text-mute">
            <p data-reveal className="text-lg leading-relaxed text-bone">
              O diário alimentar é o centro do NUTRI//FLOW. Cada alimento registrado recalcula a refeição, o dia, os
              macronutrientes e as calorias restantes na hora, sem recarregar.
            </p>
            <ul data-reveal className="space-y-3 text-sm">
              {[
                "597 alimentos da TACO, com fonte e legenda de cada valor",
                "Gramas, quilos, mililitros, litros e medidas caseiras com conversão explícita",
                "Favoritos, recentes, duplicar e copiar refeições de outros dias",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-2 h-px w-4 shrink-0 bg-volt" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </RevealGroup>
        </div>

        {/* instrumento de porção */}
        <div className="lg:col-span-7">
          <div className="panel relative overflow-hidden p-5 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="eyebrow">Experimente o seletor de porção</span>
              <span className="chip chip-volt">Dados reais · TACO</span>
            </div>

            <div role="radiogroup" aria-label="Alimento" className="mt-6 flex flex-wrap gap-2">
              {TACO_SAMPLES.map((f, i) => (
                <button
                  key={f.ref}
                  role="radio"
                  aria-checked={i === idx}
                  onClick={() => setIdx(i)}
                  className={`relative rounded-[2px] border px-3 py-2 text-sm transition-colors ${
                    i === idx ? "border-volt text-bone" : "border-line-strong text-mute hover:text-bone"
                  }`}
                >
                  {i === idx && <motion.span layoutId="food-pick" className="absolute inset-0 -z-0 bg-volt-dim" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
                  <span className="relative">{f.short}</span>
                </button>
              ))}
            </div>

            <div className="mt-10 grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <label htmlFor={sliderId} className="eyebrow">
                  Quantidade consumida
                </label>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="display text-[clamp(4rem,9vw,7.5rem)] text-bone">
                    <AnimatedNumber value={grams} duration={0.25} />
                  </span>
                  <span className="text-xl text-mute">g</span>
                </div>
                <input
                  id={sliderId}
                  type="range"
                  min={10}
                  max={400}
                  step={5}
                  value={grams}
                  onChange={(e) => setGrams(Number(e.target.value))}
                  className="mt-4 w-full accent-[var(--color-volt)]"
                  aria-valuetext={`${grams} gramas`}
                />
                <div className="mt-1 flex justify-between text-[11px] text-dim num" aria-hidden>
                  <span>10 g</span>
                  <span>200 g</span>
                  <span>400 g</span>
                </div>
              </div>
              <div className="md:text-right" aria-live="polite">
                <div className="eyebrow">Energia da porção</div>
                <div className="display mt-2 text-[clamp(3.5rem,7vw,6rem)] text-volt">
                  <AnimatedNumber value={res.kcal} decimals={1} duration={0.35} />
                </div>
                <div className="text-sm text-mute">kcal</div>
              </div>
            </div>

            {/* fórmula por extenso: explica o cálculo, não decora */}
            <div className="mt-8 border-t border-line pt-5">
              <div className="eyebrow">Como calculamos</div>
              <p className="num mt-2 font-mono text-[13px] leading-relaxed text-bone/90 md:text-sm">
                {fmt(food.kcal)} kcal <span className="text-dim">×</span> {grams} g <span className="text-dim">÷</span> 100 g{" "}
                <span className="text-dim">=</span> <span className="text-volt">{fmt(res.kcal)} kcal</span>
              </p>
              <dl className="mt-5 grid grid-cols-3 gap-4">
                {[
                  ["Proteínas", res.p, "var(--color-protein)"],
                  ["Carboidratos", res.c, "var(--color-carbs)"],
                  ["Gorduras", res.f, "var(--color-fat)"],
                ].map(([label, v, c]) => (
                  <div key={label as string}>
                    <dt className="flex items-center gap-2 eyebrow">
                      <span className="h-2 w-2" style={{ background: c as string }} aria-hidden />
                      {label}
                    </dt>
                    <dd className="num mt-1 text-2xl font-semibold">
                      <AnimatedNumber value={v as number} decimals={1} duration={0.3} />
                      <span className="ml-1 text-sm font-normal text-mute">g</span>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-6 text-[11px] text-dim">
                {food.name} · por 100 g · {TACO_CITATION}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
