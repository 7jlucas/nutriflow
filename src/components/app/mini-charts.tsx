"use client";
import { motion } from "motion/react";
import { formatDateShort } from "@/lib/dates";

/** Sparkline de dados reais. Com menos de 2 pontos, mostra estado vazio honesto. */
export function Sparkline({ points, height = 56, label }: { points: { x: string; y: number }[]; height?: number; label: string }) {
  if (points.length < 2) return <p className="text-xs text-dim">Registre ao menos duas pesagens para ver a tendência.</p>;
  const W = 240, H = height, P = 4;
  const ys = points.map((p) => p.y);
  const min = Math.min(...ys), max = Math.max(...ys);
  const span = max - min || 1;
  const xy = points.map((p, i) => [P + (i / (points.length - 1)) * (W - P * 2), P + ((max - p.y) / span) * (H - P * 2)] as const);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = xy.at(-1)!;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      <motion.path d={d} fill="none" stroke="var(--color-volt)" strokeWidth="1.75" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
      <circle cx={last[0]} cy={last[1]} r="3" fill="var(--color-volt)" />
    </svg>
  );
}

/** Barras dos últimos dias vs. meta (linha tracejada). Dias sem registro aparecem vazios, não como zero consumido. */
export function WeekBars({ days, target }: { days: { date: string; kcal: number | null }[]; target: number | null }) {
  const max = Math.max(target ?? 0, ...days.map((d) => d.kcal ?? 0), 1) * 1.1;
  return (
    <div>
      <div className="relative flex h-28 items-end gap-1.5">
        {target && <span className="absolute inset-x-0 border-t border-dashed border-bone/40" style={{ bottom: `${(target / max) * 100}%` }} aria-hidden />}
        {days.map((d, i) => (
          <div key={d.date} className="flex h-full flex-1 flex-col justify-end">
            {d.kcal === null ? (
              <span className="h-1 bg-line" title={`${formatDateShort(d.date)}: sem registros`} />
            ) : (
              <motion.span
                className={`block ${target && d.kcal > target * 1.1 ? "bg-amber" : "bg-volt"}`}
                initial={{ height: 0 }}
                animate={{ height: `${(d.kcal / max) * 100}%` }}
                transition={{ delay: i * 0.04, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                title={`${formatDateShort(d.date)}: ${Math.round(d.kcal)} kcal`}
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {days.map((d) => (
          <span key={d.date} className="num flex-1 text-center text-[10px] text-dim">{formatDateShort(d.date).split(" ")[0]}</span>
        ))}
      </div>
    </div>
  );
}

export function FrequencyStrip({ days }: { days: { date: string; logged: boolean }[] }) {
  return (
    <div className="flex gap-1" role="img" aria-label={`${days.filter((d) => d.logged).length} de ${days.length} dias com registros`}>
      {days.map((d) => (
        <span key={d.date} className={`h-6 flex-1 ${d.logged ? "bg-volt" : "bg-graphite-3"}`} title={`${formatDateShort(d.date)}${d.logged ? " · registrado" : " · sem registro"}`} />
      ))}
    </div>
  );
}
