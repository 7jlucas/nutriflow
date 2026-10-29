"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

const Scene = dynamic(() => import("./molecule-scene"), { ssr: false, loading: () => null });

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Carrega a cena 3D só depois da primeira pintura e quando há WebGL.
 * Fallback: a mesma escultura em vetor (sempre presente por baixo, para LCP estável).
 */
export function Molecule() {
  const [mode, setMode] = useState<"fallback" | "webgl">("fallback");
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const onFail = useCallback(() => setMode("fallback"), []);
  const onReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (!hasWebGL() || saveData) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => setMode("webgl"), { timeout: 1200 });
    else setTimeout(() => setMode("webgl"), 300);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <MoleculeFallback className={`transition-opacity duration-700 ${mode === "webgl" && ready ? "opacity-0" : "opacity-100"}`} />
      {mode === "webgl" && (
        <div className={`absolute inset-0 transition-opacity duration-1000 ${ready ? "opacity-100" : "opacity-0"}`}>
          <Scene reduced={reduced} onFail={onFail} onReady={onReady} />
        </div>
      )}
    </div>
  );
}

function MoleculeFallback({ className = "" }: { className?: string }) {
  const R = 120;
  const ring = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2;
    return [Math.cos(a) * R, Math.sin(a) * R] as const;
  });
  return (
    <svg viewBox="-380 -330 760 660" className={`absolute inset-0 h-full w-full ${className}`}>
      <defs>
        <radialGradient id="mf-atom" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#3D3737" />
          <stop offset="100%" stopColor="#0E0C0C" />
        </radialGradient>
        <radialGradient id="mf-volt" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FF8A94" />
          <stop offset="100%" stopColor="#A3001A" />
        </radialGradient>
      </defs>
      <ellipse cx="0" cy="0" rx="195" ry="70" fill="none" stroke="#FF2A3D" strokeOpacity="0.4" strokeWidth="1" transform="rotate(-12)" />
      {ring.map(([x, y], i) => {
        const [nx, ny] = ring[(i + 1) % 6];
        return <line key={`b${i}`} x1={x} y1={y} x2={nx} y2={ny} stroke="#3E3838" strokeWidth="6" />;
      })}
      <circle cx="0" cy="0" r="74" fill="url(#mf-atom)" />
      {ring.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="30" fill={i === 1 ? "url(#mf-volt)" : "url(#mf-atom)"} />
      ))}
    </svg>
  );
}
