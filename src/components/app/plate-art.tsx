/**
 * Ilustração editorial do prato, gerada a partir dos ingredientes reais (proporção por peso
 * e cor por grupo alimentar). Determinística. Substitui fotografia quando não há imagem licenciada.
 */
const GROUP_COLORS: [RegExp, string[]][] = [
  [/Cereais/i, ["#d8c9a3", "#c9b68a", "#e4d8bb"]],
  [/Verduras|hortali/i, ["#3f7d3a", "#5c9a46", "#2f6a3a", "#e05a3a"]],
  [/Frutas/i, ["#f2c14e", "#e86f4a", "#c43d5a", "#f08a3c"]],
  [/Carnes/i, ["#a65a3c", "#8c4a32", "#bd7350"]],
  [/Pescados/i, ["#e59a83", "#d9b8a0", "#c9876f"]],
  [/Leguminosas/i, ["#6b4a35", "#8a6240", "#4a3226"]],
  [/Leite/i, ["#f1ede2", "#e8e2d0"]],
  [/Ovos/i, ["#f5d36a", "#f4efe2"]],
  [/Gorduras/i, ["#c9b23a"]],
  [/Nozes/i, ["#9b6b43", "#b9895a"]],
  [/Alimentos preparados|Outros|Miscel/i, ["#b98a5a", "#a87b4f"]],
];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const colorFor = (cat: string | null, i: number) => {
  const g = GROUP_COLORS.find(([re]) => re.test(cat ?? ""));
  const list = g?.[1] ?? ["#9A9393"];
  return list[i % list.length];
};

export function PlateArt({ seed, ingredients, className = "", label }: { seed: string; ingredients: { grams: number; category: string | null; name: string }[]; className?: string; label?: string }) {
  const r = rng(hash(seed));
  // gorduras e itens < 8 g viram "brilho"/salpicado; o resto ocupa setores
  const main = ingredients.filter((i) => i.grams >= 8 && !/Gorduras/i.test(i.category ?? ""));
  const total = main.reduce((a, i) => a + Math.sqrt(i.grams), 0) || 1;
  const start = r() * Math.PI * 2;
  const cx = 200, cy = 200;
  const shares = main.map((ing) => Math.sqrt(ing.grams) / total);
  const starts = shares.map((_, i) => start + shares.slice(0, i).reduce((a, x) => a + x, 0) * Math.PI * 2);
  const blobs = main.map((ing, idx) => {
    const share = shares[idx];
    const span = share * Math.PI * 2;
    const mid = starts[idx] + span / 2;
    const dist = main.length === 1 ? 0 : 58 + r() * 14;
    const rad = 38 + Math.sqrt(share) * 78;
    const x = cx + Math.cos(mid) * dist;
    const y = cy + Math.sin(mid) * dist;
    const pts = 14;
    const path = Array.from({ length: pts }, (_, k) => {
      const a = (k / pts) * Math.PI * 2;
      const rr = rad * (0.82 + r() * 0.3);
      return [x + Math.cos(a) * rr, y + Math.sin(a) * rr * (0.86 + r() * 0.2)];
    });
    const d = path.map(([px, py], k) => {
      const [nx, ny] = path[(k + 1) % pts];
      return `${k ? "" : `M${((px + path[pts - 1][0]) / 2).toFixed(1)},${((py + path[pts - 1][1]) / 2).toFixed(1)} `}Q${px.toFixed(1)},${py.toFixed(1)} ${((px + nx) / 2).toFixed(1)},${((py + ny) / 2).toFixed(1)}`;
    }).join(" ");
    const fill = colorFor(ing.category, idx);
    const grains = Array.from({ length: 10 + Math.round(share * 30) }, () => {
      const a = r() * Math.PI * 2, d2 = r() * rad * 0.7;
      return [x + Math.cos(a) * d2, y + Math.sin(a) * d2, 1.2 + r() * 2.4] as const;
    });
    return { d, fill, grains, key: `${ing.name}-${idx}` };
  });
  const specks = Array.from({ length: 26 }, () => [cx + (r() - 0.5) * 240, cy + (r() - 0.5) * 240, 0.8 + r() * 1.4] as const);
  return (
    <svg viewBox="0 0 400 400" className={className} role="img" aria-label={label ?? "Ilustração do prato"}>
      <defs>
        <radialGradient id={`pl-${seed}`} cx="45%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#2D2828" />
          <stop offset="100%" stopColor="#161313" />
        </radialGradient>
        <radialGradient id={`sh-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="70%" stopColor="#000" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <filter id={`gr-${seed}`}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={hash(seed) % 100} /><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0" /><feComposite in2="SourceGraphic" operator="in" /></filter>
      </defs>
      <rect width="400" height="400" fill="#0F0D0D" />
      <circle cx="212" cy="216" r="182" fill={`url(#sh-${seed})`} />
      <circle cx="200" cy="200" r="176" fill={`url(#pl-${seed})`} />
      <circle cx="200" cy="200" r="176" fill="none" stroke="#3D3737" strokeWidth="1.5" />
      <circle cx="200" cy="200" r="150" fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="1" />
      {blobs.map((b) => (
        <g key={b.key}>
          <path d={b.d} fill={b.fill} />
          {b.grains.map(([gx, gy, gr], k) => <circle key={k} cx={gx} cy={gy} r={gr} fill="#fff" fillOpacity="0.12" />)}
          <path d={b.d} fill="#000" filter={`url(#gr-${seed})`} />
        </g>
      ))}
      {specks.map(([sx, sy, sr], k) => <circle key={k} cx={sx} cy={sy} r={sr} fill="#FF2A3D" fillOpacity="0.18" />)}
    </svg>
  );
}
