"use client";
import { useEffect, useMemo, useReducer, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ChefHat, Copy, CopyPlus, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { PortionSelector, type PortionValue } from "./portion-selector";
import { useToast } from "./toast";
import { useQuickLog, DIARY_EVENT } from "./quick-log";
import { copyMeals, deleteDiaryEntry, getFoodDetail, restoreDiaryEntry, updateDiaryEntry, addCustomMealType } from "@/app/(app)/actions/diary";
import { diaryReducer } from "@/lib/nutrition/diary-state";
import { totalsByMeal, nutrientsFor, type Nutrients } from "@/lib/nutrition/calc";
import { toBaseAmount } from "@/lib/nutrition/units";
import { addDays, formatDateShort } from "@/lib/dates";
import { fmt0, fmt1 } from "@/lib/format";
import type { MealDef } from "@/lib/nutrition/meals";
import type { DiaryEntry, Food, FoodPortion } from "@/lib/types";

interface Props {
  date: string;
  initial: DiaryEntry[];
  meals: MealDef[];
  variant?: "full" | "timeline";
  onTotals?: (n: Nutrients) => void;
}

/** Diário do dia com atualização otimista: refeição, dia e macros recalculam na hora. */
export function DiaryView({ date, initial, meals, variant = "full", onTotals }: Props) {
  const [entries, dispatch] = useReducer(diaryReducer, initial);
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [copyFor, setCopyFor] = useState<{ mode: "duplicate" | "import"; slot: string | null } | null>(null);
  const toast = useToast();
  const quickLog = useQuickLog();
  const router = useRouter();

  // sincroniza quando o servidor re-renderiza (troca de data, router.refresh)
  useEffect(() => {
    dispatch({ type: "set", entries: initial });
  }, [initial]);
  // itens adicionados pelo registro rápido (qualquer tela)
  useEffect(() => {
    const on = (e: Event) => {
      const entry = (e as CustomEvent<DiaryEntry>).detail;
      if (entry.entry_date === date) dispatch({ type: "add", entry });
    };
    window.addEventListener(DIARY_EVENT, on);
    return () => window.removeEventListener(DIARY_EVENT, on);
  }, [date]);

  const totals = useMemo(() => totalsByMeal(entries), [entries]);
  useEffect(() => {
    onTotals?.(totals.day);
  }, [totals.day, onTotals]);

  // refeições visíveis: padrão + personalizadas + qualquer slot com itens
  const visible = useMemo(() => {
    const list = [...meals];
    for (const e of entries) if (!list.some((m) => m.slot === e.meal_slot)) list.push({ slot: e.meal_slot, label: e.meal_slot.replace(/^custom:/, ""), time: null, custom: true });
    return variant === "timeline" ? list.filter((m) => entries.some((e) => e.meal_slot === m.slot) || !m.custom) : list;
  }, [meals, entries, variant]);

  async function remove(entry: DiaryEntry) {
    dispatch({ type: "remove", id: entry.id });
    const r = await deleteDiaryEntry(entry.id);
    if (!r.ok) {
      dispatch({ type: "add", entry });
      toast({ tone: "error", message: r.error });
      return;
    }
    router.refresh();
    toast({
      tone: "info",
      message: `${entry.name.split(",")[0]} removido`,
      action: {
        label: "Desfazer",
        onClick: async () => {
          const back = await restoreDiaryEntry(entry);
          if (back.ok) {
            dispatch({ type: "add", entry: back.data });
            router.refresh();
          } else toast({ tone: "error", message: back.error });
        },
      },
    });
  }

  const totalCount = entries.length;

  return (
    <div>
      {variant === "full" && totalCount === 0 && (
        <div className="mb-6 border border-dashed border-line-strong p-6 text-center">
          <p className="display text-3xl">Nada registrado ainda.</p>
          <p className="mt-2 text-sm text-mute">Comece pela refeição mais recente ou copie de outro dia.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button className="btn btn-volt" onClick={() => quickLog({ date })}><Plus size={16} /> Registrar alimento</button>
            <button className="btn btn-ghost" onClick={() => setCopyFor({ mode: "import", slot: null })}><Copy size={14} /> Copiar de outro dia</button>
          </div>
        </div>
      )}

      <ol className="relative">
        {/* trilho da timeline */}
        <span className="absolute bottom-2 left-[3.75rem] top-2 w-px bg-line md:left-[5rem]" aria-hidden />
        {visible.map((m) => {
          const items = entries.filter((e) => e.meal_slot === m.slot);
          const t = totals.meals[m.slot];
          const firstTime = items.find((i) => i.logged_time)?.logged_time?.slice(0, 5) ?? m.time;
          return (
            <li key={m.slot} className="relative grid grid-cols-[3.25rem_1fr] gap-x-4 pb-6 md:grid-cols-[4.25rem_1fr] md:gap-x-6">
              <div className="pt-1 text-right">
                <span className={`num text-sm ${items.length ? "text-bone" : "text-dim"}`}>{firstTime ?? "-"}</span>
              </div>
              <span className={`absolute left-[3.75rem] top-2.5 h-[7px] w-[7px] -translate-x-[3px] md:left-[5rem] ${items.length ? "bg-volt" : "border border-line-strong bg-ink"}`} aria-hidden />
              <section aria-labelledby={`meal-${date}-${m.slot}`} className="min-w-0 pl-2">
                <header className="flex items-center justify-between gap-3">
                  <h3 id={`meal-${date}-${m.slot}`} className="text-sm font-semibold uppercase tracking-[0.08em]">
                    {m.label}
                  </h3>
                  <div className="flex items-center gap-1">
                    {t && (
                      <span className="num mr-2 text-sm">
                        <span className="font-semibold"><AnimatedNumber value={Math.round(t.kcal)} /></span>
                        <span className="text-mute"> kcal</span>
                      </span>
                    )}
                    <button onClick={() => quickLog({ slot: m.slot, date })} className="btn btn-quiet h-8 w-8 p-0" aria-label={`Adicionar em ${m.label}`}>
                      <Plus size={16} />
                    </button>
                    {variant === "full" && <MealMenu hasItems={items.length > 0} label={m.label} onDuplicate={() => setCopyFor({ mode: "duplicate", slot: m.slot })} onImport={() => setCopyFor({ mode: "import", slot: m.slot })} />}
                  </div>
                </header>
                {t && variant === "full" && (
                  <p className="num mt-0.5 text-xs text-dim">
                    P {fmt1(t.protein_g)} g · C {fmt1(t.carbs_g)} g · G {fmt1(t.fat_g)} g
                  </p>
                )}
                <ul className="mt-2">
                  <AnimatePresence initial={false}>
                    {items.map((e) => (
                      <motion.li
                        key={e.id}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="group grid grid-cols-[1fr_auto] items-center gap-3 border-t border-line py-2.5">
                          <button onClick={() => setEditing(e)} className="min-w-0 text-left" aria-label={`Editar ${e.name}`}>
                            <span className="flex items-center gap-1.5">
                              {e.recipe_id && <ChefHat size={12} className="shrink-0 text-mute" aria-label="Receita" />}
                              <span className="truncate text-sm group-hover:text-volt">{e.name}</span>
                              {(e.incomplete || e.is_estimate) && (
                                <AlertTriangle size={12} className="shrink-0 text-amber" aria-label={e.incomplete ? "Nutrientes incompletos na fonte" : "Conversão estimada"} />
                              )}
                            </span>
                            <span className="num mt-0.5 block text-xs text-dim">
                              {fmt1(e.quantity)} {e.unit_label ?? e.unit}
                              {e.unit !== "g" && e.unit !== "ml" ? ` · ${fmt0(e.base_amount)} ${e.unit === "l" ? "ml" : "g"}` : ""}
                              {e.brand ? ` · ${e.brand}` : ""}
                            </span>
                          </button>
                          <div className="flex items-center gap-1">
                            <span className="num w-14 text-right text-sm">{fmt0(e.kcal)}</span>
                            {variant === "full" && (
                              <>
                                <button onClick={() => setEditing(e)} className="btn btn-quiet h-8 w-8 p-0 opacity-60 group-hover:opacity-100" aria-label={`Editar ${e.name}`}>
                                  <Pencil size={14} />
                                </button>
                                <button onClick={() => remove(e)} className="btn btn-quiet h-8 w-8 p-0 opacity-60 hover:text-danger group-hover:opacity-100" aria-label={`Remover ${e.name}`}>
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
                {!items.length && <p className="border-t border-line py-2.5 text-xs text-dim">Sem registros.</p>}
              </section>
            </li>
          );
        })}
      </ol>

      {variant === "full" && <AddMealType />}

      <EditEntrySheet
        entry={editing}
        meals={meals}
        onClose={() => setEditing(null)}
        onSaved={(row) => {
          dispatch({ type: "update", entry: row });
          setEditing(null);
          router.refresh();
          toast({ tone: "success", message: "Registro atualizado" });
        }}
        onDelete={(row) => {
          setEditing(null);
          remove(row);
        }}
      />
      <CopySheet
        state={copyFor}
        date={date}
        meals={meals}
        onClose={() => setCopyFor(null)}
        onCopied={(rows, toDate) => {
          if (toDate === date) dispatch({ type: "addMany", entries: rows });
          setCopyFor(null);
          router.refresh();
          toast({ tone: "success", message: `${rows.length} ${rows.length === 1 ? "item copiado" : "itens copiados"} para ${formatDateShort(toDate)}` });
        }}
      />
    </div>
  );
}

function MealMenu({ hasItems, label, onDuplicate, onImport }: { hasItems: boolean; label: string; onDuplicate: () => void; onImport: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="btn btn-quiet h-8 w-8 p-0" aria-haspopup="menu" aria-expanded={open} aria-label={`Mais ações para ${label}`}>
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-9 z-20 w-56 border border-line-strong bg-graphite-2 py-1 shadow-[var(--shadow-pop)]" onMouseLeave={() => setOpen(false)}>
          <button role="menuitem" disabled={!hasItems} onClick={() => { setOpen(false); onDuplicate(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-graphite-3 disabled:opacity-40">
            <CopyPlus size={14} /> Duplicar refeição…
          </button>
          <button role="menuitem" onClick={() => { setOpen(false); onImport(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-graphite-3">
            <Copy size={14} /> Copiar de outro dia…
          </button>
        </div>
      )}
    </div>
  );
}

function AddMealType() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [time, setTime] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="ml-[4.5rem] flex items-center gap-1.5 text-xs uppercase tracking-wider text-mute hover:text-bone md:ml-[5.5rem]">
        <Plus size={12} /> Refeição personalizada
      </button>
    );
  return (
    <form
      className="ml-[4.5rem] flex flex-wrap items-end gap-2 md:ml-[5.5rem]"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addCustomMealType(name, time || null);
          if (!r.ok) return toast({ tone: "error", message: r.error });
          setOpen(false);
          setName("");
          router.refresh();
          toast({ tone: "success", message: "Refeição criada" });
        });
      }}
    >
      <input className="field h-10 w-48" placeholder="Ex.: Pré-treino" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome da refeição" maxLength={40} autoFocus />
      <input className="field num h-10 w-28" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Horário padrão" />
      <button className="btn btn-ghost h-10" disabled={!name.trim() || pending}>Criar</button>
      <button type="button" className="btn btn-quiet h-10" onClick={() => setOpen(false)}>Cancelar</button>
    </form>
  );
}

function EditEntrySheet({ entry, meals, onClose, onSaved, onDelete }: { entry: DiaryEntry | null; meals: MealDef[]; onClose: () => void; onSaved: (e: DiaryEntry) => void; onDelete: (e: DiaryEntry) => void }) {
  const [detail, setDetail] = useState<{ food: Food; portions: FoodPortion[] } | null>(null);
  const [value, setValue] = useState<PortionValue>({ quantity: 1, unit: "g", portion_id: null });
  const [slot, setSlot] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!entry) return;
    setValue({ quantity: Number(entry.quantity), unit: entry.unit, portion_id: entry.portion_id });
    setSlot(entry.meal_slot);
    setTime(entry.logged_time?.slice(0, 5) ?? "");
    setError(null);
    setDetail(null);
    if (entry.food_id) {
      setLoading(true);
      getFoodDetail(entry.food_id).then((d) => {
        setDetail(d ? { food: d.food, portions: d.portions } : null);
        setLoading(false);
      });
    }
  }, [entry]);

  if (!entry) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>;

  // pré-visualização para receitas/snapshots: escala proporcional
  const scaled = entry.recipe_id || !entry.food_id ? Number(entry.kcal) * (value.quantity / Number(entry.quantity)) : null;
  const preview = detail ? (() => { const c = toBaseAmount(value.quantity, value.unit, detail.food, detail.portions.find((p) => p.id === value.portion_id)); return c.ok ? nutrientsFor(detail.food, c.baseAmount).kcal : null; })() : scaled;

  function save() {
    if (!entry) return;
    start(async () => {
      const r = await updateDiaryEntry({ id: entry.id, quantity: value.quantity, unit: value.unit, portion_id: value.portion_id, meal_slot: slot, logged_time: time || null });
      if (!r.ok) return setError(r.error);
      onSaved(r.data);
    });
  }

  return (
    <Sheet open={!!entry} onClose={onClose} title="Editar registro" description={entry.name}>
      <div className="space-y-6 px-5 py-5 md:px-7">
        <div className="grid grid-cols-[1fr_7.5rem] gap-2">
          <select value={slot} onChange={(e) => setSlot(e.target.value)} className="field h-10 py-0" aria-label="Refeição">
            {meals.map((m) => <option key={m.slot} value={m.slot}>{m.label}</option>)}
            {!meals.some((m) => m.slot === slot) && <option value={slot}>{slot.replace(/^custom:/, "")}</option>}
          </select>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="field num h-10 py-0" aria-label="Horário" />
        </div>
        {loading && <div className="skeleton h-64" />}
        {detail && <PortionSelector food={detail.food} portions={detail.portions} value={value} onChange={setValue} />}
        {!entry.food_id && (
          <div>
            <label className="eyebrow" htmlFor="edit-q">{entry.recipe_id ? "Porções" : `Quantidade (${entry.unit_label ?? entry.unit})`}</label>
            <input id="edit-q" type="number" inputMode="decimal" step="any" min={0} value={Number.isFinite(value.quantity) ? value.quantity : ""} onChange={(e) => setValue({ ...value, quantity: Number(e.target.value) })} className="field num mt-2 text-2xl" />
            <p className="mt-4 text-sm">
              Energia: <span className="num text-volt">{preview !== null && Number.isFinite(preview) ? `${fmt0(preview)} kcal` : "-"}</span>
            </p>
            {!entry.recipe_id && <p className="mt-1 text-xs text-dim">O alimento de origem não existe mais; os valores são reescalados a partir do registro.</p>}
          </div>
        )}
        {error && <p className="flex items-center gap-2 text-sm text-danger" role="alert"><AlertTriangle size={14} /> {error}</p>}
      </div>
      <div className="sticky bottom-0 flex gap-2 border-t border-line bg-ink px-5 py-4 md:px-7">
        <button onClick={() => onDelete(entry)} className="btn btn-danger"><Trash2 size={14} /> Remover</button>
        <button onClick={save} disabled={pending || !(value.quantity > 0)} className="btn btn-volt flex-1">
          {pending ? <Loader2 size={16} className="animate-spin" /> : null} Salvar alteração
        </button>
      </div>
    </Sheet>
  );
}

function CopySheet({ state, date, meals, onClose, onCopied }: { state: { mode: "duplicate" | "import"; slot: string | null } | null; date: string; meals: MealDef[]; onClose: () => void; onCopied: (rows: DiaryEntry[], toDate: string) => void }) {
  const [other, setOther] = useState(addDays(date, -1));
  const [slot, setSlot] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (!state) return;
    setOther(state.mode === "import" ? addDays(date, -1) : addDays(date, 1));
    setSlot(state.slot ?? "");
    setError(null);
  }, [state, date]);
  if (!state) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>;
  const isImport = state.mode === "import";
  const label = (s: string | null) => (s ? meals.find((m) => m.slot === s)?.label ?? s : "Dia inteiro");
  return (
    <Sheet open onClose={onClose} title={isImport ? "Copiar de outro dia" : "Duplicar refeição"} description={isImport ? `Para ${formatDateShort(date)} · ${label(state.slot)}` : `${label(state.slot)} de ${formatDateShort(date)}`}>
      <div className="space-y-5 px-5 py-5 md:px-7">
        <div>
          <label className="eyebrow mb-2 block" htmlFor="copy-date">{isImport ? "Copiar do dia" : "Para o dia"}</label>
          <input id="copy-date" type="date" className="field num" value={other} onChange={(e) => setOther(e.target.value)} />
        </div>
        <div>
          <label className="eyebrow mb-2 block" htmlFor="copy-slot">{isImport ? "Refeição de origem" : "Na refeição"}</label>
          <select id="copy-slot" className="field" value={slot} onChange={(e) => setSlot(e.target.value)}>
            {isImport && <option value="">Dia inteiro (mantém as refeições)</option>}
            {meals.map((m) => <option key={m.slot} value={m.slot}>{m.label}</option>)}
          </select>
        </div>
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <button
          className="btn btn-volt w-full"
          disabled={pending || !other}
          onClick={() =>
            start(async () => {
              const r = isImport
                ? await copyMeals({ fromDate: other, fromSlot: slot || null, toDate: date, toSlot: slot ? (state.slot ?? slot) : null })
                : await copyMeals({ fromDate: date, fromSlot: state.slot, toDate: other, toSlot: slot || state.slot });
              if (!r.ok) return setError(r.error);
              onCopied(r.data, isImport ? date : other);
            })
          }
        >
          {pending ? "Copiando…" : "Copiar"}
        </button>
        <p className="text-xs text-dim">Os itens copiados mantêm quantidades e valores nutricionais do registro original.</p>
      </div>
    </Sheet>
  );
}
