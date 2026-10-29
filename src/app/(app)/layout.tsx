import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { getFavorites, getMealTypes, getProfile, getRecent } from "@/lib/data/queries";
import { allMeals } from "@/lib/nutrition/meals";
import { AppShell } from "@/components/app/app-shell";
import { QuickLogProvider } from "@/components/app/quick-log";
import { ToastProvider } from "@/components/app/toast";
import { Reminders } from "@/components/app/reminders";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();
  const [profile, mealTypes, favorites, recent] = await Promise.all([
    getProfile(supabase, user.id),
    getMealTypes(supabase),
    getFavorites(supabase),
    getRecent(supabase),
  ]);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");
  return (
    <ToastProvider>
      <QuickLogProvider meals={allMeals(mealTypes)} favorites={favorites} recent={recent}>
        <AppShell userName={profile.display_name ?? user.email ?? ""}>{children}</AppShell>
        <Reminders enabled={profile.reminders_enabled} times={(profile.reminder_times ?? []).map((t) => t.slice(0, 5))} />
      </QuickLogProvider>
    </ToastProvider>
  );
}
