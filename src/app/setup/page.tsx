import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { supabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Configuração pendente" };
export const dynamic = "force-dynamic";

/** Estado honesto de configuração pendente, sem simular backend. */
export default function SetupPage() {
  const env = supabaseEnv();
  const items = [
    { k: "NEXT_PUBLIC_SUPABASE_URL", ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL), d: "URL do projeto Supabase" },
    { k: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", ok: Boolean(env.key), d: "Chave pública (publishable/anon)" },
    { k: "SUPABASE_SERVICE_ROLE_KEY", ok: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY), d: "Somente servidor, usada para excluir contas" },
    { k: "ANTHROPIC_API_KEY", ok: Boolean(process.env.ANTHROPIC_API_KEY), d: "Opcional, habilita o AI Nutrition Lab" },
  ];
  return (
    <main id="conteudo" className="mx-auto max-w-3xl px-5 py-16">
      <Logo />
      <p className="eyebrow mt-14">Status do ambiente</p>
      <h1 className="display mt-3 text-6xl md:text-8xl">{env.configured ? "Pronto." : "Modo local."}</h1>
      {env.local && (
        <p className="mt-6 max-w-[60ch] text-mute">
          Sem Supabase configurado, o app roda com auth e dados num arquivo local em
          <code className="mx-1 text-bone">.local-db/nutriflow.json</code>, já com a TACO e as receitas. Serve só para testar na
          sua máquina: apague o arquivo para recomeçar do zero.
        </p>
      )}
      <p className="mt-6 max-w-[60ch] text-mute">
        Para produção, a área autenticada precisa de um projeto Supabase real (autenticação + Postgres). Defina as variáveis abaixo em
        <code className="mx-1 text-bone">.env.local</code>, aplique as migrations em <code className="text-bone">supabase/migrations</code> e
        reinicie o servidor. O passo a passo está no README.
      </p>
      <ul className="mt-10 divide-y divide-line border border-line">
        {items.map((i) => (
          <li key={i.k} className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <code className="text-sm">{i.k}</code>
              <p className="text-xs text-dim">{i.d}</p>
            </div>
            <span className={`chip ${i.ok ? "chip-volt" : "chip-amber"}`}>{i.ok ? "Definida" : "Ausente"}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
