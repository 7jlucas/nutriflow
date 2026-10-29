import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-line lg:block" aria-label="NUTRI//FLOW">
        <div className="absolute left-10 top-8">
          <Logo />
        </div>
        <svg viewBox="0 0 600 600" className="absolute -bottom-24 -right-24 h-[640px] w-[640px] opacity-90" aria-hidden>
          <g fill="none" stroke="#FF2A3D" strokeOpacity="0.5">
            <circle cx="300" cy="300" r="250" strokeDasharray="2 10" />
            <circle cx="300" cy="300" r="190" strokeOpacity="0.2" />
          </g>
          {Array.from({ length: 6 }).map((_, i) => {
            const a = (i / 6) * Math.PI * 2;
            const x = 300 + Math.cos(a) * 120;
            const y = 300 + Math.sin(a) * 120;
            const b = ((i + 1) / 6) * Math.PI * 2;
            return (
              <g key={i}>
                <line x1={x} y1={y} x2={300 + Math.cos(b) * 120} y2={300 + Math.sin(b) * 120} stroke="#302B2B" strokeWidth="8" />
                <circle cx={x} cy={y} r="26" fill={i === 1 ? "#FF2A3D" : "#1F1C1C"} stroke="#3E3838" />
              </g>
            );
          })}
        </svg>
        <div className="absolute bottom-10 left-10 max-w-[30ch]">
          <p className="eyebrow">NUTRI//FLOW</p>
          <p className="mt-3 text-sm leading-relaxed text-mute">Diário alimentar com dados da TACO, metas estimadas com transparência e evolução no seu ritmo.</p>
        </div>
      </aside>
      <main id="conteudo" className="flex flex-col px-5 py-8 sm:px-10 lg:px-16">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
