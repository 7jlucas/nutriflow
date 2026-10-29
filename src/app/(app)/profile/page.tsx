import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import { getLatestWeight, getProfile, getTargets } from "@/lib/data/queries";
import { ProfileForm } from "@/components/app/profile-form";
import { draftFrom } from "@/lib/profile-draft";
import { ManualTarget } from "./manual-target";

export const metadata: Metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const { supabase, user } = await requireUser();
  const [profile, weight, targets] = await Promise.all([getProfile(supabase, user.id), getLatestWeight(supabase), getTargets(supabase)]);
  return (
    <div className="mx-auto max-w-[1100px] px-5 py-6 md:px-10 md:py-10">
      <p className="eyebrow">Perfil nutricional · {user.email}</p>
      <h1 className="display mt-2 text-[clamp(2.8rem,7vw,5rem)]">Perfil</h1>
      <p className="mt-2 max-w-[60ch] text-sm text-mute">Edite qualquer informação. Ao salvar, recalculamos a meta estimada a partir de hoje. O histórico de metas anteriores é preservado.</p>
      <div className="mt-10">
        <ProfileForm mode="edit" initial={draftFrom(profile, weight?.weight_kg ? Number(weight.weight_kg) : null)} />
      </div>
      <ManualTarget targets={[...targets].reverse()} />
    </div>
  );
}
