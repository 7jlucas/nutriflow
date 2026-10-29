"use client";
import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

const fmt = (n: number, decimals: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/**
 * Contador animado: anima apenas a transição entre valores reais
 * (feedback de mudança de estado), nunca inventa números intermediários persistentes.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  duration = 0.6,
  className,
  startOnView = false,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
  startOnView?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef<number | null>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (startOnView && !inView) return;
    const from = prev.current ?? (startOnView ? 0 : value);
    prev.current = value;
    if (reduce || from === value) {
      el.textContent = fmt(value, decimals);
      return;
    }
    const controls = animate(from, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = fmt(v, decimals);
      },
    });
    return () => controls.stop();
  }, [value, decimals, duration, reduce, inView, startOnView]);

  return (
    <span ref={ref} className={`num ${className ?? ""}`}>
      {fmt(startOnView ? 0 : value, decimals)}
    </span>
  );
}
