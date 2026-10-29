"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { Magnetic } from "@/components/ui/magnetic";
import { Molecule } from "./molecule";
import { FULL, getGsap } from "./gsap";

export function Hero() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const { gsap, SplitText } = getGsap();
    const mm = gsap.matchMedia();
    mm.add(FULL, () => {
      const title = el.querySelector("[data-hero-title]") as HTMLElement;
      const split = SplitText.create(title, { type: "lines,chars", mask: "lines" });
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.set(el.querySelectorAll(".hero-pre"), { autoAlpha: 1 })
        .from(el.querySelector("[data-hero-kicker]"), { autoAlpha: 0, x: -16, duration: 0.6 })
        .from(split.chars, { yPercent: 110, duration: 1.05, stagger: { each: 0.018, from: "start" } }, 0.05)
        .from(el.querySelectorAll("[data-hero-copy]"), { autoAlpha: 0, y: 18, duration: 0.8, stagger: 0.08 }, 0.55)
        .from(el.querySelectorAll("[data-hero-cta]"), { autoAlpha: 0, y: 14, duration: 0.7, stagger: 0.08 }, 0.7)
        .from(el.querySelectorAll("[data-hero-hud]"), { autoAlpha: 0, y: 24, duration: 0.9, stagger: 0.1 }, 0.8)
        .from(el.querySelector("[data-hero-scroll]"), { autoAlpha: 0, duration: 0.6 }, 1.1);

      // parallax discreto: o título sobe um pouco mais devagar que a página
      gsap.to(title, {
        yPercent: -12,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: true },
      });
      gsap.to(el.querySelector("[data-hero-art]"), {
        yPercent: 10,
        scale: 0.94,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: true },
      });
      return () => split.revert();
    });
    return () => mm.revert();
  }, []);

  return (
    <section ref={root} className="relative isolate flex min-h-[100svh] flex-col overflow-hidden" aria-labelledby="hero-title">
      {/* escultura */}
      <div
        data-hero-art
        className="absolute -right-[38%] top-[6%] -z-10 h-[40%] w-[110%] opacity-55 sm:opacity-100 sm:-right-[12%] sm:top-[6%] sm:h-[76%] sm:w-[76%] lg:-right-[9%] lg:w-[62%]"
      >
        <Molecule />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(80%_60%_at_70%_35%,transparent_0%,var(--color-ink)_78%)]" aria-hidden />

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-5 pb-10 pt-28 md:px-10 md:pt-32">
        <div data-hero-kicker className="hero-pre flex items-center gap-3 eyebrow">
          <span className="h-1.5 w-1.5 bg-volt animate-pulse-dot" aria-hidden />
          Plataforma de performance nutricional
        </div>

        <h1
          id="hero-title"
          data-hero-title
          className="hero-pre display mt-8 max-w-[14ch] text-[clamp(3.4rem,11.2vw,12rem)] [font-kerning:normal]"
        >
          Your body.
          <br />
          Your data.
          <br />
          Your <span className="text-volt">evolution.</span>
        </h1>

        <div className="mt-auto grid gap-10 pt-12 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-5">
            <p data-hero-copy className="hero-pre max-w-[34ch] text-xl leading-snug text-bone md:text-2xl">
              Sua alimentação sob controle. Seu progresso em movimento.
            </p>
            <p data-hero-copy className="hero-pre mt-3 max-w-[48ch] text-sm leading-relaxed text-mute">
              Registre o que você come com dados da tabela TACO, acompanhe calorias e macronutrientes em tempo real e
              evolua com metas calculadas, não chutadas.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <div data-hero-cta className="hero-pre">
                <Magnetic>
                  <Link href="/signup" className="btn btn-volt h-12 px-6">
                    Começar agora <ArrowUpRight size={16} aria-hidden />
                  </Link>
                </Magnetic>
              </div>
              <div data-hero-cta className="hero-pre">
                <a href="#consume" className="btn btn-ghost h-12 px-6">
                  Explorar a plataforma
                </a>
              </div>
            </div>
          </div>

          <HeroHud />
        </div>

        <a
          data-hero-scroll
          href="#consume"
          className="hero-pre mt-10 inline-flex w-fit items-center gap-3 eyebrow hover:text-bone"
          aria-label="Rolar para a próxima seção"
        >
          <span className="relative block h-9 w-px overflow-hidden bg-line-strong" aria-hidden>
            <span className="absolute inset-x-0 top-0 h-3 bg-volt motion-safe:animate-[scrollcue_1.8s_var(--ease-in-out-quart)_infinite]" />
          </span>
          Role <ArrowDown size={12} aria-hidden />
        </a>
      </div>
    </section>
  );
}

/** Painel de telemetria: explicitamente ilustrativo. */
function HeroHud() {
  const target = 2100;
  const consumed = 1480;
  const pctv = consumed / target;
  const C = 2 * Math.PI * 34;
  return (
    <div className="lg:col-span-5 lg:col-start-8">
      <div data-hero-hud className="hero-pre panel-quiet bg-ink/60 p-4 backdrop-blur-sm md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="eyebrow">Telemetria do dia</span>
          <span className="chip chip-amber">Ilustração · dados demonstrativos</span>
        </div>
        <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-5">
          <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden>
            <circle cx="44" cy="44" r="34" fill="none" stroke="var(--color-line-strong)" strokeWidth="4" />
            <circle
              cx="44" cy="44" r="34" fill="none" stroke="var(--color-volt)" strokeWidth="4"
              strokeDasharray={`${C * pctv} ${C}`} transform="rotate(-90 44 44)"
            />
            {Array.from({ length: 24 }).map((_, i) => (
              <line key={i} x1="44" y1="4" x2="44" y2={i % 6 === 0 ? 9 : 7} stroke="var(--color-dim)" strokeWidth="1" transform={`rotate(${i * 15} 44 44)`} />
            ))}
            <text x="44" y="49" textAnchor="middle" className="num" fill="var(--color-bone)" fontSize="15" fontWeight="600">
              70%
            </text>
          </svg>
          <dl className="grid grid-cols-3 gap-3">
            {[
              ["kcal", "1.480", "/ 2.100"],
              ["Prot.", "96 g", "/ 120 g"],
              ["Rest.", "620", "kcal"],
            ].map(([k, v, s]) => (
              <div key={k}>
                <dt className="eyebrow">{k}</dt>
                <dd className="num mt-1 text-lg font-semibold">{v}</dd>
                <dd className="num text-xs text-dim">{s}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <p data-hero-hud className="hero-pre mt-2 text-[11px] leading-relaxed text-dim">
        Valores ilustrativos. No app, cada número vem dos seus próprios registros.
      </p>
    </div>
  );
}
