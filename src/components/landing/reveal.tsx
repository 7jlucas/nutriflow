"use client";
import { useEffect, useRef } from "react";
import { FULL, getGsap } from "./gsap";

/**
 * Título de seção com revelação por linhas (SplitText + ScrollTrigger).
 * Orienta a atenção para a mudança de capítulo; sem movimento reduzido, aparece estático.
 */
export function RevealTitle({
  children,
  className = "",
  as: Tag = "h2",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
  id?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { gsap, SplitText } = getGsap();
    const mm = gsap.matchMedia();
    mm.add(FULL, () => {
      const split = SplitText.create(el, {
        type: "lines,words",
        mask: "lines",
        autoSplit: true,
        onSplit(self) {
          return gsap.from(self.lines, {
            yPercent: 105,
            duration: 1,
            ease: "expo.out",
            stagger: 0.08,
            scrollTrigger: { trigger: el, start: "top 85%", once: true },
          });
        },
      });
      return () => split.revert();
    });
    return () => mm.revert();
  }, []);
  return (
    <Tag ref={ref} id={id} className={`display ${className}`}>
      {children}
    </Tag>
  );
}

/** Entrada escalonada de filhos marcados com [data-reveal]. */
export function RevealGroup({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { gsap } = getGsap();
    const mm = gsap.matchMedia();
    mm.add(FULL, () => {
      const items = el.querySelectorAll("[data-reveal]");
      gsap.from(items, {
        y: 28,
        autoAlpha: 0,
        duration: 0.9,
        ease: "expo.out",
        stagger: 0.07,
        scrollTrigger: { trigger: el, start: "top 80%", once: true },
      });
    });
    return () => mm.revert();
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export function SectionIndex({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-center gap-3 eyebrow">
      <span className="num text-volt">{n}</span>
      <span className="h-px w-10 bg-line-strong" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
