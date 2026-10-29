"use client";
import { useState, useTransition } from "react";
import { Field, FormMessage } from "@/components/ui/form";
import { createCustomFood } from "@/app/(app)/actions/foods";
import type { Food, FoodPortion } from "@/lib/types";

/**
 * Cadastro de alimento próprio ou de rótulo. Somente calorias são obrigatórias;
 * nutrientes não informados ficam marcados como ausentes (nunca preenchidos com 0).
 */
export function CustomFoodForm({ onCreated }: { onCreated: (f: Food, p: FoodPortion | null) => void }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [unit, setUnit] = useState<"g" | "ml">("g");
  const [source, setSource] = useState<"LABEL" | "USER">("LABEL");
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = { ...Object.fromEntries(fd), ref_unit: unit, source };
    start(async () => {
      const r = await createCustomFood(payload);
      if (!r.ok) {
        setErrors(r.errors ?? {});
        setMessage(r.error);
        return;
      }
      setErrors({});
      setMessage(null);
      onCreated(r.data.food, r.data.portion);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 pb-4" noValidate>
      {message && <FormMessage tone="error">{message}</FormMessage>}
      <div role="radiogroup" aria-label="Origem dos dados" className="grid grid-cols-2 gap-1">
        {([
          ["LABEL", "Rótulo do produto"],
          ["USER", "Dados próprios"],
        ] as const).map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={source === k} onClick={() => setSource(k)} className={`h-9 border text-xs uppercase tracking-wider ${source === k ? "border-volt text-bone" : "border-line text-mute"}`}>
            {l}
          </button>
        ))}
      </div>
      <Field label="Nome" name="name" required error={errors.name} placeholder="Ex.: Iogurte grego natural" />
      <Field label="Marca (opcional)" name="brand" error={errors.brand} />
      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <Field label="Valores referentes a" name="ref_amount" type="number" inputMode="decimal" defaultValue={100} required error={errors.ref_amount} />
        <div role="radiogroup" aria-label="Unidade de referência" className="flex h-[46px]">
          {(["g", "ml"] as const).map((u) => (
            <button key={u} type="button" role="radio" aria-checked={unit === u} onClick={() => setUnit(u)} className={`w-12 border ${unit === u ? "border-volt text-bone" : "border-line-strong text-mute"}`}>
              {u}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Calorias (kcal)" name="kcal" type="number" inputMode="decimal" required error={errors.kcal} />
        <Field label="Proteínas (g)" name="protein_g" type="number" inputMode="decimal" error={errors.protein_g} />
        <Field label="Carboidratos (g)" name="carbs_g" type="number" inputMode="decimal" error={errors.carbs_g} />
        <Field label="Gorduras (g)" name="fat_g" type="number" inputMode="decimal" error={errors.fat_g} />
        <Field label="Fibras (g)" name="fiber_g" type="number" inputMode="decimal" error={errors.fiber_g} />
        <Field label="Sódio (mg)" name="sodium_mg" type="number" inputMode="decimal" error={errors.sodium_mg} />
      </div>
      <p className="text-xs text-dim">Campos vazios ficam registrados como “sem dado”. Não assumimos zero.</p>
      <div className="grid grid-cols-[1fr_8rem] gap-3 border-t border-line pt-4">
        <Field label="Medida caseira (opcional)" name="serving_label" placeholder="Ex.: 1 pote" error={errors.serving_label} />
        <Field label={`Equivale a (${unit})`} name="serving_amount" type="number" inputMode="decimal" error={errors.serving_amount} />
      </div>
      <button type="submit" disabled={pending} className="btn btn-ghost w-full">
        {pending ? "Salvando…" : "Salvar e usar"}
      </button>
    </form>
  );
}
