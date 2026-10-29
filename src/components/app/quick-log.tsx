"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/sheet";
import { FoodLogger } from "./food-logger";
import { suggestSlot, type MealDef } from "@/lib/nutrition/meals";
import { todayISO, formatDateLong } from "@/lib/dates";
import type { DiaryEntry, Food } from "@/lib/types";

interface OpenOpts {
  slot?: string;
  date?: string;
  food?: Food;
}
const Ctx = createContext<(o?: OpenOpts) => void>(() => {});
export const useQuickLog = () => useContext(Ctx);

export const DIARY_EVENT = "nutriflow:diary-added";

/** Registro de alimento acessível de qualquer tela (botão "+ Registrar alimento"). */
export function QuickLogProvider({ children, meals, favorites, recent }: { children: React.ReactNode; meals: MealDef[]; favorites: Food[]; recent: Food[] }) {
  const [state, setState] = useState<{ open: boolean; slot: string; date: string; food: Food | null }>({ open: false, slot: "breakfast", date: "", food: null });
  const router = useRouter();
  const open = useCallback((o?: OpenOpts) => {
    setState({ open: true, slot: o?.slot ?? suggestSlot(), date: o?.date ?? todayISO(), food: o?.food ?? null });
  }, []);
  const onAdded = useCallback(
    (e: DiaryEntry) => {
      window.dispatchEvent(new CustomEvent<DiaryEntry>(DIARY_EVENT, { detail: e }));
      router.refresh();
    },
    [router],
  );
  return (
    <Ctx.Provider value={open}>
      {children}
      <Sheet
        open={state.open}
        onClose={() => setState((s) => ({ ...s, open: false }))}
        title="Registrar alimento"
        description={state.date ? `Diário de ${formatDateLong(state.date)}` : undefined}
      >
        {state.open && <FoodLogger date={state.date} slot={state.slot} meals={meals} favorites={favorites} recent={recent} onAdded={onAdded} initialFood={state.food} />}
      </Sheet>
    </Ctx.Provider>
  );
}
