"use client";
import { useEffect, useRef } from "react";
import { FULL, getGsap } from "./gsap";
import { RevealGroup, RevealTitle, SectionIndex } from "./reveal";

// Curva ILUSTRATIVA (não são dados de usuários). Explicitamente rotulada na UI.
const DEMO = [82.4, 82.1, 82.3, 81.8, 81.5, 81.6, 81.1, 80.9, 81.0, 80.5, 80.2, 80.4, 79.9, 79.7, 79.8, 79.4];

export function SectionEvolution() {
  const ref = useRef<HTMLDivElement>(null);
  const W = 1200, H = 360, P = 24;
  const min = 78.5, max = 83;
  const pts = DEMO.map((v, i) => [P + (i / (DEMO.length - 1)) * (W - P * 2), P + ((max - v) / (max - min)) * (H - P * 2)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${d} L${pts.at(-1)![0]},${H} L${pts[0][0]},${H} Z`;
  const goalY = P + ((max - 79) / (max - min)) * (H - P * 2);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { gsap } = getGsap();
    const mm = gsap.matchMedia();
    mm.add(FULL, () => {
      const path = el.querySelector<SVGPathElement>("[data-line]");
      if (!path) return;
      const len = path.getTotalLength();
      gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 70%", once: true } });
      tl.to(path, { strokeDashoffset: 0, duration: 2, ease: "power2.inOut" })
        .from(el.querySelector("[data-area]"), { opacity: 0, duration: 1 }, 0.6)
        .from(el.querySelectorAll("[data-dot]"), { scale: 0, transformOrigin: "center", stagger: 0.04, duration: 0.3 }, 0.4);
    });
    return () => mm.revert();
  }, []);

  return (
    <section id="evolution" className="relative overflow-hidden border-t border-line py-24 md:py-36" aria-labelledby="evolution-title">
      <div className="mx-auto max-w-[1440px] px-5 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <SectionIndex n="03" label="Evolução pessoal" />
            <RevealTitle id="evolution-title" className="mt-6 text-[clamp(3rem,8.5vw,9rem)]">
              Track your <span className="text-volt">evolution.</span>
            </RevealTitle>
          </div>
        </div>

        <div ref={ref} className="relative mt-12">
          <div className="absolute right-0 top-0 z-10 flex gap-2">
            <span className="chip chip-amber">Ilustração · dados demonstrativos</span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Gráfico ilustrativo de evolução de peso, com linha de meta. Não representa dados reais.">
            <defs>
              <linearGradient id="evo-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF2A3D" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#FF2A3D" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3, 4].map((i) => (
              <line key={i} x1={P} x2={W - P} y1={P + (i / 4) * (H - P * 2)} y2={P + (i / 4) * (H - P * 2)} stroke="rgba(244,241,241,0.07)" />
            ))}
            <line x1={P} x2={W - P} y1={goalY} y2={goalY} stroke="#F4F1F1" strokeOpacity="0.5" strokeDasharray="4 6" />
            <text x={W - P} y={goalY - 8} textAnchor="end" fill="#A8A2A2" fontSize="12" letterSpacing="1.5">META</text>
            <path data-area d={area} fill="url(#evo-area)" />
            <path data-line d={d} fill="none" stroke="#FF2A3D" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {pts.map(([x, y], i) => (
              <circle data-dot key={i} cx={x} cy={y} r={i === pts.length - 1 ? 6 : 3} fill={i === pts.length - 1 ? "#FF2A3D" : "#0A0A0A"} stroke="#FF2A3D" strokeWidth="1.5" />
            ))}
          </svg>
        </div>

        <RevealGroup className="mt-12 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Pesagens", "Registre quando quiser. O gráfico usa só o que você registrou."],
            ["Medidas", "Cintura, quadril, braço e mais, todas opcionais."],
            ["Metas", "Histórico de metas, com ritmo sugerido e sem extremos."],
            ["Marcos", "Momentos que importam para você, além da balança."],
          ].map(([t, s]) => (
            <div data-reveal key={t} className="bg-ink p-6">
              <div className="display text-3xl">{t}</div>
              <p className="mt-3 text-sm leading-relaxed text-mute">{s}</p>
            </div>
          ))}
        </RevealGroup>
        <p className="mt-4 text-xs text-dim">
          Peso é um dado entre vários. O NUTRI//FLOW não promete resultados e não incentiva perda acelerada.
        </p>
      </div>
    </section>
  );
}
