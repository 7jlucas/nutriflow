import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data/queries";
import { todayISO } from "@/lib/dates";
import type { WeightGoal, WeightLog } from "@/lib/types";
import { ProgressView } from "./progress-view";

export const metadata: Metadata = { title: "Progress tracker" };

export default async function ProgressPage() {
  const { supabase, user } = await requireUser();
  const [profile, weights, goals, meas, miles] = await Promise.all([
    getProfile(supabase, user.id),
    supabase.from("weight_logs").select("id, measured_on, weight_kg, note").order("measured_on"),
    supabase.from("weight_goals").select("*").order("created_at", { ascending: false }),
    supabase.from("body_measurements").select("*").order("measured_on", { ascending: false }).limit(30),
    supabase.from("milestones").select("*").order("happened_on", { ascending: false }),
  ]);
  return (
    <ProgressView
      today={todayISO()}
      heightCm={profile?.height_cm ?? null}
      weights={((weights.data ?? []) as WeightLog[]).map((w) => ({ ...w, weight_kg: Number(w.weight_kg) }))}
      goals={(goals.data ?? []) as WeightGoal[]}
      measurements={(meas.data ?? []) as { id: string; measured_on: string; waist_cm: number | null; hip_cm: number | null; chest_cm: number | null; arm_cm: number | null; thigh_cm: number | null }[]}
      milestones={(miles.data ?? []) as { id: string; happened_on: string; title: string }[]}
    />
  );
}
