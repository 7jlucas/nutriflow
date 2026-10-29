"use client";
import { useCallback } from "react";

/** Atualiza --mx/--my para o efeito .spotlight (CSS). */
export function useSpotlight() {
  return useCallback((e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }, []);
}

export function SpotlightCard({ className = "", children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  const onMove = useSpotlight();
  return (
    <div {...rest} onPointerMove={onMove} className={`spotlight ${className}`}>
      {children}
    </div>
  );
}
