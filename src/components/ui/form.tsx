"use client";
import { useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useId } from "react";

export function Field({
  label,
  name,
  error,
  hint,
  className = "",
  children,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string; children?: React.ReactNode }) {
  const id = useId();
  const describedBy = [error ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="eyebrow mb-2 block text-bone/80">
        {label}
      </label>
      <div className="relative">
        <input id={id} name={name} className="field" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
        {children}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-dim">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="mt-1.5 flex items-center gap-1.5 text-xs text-danger" role="alert">
          <AlertTriangle size={12} aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ children, pendingLabel, className = "btn btn-volt w-full h-12" }: { children: React.ReactNode; pendingLabel?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? (
        <>
          <Loader2 size={16} className="animate-spin" aria-hidden /> {pendingLabel ?? "Enviando…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "success" | "info"; children: React.ReactNode }) {
  const styles = {
    error: "border-danger/40 bg-danger-dim text-bone",
    success: "border-volt/40 bg-volt-dim text-bone",
    info: "border-line-strong bg-graphite text-bone",
  }[tone];
  const Icon = tone === "success" ? CheckCircle2 : AlertTriangle;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-2.5 border px-3.5 py-3 text-sm ${styles}`}>
      <Icon size={16} className={`mt-0.5 shrink-0 ${tone === "error" ? "text-danger" : "text-volt"}`} aria-hidden />
      <div>{children}</div>
    </div>
  );
}
