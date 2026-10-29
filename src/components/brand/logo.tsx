import Link from "next/link";

/** Marca: NUTRI//FLOW. As barras duplas são o símbolo: fluxo e precisão. */
export function Logo({ href = "/", compact = false, className = "" }: { href?: string; compact?: boolean; className?: string }) {
  return (
    <Link href={href} className={`group inline-flex items-center gap-2 ${className}`} aria-label="NUTRI//FLOW, início">
      <svg width="22" height="22" viewBox="0 0 64 64" aria-hidden className="shrink-0">
        <path d="M22 50 36 14h6L28 50zM34 50 48 14h6L40 50z" fill="var(--color-volt)" />
        <rect x="10" y="44" width="10" height="6" fill="var(--color-bone)" className="transition-transform duration-300 group-hover:translate-x-1" />
      </svg>
      {!compact && (
        <span className="font-[family-name:var(--font-display)] text-[1.35rem] font-extrabold uppercase leading-none tracking-[0.02em]">
          Nutri<span className="text-volt">{"//"}</span>Flow
        </span>
      )}
    </Link>
  );
}
