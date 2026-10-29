/**
 * Amostras REAIS da TACO 4ª ed. (NEPA/UNICAMP, 2011), por 100 g, usadas nas
 * demonstrações da landing page. Mesmos valores da migration de seed.
 */
export const TACO_SAMPLES = [
  { ref: "3", name: "Arroz, tipo 1, cozido", short: "Arroz branco cozido", kcal: 128.3, protein_g: 2.5, carbs_g: 28.1, fat_g: 0.2, fiber_g: 1.6 },
  { ref: "410", name: "Frango, peito, sem pele, grelhado", short: "Peito de frango grelhado", kcal: 159.2, protein_g: 32.0, carbs_g: 0, fat_g: 2.5, fiber_g: 0 },
  { ref: "561", name: "Feijão, carioca, cozido", short: "Feijão carioca cozido", kcal: 76.4, protein_g: 4.8, carbs_g: 13.6, fat_g: 0.5, fiber_g: 8.5 },
  { ref: "182", name: "Banana, prata, crua", short: "Banana prata", kcal: 98.2, protein_g: 1.3, carbs_g: 26.0, fat_g: 0.1, fiber_g: 2.0 },
  { ref: "7", name: "Aveia, flocos, crua", short: "Aveia em flocos", kcal: 393.8, protein_g: 13.9, carbs_g: 66.6, fat_g: 8.5, fiber_g: 9.1 },
] as const;

export const TACO_COMPARE = {
  a: { ref: "3", short: "Arroz branco cozido", kcal: 128.3, protein_g: 2.5, carbs_g: 28.1, fat_g: 0.2, fiber_g: 1.6 },
  b: { ref: "1", short: "Arroz integral cozido", kcal: 123.5, protein_g: 2.6, carbs_g: 25.8, fat_g: 1.0, fiber_g: 2.7 },
};

export const TACO_SWAP = {
  from: { ref: "91", short: "Batata inglesa cozida", kcal: 51.6, fiber_g: 1.3 },
  to: { ref: "88", short: "Batata-doce cozida", kcal: 76.8, fiber_g: 2.2 },
};

export const TACO_CITATION = "TACO (Tabela Brasileira de Composição de Alimentos), 4ª ed. NEPA/UNICAMP, 2011";
