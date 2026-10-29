"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Check, FlaskConical, Loader2, MessageSquarePlus, Plus, RefreshCw, Save, Square, Trash2 } from "lucide-react";
import { addDiaryEntry } from "@/app/(app)/actions/diary";
import { savePlanFromSuggestion } from "@/app/(app)/actions/plan";
import { deleteConversation, loadConversation } from "@/app/(app)/actions/ai";
import { useToast } from "@/components/app/toast";
import { FormMessage } from "@/components/ui/form";
import { mealLabel, type MealDef } from "@/lib/nutrition/meals";
import { r1, sumNutrients, type Nutrients } from "@/lib/nutrition/calc";
import { fmt0, fmt1 } from "@/lib/format";
import { formatDateShort } from "@/lib/dates";
import type { AiCard } from "@/lib/ai/nutrition-agent";

type Part = { t: "text"; text: string } | { t: "card"; card: AiCard };
interface Msg { id: string; role: "user" | "assistant"; content: string; cards: AiCard[]; parts?: Part[]; status?: string; error?: string; streaming?: boolean }

const QUICK = [
  "Monte um cardápio para hoje dentro da minha meta",
  "Plano semanal econômico respeitando minhas restrições",
  "Tenho arroz, ovo, tomate e feijão em casa. O que faço no jantar?",
  "Sugira um lanche da tarde com até 200 kcal e boa proteína",
  "Troque o almoço por uma opção vegetariana com calorias parecidas",
];

