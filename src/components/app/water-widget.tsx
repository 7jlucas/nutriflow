"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { motion } from "motion/react";
import { Droplet, Undo2 } from "lucide-react";
import { addWater, deleteWater } from "@/app/(app)/actions/tracking";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { useToast } from "./toast";

export function WaterWidget({ date, initial, goal }: { date: string; initial: { id: string; ml: number }[]; goal: number }) {
  const [list, setList] = useState(initial);
  const [, start] = useTransition();
  const seq = useRef(0);
  const toast = useToast();
  useEffect(() => {
    setList(initial);
  }, [initial]);
  const total = list.reduce((a, w) => a + w.ml, 0);
  const pct = Math.min(1, total / goal);

  function add(ml: number) {
    const temp = { id: `temp-${++seq.current}`, ml };
    setList((l) => [...l, temp]);
    start(async () => {
      const r = await addWater(date, ml);
      if (!r.ok) {
        setList((l) => l.filter((w) => w.id !== temp.id));
        toast({ tone: "error", message: r.error });
      } else setList((l) => l.map((w) => (w.id === temp.id ? r.data : w)));
    });
  }
  function undo() {
    const last = list.at(-1);
    if (!last || last.id.startsWith("temp-")) return;
    setList((l) => l.slice(0, -1));
    start(async () => {
      const r = await deleteWater(last.id);
      if (!r.ok) {
        setList((l) => [...l, last]);
        toast({ tone: "error", message: r.error });
      }
    });
  }

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <span className="display text-5xl"><AnimatedNumber value={total} /></span>
          <span className="ml-1 text-sm text-mute">/ {goal.toLocaleString("pt-BR")} ml</span>
        </div>
        <Droplet size={20} className="mb-2 text-bone" aria-hidden />
      </div>
      <div className="mt-3 h-1.5 bg-graphite-3" role="progressbar" aria-label="Água do dia" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={total}>
        <motion.div className="h-full bg-bone/70" initial={false} animate={{ width: `${pct * 100}%` }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
      </div>
      <div className="mt-4 flex gap-1.5">
        {[200, 300, 500].map((ml) => (
          <button key={ml} onClick={() => add(ml)} className="btn btn-ghost btn-sm min-w-0 flex-1 px-1" aria-label={`Adicionar ${ml} ml`}>
            +{ml}
          </button>
        ))}
        <button onClick={undo} disabled={!list.length} className="btn btn-quiet btn-sm" aria-label="Desfazer último registro de água">
          <Undo2 size={14} />
        </button>
      </div>
      <p className="mt-3 text-[11px] text-dim">Meta configurável no perfil. Não é uma prescrição clínica.</p>
    </div>
  );
}
