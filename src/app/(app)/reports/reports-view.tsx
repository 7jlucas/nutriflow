"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { Download, FileText } from "lucide-react";
import { color } from "@/lib/design/tokens";
import { rangeDays, formatDateShort, formatDateLong } from "@/lib/dates";
import { fmt0, fmt1 } from "@/lib/format";
import { diaryCsv, targetOn } from "@/lib/report";
import { mealLabel } from "@/lib/nutrition/meals";
import { useToast } from "@/components/app/toast";
import type { DiaryEntry, NutritionTarget } from "@/lib/types";

interface DayTotal { entry_date: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number; items: number; incomplete: number }

export function ReportsView({ period, from, to, name, totals, targets, entries, top, weights }: { period: string; from: string; to: string; name: string; totals: DayTotal[]; targets: NutritionTarget[]; entries: DiaryEntry[]; top: { food_id: string; name: string; times: number; kcal: number }[]; weights: { date: string; kg: number }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [cFrom, setCFrom] = useState(from);
  const [cTo, setCTo] = useState(to);
  const [openDay, setOpenDay] = useState<string | null>(null);

  const days = useMemo(() => rangeDays(from, to), [from, to]);
  const byDate = useMemo(() => new Map(totals.map((t) => [t.entry_date, t])), [totals]);
  const chart = days.map((d) => {
    const t = byDate.get(d);
    const tg = targetOn(targets, d);
    return { date: d, kcal: t ? Math.round(t.kcal) : null, target: tg?.kcal ?? null };
  });
  const logged = totals.length;
  const avg = (k: keyof Omit<DayTotal, "entry_date">) => (logged ? totals.reduce((a, t) => a + Number(t[k]), 0) / logged : null);
  const withTarget = chart.filter((c) => c.kcal !== null && c.target);
  const within = withTarget.filter((c) => Math.abs(c.kcal! - c.target!) <= c.target! * 0.1).length;
  const avgDiff = withTarget.length ? withTarget.reduce((a, c) => a + (c.kcal! - c.target!), 0) / withTarget.length : null;
  const avgTarget = withTarget.length ? withTarget.reduce((a, c) => a + c.target!, 0) / withTarget.length : null;
  const incomplete = totals.reduce((a, t) => a + Number(t.incomplete), 0);

  function exportCsv() {
    const blob = new Blob([diaryCsv(entries)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nutriflow-diario-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function exportPdf() {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      let y = 56;
      const line = (txt: string, size = 10, bold = false, gap = 16) => {
        if (y > 790) { doc.addPage(); y = 56; }
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(size);
        doc.text(txt, 48, y);
        y += gap;
      };
      doc.setFillColor(8, 9, 8);
      doc.rect(0, 0, W, 36, "F");
      doc.setTextColor(255, 42, 61);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("NUTRI//FLOW", 48, 23);
      doc.setTextColor(20, 20, 20);
      line(`Relatório nutricional: ${name}`, 16, true, 22);
      line(`Período: ${formatDateShort(from)} a ${formatDateShort(to)} · ${days.length} dia(s) · ${logged} com registros`, 10, false, 24);
      line("Médias por dia com registro (consumo registrado)", 11, true);
      line(`Energia: ${avg("kcal") !== null ? fmt0(avg("kcal")) : "-"} kcal   Proteínas: ${fmt1(avg("protein_g"))} g   Carboidratos: ${fmt1(avg("carbs_g"))} g   Gorduras: ${fmt1(avg("fat_g"))} g   Fibras: ${fmt1(avg("fiber_g"))} g`);
      if (avgTarget) line(`Meta média estimada: ${fmt0(avgTarget)} kcal · diferença média: ${avgDiff! > 0 ? "+" : ""}${fmt0(avgDiff)} kcal · dias dentro de ±10%: ${within}/${withTarget.length}`);
      y += 8;
      line("Consumo diário", 11, true);
      for (const c of chart) line(`${formatDateShort(c.date)}   ${c.kcal === null ? "sem registros" : `${fmt0(c.kcal)} kcal`}${c.target ? `   (meta ${fmt0(c.target)})` : ""}`, 9, false, 13);
      y += 8;
      if (top.length) {
        line("Alimentos mais consumidos", 11, true);
        top.forEach((t, i) => line(`${i + 1}. ${t.name}: ${t.times}x · ${fmt0(t.kcal)} kcal no período`, 9, false, 13));
        y += 8;
      }
      if (weights.length) {
        line("Pesagens", 11, true);
        weights.forEach((w) => line(`${formatDateShort(w.date)}   ${fmt1(w.kg)} kg`, 9, false, 13));
        y += 8;
      }
      doc.setTextColor(110, 110, 110);
      line("Valores calculados a partir dos registros do usuário e da TACO 4ª ed. (NEPA/UNICAMP, 2011).", 8, false, 11);
      line("Metas são estimativas (Mifflin-St Jeor) e não substituem orientação profissional.", 8, false, 11);
      if (incomplete) line(`${incomplete} item(ns) com nutrientes ausentes na fonte: totais de macros podem estar subestimados.`, 8, false, 11);
      doc.save(`nutriflow-relatorio-${from}_${to}.pdf`);
    } catch {
      toast({ tone: "error", message: "Não foi possível gerar o PDF." });
    }
  }

  const grouped = useMemo(() => {
    const m = new Map<string, DiaryEntry[]>();
    for (const e of entries) m.set(e.entry_date, [...(m.get(e.entry_date) ?? []), e]);
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-6 md:px-10 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Relatórios e estatísticas</p>
          <h1 className="display mt-2 text-[clamp(2.8rem,7vw,5rem)]">Relatórios</h1>
          <p className="mt-1 text-sm text-mute">{formatDateShort(from)} a {formatDateShort(to)} · {days.length} {days.length === 1 ? "dia" : "dias"}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={exportCsv} disabled={!entries.length}><Download size={14} /> CSV</button>
          <button className="btn btn-ghost" onClick={exportPdf} disabled={!entries.length && !weights.length}><FileText size={14} /> PDF</button>
        </div>
      </div>

      {/* filtros: uma linha acima dos gráficos */}
      <div className="mt-6 flex flex-wrap items-center gap-2 border-y border-line py-3">
        {[["day", "Dia"], ["week", "Semana"], ["month", "Mês"], ["custom", "Período"]].map(([k, l]) => (
          <Link key={k} href={k === "custom" ? `/reports?p=custom&from=${cFrom}&to=${cTo}` : `/reports?p=${k}`} aria-current={period === k ? "page" : undefined} className={`h-8 px-3 text-xs uppercase leading-8 tracking-wider ${period === k ? "bg-bone text-ink" : "text-mute hover:text-bone"}`}>{l}</Link>
        ))}
        {period === "custom" && (
          <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); router.push(`/reports?p=custom&from=${cFrom}&to=${cTo}`); }}>
            <input type="date" className="field num h-8 w-40 py-0 text-sm" value={cFrom} onChange={(e) => setCFrom(e.target.value)} aria-label="De" />
            <input type="date" className="field num h-8 w-40 py-0 text-sm" value={cTo} onChange={(e) => setCTo(e.target.value)} aria-label="Até" />
            <button className="btn btn-ghost btn-sm">Aplicar</button>
          </form>
        )}
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-3 lg:grid-cols-6">
        {[
          ["Média calórica", avg("kcal"), "kcal/dia registrado"],
          ["Proteínas", avg("protein_g"), "g/dia (média)"],
          ["Carboidratos", avg("carbs_g"), "g/dia (média)"],
          ["Gorduras", avg("fat_g"), "g/dia (média)"],
          ["Frequência", logged, `de ${days.length} dias com registro`],
          ["Dentro da meta ±10%", withTarget.length ? within : null, withTarget.length ? `de ${withTarget.length} dias com meta` : "sem meta no período"],
        ].map(([l, v, s]) => (
          <div key={l as string} className="bg-ink p-4">
            <dt className="eyebrow">{l}</dt>
            <dd className="num mt-2 text-3xl font-semibold">{v === null ? "-" : fmt0(v as number)}</dd>
            <dd className="text-[11px] text-dim">{s}</dd>
          </div>
        ))}
      </dl>

      <section className="panel mt-3 p-5 md:p-7" aria-labelledby="daily-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="daily-title" className="eyebrow">Consumo calórico diário · registrado vs. meta estimada</h2>
          <div className="flex items-center gap-4 text-xs text-mute">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-volt" aria-hidden /> Consumo registrado</span>
            <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t border-dashed border-bone" aria-hidden /> Meta estimada</span>
          </div>
        </div>
        <div className="mt-6 h-[280px]">
          {logged === 0 ? (
            <div className="grid h-full place-items-center border border-dashed border-line text-sm text-mute">Sem registros no período.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barCategoryGap={days.length > 14 ? 2 : 8}>
                <CartesianGrid stroke={color.line} vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d: string) => formatDateShort(d)} tick={{ fontSize: 11, fill: color.mute }} tickLine={false} axisLine={{ stroke: color.lineStrong }} minTickGap={16} />
                <YAxis tick={{ fontSize: 11, fill: color.mute }} tickLine={false} axisLine={false} width={48} />
                <Tooltip
                  cursor={{ fill: "rgba(244,241,241,0.04)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as { date: string; kcal: number | null; target: number | null };
                    return (
                      <div className="border border-line-strong bg-graphite-2 px-3 py-2 text-xs shadow-[var(--shadow-pop)]">
                        <div className="text-mute">{formatDateLong(p.date)}</div>
                        <div className="num mt-1 text-sm text-bone">{p.kcal === null ? "Sem registros" : `${fmt0(p.kcal)} kcal registradas`}</div>
                        {p.target && <div className="num text-mute">Meta: {fmt0(p.target)} kcal</div>}
                      </div>
                    );
                  }}
                />
                <Bar dataKey="kcal" radius={[3, 3, 0, 0]} isAnimationActive>
                  {chart.map((c) => <Cell key={c.date} fill={c.target && c.kcal && c.kcal > c.target * 1.1 ? color.amber : color.volt} />)}
                </Bar>
                <Bar dataKey="target" fill="transparent" stroke={color.bone} strokeDasharray="3 3" strokeOpacity={0.55} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <p className="mt-3 text-xs text-dim">
          Âmbar: dia acima de 110% da meta. {avgDiff !== null && <>Diferença média em relação à meta: <b className="num text-bone">{avgDiff > 0 ? "+" : ""}{fmt0(avgDiff)} kcal</b>. </>}
          Metas são estimativas; consumo registrado depende do que foi anotado.
          {incomplete > 0 && <span className="text-amber"> {incomplete} item(ns) com nutrientes ausentes na fonte.</span>}
        </p>
      </section>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <section className="panel p-5 md:p-6" aria-labelledby="top-title">
          <h2 id="top-title" className="eyebrow">Alimentos mais consumidos</h2>
          {top.length ? (
            <table className="mt-4 w-full text-sm">
              <thead><tr className="text-left text-xs text-dim"><th className="py-1.5 font-normal">Alimento</th><th className="py-1.5 text-right font-normal">Vezes</th><th className="py-1.5 text-right font-normal">kcal no período</th></tr></thead>
              <tbody className="divide-y divide-line">{top.map((t) => <tr key={t.food_id}><td className="py-2">{t.name}</td><td className="num py-2 text-right">{t.times}</td><td className="num py-2 text-right text-mute">{fmt0(t.kcal)}</td></tr>)}</tbody>
            </table>
          ) : <p className="mt-4 text-sm text-mute">Sem dados no período.</p>}
        </section>
        <section className="panel p-5 md:p-6" aria-labelledby="w-title">
          <h2 id="w-title" className="eyebrow">Evolução do peso no período</h2>
          {weights.length ? (
            <table className="mt-4 w-full text-sm">
              <tbody className="divide-y divide-line">
                {weights.map((w, i) => (
                  <tr key={w.date}><td className="py-2">{formatDateShort(w.date)}</td><td className="num py-2 text-right">{fmt1(w.kg)} kg</td><td className="num py-2 text-right text-xs text-dim">{i ? `${w.kg - weights[i - 1].kg > 0 ? "+" : ""}${fmt1(w.kg - weights[i - 1].kg)}` : ""}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <p className="mt-4 text-sm text-mute">Nenhuma pesagem no período.</p>}
        </section>
      </div>

      <section className="panel mt-3 p-5 md:p-6" aria-labelledby="hist-title">
        <h2 id="hist-title" className="eyebrow">Histórico de refeições</h2>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {grouped.map(([d, list]) => {
            const t = byDate.get(d);
            const open = openDay === d;
            return (
              <li key={d}>
                <button onClick={() => setOpenDay(open ? null : d)} aria-expanded={open} className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-4 py-3 text-left hover:bg-graphite">
                  <span className="text-sm first-letter:uppercase">{formatDateLong(d)}</span>
                  <span className="num text-xs text-dim">{list.length} itens</span>
                  <span className="num w-24 text-right text-sm">{t ? fmt0(t.kcal) : "-"} kcal</span>
                </button>
                {open && (
                  <table className="mb-3 w-full text-xs">
                    <tbody>
                      {list.map((e) => (
                        <tr key={e.id} className="border-t border-line/60">
                          <td className="py-1.5 pr-2 text-dim">{mealLabel(e.meal_slot)}</td>
                          <td className="py-1.5">{e.name}</td>
                          <td className="num py-1.5 text-right text-mute">{fmt1(Number(e.quantity))} {e.unit_label ?? e.unit}</td>
                          <td className="num py-1.5 text-right">{fmt0(Number(e.kcal))} kcal</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </li>
            );
          })}
          {!grouped.length && <li className="py-6 text-center text-sm text-mute">Sem refeições registradas no período.</li>}
        </ul>
      </section>
    </div>
  );
}
