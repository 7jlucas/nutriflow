"use client";
import { RevealGroup, RevealTitle, SectionIndex } from "./reveal";

const DAY = [
  { t: "07:30", slot: "Café da manhã", name: "Overnight de aveia, banana e iogurte", kcal: 355 },
  { t: "12:30", slot: "Almoço", name: "Frango grelhado, arroz integral, feijão e brócolis", kcal: 480 },
  { t: "16:00", slot: "Lanche da tarde", name: "Iogurte com morango e aveia", kcal: 160 },
  { t: "19:30", slot: "Jantar", name: "Merluza assada com arroz e legumes", kcal: 398 },
];

const PIPELINE = [
  ["Perfil", "Objetivo, rotina, restrições, alergias e orçamento."],
  ["Sugestão", "A IA (ou o gerador determinístico) escolhe refeições compatíveis."],
  ["Cálculo", "Totais calculados pelo app com os dados da TACO, não pelo texto da IA."],
  ["Você decide", "Troque, ajuste porções, gere a lista de compras e registre no diário."],
];

export function SectionPlan() {
  return (
    <section id="plan" className="relative border-t border-line bg-graphite/40 py-24 md:py-36" aria-labelledby="plan-title">
      <div className="mx-auto grid max-w-[1440px] gap-14 px-5 md:px-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-28">
            <SectionIndex n="04" label="Nutrição inteligente" />
            <RevealTitle id="plan-title" className="mt-6 text-[clamp(3rem,7vw,7rem)]">
              Your plan.
              <br />
              Your routine.
            </RevealTitle>
            <p className="mt-8 max-w-[44ch] text-mute">
              Cardápios diários e semanais montados a partir do seu perfil, com substituições e porções ajustáveis. O
              planejado fica separado do que você realmente comeu.
            </p>
            <ol className="mt-10 space-y-0 border-l border-line">
              {PIPELINE.map(([t, s], i) => (
                <li key={t} className="relative pb-6 pl-6 last:pb-0">
                  <span className={`absolute -left-[5px] top-1.5 h-[9px] w-[9px] ${i === 2 ? "bg-volt" : "border border-line-strong bg-ink"}`} aria-hidden />
                  <div className="flex items-baseline gap-3">
                    <span className="num text-xs text-dim">0{i + 1}</span>
                    <span className="font-semibold">{t}</span>
                  </div>
                  <p className="mt-1 text-sm text-mute">{s}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <RevealGroup className="lg:col-span-6 lg:col-start-7">
          <div className="flex items-center justify-between">
            <span className="eyebrow">Exemplo · um dia do plano</span>
            <span className="chip">Receitas reais da biblioteca</span>
          </div>
          <ol className="mt-6">
            {DAY.map((m) => (
              <li data-reveal key={m.t} className="grid grid-cols-[4.5rem_1fr] gap-4 border-t border-line py-6 md:grid-cols-[6rem_1fr_auto]">
                <span className="display text-3xl text-mute md:text-4xl">{m.t}</span>
                <div>
                  <div className="eyebrow">{m.slot}</div>
                  <div className="mt-1 text-lg leading-snug">{m.name}</div>
                </div>
                <div className="col-start-2 md:col-start-auto md:text-right">
                  <span className="num text-2xl font-semibold">{m.kcal}</span>
                  <span className="ml-1 text-sm text-mute">kcal</span>
                </div>
              </li>
            ))}
            <li data-reveal className="flex items-center justify-between border-t border-line-strong py-5">
              <span className="eyebrow">Total planejado</span>
              <span className="num text-2xl font-semibold text-volt">
                {DAY.reduce((a, m) => a + m.kcal, 0).toLocaleString("pt-BR")} kcal
              </span>
            </li>
          </ol>
          <p className="text-xs text-dim">
            Valores por porção calculados a partir dos ingredientes (TACO). No app, as porções se ajustam à sua meta.
          </p>
        </RevealGroup>
      </div>
    </section>
  );
}
