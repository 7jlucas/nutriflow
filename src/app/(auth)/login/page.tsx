import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <h1 className="display text-[clamp(3.5rem,8vw,6rem)]">
        Welcome
        <br />
        <span className="text-volt">back.</span>
      </h1>
      <p className="mt-4 text-mute">Entre para continuar seu registro.</p>
      <LoginForm next={sp.next ?? ""} linkError={sp.erro === "link"} />
    </>
  );
}
