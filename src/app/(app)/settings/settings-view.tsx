"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Download, LogOut, Plus, Trash2, X } from "lucide-react";
import { deleteAccount, exportMyData, savePreferences } from "@/app/(app)/actions/profile";
import { logoutAction } from "@/app/(auth)/actions";
import { useToast } from "@/components/app/toast";
import { FormMessage } from "@/components/ui/form";

interface Prefs { water_enabled: boolean; water_goal_ml: number; reminders_enabled: boolean; reminder_times: string[] }

export function SettingsView({ email, prefs, canDelete, aiConfigured }: { email: string; prefs: Prefs; canDelete: boolean; aiConfigured: boolean }) {
  const [p, setP] = useState(prefs);
  const [newTime, setNewTime] = useState("12:00");
  const [perm, setPerm] = useState<string>("unsupported");
  useEffect(() => {
    setPerm(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  }, []);
  const [confirm, setConfirm] = useState("");
  const [delError, setDelError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function save(next: Prefs) {
    setP(next);
    start(async () => {
      const r = await savePreferences(next);
      if (!r.ok) toast({ tone: "error", message: r.error });
      else {
        toast({ tone: "success", message: "Preferências salvas" });
        router.refresh();
      }
    });
  }

  return (
    <div className="mx-auto max-w-[900px] px-5 py-6 md:px-10 md:py-10">
      <p className="eyebrow">Conta · {email}</p>
      <h1 className="display mt-2 text-[clamp(2.8rem,7vw,5rem)]">Configurações</h1>

      <Section n="01" title="Água">
        <Toggle label="Acompanhar consumo de água" checked={p.water_enabled} onChange={(v) => save({ ...p, water_enabled: v })} />
        {p.water_enabled && (
          <label className="mt-4 block text-sm text-mute">Meta diária (ml)
            <div className="mt-2 flex gap-2">
              <input type="number" className="field num w-40" min={250} max={8000} step={50} value={p.water_goal_ml} onChange={(e) => setP({ ...p, water_goal_ml: Number(e.target.value) })} />
              <button className="btn btn-ghost" disabled={pending || p.water_goal_ml < 250 || p.water_goal_ml > 8000} onClick={() => save(p)}>Salvar</button>
            </div>
            <span className="mt-2 block text-xs text-dim">Referência pessoal configurável; necessidades de água variam com clima, atividade e saúde.</span>
          </label>
        )}
      </Section>

      <Section n="02" title="Lembretes">
        <Toggle label="Lembretes de registro" checked={p.reminders_enabled} onChange={(v) => save({ ...p, reminders_enabled: v })} />
        {p.reminders_enabled && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {p.reminder_times.map((t) => (
                <span key={t} className="chip h-8 gap-2 text-bone num">{t}<button aria-label={`Remover lembrete das ${t}`} onClick={() => save({ ...p, reminder_times: p.reminder_times.filter((x) => x !== t) })}><X size={12} /></button></span>
              ))}
              {!p.reminder_times.length && <span className="text-sm text-dim">Nenhum horário.</span>}
            </div>
            <div className="flex gap-2">
              <input type="time" className="field num w-36" value={newTime} onChange={(e) => setNewTime(e.target.value)} aria-label="Horário do lembrete" />
              <button className="btn btn-ghost" disabled={p.reminder_times.includes(newTime) || p.reminder_times.length >= 8} onClick={() => save({ ...p, reminder_times: [...p.reminder_times, newTime].sort() })}><Plus size={14} /> Adicionar</button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Bell size={14} className="text-mute" />
              {perm === "granted" ? <span className="text-volt">Notificações do navegador permitidas.</span> : perm === "unsupported" ? <span className="text-mute">Seu navegador não suporta notificações; os lembretes aparecem como aviso na tela.</span> : (
                <button className="btn btn-quiet btn-sm" onClick={async () => setPerm(await Notification.requestPermission())}>Permitir notificações do navegador</button>
              )}
            </div>
            <p className="text-xs text-dim">Os lembretes funcionam enquanto o NUTRI//FLOW estiver aberto em uma aba. No máximo um aviso por horário, sem repetição.</p>
          </div>
        )}
      </Section>

      <Section n="03" title="Integrações">
        <div className="flex items-center justify-between gap-4 border border-line p-4">
          <div>
            <p className="font-semibold">AI Nutrition Lab</p>
            <p className="text-sm text-mute">Assistente de IA no servidor (chave nunca exposta ao navegador).</p>
          </div>
          <span className={`chip ${aiConfigured ? "chip-volt" : "chip-amber"}`}>{aiConfigured ? "Configurado" : "Configuração pendente"}</span>
        </div>
      </Section>

      <Section n="04" title="Privacidade e dados">
        <p className="text-sm text-mute">Seus dados ficam isolados por usuário no banco (Row Level Security). Você pode exportá-los ou excluí-los a qualquer momento (LGPD, art. 18).</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="btn btn-ghost"
            onClick={() =>
              start(async () => {
                const json = await exportMyData();
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
                a.download = `nutriflow-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
              })
            }
          >
            <Download size={14} /> Exportar meus dados (JSON)
          </button>
          <form action={logoutAction}><button className="btn btn-quiet"><LogOut size={14} /> Sair</button></form>
        </div>

        <div className="mt-10 border border-danger/40 p-5">
          <h3 className="flex items-center gap-2 font-semibold text-danger"><Trash2 size={16} /> Excluir conta</h3>
          <p className="mt-2 text-sm text-mute">Remove permanentemente sua conta e todos os registros: diário, pesagens, planos, receitas e conversas. Não é possível desfazer.</p>
          {!canDelete && <div className="mt-3"><FormMessage tone="info">A exclusão está indisponível neste servidor: falta configurar SUPABASE_SERVICE_ROLE_KEY.</FormMessage></div>}
          <label className="mt-4 block text-sm text-mute">Digite seu e-mail para confirmar
            <input className="field mt-2" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={email} autoComplete="off" />
          </label>
          {delError && <p className="mt-2 text-sm text-danger" role="alert">{delError}</p>}
          <button
            className="btn btn-danger mt-4"
            disabled={!canDelete || confirm.trim().toLowerCase() !== email.toLowerCase() || pending}
            onClick={() =>
              start(async () => {
                const r = await deleteAccount(confirm);
                if (!r.ok) return setDelError(r.error);
                router.replace("/?conta=excluida");
                router.refresh();
              })
            }
          >
            Excluir conta definitivamente
          </button>
        </div>
      </Section>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 grid gap-4 border-t border-line pt-8 md:grid-cols-[12rem_1fr]">
      <div><span className="num text-xs text-dim">{n}</span><h2 className="display mt-1 text-3xl">{title}</h2></div>
      <div>{children}</div>
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 border border-line p-4 text-left hover:border-line-strong">
      <span className="font-semibold">{label}</span>
      <span className={`relative h-6 w-11 shrink-0 transition-colors ${checked ? "bg-volt" : "bg-graphite-3"}`} aria-hidden>
        <span className={`absolute top-1 h-4 w-4 transition-all ${checked ? "left-6 bg-volt-ink" : "left-1 bg-mute"}`} />
      </span>
    </button>
  );
}
