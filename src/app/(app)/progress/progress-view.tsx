"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Flag, Plus, Trash2 } from "lucide-react";
import { addMilestone, deleteMilestone, deleteWeight, logMeasurements, logWeight } from "@/app/(app)/actions/tracking";
import { useToast } from "@/components/app/toast";
import { color } from "@/lib/design/tokens";
import { addDays, formatDateShort } from "@/lib/dates";
import { fmt1, fmtKg } from "@/lib/format";
import type { WeightGoal, WeightLog } from "@/lib/types";

type Range = "7" | "30" | "90" | "365" | "all" | "custom";
interface Meas { id: string; measured_on: string; waist_cm: number | null; hip_cm: number | null; chest_cm: number | null; arm_cm: number | null; thigh_cm: number | null }

export function ProgressView({ today, heightCm, weights, goals, measurements, milestones }: { today: string; heightCm: number | null; weights: WeightLog[]; goals: WeightGoal[]; measurements: Meas[]; milestones: { id: string; happened_on: string; title: string }[] }) {
  const [range, setRange] = useState<Range>("90");
  const [from, setFrom] = useState(addDays(today, -90));
  const [to, setTo] = useState(today);
  const [showTable, setShowTable] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  const active = goals.find((g) => g.status === "active") ?? null;
  const first = weights[0] ?? null;
  const latest = weights.at(-1) ?? null;

  const data = useMemo(() => {
    const f = range === "all" ? "0000-00-00" : range === "custom" ? from : addDays(today, -Number(range));
    const t = range === "custom" ? to : today;
    return weights.filter((w) => w.measured_on >= f && w.measured_on <= t).map((w) => ({ date: w.measured_on, kg: w.weight_kg }));
  }, [weights, range, from, to, today]);

  const change = data.length >= 2 ? data.at(-1)!.kg - data[0].kg : null;
  const toGoal = active && latest ? latest.weight_kg - Number(active.target_weight_kg) : null;
  const goalProgress = active && latest ? Math.max(0, Math.min(1, (Number(active.start_weight_kg) - latest.weight_kg) / (Number(active.start_weight_kg) - Number(active.target_weight_kg)))) : null;
  const yDomain = useMemo(() => {
    const vals = data.map((d) => d.kg).concat(active ? [Number(active.target_weight_kg)] : []);
    if (!vals.length) return [0, 1];
    return [Math.floor(Math.min(...vals) - 1), Math.ceil(Math.max(...vals) + 1)];
  }, [data, active]);

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-6 md:px-10 md:py-10">
      <p className="eyebrow">Evolução pessoal</p>
      <h1 className="display mt-2 text-[clamp(2.8rem,7.5vw,6.5rem)]">Progress <span className="text-volt">tracker</span></h1>

      <dl className="mt-8 grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4">
        {[
          ["Peso inicial", first ? fmtKg(first.weight_kg) : "-", first ? formatDateShort(first.measured_on) : "primeira pesagem"],
          ["Peso atual", latest ? fmtKg(latest.weight_kg) : "-", latest ? formatDateShort(latest.measured_on) : "sem registros"],
          ["Meta de peso", active ? fmtKg(Number(active.target_weight_kg)) : "-", active?.target_date ? `até ${formatDateShort(active.target_date)}` : active ? "sem prazo" : "defina no perfil"],
          ["Distância da meta", toGoal !== null ? `${fmt1(Math.abs(toGoal))} kg` : "-", goalProgress !== null ? `${Math.round(goalProgress * 100)}% do caminho` : "-"],
        ].map(([l, v, s]) => (
          <div key={l} className="bg-ink p-5">
            <dt className="eyebrow">{l}</dt>
            <dd className="num mt-2 text-3xl font-semibold">{v}</dd>
            <dd className="mt-1 text-xs text-dim">{s}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 grid gap-3 lg:grid-cols-12">
        <section className="panel p-5 md:p-7 lg:col-span-8" aria-labelledby="chart-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="chart-title" className="eyebrow">Peso (kg){change !== null && <span className="ml-3 normal-case tracking-normal text-mute">variação no período: <b className="num text-bone">{change > 0 ? "+" : ""}{fmt1(change)} kg</b></span>}</h2>
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Período">
              {([["7", "7D"], ["30", "30D"], ["90", "90D"], ["365", "1A"], ["all", "Tudo"], ["custom", "Período"]] as [Range, string][]).map(([k, l]) => (
                <button key={k} aria-pressed={range === k} onClick={() => setRange(k)} className={`h-8 px-2.5 text-xs uppercase tracking-wider ${range === k ? "bg-bone text-ink" : "text-mute hover:text-bone"}`}>{l}</button>
              ))}
            </div>
          </div>
          {range === "custom" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <input type="date" className="field num h-9 w-40 py-0" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="De" />
              <input type="date" className="field num h-9 w-40 py-0" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Até" />
            </div>
          )}
          <div className="mt-6 h-[320px]">
            {data.length === 0 ? (
              <div className="grid h-full place-items-center border border-dashed border-line text-center text-sm text-mute">
                <p>Nenhuma pesagem neste período.<br />Registre ao lado. O gráfico usa apenas seus registros.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke={color.line} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => formatDateShort(d)} stroke={color.dim} tick={{ fontSize: 11, fill: color.mute }} tickLine={false} axisLine={{ stroke: color.lineStrong }} minTickGap={24} />
                  <YAxis domain={yDomain as [number, number]} stroke={color.dim} tick={{ fontSize: 11, fill: color.mute }} tickLine={false} axisLine={false} width={48} />
                  {active && <ReferenceLine y={Number(active.target_weight_kg)} stroke={color.bone} strokeOpacity={0.5} strokeDasharray="4 6" label={{ value: "META", position: "insideTopRight", fill: color.mute, fontSize: 10 }} />}
                  <Tooltip
                    cursor={{ stroke: color.lineStrong }}
                    content={({ active: a, payload }) =>
                      a && payload?.length ? (
                        <div className="border border-line-strong bg-graphite-2 px-3 py-2 text-xs shadow-[var(--shadow-pop)]">
                          <div className="text-mute">{formatDateShort(String(payload[0].payload.date))}</div>
                          <div className="num mt-0.5 text-base font-semibold text-bone">{fmt1(Number(payload[0].value))} kg</div>
                        </div>
                      ) : null
                    }
                  />
                  <Line type="monotone" dataKey="kg" stroke={color.volt} strokeWidth={2} dot={{ r: 3, fill: color.ink, stroke: color.volt, strokeWidth: 1.5 }} activeDot={{ r: 6, fill: color.volt, stroke: color.ink, strokeWidth: 2 }} animationDuration={900} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-dim">Variações diárias de peso são normais (água, sal, horário). Observe a tendência.</p>
            <button className="text-xs uppercase tracking-wider text-mute hover:text-bone" onClick={() => setShowTable((s) => !s)} aria-expanded={showTable}>{showTable ? "Ocultar tabela" : "Ver tabela"}</button>
          </div>
          {showTable && (
            <table className="mt-3 w-full text-sm">
              <thead><tr className="text-left text-xs text-dim"><th className="py-2 font-normal">Data</th><th className="py-2 text-right font-normal">Peso</th><th className="py-2 text-right font-normal">IMC</th><th /></tr></thead>
              <tbody className="divide-y divide-line">
                {[...weights].reverse().map((w) => (
                  <tr key={w.id}>
                    <td className="py-2">{formatDateShort(w.measured_on)}{w.note ? <span className="ml-2 text-xs text-dim">{w.note}</span> : null}</td>
                    <td className="num py-2 text-right">{fmt1(w.weight_kg)} kg</td>
                    <td className="num py-2 text-right text-mute">{heightCm ? fmt1(w.weight_kg / (heightCm / 100) ** 2) : "-"}</td>
                    <td className="py-2 text-right">
                      <button className="btn btn-quiet h-7 w-7 p-0 hover:text-danger" aria-label={`Remover pesagem de ${formatDateShort(w.measured_on)}`} onClick={() => start(async () => { const r = await deleteWeight(w.id); if (r.ok) router.refresh(); else toast({ tone: "error", message: r.error }); })}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <div className="space-y-3 lg:col-span-4">
          <WeightForm today={today} pending={pending} onSave={(d, kg, note) => start(async () => { const r = await logWeight({ measured_on: d, weight_kg: kg, note }); if (!r.ok) return toast({ tone: "error", message: r.error }); toast({ tone: "success", message: "Pesagem registrada" }); router.refresh(); })} />
          <section className="panel p-5" aria-labelledby="goals-title">
            <h2 id="goals-title" className="eyebrow">Histórico de metas</h2>
            {goals.length ? (
              <ol className="mt-4 space-y-3">
                {goals.map((g) => (
                  <li key={g.id} className="grid grid-cols-[1fr_auto] gap-2 border-t border-line pt-3 text-sm">
                    <span>
                      <span className="num">{fmt1(Number(g.start_weight_kg))} → {fmt1(Number(g.target_weight_kg))} kg</span>
                      <span className="block text-xs text-dim">desde {formatDateShort(g.start_date)}{g.target_date ? ` · prazo ${formatDateShort(g.target_date)}` : ""}</span>
                    </span>
                    <span className={`chip ${g.status === "active" ? "chip-volt" : g.status === "achieved" ? "" : ""}`}>{g.status === "active" ? "Ativa" : g.status === "achieved" ? "Atingida" : "Arquivada"}</span>
                  </li>
                ))}
              </ol>
            ) : <p className="mt-3 text-sm text-mute">Defina uma meta de peso no perfil (opcional).</p>}
          </section>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-12">
        <MeasurementsPanel today={today} items={measurements} onSave={(m) => start(async () => { const r = await logMeasurements(m); if (!r.ok) return toast({ tone: "error", message: r.error }); toast({ tone: "success", message: "Medidas salvas" }); router.refresh(); })} />
        <section className="panel p-5 md:p-6 lg:col-span-5" aria-labelledby="ms-title">
          <h2 id="ms-title" className="eyebrow">Marcos pessoais</h2>
          <MilestoneForm today={today} onSave={(t, d) => start(async () => { const r = await addMilestone(t, d); if (!r.ok) return toast({ tone: "error", message: r.error }); router.refresh(); })} />
          <ol className="mt-4 space-y-0">
            {milestones.map((m) => (
              <li key={m.id} className="group grid grid-cols-[auto_1fr_auto] items-start gap-3 border-t border-line py-3">
                <Flag size={14} className="mt-0.5 text-volt" aria-hidden />
                <span><span className="block text-sm">{m.title}</span><span className="text-xs text-dim">{formatDateShort(m.happened_on)}</span></span>
                <button className="btn btn-quiet h-7 w-7 p-0 opacity-50 hover:text-danger group-hover:opacity-100" aria-label={`Remover marco ${m.title}`} onClick={() => start(async () => { await deleteMilestone(m.id); router.refresh(); })}><Trash2 size={13} /></button>
              </li>
            ))}
            {!milestones.length && <li className="pt-3 text-sm text-mute">Ex.: “Subi 3 lances de escada sem parar”, “Cozinhei a semana toda”.</li>}
          </ol>
        </section>
      </div>
    </div>
  );
}

function WeightForm({ today, onSave, pending }: { today: string; onSave: (d: string, kg: number, note: string | null) => void; pending: boolean }) {
  const [d, setD] = useState(today);
  const [kg, setKg] = useState("");
  const [note, setNote] = useState("");
  const v = Number(kg.replace(",", "."));
  return (
    <form className="panel p-5" onSubmit={(e) => { e.preventDefault(); if (v > 0) { onSave(d, v, note.trim() || null); setKg(""); setNote(""); } }}>
      <h2 className="eyebrow">Registrar pesagem</h2>
      <div className="mt-4 grid grid-cols-[1fr_9.5rem] gap-2">
        <div className="relative">
          <input className="field num pr-10 text-2xl" inputMode="decimal" placeholder="00,0" value={kg} onChange={(e) => setKg(e.target.value)} aria-label="Peso em kg" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-dim">kg</span>
        </div>
        <input type="date" className="field num" value={d} max={today} onChange={(e) => setD(e.target.value)} aria-label="Data da pesagem" />
      </div>
      <input className="field mt-2" placeholder="Nota (opcional), ex.: em jejum" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} aria-label="Nota" />
      <button className="btn btn-volt mt-3 w-full" disabled={!(v >= 25 && v <= 400) || pending}><Plus size={16} /> Salvar pesagem</button>
      <p className="mt-2 text-[11px] text-dim">Uma pesagem por dia; registrar de novo na mesma data substitui o valor.</p>
    </form>
  );
}

const MEAS: [keyof Omit<Meas, "id" | "measured_on">, string][] = [["waist_cm", "Cintura"], ["hip_cm", "Quadril"], ["chest_cm", "Peito"], ["arm_cm", "Braço"], ["thigh_cm", "Coxa"]];

function MeasurementsPanel({ today, items, onSave }: { today: string; items: Meas[]; onSave: (m: Omit<Meas, "id">) => void }) {
  const [d, setD] = useState(today);
  const [vals, setVals] = useState<Record<string, string>>({});
  return (
    <section className="panel p-5 md:p-6 lg:col-span-7" aria-labelledby="meas-title">
      <h2 id="meas-title" className="eyebrow">Medidas corporais · opcional</h2>
      <form className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" onSubmit={(e) => { e.preventDefault(); const n = (k: string) => (vals[k] ? Number(vals[k].replace(",", ".")) : null); onSave({ measured_on: d, waist_cm: n("waist_cm"), hip_cm: n("hip_cm"), chest_cm: n("chest_cm"), arm_cm: n("arm_cm"), thigh_cm: n("thigh_cm") }); setVals({}); }}>
        {MEAS.map(([k, l]) => (
          <label key={k} className="text-xs text-mute">{l} (cm)
            <input className="field num mt-1 h-10 py-0" inputMode="decimal" value={vals[k] ?? ""} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} />
          </label>
        ))}
        <label className="text-xs text-mute">Data
          <input type="date" className="field num mt-1 h-10 py-0" value={d} max={today} onChange={(e) => setD(e.target.value)} />
        </label>
        <button className="btn btn-ghost col-span-2 sm:col-span-3 lg:col-span-6" disabled={!Object.values(vals).some(Boolean)}>Salvar medidas</button>
      </form>
      {items.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead><tr className="text-left text-xs text-dim"><th className="py-2 font-normal">Data</th>{MEAS.map(([k, l]) => <th key={k} className="py-2 text-right font-normal">{l}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {items.map((m) => (
                <tr key={m.id}><td className="py-2">{formatDateShort(m.measured_on)}</td>{MEAS.map(([k]) => <td key={k} className="num py-2 text-right">{m[k] !== null ? fmt1(Number(m[k])) : <span className="text-dim">-</span>}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function MilestoneForm({ today, onSave }: { today: string; onSave: (t: string, d: string) => void }) {
  const [t, setT] = useState("");
  return (
    <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (t.trim()) { onSave(t.trim(), today); setT(""); } }}>
      <input className="field h-10" placeholder="Novo marco" value={t} onChange={(e) => setT(e.target.value)} maxLength={120} aria-label="Descrição do marco" />
      <button className="btn btn-ghost h-10" disabled={!t.trim()}>Adicionar</button>
    </form>
  );
}
