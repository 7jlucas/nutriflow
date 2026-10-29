import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data/queries";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Configurações e privacidade" };

export default async function SettingsPage() {
  const { supabase, user } = await requireUser();
  const profile = await getProfile(supabase, user.id);
  return (
    <SettingsView
      email={user.email ?? ""}
      prefs={{ water_enabled: profile?.water_enabled ?? true, water_goal_ml: profile?.water_goal_ml ?? 2000, reminders_enabled: profile?.reminders_enabled ?? false, reminder_times: (profile?.reminder_times ?? []).map((t) => t.slice(0, 5)) }}
      canDelete={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY)}
      aiConfigured={Boolean(process.env.ANTHROPIC_API_KEY)}
    />
  );
}
