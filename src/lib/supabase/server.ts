import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createLocalClient } from "@/lib/local-db/client";
import { requireSupabaseEnv, supabaseEnv } from "./env";

export async function createClient() {
  const cookieStore = await cookies();
  if (supabaseEnv().local) {
    return createLocalClient({
      get: (name) => cookieStore.get(name)?.value,
      set: (name, value, options) => {
        try {
          cookieStore.set(name, value, options);
        } catch {
          // Server Component não grava cookies; só actions e route handlers.
        }
      },
    });
  }
  const { url, key } = requireSupabaseEnv();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chamado de um Server Component: o proxy já renova a sessão.
        }
      },
    },
  });
}

/** Usuário autenticado (validado no servidor de Auth). Redireciona para /login se ausente. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  // ?expirada evita loop quando o cookie é válido mas o usuário não existe mais (ex.: banco local apagado)
  if (error || !data.user) redirect("/login?expirada=1");
  return { supabase, user: data.user };
});
