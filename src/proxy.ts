import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { LOCAL_SESSION_COOKIE, verifySessionToken } from "@/lib/local-db/session";

const PRIVATE = ["/dashboard", "/diary", "/foods", "/plan", "/lab", "/recipes", "/progress", "/reports", "/profile", "/settings", "/onboarding"];
const AUTH_PAGES = ["/login", "/signup"];

/**
 * Renova a sessão do Supabase a cada navegação e faz a checagem otimista de acesso.
 * A autorização real acontece no banco (RLS) e em requireUser() nas páginas.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;
  const isPrivate = PRIVATE.some((p) => path === p || path.startsWith(p + "/"));

  if (!url || !key) {
    // modo local: sessão em cookie assinado (src/lib/local-db/session.ts)
    return gate(request, path, isPrivate, Boolean(verifySessionToken(request.cookies.get(LOCAL_SESSION_COOKIE)?.value)), NextResponse.next());
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getClaims valida o JWT (localmente com chaves assimétricas; via Auth com HS256)
  const { data } = await supabase.auth.getClaims();
  return gate(request, path, isPrivate, Boolean(data?.claims?.sub), response);
}

function gate(request: NextRequest, path: string, isPrivate: boolean, signedIn: boolean, response: NextResponse) {
  if (isPrivate && !signedIn) {
    const to = new URL("/login", request.url);
    to.searchParams.set("next", path);
    return NextResponse.redirect(to);
  }
  if (signedIn && AUTH_PAGES.includes(path) && !request.nextUrl.searchParams.has("expirada")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)"],
};
