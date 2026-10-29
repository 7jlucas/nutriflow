"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { setManualTarget } from "@/app/(app)/actions/profile";
import { useToast } from "@/components/app/toast";
import { formatDateShort } from "@/lib/dates";
import type { NutritionTarget } from "@/lib/types";

export function ManualTarget({ targets }: { targets: NutritionTarget[] }) {
  const current = targets[0];
  const [v, setV] = useState({ kcal: String(current?.kcal ?? ""), protein_g: String(current?.protein_g ?? ""), carbs_g: String(current?.carbs_g ?? ""), fat_g: String(current?.fat_g ?? "") });
  const [confirmLow, setConfirmLow] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const kcal = Number(v.kcal);
  const macroKcal = Number(v.protein_g) * 4 + Number(v.carbs_g) * 4 + Number(v.fat_g) * 9;
  const low = kcal > 0 && kcal < 1200;
  return (
    <section className="mt-16 grid gap-6 border-t border-line pt-8 lg:grid-cols-[16rem_1fr]" aria-labelledby="mt-title">
      <div>
        <span className="num text-xs text-dim">07</span>
        <h2 id="mt-title" className="display mt-1 text-3xl">Meta manual</h2>
        <p className="mt-1 text-sm text-mute">Para metas definidas com seu nutricionista.</p>
      </div>
      <div>
        <form
          className="grid grid-cols-2 gap-3 md:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (low && !confirmLow) return;
            start(async () => {
              const r = await setManualTarget({ kcal: Math.round(kcal), protein_g: Math.round(Number(v.protein_g)), carbs_g: Math.round(Number(v.carbs_g)), fat_g: Math.round(Number(v.fat_g)) });
              if (!r.ok) return toast({ tone: "error", message: r.error });
              toast({ tone: "success", message: "Meta manual salva a partir de hoje" });
              router.refresh();
            });
          }}
        >
          {([["kcal", "Calorias (kcal)"], ["protein_g", "Proteínas (g)"], ["carbs_g", "Carboidratos (g)"], ["fat_g", "Gorduras (g)"]] as const).map(([k, l]) => (
            <label key={k} className="text-xs text-mute">{l}
              <input className="field num mt-1" type="number" inputMode="numeric" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} required />
            </label>
          ))}
          <p className="col-span-2 text-xs text-dim md:col-span-4">Os macros somam <b className="num text-bone">{Math.round(macroKcal)}</b> kcal (4/4/9 kcal por grama).{Math.abs(macroKcal - kcal) > 50 && kcal > 0 ? <span className="text-amber"> Diferença de {Math.round(macroKcal - kcal)} kcal em relação à meta.</span> : null}</p>
          {low && (
            <label className="col-span-2 flex items-start gap-2 border border-amber/50 bg-amber-dim p-3 text-sm md:col-span-4">
              <input type="checkbox" checked={confirmLow} onChange={(e) => setConfirmLow(e.target.checked)} className="mt-1 accent-[var(--color-amber)]" />
              <span><AlertTriangle size={14} className="mr-1 inline text-amber" /> Metas abaixo de 1.200 kcal/dia só devem ser seguidas com acompanhamento profissional. Confirmo que esta meta foi definida por um profissional de saúde.</span>
            </label>
          )}
          <button className="btn btn-ghost col-span-2 md:col-span-4" disabled={pending || (low && !confirmLow) || !(kcal >= 800)}>Salvar meta manual</button>
        </form>
        {targets.length > 0 && (
          <div className="mt-8">
            <p className="eyebrow">Histórico de metas nutricionais</p>
            <table className="mt-2 w-full text-sm">
              <thead><tr className="text-left text-xs text-dim"><th className="py-1.5 font-normal">Desde</th><th className="py-1.5 font-normal">Origem</th><th className="py-1.5 text-right font-normal">kcal</th><th className="py-1.5 text-right font-normal">P/C/G (g)</th></tr></thead>
              <tbody className="divide-y divide-line">
                {targets.slice(0, 12).map((t) => (
                  <tr key={t.id}><td className="py-2">{formatDateShort(t.effective_from)}</td><td className="py-2 text-mute">{t.is_manual ? "Manual" : "Estimada (Mifflin-St Jeor)"}</td><td className="num py-2 text-right">{t.kcal}</td><td className="num py-2 text-right text-mute">{t.protein_g}/{t.carbs_g}/{t.fat_g}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
