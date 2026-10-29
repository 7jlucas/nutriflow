export const TAG_LABEL: Record<string, string> = {
  vegetariano: "Vegetariano", vegano: "Vegano", "sem-lactose": "Sem lactose", "sem-gluten": "Sem glúten", "sem-ovo": "Sem ovo",
  "sem-peixe": "Sem peixe", "sem-castanhas": "Sem castanhas", "sem-soja": "Sem soja", "alto-proteina": "Mais proteína",
};
export const tagLabel = (t: string) => TAG_LABEL[t] ?? t.replaceAll("-", " ");
