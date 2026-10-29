import type { Metadata } from "next";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignupPage() {
  return (
    <>
      <h1 className="display text-[clamp(3.2rem,7vw,5.5rem)]">
        Start with
        <br />
        what you <span className="text-volt">eat.</span>
      </h1>
      <p className="mt-4 text-mute">Crie sua conta. Leva menos de um minuto.</p>
      <SignupForm />
    </>
  );
}
