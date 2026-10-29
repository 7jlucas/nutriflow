"""
Gera supabase/migrations/20261027000200_seed_taco.sql a partir da planilha oficial
TACO 4ª edição (NEPA/UNICAMP, 2011): original-Taco_4a_edicao_2011.xls

Uso: python3 scripts/build_taco_seed.py caminho/original-Taco_4a_edicao_2011.xls

Regras de normalização (legenda da própria TACO):
  - "NA"  (não aplicável)          -> 0 para macronutrientes e fibra, null em energia/sódio; flag "NA"
  - "Tr"  (traço, < 0,5 un.)        -> 0, flag "Tr"
  - "*"   (amostra em reavaliação)  -> null, flag "*"   (dado ausente: NÃO inventamos)
  - vazio                           -> null, flag "missing"
Valores por 100 g de parte comestível.
"""
import sys, json, xlrd

COLS = {"kcal": 3, "protein_g": 5, "fat_g": 6, "carbs_g": 8, "fiber_g": 9, "sodium_mg": 17}
NA_AS_ZERO = {"fiber_g", "carbs_g", "protein_g", "fat_g"}  # "não aplicável" = ausente no alimento
# Bebidas e laticínios líquidos: conversão ml->g aproximada (densidade ~1). Sinalizada como estimativa.
LIQUID_CATEGORIES = {"Bebidas (alcoólicas e não alcoólicas)"}
LIQUID_NAMES = {"Leite, de vaca, desnatado, UHT", "Leite, de vaca, integral", "Leite, de coco",
                "Bebida láctea, pêssego", "Iogurte, natural", "Iogurte, natural, desnatado",
                "Soja, extrato solúvel, natural, fluido", "Leite, de vaca, achocolatado"}

def clean_name(name):
    import re
    name = re.sub(r"\s+", " ", name).strip()
    # remove notas de rodapé numéricas da planilha ("Cerveja, pilsen 2")
    name = re.sub(r"(?<=[a-zà-ú]) [0-9]$", "", name)
    return name

def is_liquid(name, category):
    if category in LIQUID_CATEGORIES:
        return True
    if name in LIQUID_NAMES:
        return True
    return (", suco" in name or name.startswith("Suco")) and "pó" not in name

def sql_str(s):
    return "'" + s.replace("'", "''") + "'"

def main(path):
    sh = xlrd.open_workbook(path).sheet_by_index(0)
    category = None
    rows = []
    for r in range(3, sh.nrows):
        c0 = sh.cell(r, 0).value
        name = clean_name(str(sh.cell(r, 1).value))
        if isinstance(c0, str):
            label = c0.strip()
            if label and not name and not label.startswith("Número") and len(label) < 60:
                category = label
            continue
        taco_id = int(c0)
        vals, flags = {}, {}
        for key, col in COLS.items():
            v = sh.cell(r, col).value
            if isinstance(v, float):
                vals[key] = round(v, 1) if key != "sodium_mg" else round(v)
            else:
                t = str(v).strip()
                if t == "Tr":
                    vals[key], flags[key] = 0, "Tr"
                elif t == "NA":
                    vals[key] = 0 if key in NA_AS_ZERO else None
                    flags[key] = "NA"
                elif t == "*":
                    vals[key], flags[key] = None, "*"
                else:
                    vals[key], flags[key] = None, "missing"
        liquid = is_liquid(name, category)
        rows.append((taco_id, name, category, vals, flags, liquid))

    out = ["-- Gerado por scripts/build_taco_seed.py — NÃO editar manualmente.",
           "-- Fonte: TACO – Tabela Brasileira de Composição de Alimentos, 4ª ed. revisada e ampliada.",
           "-- NEPA/UNICAMP, Campinas, 2011. Valores por 100 g de parte comestível.",
           "insert into public.foods (source, source_ref, source_version, verified, name, category, ref_amount, ref_unit,",
           "  kcal, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, nutrient_flags, density_g_per_ml, density_is_estimate) values"]
    lines = []
    for taco_id, name, cat, v, f, liquid in rows:
        def n(k):
            return "null" if v[k] is None else repr(v[k])
        lines.append("  ('TACO', %s, '4ª ed. 2011', true, %s, %s, 100, 'g', %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)" % (
            sql_str(str(taco_id)), sql_str(name), sql_str(cat or "Outros"),
            n("kcal"), n("protein_g"), n("carbs_g"), n("fat_g"), n("fiber_g"), n("sodium_mg"),
            sql_str(json.dumps(f, ensure_ascii=False)), "1.0" if liquid else "null", "true" if liquid else "false"))
    out.append(",\n".join(lines) + "\non conflict (source, source_ref) where owner_id is null do nothing;")
    sys.stdout.write("\n".join(out) + "\n")
    sys.stderr.write(f"{len(rows)} alimentos, {sum(1 for r in rows if r[5])} líquidos\n")

if __name__ == "__main__":
    main(sys.argv[1])
