/** Traduz erros do Supabase Auth para mensagens claras, sem vazar detalhes internos. */
export function authErrorMessage(err: { message?: string; code?: string; status?: number } | null | undefined): string {
  if (!err) return "Algo deu errado. Tente novamente.";
  const code = err.code ?? "";
  const msg = (err.message ?? "").toLowerCase();
  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (code === "user_already_exists" || code === "email_exists" || msg.includes("already registered")) return "Já existe uma conta com este e-mail. Tente entrar.";
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (code === "weak_password" || msg.includes("password should")) return "Senha fraca. Use pelo menos 8 caracteres com letras e números.";
  if (code === "same_password") return "A nova senha precisa ser diferente da anterior.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || err.status === 429) return "Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo.";
  if (code === "signup_disabled") return "Novos cadastros estão desativados no momento.";
  if (msg.includes("fetch") || msg.includes("network")) return "Não foi possível conectar ao servidor. Verifique sua conexão.";
  return "Não foi possível concluir. Tente novamente em instantes.";
}