export function LabView({ configured, model, conversations, meals, today }: { configured: boolean; model: string | null; conversations: { id: string; title: string; updated_at: string }[]; meals: MealDef[]; today: string }) {
  const [convId, setConvId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  async function openConv(id: string) {
    if (busy) return;
    setLoadingConv(true);
    setConvId(id);
    const list = await loadConversation(id);
    setMsgs(list);
    setLoadingConv(false);
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy || !configured) return;
    setInput("");
    setBusy(true);
    const aid = `a-${Date.now()}`;
    setMsgs((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: message, cards: [] }, { id: aid, role: "assistant", content: "", cards: [], streaming: true, status: "Pensando…" }]);
    const patch = (fn: (m: Msg) => Msg) => setMsgs((list) => list.map((x) => (x.id === aid ? fn(x) : x)));
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/ai/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: convId, message }), signal: ctrl.signal });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        patch((m) => ({ ...m, streaming: false, status: undefined, error: j.error ?? "Falha ao contatar o assistente." }));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const line = buf.slice(0, i).replace(/^data:\s*/, "");
          buf = buf.slice(i + 2);
          let ev: { type: string; delta?: string; card?: AiCard; label?: string; message?: string; conversationId?: string };
          try { ev = JSON.parse(line); } catch { continue; }
          if (ev.type === "meta" && ev.conversationId) setConvId(ev.conversationId);
          else if (ev.type === "text")
            patch((m) => {
              const parts = [...(m.parts ?? [])];
              const last = parts.at(-1);
              if (last?.t === "text") parts[parts.length - 1] = { t: "text", text: last.text + ev.delta };
              else parts.push({ t: "text", text: ev.delta ?? "" });
              return { ...m, content: m.content + ev.delta, parts, status: undefined };
            });
          else if (ev.type === "status") patch((m) => ({ ...m, status: ev.label }));
          else if (ev.type === "card") patch((m) => ({ ...m, cards: [...m.cards, ev.card!], parts: [...(m.parts ?? []), { t: "card", card: ev.card! }] }));
          else if (ev.type === "error") patch((m) => ({ ...m, error: ev.message }));
        }
      }
    } catch (e) {
      patch((m) => ({ ...m, error: e instanceof Error && e.name === "AbortError" ? "Resposta interrompida." : "Conexão perdida. Tente novamente." }));
    } finally {
      patch((m) => ({ ...m, streaming: false, status: undefined }));
      setBusy(false);
      abortRef.current = null;
      router.refresh();
    }
  }

  return (
    <div className="mx-auto grid max-w-[1500px] gap-0 lg:h-dvh lg:grid-cols-[17rem_1fr]">
      {/* histórico */}
      <aside className="border-line px-5 py-6 lg:overflow-y-auto lg:border-r lg:px-4" aria-label="Histórico de conversas">
        <button className="btn btn-ghost w-full" onClick={() => { setConvId(null); setMsgs([]); }} disabled={busy}><MessageSquarePlus size={14} /> Nova conversa</button>
        <p className="eyebrow mt-6">Histórico</p>
        <ul className="mt-2 space-y-0.5 max-lg:flex max-lg:gap-2 max-lg:overflow-x-auto max-lg:space-y-0">
          {conversations.map((c) => (
            <li key={c.id} className="group flex items-center gap-1 max-lg:shrink-0">
              <button onClick={() => openConv(c.id)} className={`min-w-0 flex-1 truncate px-2 py-2 text-left text-sm ${convId === c.id ? "bg-graphite text-bone" : "text-mute hover:text-bone"}`}>
                {c.title}
                <span className="block text-[10px] text-dim">{formatDateShort(c.updated_at.slice(0, 10))}</span>
              </button>
              <button className="btn btn-quiet h-7 w-7 p-0 opacity-0 group-hover:opacity-100 max-lg:hidden" aria-label={`Excluir conversa ${c.title}`} onClick={async () => { await deleteConversation(c.id); if (convId === c.id) { setConvId(null); setMsgs([]); } router.refresh(); }}><Trash2 size={12} /></button>
            </li>
          ))}
          {!conversations.length && <li className="px-2 text-xs text-dim">Nenhuma conversa ainda.</li>}
        </ul>
      </aside>

      <section className="flex min-h-[calc(100dvh-8rem)] flex-col lg:min-h-0" aria-labelledby="lab-title">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-5 md:px-8">
          <div>
            <p className="eyebrow flex items-center gap-2"><FlaskConical size={12} /> Sugestões com cálculo determinístico</p>
            <h1 id="lab-title" className="display mt-1 text-[clamp(2.4rem,5vw,4rem)]">AI Nutrition <span className="text-volt">Lab</span></h1>
          </div>
          <span className={`chip ${configured ? "chip-volt" : "chip-amber"}`}>{configured ? `Conectado · ${model}` : "Configuração pendente"}</span>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-6 md:px-8" aria-live="polite" aria-busy={busy}>
          {!configured && (
            <div className="mx-auto max-w-2xl">
              <FormMessage tone="info">
                <p className="font-semibold">O assistente de IA ainda não está configurado neste servidor.</p>
                <p className="mt-1 text-mute">Defina <code className="text-bone">ANTHROPIC_API_KEY</code> (e opcionalmente <code className="text-bone">AI_MODEL</code>) nas variáveis de ambiente do servidor e reinicie. A chave nunca é enviada ao navegador. Streaming, ferramentas de cálculo, histórico e cartões já estão prontos.</p>
                <p className="mt-2 text-mute">Enquanto isso, o <a href="/plan" className="text-bone underline underline-offset-4">gerador determinístico de planos</a> funciona sem IA.</p>
              </FormMessage>
            </div>
          )}
          {loadingConv && <div className="mx-auto max-w-3xl space-y-3"><div className="skeleton h-10 w-1/2" /><div className="skeleton h-40" /></div>}
          {configured && !msgs.length && !loadingConv && (
            <div className="mx-auto max-w-3xl">
              <p className="text-mute">Peça cardápios, substituições ou ideias com o que você tem em casa. O assistente escolhe; o app calcula calorias e macros com a TACO.</p>
              <ul className="mt-6 grid gap-2 sm:grid-cols-2">
                {QUICK.map((q) => (
                  <li key={q}><button onClick={() => send(q)} className="w-full border border-line-strong px-4 py-3 text-left text-sm hover:border-volt hover:bg-volt-dim">{q}</button></li>
                ))}
              </ul>
            </div>
          )}
          <ol className="mx-auto max-w-3xl space-y-6">
            {msgs.map((m) => (
              <li key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
                {m.role === "user" ? (
                  <p className="max-w-[85%] bg-graphite-2 px-4 py-3 text-sm">{m.content}</p>
                ) : (
                  <div className="space-y-4">
                    {m.status && <p className="flex items-center gap-2 text-xs text-mute"><Loader2 size={12} className="animate-spin" /> {m.status}</p>}
                    {(m.parts ?? [...(m.content ? [{ t: "text" as const, text: m.content }] : []), ...m.cards.map((card) => ({ t: "card" as const, card }))]).map((part, i, arr) =>
                      part.t === "card" ? (
                        <CardView key={i} card={part.card} meals={meals} today={today} onAsk={send} />
                      ) : part.text.trim() ? (
                        <div key={i} className="whitespace-pre-wrap text-sm leading-relaxed text-bone/90">
                          {part.text.trim()}
                          {m.streaming && i === arr.length - 1 && <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 bg-volt motion-safe:animate-pulse-dot" aria-hidden />}
                        </div>
                      ) : null,
                    )}
                    {m.error && <FormMessage tone="error">{m.error}</FormMessage>}
                  </div>
                )}
              </li>
            ))}
          </ol>
          <div ref={endRef} />
        </div>

        <form className="border-t border-line px-5 py-4 md:px-8" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <label htmlFor="lab-input" className="sr-only">Mensagem para o assistente</label>
            <textarea
              id="lab-input"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder={configured ? "Ex.: jantar até 500 kcal sem lactose" : "Assistente indisponível até a configuração"}
              disabled={!configured}
              maxLength={2000}
              className="field max-h-40 min-h-12 resize-none"
            />
            {busy ? (
              <button type="button" onClick={() => abortRef.current?.abort()} className="btn btn-ghost h-12 w-12 p-0" aria-label="Interromper resposta"><Square size={14} /></button>
            ) : (
              <button type="submit" disabled={!configured || !input.trim()} className="btn btn-volt h-12 w-12 p-0" aria-label="Enviar"><ArrowUp size={18} /></button>
            )}
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-[11px] text-dim">Sugestões não substituem nutricionista. Enviamos ao provedor de IA apenas objetivo, meta, restrições e sua mensagem.</p>
        </form>
      </section>
    </div>
  );
}

