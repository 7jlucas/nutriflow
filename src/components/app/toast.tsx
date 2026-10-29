"use client";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Check, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type Tone = "success" | "error" | "info";
interface Toast {
  id: number;
  tone: Tone;
  message: string;
  action?: { label: string; onClick: () => void };
}

const Ctx = createContext<(t: Omit<Toast, "id">) => void>(() => {});

/** Feedback imediato das ações (com "desfazer" quando aplicável). Anunciado a leitores de tela. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const region = useRef<HTMLDivElement>(null);
  // Popover na camada superior: avisos ficam visíveis inclusive sobre painéis modais (<dialog>)
  useEffect(() => {
    const el = region.current as (HTMLDivElement & { showPopover?: () => void; hidePopover?: () => void }) | null;
    if (!el?.showPopover) return;
    try {
      if (toasts.length) {
        if (el.matches(":popover-open")) el.hidePopover!();
        el.showPopover();
      } else if (el.matches(":popover-open")) el.hidePopover!();
    } catch {}
  }, [toasts.length]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = ++seq.current;
      setToasts((list) => [...list.slice(-2), { ...t, id }]);
      window.setTimeout(() => dismiss(id), t.action ? 6000 : 3200);
    },
    [dismiss],
  );
  return (
    <Ctx.Provider value={push}>
      {children}
      <div ref={region} popover="manual" aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 bottom-24 top-auto z-[70] m-0 flex w-full max-w-none flex-col items-center gap-2 overflow-visible border-0 bg-transparent p-0 px-4 text-bone lg:bottom-6 lg:items-end lg:pr-6 [&:not(:popover-open)]:flex">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              role={t.tone === "error" ? "alert" : "status"}
              className="pointer-events-auto flex w-full max-w-sm items-center gap-3 border border-line-strong bg-graphite-2 px-4 py-3 text-sm shadow-[var(--shadow-pop)]"
            >
              <span className={`grid h-5 w-5 shrink-0 place-items-center ${t.tone === "error" ? "bg-danger text-ink" : t.tone === "success" ? "bg-volt text-volt-ink" : "bg-bone text-ink"}`} aria-hidden>
                {t.tone === "error" ? <AlertTriangle size={12} /> : <Check size={12} strokeWidth={3} />}
              </span>
              <span className="flex-1">{t.message}</span>
              {t.action && (
                <button
                  className="text-xs font-semibold uppercase tracking-wider text-volt hover:underline"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button onClick={() => dismiss(t.id)} className="text-dim hover:text-bone" aria-label="Fechar aviso">
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
