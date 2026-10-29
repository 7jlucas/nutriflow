export const fmt0 = (n: number | null | undefined) => (n === null || n === undefined ? "-" : Math.round(n).toLocaleString("pt-BR"));
export const fmt1 = (n: number | null | undefined) =>
  n === null || n === undefined ? "-" : n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
export const fmtKg = (n: number | null | undefined) =>
  n === null || n === undefined ? "-" : `${n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;

export const GOAL_LABEL = { lose: "Emagrecer", maintain: "Manter o peso", gain: "Ganhar peso e massa" } as const;
export const SOURCE_LABEL = { TACO: "TACO 4ª ed.", TBCA: "TBCA", LABEL: "Rótulo", USER: "Personalizado" } as const;
