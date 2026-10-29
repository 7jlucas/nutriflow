"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Info, Minus, Plus } from "lucide-react";
import { Field, FormMessage } from "@/components/ui/form";
import { ACTIVITY_FACTORS, estimateEnergy } from "@/lib/nutrition/energy";
import { PREFERENCE_OPTIONS, RESTRICTION_OPTIONS } from "@/lib/nutrition/plan";
import { saveProfile } from "@/app/(app)/actions/profile";
import { fmt0 } from "@/lib/format";
import type { ActivityLevel, BudgetLevel, SexForEquation } from "@/lib/types";
import type { ProfileDraft } from "@/lib/profile-draft";

const num = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(",", ".")));

const STEPS = [
  { key: "you", title: "Você", sub: "Para estimar seu gasto energético." },
  { key: "goal", title: "Objetivo", sub: "Onde você está e aonde quer chegar." },
  { key: "routine", title: "Rotina", sub: "Atividade física e refeições." },
  { key: "food", title: "Alimentação", sub: "Preferências, alergias e restrições. Tudo opcional." },
  { key: "health", title: "Segurança", sub: "Para não sugerir metas inadequadas." },
  { key: "result", title: "Sua estimativa", sub: "Revise antes de concluir." },
] as const;

export function ProfileForm({ initial, mode }: { initial: ProfileDraft; mode: "onboarding" | "edit" }) {
  const [d, setD] = useState<ProfileDraft>(initial);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => {
    setD((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
    setSaved(false);
  };

  const energy = useMemo(() => {
    const w = num(d.weight_kg), h = num(d.height_cm), a = num(d.age);
    if (!(w > 0 && h > 0 && a > 0)) return null;
    return estimateEnergy({ weightKg: w, heightCm: h, age: a, sex: d.sex, activity: d.activity, goal: d.goal, needsProfessionalGuidance: d.needs_professional_guidance, targetWeightKg: num(d.target_weight_kg) || null, targetDate: d.target_date || null });
  }, [d]);

  function validateStep(i: number): boolean {
    const e: Record<string, string> = {};
    const key = STEPS[i].key;
    if (key === "you") {
      if (!d.display_name.trim()) e.display_name = "Informe seu nome.";
      const a = num(d.age);
      if (!(a >= 13 && a <= 110)) e.age = "Idade entre 13 e 110 anos.";
      const h = num(d.height_cm);
      if (!(h >= 100 && h <= 250)) e.height_cm = "Altura em centímetros (100 a 250).";
    }
    if (key === "goal") {
      const w = num(d.weight_kg);
      if (!(w >= 30 && w <= 350)) e.weight_kg = "Peso em kg (30 a 350).";
      const t = num(d.target_weight_kg);
      if (d.goal !== "maintain" && d.target_weight_kg && !(t >= 30 && t <= 350)) e.target_weight_kg = "Meta em kg (30 a 350).";
      if (d.goal === "lose" && t && w && t >= w) e.target_weight_kg = "Para emagrecer, a meta deve ser menor que o peso atual.";
      if (d.goal === "gain" && t && w && t <= w) e.target_weight_kg = "Para ganhar, a meta deve ser maior que o peso atual.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit() {
    for (let i = 0; i < STEPS.length - 1; i++) {
      if (!validateStep(i)) {
        if (mode === "onboarding") setStep(i);
        return;
      }
    }
    start(async () => {
      const payload = {
        ...d,
        target_weight_kg: d.goal === "maintain" ? "" : d.target_weight_kg,
        target_date: d.goal === "maintain" ? "" : d.target_date,
      };
      const r = await saveProfile(payload, { onboarding: mode === "onboarding", recalcTarget: mode === "edit" });
      if (!r.ok) {
        setErrors(r.errors ?? {});
        setMessage(r.error);
        return;
      }
      setMessage(null);
      if (mode === "onboarding") router.push("/dashboard?bemvindo=1");
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  const sections = {
    you: <StepYou d={d} set={set} errors={errors} />,
    goal: <StepGoal d={d} set={set} errors={errors} />,
    routine: <StepRoutine d={d} set={set} />,
    food: <StepFood d={d} set={set} />,
    health: <StepHealth d={d} set={set} />,
    result: <EnergyPanel energy={energy} sex={d.sex} />,
  };

  if (mode === "edit") {
    return (
      <div className="space-y-12">
        {message && <FormMessage tone="error">{message}</FormMessage>}
        {STEPS.map((s, i) => (
          <section key={s.key} aria-labelledby={`sec-${s.key}`} className="grid gap-6 border-t border-line pt-8 lg:grid-cols-[16rem_1fr]">
            <div>
              <span className="num text-xs text-dim">0{i + 1}</span>
              <h2 id={`sec-${s.key}`} className="display mt-1 text-3xl">{s.title}</h2>
              <p className="mt-1 text-sm text-mute">{s.sub}</p>
            </div>
            <div>{sections[s.key]}</div>
          </section>
        ))}
        <div className="sticky bottom-20 z-10 flex items-center justify-end gap-3 border-t border-line bg-ink/90 py-4 backdrop-blur lg:bottom-0">
          {saved && <span className="flex items-center gap-1.5 text-sm text-volt" role="status"><Check size={14} /> Perfil e meta atualizados</span>}
          <button onClick={submit} disabled={pending} className="btn btn-volt">{pending ? "Salvando…" : "Salvar e recalcular meta"}</button>
        </div>
      </div>
    );
  }

  const current = STEPS[step];
  return (
    <div>
      {/* progresso */}
      <div className="flex items-center gap-1.5" aria-label={`Etapa ${step + 1} de ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <span key={s.key} className={`h-[3px] flex-1 transition-colors duration-500 ${i <= step ? "bg-volt" : "bg-line-strong"}`} />
        ))}
      </div>
      <div className="mt-8 flex items-baseline gap-3">
        <span className="num text-sm text-dim">0{step + 1}/0{STEPS.length}</span>
        <span className="eyebrow">{current.sub}</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={current.key} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
          <h1 className="display mt-3 text-[clamp(3rem,8vw,5.5rem)]">{current.title}</h1>
          <div className="mt-10">{sections[current.key]}</div>
        </motion.div>
      </AnimatePresence>
      {message && <div className="mt-6"><FormMessage tone="error">{message}</FormMessage></div>}
      <div className="mt-12 flex items-center justify-between gap-3 border-t border-line pt-6">
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="btn btn-quiet">
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="flex items-center gap-2">
          {(current.key === "food" || current.key === "health") && (
            <button onClick={() => setStep((s) => s + 1)} className="btn btn-quiet">Pular</button>
          )}
          {step < STEPS.length - 1 ? (
            <button onClick={() => validateStep(step) && setStep((s) => s + 1)} className="btn btn-volt">
              Continuar <ArrowRight size={16} />
            </button>
          ) : (
            <button onClick={submit} disabled={pending} className="btn btn-volt">
              {pending ? "Salvando…" : "Concluir"} <Check size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type StepProps = { d: ProfileDraft; set: <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => void; errors?: Record<string, string> };

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; l: string; hint?: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1.5 sm:auto-cols-fr sm:grid-flow-col">
      {options.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)} className={`border px-4 py-3 text-left transition-colors ${value === o.v ? "border-volt bg-volt-dim" : "border-line-strong hover:border-bone/40"}`}>
          <span className="block text-sm font-semibold">{o.l}</span>
          {o.hint && <span className="mt-0.5 block text-xs text-mute">{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}

function StepYou({ d, set, errors = {} }: StepProps) {
  return (
    <div className="space-y-6">
      <Field label="Como podemos te chamar?" value={d.display_name} onChange={(e) => set("display_name", e.target.value)} error={errors.display_name} maxLength={60} autoComplete="given-name" />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Idade (anos)" type="number" inputMode="numeric" value={d.age} onChange={(e) => set("age", e.target.value)} error={errors.age} />
        <Field label="Altura (cm)" type="number" inputMode="decimal" value={d.height_cm} onChange={(e) => set("height_cm", e.target.value)} error={errors.height_cm} placeholder="170" />
      </div>
      <div>
        <span className="eyebrow mb-2 block text-bone/80">Sexo para a equação</span>
        <Segmented
          label="Sexo para a equação"
          value={d.sex}
          onChange={(v) => set("sex", v)}
          options={[
            { v: "female", l: "Feminino" },
            { v: "male", l: "Masculino" },
            { v: "unspecified", l: "Prefiro não informar", hint: "Usa uma média; menos precisa" },
          ]}
        />
        <p className="mt-2 flex items-start gap-1.5 text-xs text-dim"><Info size={12} className="mt-0.5 shrink-0" /> A equação de Mifflin-St Jeor usa uma constante diferente por sexo biológico. Usamos essa informação apenas no cálculo.</p>
      </div>
    </div>
  );
}

function StepGoal({ d, set, errors = {} }: StepProps) {
  return (
    <div className="space-y-6">
      <Field label="Peso atual (kg)" type="number" inputMode="decimal" step="0.1" value={d.weight_kg} onChange={(e) => set("weight_kg", e.target.value)} error={errors.weight_kg} placeholder="70,0" />
      <div>
        <span className="eyebrow mb-2 block text-bone/80">Objetivo</span>
        <Segmented
          label="Objetivo"
          value={d.goal}
          onChange={(v) => set("goal", v)}
          options={[
            { v: "lose", l: "Emagrecer", hint: "Déficit moderado" },
            { v: "maintain", l: "Manter o peso", hint: "Equilíbrio" },
            { v: "gain", l: "Ganhar peso e massa", hint: "Superávit leve" },
          ]}
        />
      </div>
      {d.goal !== "maintain" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Meta de peso (kg, opcional)" type="number" inputMode="decimal" step="0.1" value={d.target_weight_kg} onChange={(e) => set("target_weight_kg", e.target.value)} error={errors.target_weight_kg} />
          <Field label="Prazo desejado (opcional)" type="date" value={d.target_date} onChange={(e) => set("target_date", e.target.value)} error={errors.target_date} hint="Usado só para alertar se o ritmo for rápido demais." />
        </div>
      )}
    </div>
  );
}

function StepRoutine({ d, set }: StepProps) {
  return (
    <div className="space-y-8">
      <div>
        <span className="eyebrow mb-2 block text-bone/80">Nível de atividade física</span>
        <div role="radiogroup" aria-label="Nível de atividade física" className="divide-y divide-line border border-line">
          {(Object.keys(ACTIVITY_FACTORS) as ActivityLevel[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={d.activity === k} onClick={() => set("activity", k)} className={`grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3 text-left ${d.activity === k ? "bg-volt-dim" : "hover:bg-graphite"}`}>
              <span className={`h-3 w-3 border ${d.activity === k ? "border-volt bg-volt" : "border-line-strong"}`} aria-hidden />
              <span>
                <span className="block text-sm font-semibold">{ACTIVITY_FACTORS[k].label}</span>
                <span className="block text-xs text-mute">{ACTIVITY_FACTORS[k].hint}</span>
              </span>
              <span className="num text-xs text-dim">×{ACTIVITY_FACTORS[k].factor}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="eyebrow mb-2 block text-bone/80" id="meals-label">Refeições por dia (habitual)</span>
        <div className="flex items-center gap-3" role="group" aria-labelledby="meals-label">
          <button type="button" className="btn btn-ghost h-11 w-11 p-0" onClick={() => set("meals_per_day", Math.max(1, d.meals_per_day - 1))} aria-label="Menos uma refeição"><Minus size={16} /></button>
          <span className="display w-14 text-center text-5xl num" aria-live="polite">{d.meals_per_day}</span>
          <button type="button" className="btn btn-ghost h-11 w-11 p-0" onClick={() => set("meals_per_day", Math.min(8, d.meals_per_day + 1))} aria-label="Mais uma refeição"><Plus size={16} /></button>
        </div>
      </div>
    </div>
  );
}

function ChipToggle({ options, value, onChange, label }: { options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])} className={`h-9 border px-3 text-sm transition-colors ${on ? "border-volt bg-volt-dim text-bone" : "border-line-strong text-mute hover:text-bone"}`}>
            {on && <Check size={12} className="mr-1 inline" aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function StepFood({ d, set }: StepProps) {
  const [other, setOther] = useState("");
  return (
    <div className="space-y-8">
      <div>
        <span className="eyebrow mb-2 block text-bone/80">Preferências</span>
        <ChipToggle label="Preferências" options={PREFERENCE_OPTIONS} value={d.diet_preferences} onChange={(v) => set("diet_preferences", v)} />
      </div>
      <div>
        <span className="eyebrow mb-2 block text-bone/80">Alergias e intolerâncias</span>
        <ChipToggle label="Alergias e intolerâncias" options={RESTRICTION_OPTIONS} value={d.allergies} onChange={(v) => set("allergies", v)} />
        <div className="mt-3 flex gap-2">
          <input className="field h-10" placeholder="Outra (ex.: kiwi)" value={other} onChange={(e) => setOther(e.target.value)} aria-label="Adicionar outra alergia" maxLength={40} />
          <button type="button" className="btn btn-ghost h-10" disabled={!other.trim()} onClick={() => { set("allergies", [...d.allergies, other.trim().toLowerCase()]); setOther(""); }}>Adicionar</button>
        </div>
        {d.allergies.filter((a) => !RESTRICTION_OPTIONS.some((o) => o.value === a)).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {d.allergies.filter((a) => !RESTRICTION_OPTIONS.some((o) => o.value === a)).map((a) => (
              <button key={a} type="button" className="chip hover:border-danger hover:text-danger" onClick={() => set("allergies", d.allergies.filter((x) => x !== a))} aria-label={`Remover ${a}`}>{a} ×</button>
            ))}
          </div>
        )}
      </div>
      <div>
        <span className="eyebrow mb-2 block text-bone/80">Restrições por escolha</span>
        <ChipToggle label="Restrições" options={[{ value: "lactose", label: "Sem lactose" }, { value: "gluten", label: "Sem glúten" }, { value: "peixe", label: "Sem peixe" }]} value={d.restrictions} onChange={(v) => set("restrictions", v)} />
      </div>
      <div>
        <span className="eyebrow mb-2 block text-bone/80">Orçamento alimentar (opcional)</span>
        <ChipToggle label="Orçamento" options={[{ value: "low", label: "Econômico" }, { value: "medium", label: "Moderado" }, { value: "high", label: "Flexível" }]} value={d.budget ? [d.budget] : []} onChange={(v) => set("budget", (v.at(-1) as BudgetLevel) ?? "")} />
      </div>
    </div>
  );
}

function StepHealth({ d, set }: StepProps) {
  return (
    <div className="space-y-4">
      <label className={`flex cursor-pointer items-start gap-4 border p-5 ${d.needs_professional_guidance ? "border-amber bg-amber-dim" : "border-line-strong"}`}>
        <input type="checkbox" checked={d.needs_professional_guidance} onChange={(e) => set("needs_professional_guidance", e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-amber)]" />
        <span>
          <span className="block font-semibold">Estou gestante ou amamentando, tenho uma condição médica relevante ou histórico de transtorno alimentar.</span>
          <span className="mt-1 block text-sm text-mute">Se marcar, não aplicaremos déficit ou superávit automáticos. Você poderá registrar uma meta definida com seu profissional de saúde. Não pedimos detalhes.</span>
        </span>
      </label>
      <p className="text-xs text-dim">O NUTRI//FLOW não substitui nutricionista ou médico.</p>
    </div>
  );
}

function EnergyPanel({ energy, sex }: { energy: ReturnType<typeof estimateEnergy> | null; sex: SexForEquation }) {
  if (!energy) return <p className="text-mute">Preencha idade, altura e peso para ver a estimativa.</p>;
  return (
    <div className="space-y-6">
      <dl className="grid gap-px border border-line bg-line sm:grid-cols-3">
        {[
          ["Taxa metabólica basal", energy.bmr, "estimada"],
          ["Gasto diário total", energy.tdee, "com atividade"],
          ["Meta diária", energy.targetKcal, energy.targetKcal ? (energy.adjustment ? `${energy.adjustment > 0 ? "+" : ""}${energy.adjustment} kcal` : "manutenção") : "sem meta automática"],
        ].map(([l, v, s], i) => (
          <div key={l as string} className="bg-ink p-5">
            <dt className="eyebrow">{l}</dt>
            <dd className={`display mt-2 text-5xl ${i === 2 ? "text-volt" : ""}`}>{v === null ? "-" : fmt0(v as number)}</dd>
            <dd className="text-xs text-mute">{v === null ? s : `kcal/dia · ${s}`}</dd>
          </div>
        ))}
      </dl>
      {energy.macros && (
        <div className="grid grid-cols-3 gap-4">
          {[
            ["Proteínas", energy.macros.protein_g, "var(--color-protein)"],
            ["Carboidratos", energy.macros.carbs_g, "var(--color-carbs)"],
            ["Gorduras", energy.macros.fat_g, "var(--color-fat)"],
          ].map(([l, v, c]) => (
            <div key={l as string} className="border-t-2 pt-3" style={{ borderColor: c as string }}>
              <div className="eyebrow">{l}</div>
              <div className="num mt-1 text-2xl font-semibold">{v as number} g</div>
            </div>
          ))}
        </div>
      )}
      {energy.warnings.map((w) => (
        <FormMessage key={w} tone="info">{w}</FormMessage>
      ))}
      <ul className="space-y-1 text-xs text-dim">
        {energy.notes.map((n) => <li key={n}>{n}</li>)}
        {sex !== "unspecified" && <li>Você pode ajustar a meta manualmente depois, no painel.</li>}
      </ul>
    </div>
  );
}
