"use client";
import { useEffect, useRef } from "react";
import { useToast } from "./toast";

/** Lembretes locais enquanto o app está aberto. Um aviso por horário por dia, sem repetição. */
export function Reminders({ enabled, times }: { enabled: boolean; times: string[] }) {
  const toast = useToast();
  const fired = useRef(new Set<string>());
  useEffect(() => {
    if (!enabled || !times.length) return;
    const tick = () => {
      const now = new Date();
      const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const key = `${now.toDateString()}-${hm}`;
      if (!times.includes(hm) || fired.current.has(key)) return;
      fired.current.add(key);
      const msg = "Hora de registrar sua refeição no diário.";
      if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
        new Notification("NUTRI//FLOW", { body: msg, tag: key });
      } else toast({ tone: "info", message: msg });
    };
    const id = window.setInterval(tick, 20000);
    return () => window.clearInterval(id);
  }, [enabled, times, toast]);
  return null;
}
