"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { passwordSchema } from "@/lib/validation";
import { signupAction, type FormState } from "../actions";

export function SignupForm() {
  const [state, action] = useActionState<FormState, FormData>(signupAction, {});
  const [pw, setPw] = useState("");
  const checks = [
    { ok: pw.length >= 8, label: "8+ caracteres" },
    { ok: /[A-Za-z]/.test(pw), label: "letras" },
    { ok: /\d/.test(pw), label: "números" },
  ];
  const valid = passwordSchema.safeParse(pw).success;

  if (state.ok) {
    return (
      <div className="mt-10 space-y-6">
        <FormMessage tone="success">{state.message}</FormMessage>
        <Link href="/login" className="btn btn-ghost w-full">Ir para o login</Link>
      </div>
    );
  }

  return (
    <form action={action} className="mt-10 space-y-5" noValidate>
      {state.message && <FormMessage tone="error">{state.message}</FormMessage>}
      <Field label="Nome" name="name" autoComplete="given-name" required maxLength={60} defaultValue={state.values?.name} error={state.errors?.name} />
      <Field label="E-mail" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={state.errors?.email} />
      <div>
        <Field
          label="Senha"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          error={state.errors?.password}
        />
        <ul className="mt-2 flex gap-4 text-xs" aria-label="Requisitos da senha">
          {checks.map((c) => (
            <li key={c.label} className={c.ok ? "text-volt" : "text-dim"}>
              <span aria-hidden>{c.ok ? "■" : "□"}</span> {c.label}
              <span className="sr-only">{c.ok ? " (atendido)" : " (pendente)"}</span>
            </li>
          ))}
        </ul>
      </div>
      <Field label="Confirmar senha" name="confirm" type="password" autoComplete="new-password" required error={state.errors?.confirm} />
      <label className="flex items-start gap-3 text-sm text-mute">
        <input type="checkbox" name="consent" className="mt-1 h-4 w-4 accent-[var(--color-volt)]" required />
        <span>
          Concordo com o tratamento dos meus dados de saúde para personalizar o app, conforme a{" "}
          <Link href="/privacidade" className="text-bone underline underline-offset-4" target="_blank">
            política de privacidade
          </Link>
          .
        </span>
      </label>
      {state.errors?.consent && <p className="text-xs text-danger" role="alert">{state.errors.consent}</p>}
      <SubmitButton pendingLabel="Criando conta…">{valid ? "Criar minha conta" : "Criar conta"}</SubmitButton>
      <p className="text-center text-sm text-mute">
        Já tem conta?{" "}
        <Link href="/login" className="text-bone underline underline-offset-4 hover:text-volt">
          Entrar
        </Link>
      </p>
    </form>
  );
}
