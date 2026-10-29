"use client";
import { useEffect, useRef } from "react";
import { FULL, getGsap } from "./gsap";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";

// Estrutura (anel molecular hexagonal) → forma orgânica (alimento). Narrativa do produto:
// dados precisos sobre o que você come. Animado pelo scroll, estático com movimento reduzido.
const HEX = "M200,60 L321,130 L321,270 L200,340 L79,270 L79,130 Z";
const ORGANIC = "M200,58 C282,52 344,118 336,196 C330,262 286,334 206,342 C126,350 70,292 64,214 C58,132 118,64 200,58 Z";

export function MorphMark() {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { gsap } = getGsap();
    gsap.registerPlugin(MorphSVGPlugin);
    const mm = gsap.matchMedia();
    mm.add(FULL, () => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 85%", end: "bottom 35%", scrub: 0.8 } });
      tl.to(el.querySelector("[data-shape]"), { morphSVG: ORGANIC, ease: "none" }, 0)
        .to(el.querySelector("[data-inner]"), { morphSVG: ORGANIC, scale: 0.62, transformOrigin: "50% 50%", ease: "none" }, 0)
        .to(el.querySelectorAll("[data-node]"), { scale: 0, transformOrigin: "50% 50%", stagger: 0.03, ease: "none" }, 0)
        .to(el.querySelector("[data-core]"), { scale: 1.6, transformOrigin: "50% 50%", ease: "none" }, 0);
    });
    return () => mm.revert();
  }, []);
  const nodes = [[200, 60], [321, 130], [321, 270], [200, 340], [79, 270], [79, 130]];
  return (
    <svg ref={ref} viewBox="0 0 400 400" className="h-full w-full" aria-hidden>
      <path data-shape d={HEX} fill="none" stroke="#FF2A3D" strokeWidth="1.5" />
      <path data-inner d={HEX} fill="none" stroke="#F4F1F1" strokeOpacity="0.25" strokeWidth="1" />
      {nodes.map(([x, y], i) => (
        <circle data-node key={i} cx={x} cy={y} r="9" fill={i === 1 ? "#FF2A3D" : "#171515"} stroke="#3E3838" />
      ))}
      <circle data-core cx="200" cy="200" r="22" fill="#FF2A3D" />
    </svg>
  );
}
