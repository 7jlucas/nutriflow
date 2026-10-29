"use client";
import { animate, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { AnimatedNumber } from "@/components/ui/animated-number";

const START = 135; // graus (sentido horário, 0 = 3h)
const SWEEP = 270;

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
}
function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

/**
 * Instrumento de precisão: mostrador de 270° com escala graduada.
 * Volt = consumido até a meta; âmbar = acima da meta. Centro = calorias restantes.
 */
export function CalorieInstrument({ consumed, target, size = 340 }: { consumed: number; target: number | null; size?: number }) {
  const reduce = useReducedMotion();
  const cx = 170, cy = 170, R = 124;
  const hasTarget = !!target && target > 0;
  const ratio = hasTarget ? consumed / target! : 0;
  const within = Math.min(1, ratio);
  const over = hasTarget ? Math.min(0.25, Math.max(0, ratio - 1)) : 0; // excedente mostrado até +25%
  const remaining = hasTarget ? Math.round(target! - consumed) : null;
  const pctLabel = hasTarget ? Math.round(ratio * 100) : null;
  const needle = useAnimatedValue(ratio, reduce ? 0 : 1.1);

  const ticks = Array.from({ length: 41 }, (_, i) => i); // a cada 2,5%
  const fullArc = arc(cx, cy, R, START, START + SWEEP);
  const overArc = arc(cx, cy, R, START + SWEEP, START + SWEEP + SWEEP * over); // zona além da meta

  return (
    <figure className="relative mx-auto aspect-square w-full" style={{ maxWidth: size }} aria-label={hasTarget ? `Consumido ${Math.round(consumed)} de ${target} kcal, ${pctLabel}% da meta` : `Consumido ${Math.round(consumed)} kcal; sem meta definida`}>
      <svg viewBox="0 0 340 340" className="h-full w-full" aria-hidden>
        {/* escala graduada */}
        {ticks.map((i) => {
          const deg = START + (SWEEP * i) / 40;
          const major = i % 10 === 0;
          const mid = i % 5 === 0;
          const [x1, y1] = polar(cx, cy, R + 14, deg);
          const [x2, y2] = polar(cx, cy, R + (major ? 26 : mid ? 21 : 18), deg);
          const lit = hasTarget && i / 40 <= within;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={lit ? "var(--color-volt)" : "var(--color-dim)"} strokeOpacity={lit ? 0.9 : major ? 0.8 : 0.4} strokeWidth={major ? 1.6 : 1} />;
        })}
        {[0, 25, 50, 75, 100].map((p) => {
          const [x, y] = polar(cx, cy, R + 38, START + (SWEEP * p) / 100);
          return (
            <text key={p} x={x} y={y + 4} textAnchor="middle" fontSize="10" fill="var(--color-mute)" className="num" letterSpacing="1">
              {p}
            </text>
          );
        })}
        {/* trilho */}
        <path d={fullArc} fill="none" stroke="var(--color-graphite-3)" strokeWidth="10" strokeLinecap="butt" />
        {/* consumido até a meta */}
        {hasTarget && (
          <motion.path
            d={fullArc}
            fill="none"
            stroke="var(--color-volt)"
            strokeWidth="10"
            strokeLinecap="butt"
            initial={{ pathLength: reduce ? within : 0 }}
            animate={{ pathLength: within }}
            transition={{ duration: reduce ? 0 : 1.1, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
        {/* excedente */}
        {over > 0 && <path d={overArc} fill="none" stroke="var(--color-amber)" strokeWidth="10" strokeDasharray="3 3" />}
        {/* ponteiro */}
        {hasTarget && (() => {
          const deg = START + SWEEP * Math.min(1.25, needle);
          const [x1, y1] = polar(cx, cy, R - 18, deg);
          const [x2, y2] = polar(cx, cy, R + 8, deg);
          return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-bone)" strokeWidth="2" />;
        })()}
      </svg>
      <figcaption className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="eyebrow">{hasTarget ? (remaining! >= 0 ? "Restantes" : "Acima da meta") : "Consumidas"}</span>
        <span className={`display mt-1 text-[clamp(3.5rem,9vw,5.5rem)] ${hasTarget && remaining! < 0 ? "text-amber" : "text-bone"}`}>
          <AnimatedNumber value={hasTarget ? Math.abs(remaining!) : Math.round(consumed)} />
        </span>
        <span className="text-xs text-mute">kcal</span>
        {hasTarget && (
          <span className="mt-3 num text-sm text-mute">
            <span className="text-bone"><AnimatedNumber value={Math.round(consumed)} /></span> / {target!.toLocaleString("pt-BR")} · <span className="text-volt">{pctLabel}%</span>
          </span>
        )}
      </figcaption>
    </figure>
  );
}

/** Interpola um número até o alvo (usado pelo ponteiro, que gira em torno do centro). */
function useAnimatedValue(target: number, duration: number) {
  const [v, setV] = useState(duration ? 0 : target);
  const cur = useRef(v);
  useEffect(() => {
    if (!duration) {
      cur.current = target;
      setV(target);
      return;
    }
    const c = animate(cur.current, target, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: (x) => { cur.current = x; setV(x); } });
    return () => c.stop();
  }, [target, duration]);
  return v;
}

export function MacroBars({ consumed, target }: { consumed: { protein_g: number; carbs_g: number; fat_g: number }; target: { protein_g: number; carbs_g: number; fat_g: number } | null }) {
  const rows = [
    { k: "protein_g", label: "Proteínas", color: "var(--color-protein)" },
    { k: "carbs_g", label: "Carboidratos", color: "var(--color-carbs)" },
    { k: "fat_g", label: "Gorduras", color: "var(--color-fat)" },
  ] as const;
  return (
    <ul className="space-y-5">
      {rows.map((r) => {
        const c = consumed[r.k];
        const t = target?.[r.k] ?? null;
        const p = t ? (c / t) * 100 : 0;
        return (
          <li key={r.k}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2" style={{ background: r.color }} aria-hidden />
                {r.label}
              </span>
              <span className="num text-sm">
                <span className="text-lg font-semibold"><AnimatedNumber value={c} decimals={0} /></span>
                <span className="text-mute"> / {t ?? "-"} g</span>
                {t ? <span className={`ml-2 text-xs ${p > 110 ? "text-amber" : "text-dim"}`}>{Math.round(p)}%</span> : null}
              </span>
            </div>
            <div className="relative mt-2 h-1.5 bg-graphite-3" role="progressbar" aria-label={r.label} aria-valuemin={0} aria-valuemax={t ?? 0} aria-valuenow={Math.round(c)}>
              <motion.div className="absolute inset-y-0 left-0" style={{ background: r.color }} initial={false} animate={{ width: `${Math.min(100, p)}%` }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} />
              {/* marcadores de 25% */}
              {[25, 50, 75].map((m) => <span key={m} className="absolute inset-y-0 w-px bg-ink" style={{ left: `${m}%` }} aria-hidden />)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
