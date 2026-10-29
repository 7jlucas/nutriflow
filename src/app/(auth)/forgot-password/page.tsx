"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { forgotPasswordAction, type FormState } from "../actions";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState<FormState, FormData>(forgotPasswordAction, {});
  return (
    <>
      <h1 className="display text-[clamp(3.5rem,8vw,6rem)]">
        Reset<span className="text-volt">.</span>
      </h1>
      <p className="mt-4 text-mute">Informe seu e-mail e enviaremos um link para criar uma nova senha.</p>
      <form action={action} className="mt-10 space-y-5" noValidate>
        {state.message && <FormMessage tone={state.ok ? "success" : "error"}>{state.message}</FormMessage>}
        <Field label="E-mail" name="email" type="email" autoComplete="email" required error={state.errors?.email} />
        <SubmitButton pendingLabel="Enviando…">Enviar link</SubmitButton>
        <p className="text-center text-sm text-mute">
          <Link href="/login" className="text-bone underline underline-offset-4 hover:text-volt">Voltar ao login</Link>
        </p>
      </form>
    </>
  );
}
