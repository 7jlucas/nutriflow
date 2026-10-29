"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { loginAction, type FormState } from "../actions";

export function LoginForm({ next, linkError }: { next: string; linkError: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(loginAction, {});
  return (
    <form action={action} className="mt-10 space-y-5" noValidate>
      {linkError && <FormMessage tone="error">O link expirou ou é inválido. Solicite um novo.</FormMessage>}
      {state.message && <FormMessage tone="error">{state.message}</FormMessage>}
      <input type="hidden" name="next" value={next} />
      <Field label="E-mail" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={state.errors?.email} />
      <Field label="Senha" name="password" type="password" autoComplete="current-password" required error={state.errors?.password} />
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm text-mute underline-offset-4 hover:text-bone hover:underline">
          Esqueci minha senha
        </Link>
      </div>
      <SubmitButton pendingLabel="Entrando…">Entrar</SubmitButton>
      <p className="text-center text-sm text-mute">
        Ainda não tem conta?{" "}
        <Link href="/signup" className="text-bone underline underline-offset-4 hover:text-volt">
          Criar conta
        </Link>
      </p>
    </form>
  );
}
