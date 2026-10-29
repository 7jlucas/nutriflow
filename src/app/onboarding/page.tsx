import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { getLatestWeight, getProfile } from "@/lib/data/queries";
import { ProfileForm } from "@/components/app/profile-form";
import { draftFrom } from "@/lib/profile-draft";
import { Logo } from "@/components/brand/logo";
import { logoutAction } from "@/app/(auth)/actions";

export const metadata: Metadata = { title: "Configurar perfil" };

export default async function OnboardingPage() {
  const { supabase, user } = await requireUser();
  const [profile, weight] = await Promise.all([getProfile(supabase, user.id), getLatestWeight(supabase)]);
  if (profile?.onboarding_completed_at) redirect("/dashboard");
  return (
    <div className="min-h-dvh">
      <header className="flex h-16 items-center justify-between border-b border-line px-5 md:px-10">
        <Logo href="/onboarding" />
        <form action={logoutAction}>
          <button className="btn btn-quiet btn-sm">Sair</button>
        </form>
      </header>
      <main id="conteudo" className="mx-auto max-w-2xl px-5 py-10 md:py-16">
        <ProfileForm mode="onboarding" initial={draftFrom(profile, weight?.weight_kg ?? null)} />
      </main>
    </div>
  );
}
