"use client";
import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion, motion } from "motion/react";
import { ArrowRight, Search } from "lucide-react";
import { SpotlightCard } from "@/components/ui/spotlight";
import { TACO_COMPARE, TACO_SWAP } from "@/lib/nutrition/taco-samples";
import { r1, scaleNutrient } from "@/lib/nutrition/calc";
import { RevealGroup, RevealTitle, SectionIndex } from "./reveal";

const n1 = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function SectionSmarter() {
  return (
    <section id="smarter" className="relative border-t border-line bg-graphite/40 py-24 md:py-36" aria-labelledby="smarter-title">
      <div className="mx-auto max-w-[1440px] px-5 md:px-10">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <SectionIndex n="02" label="Inteligência alimentar" />
            <RevealTitle id="smarter-title" className="mt-6 text-[clamp(3rem,7vw,7rem)]">
              Smarter food.
              <br />
              <span className="text-mute">Better decisions.</span>
            </RevealTitle>
          </div>
          <p className="max-w-[46ch] text-mute lg:col-span-4 lg:col-start-9">
            Organize refeições, compare alimentos lado a lado e encontre alternativas, sempre com o número e a fonte à
            vista, para você decidir.
          </p>
        </div>

        <RevealGroup className="mt-14 grid gap-3 md:grid-cols-12">
          <CompareCard />
          <SearchCard />
          <SwapCard />
          <MissingDataCard />
          <RecipeCard />
        </RevealGroup>
      </div>
    </section>
  );
}

function Card({ className = "", label, title, children }: { className?: string; label: string; title: string; children: React.ReactNode }) {
  return (
    <SpotlightCard data-reveal className={`panel flex flex-col overflow-hidden p-5 md:p-7 ${className}`}>
      <span className="eyebrow">{label}</span>
      <h3 className="mt-2 text-xl font-semibold tracking-tight md:text-2xl">{title}</h3>
      <div className="mt-6 flex-1">{children}</div>
    </SpotlightCard>
  );
}

function CompareCard() {
  const { a, b } = TACO_COMPARE;
  const rows = [
    { k: "kcal", label: "Energia", unit: "kcal", max: 140 },
    { k: "carbs_g", label: "Carboidratos", unit: "g", max: 30 },
    { k: "protein_g", label: "Proteínas", unit: "g", max: 30 },
    { k: "fat_g", label: "Gorduras", unit: "g", max: 30 },
    { k: "fiber_g", label: "Fibras", unit: "g", max: 30 },
  ] as const;
  const [hover, setHover] = useState<string | null>(null);
  return (
    <Card className="md:col-span-7 md:row-span-2" label="Comparar" title="Dois alimentos, uma leitura.">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-sm">
        <span className="eyebrow">por 100 g</span>
        <span className="eyebrow text-right text-bone">{a.short}</span>
        <span className="eyebrow text-right text-volt">{b.short}</span>
        {rows.map((r) => {
          const va = a[r.k];
          const vb = b[r.k];
          return (
            <div
              key={r.k}
              className={`col-span-3 grid grid-cols-subgrid items-center border-t border-line py-3 transition-colors ${hover === r.k ? "bg-graphite-2" : ""}`}
              onPointerEnter={() => setHover(r.k)}
              onPointerLeave={() => setHover(null)}
            >
              <div>
                <div className="text-mute">{r.label}</div>
                <div className="mt-2 flex flex-col gap-1" aria-hidden>
                  <span className="h-1 bg-bone/70" style={{ width: `${Math.min(100, (va / r.max) * 100)}%` }} />
                  <span className="h-1 bg-volt" style={{ width: `${Math.min(100, (vb / r.max) * 100)}%` }} />
                </div>
              </div>
              <span className="num text-right">{n1(va)} <span className="text-dim">{r.unit}</span></span>
              <span className="num text-right text-volt">{n1(vb)} <span className="text-dim">{r.unit}</span></span>
            </div>
          );
        })}
      </div>
      <p className="mt-5 text-xs text-dim">TACO 4ª ed. · Arroz tipo 1 cozido (nº 3) vs. arroz integral cozido (nº 1).</p>
    </Card>
  );
}

