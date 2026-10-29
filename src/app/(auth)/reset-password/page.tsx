"use client";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { resetPasswordAction, type FormState } from "../actions";

export default function ResetPasswordPage() {
  const [state, action] = useActionState<FormState, FormData>(resetPasswordAction, {});
  return (
    <>
      <h1 className="display text-[clamp(3.5rem,8vw,6rem)]">
        New <span className="text-volt">key.</span>
      </h1>
      <p className="mt-4 text-mute">Defina sua nova senha.</p>
      <form action={action} className="mt-10 space-y-5" noValidate>
        {state.message && <FormMessage tone="error">{state.message}</FormMessage>}
        <Field label="Nova senha" name="password" type="password" autoComplete="new-password" required error={state.errors?.password} hint="Mínimo de 8 caracteres, com letras e números." />
        <Field label="Confirmar nova senha" name="confirm" type="password" autoComplete="new-password" required error={state.errors?.confirm} />
        <SubmitButton pendingLabel="Salvando…">Salvar nova senha</SubmitButton>
      </form>
    </>
  );
}
