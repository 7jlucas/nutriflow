"use client";
import { useId, useMemo, useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { nutrientsFor } from "@/lib/nutrition/calc";
import { availableUnits, toBaseAmount, UNIT_LABEL } from "@/lib/nutrition/units";
import { SOURCE_LABEL, fmt1 } from "@/lib/format";
import type { EntryUnit, Food, FoodPortion } from "@/lib/types";

export interface PortionValue {
  quantity: number;
  unit: EntryUnit;
  portion_id: string | null;
}

const QUICK: Record<string, number[]> = { g: [30, 50, 100, 150, 200], kg: [0.25, 0.5, 1], ml: [100, 200, 250, 300], l: [0.5, 1], portion: [0.5, 1, 2] };

/**
 * Seletor de porção com feedback imediato: o mesmo cálculo do servidor roda aqui
 * para pré-visualização (o valor gravado é recalculado no servidor).
 */
export function PortionSelector({
  food,
  portions,
  value,
  onChange,
  onAddPortion,
}: {
  food: Food;
  portions: FoodPortion[];
  value: PortionValue;
  onChange: (v: PortionValue) => void;
  onAddPortion?: (p: { label: string; amount: number; amount_unit: "g" | "ml" }) => Promise<void>;
}) {
  const qid = useId();
  const units = availableUnits(food, portions);
  const portion = portions.find((p) => p.id === value.portion_id) ?? null;
  const conv = toBaseAmount(value.quantity, value.unit, food, portion);
  const n = conv.ok ? nutrientsFor(food, conv.baseAmount) : null;
  const [adding, setAdding] = useState(false);

  const flags = useMemo(() => Object.entries(food.nutrient_flags ?? {}).filter(([, v]) => v === "*" || v === "missing"), [food]);

  function setUnit(u: EntryUnit) {
    if (u === value.unit) return;
    // converte a quantidade atual para manter a porção ao trocar g↔kg, ml↔L
    let q = value.quantity;
    if (value.unit === "g" && u === "kg") q = q / 1000;
    else if (value.unit === "kg" && u === "g") q = q * 1000;
    else if (value.unit === "ml" && u === "l") q = q / 1000;
    else if (value.unit === "l" && u === "ml") q = q * 1000;
    else if (u === "portion") q = 1;
    else if (value.unit === "portion") q = 100;
    onChange({ quantity: Math.round(q * 1000) / 1000, unit: u, portion_id: u === "portion" ? (portions[0]?.id ?? null) : null });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[1fr_auto] items-end gap-4">
        <div>
          <label htmlFor={qid} className="eyebrow">Quantidade</label>
          <input
            id={qid}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={Number.isFinite(value.quantity) ? value.quantity : ""}
            onChange={(e) => onChange({ ...value, quantity: e.target.value === "" ? Number.NaN : Number(e.target.value) })}
            className="num mt-1 w-full border-0 border-b border-line-strong bg-transparent px-0 pb-1 font-[family-name:var(--font-display)] text-6xl font-bold uppercase leading-none text-bone focus:border-volt focus:outline-none"
            aria-describedby={`${qid}-unit`}
          />
        </div>
        <div className="pb-2 text-right" aria-live="polite">
          <div className="eyebrow">Energia</div>
          <div className="display mt-1 text-5xl text-volt">{n?.kcal !== null && n ? <AnimatedNumber value={n.kcal} decimals={0} duration={0.25} /> : "-"}</div>
          <div className="text-xs text-mute">kcal</div>
        </div>
      </div>

      <div id={`${qid}-unit`} role="radiogroup" aria-label="Unidade" className="flex flex-wrap gap-1.5">
        {units.map((u) => (
          <button
            key={u}
            type="button"
            role="radio"
            aria-checked={value.unit === u}
            onClick={() => setUnit(u)}
            className={`h-9 min-w-12 border px-3 text-sm transition-colors ${value.unit === u ? "border-volt bg-volt-dim text-bone" : "border-line-strong text-mute hover:text-bone"}`}
          >
            {u === "portion" ? "Medida caseira" : UNIT_LABEL[u]}
          </button>
        ))}
      </div>

      {value.unit === "portion" && (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Medida caseira">
          {portions.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={value.portion_id === p.id}
              onClick={() => onChange({ ...value, portion_id: p.id })}
              className={`h-9 border px-3 text-sm ${value.portion_id === p.id ? "border-volt text-bone" : "border-line text-mute hover:text-bone"}`}
            >
              {p.label} <span className="num text-dim">· {fmt1(p.amount)} {p.amount_unit}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(QUICK[value.unit] ?? []).map((q) => (
          <button key={q} type="button" onClick={() => onChange({ ...value, quantity: q })} className="chip h-7 hover:border-bone hover:text-bone">
            {q.toLocaleString("pt-BR")} {value.unit === "portion" ? "×" : UNIT_LABEL[value.unit]}
          </button>
        ))}
      </div>

      {!conv.ok && Number.isFinite(value.quantity) && (
        <p className="flex items-start gap-2 text-sm text-amber" role="alert">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {conv.reason}
        </p>
      )}

      {/* macros + fórmula */}
      <div className="border-t border-line pt-4">
        <dl className="grid grid-cols-4 gap-3">
          {[
            ["Prot.", n?.protein_g, "var(--color-protein)"],
            ["Carb.", n?.carbs_g, "var(--color-carbs)"],
            ["Gord.", n?.fat_g, "var(--color-fat)"],
            ["Fibras", n?.fiber_g, "var(--color-dim)"],
          ].map(([l, v, c]) => (
            <div key={l as string}>
              <dt className="flex items-center gap-1.5 eyebrow">
                <span className="h-1.5 w-1.5" style={{ background: c as string }} aria-hidden /> {l}
              </dt>
              <dd className="num mt-1 text-lg font-semibold">{v === null || v === undefined ? <span className="text-dim" title="Sem dado na fonte">-</span> : `${fmt1(v as number)} g`}</dd>
            </div>
          ))}
        </dl>
        {conv.ok && food.kcal !== null && (
          <p className="num mt-4 font-mono text-xs text-mute">
            {fmt1(food.kcal)} kcal × {fmt1(conv.baseAmount)} {food.ref_unit} ÷ {fmt1(food.ref_amount)} {food.ref_unit} = <span className="text-bone">{fmt1(n?.kcal)} kcal</span>
            {conv.isEstimate && <span className="ml-2 text-amber">({conv.note})</span>}
          </p>
        )}
        <p className="mt-2 text-[11px] text-dim">
          Fonte: {SOURCE_LABEL[food.source]}
          {food.source_ref && food.source === "TACO" ? ` nº ${food.source_ref}` : ""} · valores por {fmt1(food.ref_amount)} {food.ref_unit}
          {food.verified ? " · verificado" : " · informado por você"}
          {flags.length > 0 && <span className="text-amber"> · alguns nutrientes sem dado na fonte</span>}
        </p>
      </div>

      {onAddPortion && (
        <AddPortion food={food} open={adding} setOpen={setAdding} onAdd={onAddPortion} />
      )}
    </div>
  );
}

function AddPortion({ food, open, setOpen, onAdd }: { food: Food; open: boolean; setOpen: (b: boolean) => void; onAdd: (p: { label: string; amount: number; amount_unit: "g" | "ml" }) => Promise<void> }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-xs text-mute hover:text-bone">
        <Plus size={12} /> Cadastrar medida caseira (ex.: “1 unidade média = 120 g”)
      </button>
    );
  const valid = label.trim().length > 0 && Number(amount) > 0;
  return (
    <div className="space-y-3 border border-line p-3">
      <p className="text-xs text-mute">Informe quanto pesa (ou mede) a sua medida. Usamos esse valor para converter, e ele fica marcado como definido por você.</p>
      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <input className="field" placeholder="Ex.: 1 unidade média" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Nome da medida" maxLength={60} />
        <div className="relative">
          <input className="field pr-8" type="number" inputMode="decimal" placeholder="120" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={`Peso em ${food.ref_unit}`} />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dim">{food.ref_unit}</span>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={!valid || busy}
          onClick={async () => {
            setBusy(true);
            await onAdd({ label: label.trim(), amount: Number(amount), amount_unit: food.ref_unit });
            setBusy(false);
            setLabel("");
            setAmount("");
            setOpen(false);
          }}
        >
          Salvar medida
        </button>
      </div>
    </div>
  );
}
