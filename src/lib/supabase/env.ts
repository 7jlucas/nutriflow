/**
 * Configuração do Supabase. Sem estas variáveis o app roda no modo local: auth e dados
 * em um arquivo em .local-db/ (src/lib/local-db), só para testes na máquina.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const configured = Boolean(url && key);
  return { url, key, configured, local: !configured };
}

export function requireSupabaseEnv() {
  const env = supabaseEnv();
  if (!env.configured) throw new Error("SUPABASE_NOT_CONFIGURED");
  return env as { url: string; key: string; configured: true };
}
