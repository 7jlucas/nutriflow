/** Espelho JS dos tokens de src/app/globals.css (gráficos SVG, Recharts, Three.js). */
export const color = {
  ink: "#0A0A0A",
  graphite: "#171515",
  graphite2: "#1F1C1C",
  graphite3: "#2A2626",
  line: "rgba(244,241,241,0.09)",
  lineStrong: "rgba(244,241,241,0.18)",
  bone: "#F4F1F1",
  mute: "#A8A2A2",
  dim: "#928B8B",
  volt: "#FF2A3D",
  danger: "#FF6B6B",
  amber: "#FFB547",
  protein: "#3987E5",
  carbs: "#199E70",
  fat: "#D95926",
} as const;

export const ease = {
  outExpo: [0.16, 1, 0.3, 1] as [number, number, number, number],
  inOutQuart: [0.76, 0, 0.24, 1] as [number, number, number, number],
};

export const duration = { fast: 0.14, base: 0.24, slow: 0.52 } as const;
