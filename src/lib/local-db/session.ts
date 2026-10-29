import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Sessão do modo local (sem Supabase): cookie assinado com HMAC contendo o id do usuário.
 * Só existe para testes na máquina do desenvolvedor; não é um mecanismo de produção.
 */
export const LOCAL_SESSION_COOKIE = "nf-local-session";
const SECRET = process.env.LOCAL_AUTH_SECRET ?? "nutriflow-local-demo";
const MAX_AGE_S = 60 * 60 * 24 * 30;

function sign(payload: string) {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function createSessionToken(userId: string) {
  const payload = `${userId}.${Math.floor(Date.now() / 1000) + MAX_AGE_S}`;
  return `${payload}.${sign(payload)}`;
}

/** Retorna o id do usuário se o token for válido e não expirado. */
export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  const expected = Buffer.from(sign(`${userId}.${exp}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(exp) * 1000 < Date.now()) return null;
  return userId;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_S,
  secure: process.env.NODE_ENV === "production",
};