function SearchCard() {
  const target = "feijao preto";
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px" });
  const reduce = useReducedMotion();
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (reduce) {
      setTyped(target);
      return;
    }
    if (!inView) return;
    let i = 0;
    setTyped("");
    const id = window.setInterval(() => {
      i++;
      setTyped(target.slice(0, i));
      if (i >= target.length) window.clearInterval(id);
    }, 85);
    return () => window.clearInterval(id);
  }, [inView, reduce]);
  const done = typed.length >= 6;
  return (
    <Card className="md:col-span-5" label="Buscar" title="Sem acento, com erro de digitação, com marca.">
      <div ref={ref}>
        <div className="flex items-center gap-2 border border-line-strong bg-ink px-3 py-2.5 text-sm">
          <Search size={14} className="text-mute" aria-hidden />
          <span className="num">{typed}</span>
          <span className="h-4 w-px bg-volt motion-safe:animate-pulse-dot" aria-hidden />
        </div>
        <ul className="mt-2 divide-y divide-line border border-line" aria-label="Resultado de exemplo">
          {[
            ["Feijão, preto, cozido", "77,0"],
            ["Feijão, preto, cru", "323,6"],
          ].map(([name, kcal], i) => (
            <motion.li
              key={name}
              initial={false}
              animate={{ opacity: done ? 1 : 0.15, x: done ? 0 : 6 }}
              transition={{ delay: done ? i * 0.08 : 0, duration: 0.4 }}
              className="flex items-center justify-between px-3 py-2.5 text-sm"
            >
              <span>{name}</span>
              <span className="num text-mute">{kcal} kcal/100 g</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function SwapCard() {
  const { from, to } = TACO_SWAP;
  return (
    <Card className="md:col-span-5" label="Substituir" title="Troca com contexto, não com julgamento.">
      <div className="flex items-center gap-3 text-sm">
        <span className="border border-line-strong px-3 py-2">{from.short}</span>
        <ArrowRight size={16} className="shrink-0 text-volt" aria-hidden />
        <span className="border border-volt px-3 py-2">{to.short}</span>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="eyebrow">Energia /100 g</dt>
          <dd className="num mt-1">{n1(from.kcal)} → <span className="text-volt">{n1(to.kcal)}</span> kcal</dd>
        </div>
        <div>
          <dt className="eyebrow">Fibras /100 g</dt>
          <dd className="num mt-1">{n1(from.fiber_g)} → <span className="text-volt">{n1(to.fiber_g)}</span> g</dd>
        </div>
      </dl>
    </Card>
  );
}

function MissingDataCard() {
  return (
    <Card className="md:col-span-6" label="Transparência" title="Dado ausente fica ausente.">
      <p className="text-sm leading-relaxed text-mute">
        A TACO 4ª ed. marca o leite de vaca fluido como amostra em reavaliação. Em vez de inventar um número, sinalizamos
        a lacuna e sugerimos alternativas ou o cadastro com dados do rótulo.
      </p>
      <dl className="mt-5 grid grid-cols-3 gap-2 text-xs">
        {[
          ["Tr", "Traço: valor abaixo do limite de quantificação"],
          ["NA", "Não aplicável àquele alimento"],
          ["*", "Amostra em reavaliação, sem valor"],
        ].map(([k, v]) => (
          <div key={k} className="border border-line p-3">
            <dt className="num font-semibold text-amber">{k}</dt>
            <dd className="mt-1 text-mute">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function RecipeCard() {
  // Frango, arroz integral, feijão, brócolis e azeite, valores TACO por 100 g
  const parts = [
    { name: "Frango grelhado", g: 120, kcal100: 159.2 },
    { name: "Arroz integral cozido", g: 120, kcal100: 123.5 },
    { name: "Feijão carioca cozido", g: 100, kcal100: 76.4 },
    { name: "Brócolis cozido", g: 80, kcal100: 24.6 },
    { name: "Azeite extra virgem", g: 5, kcal100: 884.0 },
  ].map((p) => ({ ...p, kcal: r1(scaleNutrient(p.kcal100, p.g, 100)) }));
  const total = r1(parts.reduce((a, p) => a + p.kcal, 0));
  return (
    <Card className="md:col-span-6" label="Receitas" title="Calculadas ingrediente por ingrediente.">
      <ul className="space-y-1.5 text-sm">
        {parts.map((p) => (
          <li key={p.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
            <span className="text-mute">{p.name}</span>
            <span className="num text-dim">{p.g} g</span>
            <span className="num w-16 text-right">{n1(p.kcal)}</span>
          </li>
        ))}
        <li className="grid grid-cols-[1fr_auto] border-t border-line pt-2 font-semibold">
          <span>Total do prato</span>
          <span className="num text-volt">{n1(total)} kcal</span>
        </li>
      </ul>
    </Card>
  );
}
