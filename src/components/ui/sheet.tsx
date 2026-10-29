"use client";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * Painel modal acessível baseado em <dialog> nativo (foco preso, Esc fecha, fundo inerte).
 * Desktop: painel lateral. Mobile: folha inferior.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="sheet-title"
      className={`sheet m-0 ml-auto h-dvh max-h-dvh w-full border-0 border-l border-line bg-ink p-0 text-bone backdrop:bg-black/70 backdrop:backdrop-blur-[2px] max-lg:mt-auto max-lg:h-[92dvh] max-lg:max-w-none max-lg:border-l-0 max-lg:border-t ${
        size === "lg" ? "lg:max-w-3xl" : "lg:max-w-xl"
      }`}
    >
      {open && (
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 md:px-7">
            <div>
              <h2 id="sheet-title" className="display text-3xl md:text-4xl">
                {title}
              </h2>
              {description && <p className="mt-1 text-sm text-mute">{description}</p>}
            </div>
            <button onClick={onClose} className="btn btn-quiet h-10 w-10 p-0" aria-label="Fechar">
              <X size={18} />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
        </div>
      )}
    </dialog>
  );
}