function NutLine({ n }: { n: Nutrients }) {
  return <span className="num text-xs text-mute">{fmt0(n.kcal)} kcal · P {fmt1(n.protein_g)} · C {fmt1(n.carbs_g)} · G {fmt1(n.fat_g)} g</span>;
}

function CardView({ card, meals, today, onAsk }: { card: AiCard; meals: MealDef[]; today: string; onAsk: (t: string) => void }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  const [logged, setLogged] = useState<Set<string>>(new Set());

  if (card.kind === "plan") {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <span className="font-semibold">{card.title}</span>
          <span className="chip chip-volt">Totais calculados pelo app</span>
        </div>
        {card.days.map((d) => (
          <div key={d.day_index} className="border-b border-line px-4 py-3 last:border-0">
            {card.days.length > 1 && <p className="eyebrow mb-2">Dia {d.day_index + 1}</p>}
            <ul className="space-y-2">
              {d.meals.map((m, i) => {
                const k = `${d.day_index}-${i}`;
                return (
                  <li key={k} className="grid grid-cols-[1fr_auto] items-center gap-3">
                    <span className="min-w-0">
                      <span className="eyebrow">{mealLabel(m.meal_slot, meals)} · {fmt1(m.servings)}×</span>
                      <a href={`/recipes/${m.recipe_id}`} className="block truncate text-sm hover:text-volt">{m.recipe_name}</a>
                      <NutLine n={m.nutrients} />
                      {m.note && <span className="block text-xs text-dim">{m.note}</span>}
                    </span>
                    <span className="flex gap-1">
                      <button className="btn btn-quiet btn-sm" onClick={() => onAsk(`Troque "${m.recipe_name}" (${mealLabel(m.meal_slot, meals)}${card.days.length > 1 ? `, dia ${d.day_index + 1}` : ""}) por outra opção com calorias parecidas.`)} aria-label={`Trocar ${m.recipe_name}`}><RefreshCw size={12} /></button>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={logged.has(k) || pending}
                        onClick={() => start(async () => {
                          const r = await addDiaryEntry({ entry_date: today, meal_slot: m.meal_slot, recipe_id: m.recipe_id, quantity: m.servings, unit: "serving" });
                          if (!r.ok) return toast({ tone: "error", message: r.error });
                          setLogged((s) => new Set(s).add(k));
                          toast({ tone: "success", message: `Registrado: ${fmt0(r.data.kcal)} kcal` });
                          router.refresh();
                        })}
                      >
                        {logged.has(k) ? <Check size={12} /> : <Plus size={12} />} Diário
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-sm">
              <span className="eyebrow">Total do dia</span>
              <span className="num">{fmt0(d.totals.kcal)} kcal{card.target_kcal ? <span className="text-mute"> / meta {fmt0(card.target_kcal)}</span> : null}</span>
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 bg-graphite-2 px-4 py-3">
          {saved ? (
            <a href={`/plan?id=${saved}`} className="btn btn-volt btn-sm">Abrir plano e lista de compras</a>
          ) : (
            <button
              className="btn btn-volt btn-sm"
              disabled={pending}
              onClick={() => start(async () => {
                const r = await savePlanFromSuggestion({ name: card.title, start_date: today, items: card.days.flatMap((d) => d.meals.map((m) => ({ day_index: d.day_index, meal_slot: m.meal_slot, recipe_id: m.recipe_id, servings: m.servings }))) });
                if (!r.ok) return toast({ tone: "error", message: r.error });
                setSaved(r.data.id);
                toast({ tone: "success", message: "Plano salvo" });
              })}
            >
              <Save size={12} /> Salvar como plano
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return <MealCard card={card} meals={meals} today={today} onAsk={onAsk} />;
}

function MealCard({ card, meals, today, onAsk }: { card: Extract<AiCard, { kind: "meal" }>; meals: MealDef[]; today: string; onAsk: (t: string) => void }) {
  const [grams, setGrams] = useState(() => card.items.map((i) => i.grams));
  const [slot, setSlot] = useState(card.meal_slot);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  // recálculo determinístico local ao ajustar quantidades (mesma fórmula do servidor)
  const items = card.items.map((it, i) => {
    const g = grams[i] || 0;
    const s = (v: number | null) => (v === null ? 0 : r1((v * g) / it.per100.ref_amount));
    return { ...it, g, n: { kcal: s(it.per100.kcal), protein_g: s(it.per100.protein_g), carbs_g: s(it.per100.carbs_g), fat_g: s(it.per100.fat_g), fiber_g: s(it.per100.fiber_g) } };
  });
  const totals = sumNutrients(items.map((i) => i.n));
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <span className="font-semibold">{card.title}</span>
        <span className="display text-3xl text-volt">{fmt0(totals.kcal)}<span className="ml-1 text-xs text-mute">kcal</span></span>
      </div>
      {card.note && <p className="px-4 pt-3 text-xs text-mute">{card.note}</p>}
      <ul className="divide-y divide-line px-4">
        <AnimatePresence initial={false}>
          {items.map((it, i) => (
            <li key={it.food_id + i} className="grid grid-cols-[1fr_5.5rem_auto] items-center gap-2 py-2">
              <span className="min-w-0"><span className="block truncate text-sm">{it.name}</span><NutLine n={it.n} /></span>
              <label className="relative"><span className="sr-only">Gramas de {it.name}</span><input type="number" min={0} className="field num h-8 py-0 pr-6 text-sm" value={grams[i]} onChange={(e) => setGrams(grams.map((g, j) => (j === i ? Number(e.target.value) : g)))} /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-dim">g</span></label>
              <button className="btn btn-quiet btn-sm" onClick={() => onAsk(`Substitua "${it.name}" na refeição "${card.title}" mantendo calorias e proteína parecidas.`)} aria-label={`Substituir ${it.name}`}><RefreshCw size={12} /></button>
            </li>
          ))}
        </AnimatePresence>
      </ul>
      <div className="flex flex-wrap items-center gap-2 bg-graphite-2 px-4 py-3">
        <NutLine n={totals} />
        <span className="flex-1" />
        <select className="field h-8 w-40 py-0 text-sm" value={slot} onChange={(e) => setSlot(e.target.value)} aria-label="Refeição">{meals.map((m) => <option key={m.slot} value={m.slot}>{m.label}</option>)}</select>
        <button
          className="btn btn-volt btn-sm"
          disabled={done || pending || !items.some((i) => i.g > 0)}
          onClick={() => start(async () => {
            for (const it of items.filter((i) => i.g > 0)) {
              const r = await addDiaryEntry({ entry_date: today, meal_slot: slot, food_id: it.food_id, quantity: it.g, unit: "g" });
              if (!r.ok) return toast({ tone: "error", message: `${it.name}: ${r.error}` });
            }
            setDone(true);
            toast({ tone: "success", message: "Refeição registrada no diário" });
            router.refresh();
          })}
        >
          {done ? <Check size={12} /> : pending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} {done ? "Registrada" : "Adicionar ao diário"}
        </button>
      </div>
    </motion.div>
  );
}
