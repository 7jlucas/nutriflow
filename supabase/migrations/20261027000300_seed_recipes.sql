-- Gerado por scripts/build_recipes_seed.py — receitas da biblioteca NUTRI//FLOW.

-- Valores nutricionais NÃO são digitados: são calculados pelo app a partir dos ingredientes (TACO).

with rec as (
  insert into public.recipes (slug, name, summary, meal_types, prep_minutes, servings, cost_level, tags, goals, steps, basis_note)
  values ('overnight-aveia-banana', 'Overnight de aveia, banana e iogurte', 'Aveia hidratada no iogurte durante a noite. Pronta ao acordar.', array['breakfast']::text[], 5, 1, 1,
          array['vegetariano','sem-ovo','sem-peixe','sem-castanhas','sem-soja']::text[], array['maintain','gain','lose']::public.goal_kind[], array['Misture a aveia e o iogurte em um pote com tampa.','Fatie a banana por cima e regue com o mel.','Tampe e leve à geladeira por pelo menos 6 horas.']::text[], 'Soma dos ingredientes no estado listado (ex.: arroz e feijão já cozidos). Temperos sem valor energético relevante não entram no cálculo.')
  on conflict (slug) do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, position)
select rec.id, f.id, v.grams, v.label, v.pos from rec
join (values ('7', 40, '4 colheres de sopa', 0), ('448', 170, '1 pote', 1), ('182', 80, '1 banana pequena', 2), ('507', 10, '1 colher de chá', 3)) as v(ref, grams, label, pos) on true
join public.foods f on f.source = 'TACO' and f.source_ref = v.ref and f.owner_id is null;

with rec as (
  insert into public.recipes (slug, name, summary, meal_types, prep_minutes, servings, cost_level, tags, goals, steps, basis_note)
  values ('omelete-espinafre-minas', 'Omelete de espinafre e queijo minas', 'Proteína rápida, frigideira única.', array['breakfast','dinner']::text[], 12, 1, 1,
          array['vegetariano','sem-gluten','sem-peixe','sem-castanhas','sem-soja','alto-proteina']::text[], array['lose','maintain','gain']::public.goal_kind[], array['Bata os ovos com uma pitada de sal.','Aqueça o azeite e murche o espinafre por 1 minuto.','Despeje os ovos, distribua o queijo e o tomate picado.','Tampe em fogo baixo até firmar e dobre ao meio.']::text[], 'Soma dos ingredientes no estado listado (ex.: arroz e feijão já cozidos). Temperos sem valor energético relevante não entram no cálculo.')
  on conflict (slug) do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, position)
select rec.id, f.id, v.grams, v.label, v.pos from rec
join (values ('489', 100, '2 ovos', 0), ('119', 30, '1 xícara de folhas', 1), ('461', 30, '1 fatia', 2), ('157', 50, '½ tomate', 3), ('260', 5, '1 colher de chá', 4)) as v(ref, grams, label, pos) on true
join public.foods f on f.source = 'TACO' and f.source_ref = v.ref and f.owner_id is null;

with rec as (
  insert into public.recipes (slug, name, summary, meal_types, prep_minutes, servings, cost_level, tags, goals, steps, basis_note)
  values ('pao-integral-ricota-tomate', 'Pão integral com ricota e tomate', 'Café da manhã leve e salgado.', array['breakfast','afternoon_snack']::text[], 5, 1, 1,
          array['vegetariano','sem-ovo','sem-peixe','sem-castanhas','sem-soja']::text[], array['lose','maintain']::public.goal_kind[], array['Toste o pão, se preferir.','Espalhe a ricota, cubra com o tomate e finalize com azeite, sal e orégano.']::text[], 'Soma dos ingredientes no estado listado (ex.: arroz e feijão já cozidos). Temperos sem valor energético relevante não entram no cálculo.')
  on conflict (slug) do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, position)
select rec.id, f.id, v.grams, v.label, v.pos from rec
join (values ('52', 50, '2 fatias', 0), ('469', 40, '2 colheres de sopa', 1), ('157', 40, '4 rodelas', 2), ('260', 3, 'um fio', 3)) as v(ref, grams, label, pos) on true
join public.foods f on f.source = 'TACO' and f.source_ref = v.ref and f.owner_id is null;

with rec as (
  insert into public.recipes (slug, name, summary, meal_types, prep_minutes, servings, cost_level, tags, goals, steps, basis_note)
  values ('frango-arroz-feijao-brocolis', 'Frango grelhado, arroz integral, feijão e brócolis', 'O prato brasileiro clássico, equilibrado.', array['lunch','dinner']::text[], 30, 1, 2,
          array['sem-lactose','sem-gluten','sem-ovo','sem-peixe','sem-castanhas','sem-soja','alto-proteina']::text[], array['lose','maintain','gain']::public.goal_kind[], array['Tempere o peito de frango com sal, alho e limão e grelhe 5 a 6 minutos de cada lado.','Cozinhe o brócolis no vapor por 4 minutos.','Monte o prato com arroz, feijão, frango e brócolis; finalize com o azeite.']::text[], 'Soma dos ingredientes no estado listado (ex.: arroz e feijão já cozidos). Temperos sem valor energético relevante não entram no cálculo.')
  on conflict (slug) do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, position)
select rec.id, f.id, v.grams, v.label, v.pos from rec
join (values ('410', 120, '1 filé médio', 0), ('1', 120, '4 colheres de sopa', 1), ('561', 100, '1 concha pequena', 2), ('100', 80, '1 xícara', 3), ('260', 5, '1 colher de chá', 4)) as v(ref, grams, label, pos) on true
join public.foods f on f.source = 'TACO' and f.source_ref = v.ref and f.owner_id is null;

with rec as (
  insert into public.recipes (slug, name, summary, meal_types, prep_minutes, servings, cost_level, tags, goals, steps, basis_note)
  values ('patinho-batata-doce-salada', 'Patinho grelhado com batata-doce e salada', 'Carboidrato de digestão lenta e carne magra.', array['lunch','dinner']::text[], 35, 1, 2,
          array['sem-lactose','sem-gluten','sem-ovo','sem-peixe','sem-castanhas','sem-soja','alto-proteina']::text[], array['maintain','gain','lose']::public.goal_kind[], array['Cozinhe a batata-doce com casca até ficar macia (cerca de 25 minutos).','Grelhe o patinho em frigideira bem quente.','Sirva com alface e tomate temperados com azeite e limão.']::text[], 'Soma dos ingredientes no estado listado (ex.: arroz e feijão já cozidos). Temperos sem valor energético relevante não entram no cálculo.')
  on conflict (slug) do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, position)
select rec.id, f.id, v.grams, v.label, v.pos from rec
join (values ('377', 120, '1 bife', 0), ('88', 150, '1 batata média', 1), ('78', 40, '4 folhas', 2), ('157', 60, '½ tomate grande', 3), ('260', 5, '1 colher de chá', 4)) as v(ref, grams, label, pos) on true
join public.foods f on f.source = 'TACO' and f.source_ref = v.ref and f.owner_id is null;

with rec as (
  insert into public.recipes (slug, name, summary, meal_types, prep_minutes, servings, cost_level, tags, goals, steps, basis_note)
  values ('salmao-abobora-brocolis', 'Salmão grelhado com abóbora e brócolis', 'Gordura de boa qualidade e legumes assados.', array['lunch','dinner']::text[], 30, 1, 3,
          array['sem-lactose','sem-gluten','sem-ovo','sem-castanhas','sem-soja','alto-proteina']::text[], array['maintain','lose','gain']::public.goal_kind[], array['Cozinhe a abóbora em cubos até ficar macia.','Grelhe o salmão temperado com sal e limão, 4 minutos de cada lado.','Cozinhe o brócolis no vapor e sirva tudo junto.']::text[], 'Soma dos ingredientes no estado listado (ex.: arroz e feijão já cozidos). Temperos sem valor energético relevante não entram no cálculo.')
  on conflict (slug) do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, position)
select rec.id, f.id, v.grams, v.label, v.pos from rec
join (values ('317', 120, '1 posta', 0), ('64', 150, '1 xícara em cubos', 1), ('100', 80, '1 xícara', 2)) as v(ref, grams, label, pos) on true
join public.foods f on f.source = 'TACO' and f.source_ref = v.ref and f.owner_id is null;

with rec as (
  insert into public.recipes (slug, name, summary, meal_types, prep_minutes, servings, cost_level, tags, goals, steps, basis_note)
  values ('merluza-arroz-legumes', 'Merluza assada com arroz e legumes', 'Peixe branco, leve e econômico.', array['lunch','dinner']::text[], 30, 1, 2,
          array['sem-lactose','sem-gluten','sem-ovo','sem-castanhas','sem-soja','alto-proteina']::text[], array['lose','maintain']::public.goal_kind[], array['Asse a merluza temperada a 200 °C por 15 a 18 minutos.','Cozinhe cenoura e chuchu em cubos.','Sirva com o arroz e regue com azeite.']::text[], 'Soma dos ingredientes no estado listado (ex.: arroz e feijão já cozidos). Temperos sem valor energético relevante não entram no cálculo.')
  on conflict (slug) do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, position)
select rec.id, f.id, v.grams, v.label, v.pos from rec
join (values ('301', 140, '1 filé grande', 0), ('3', 120, '4 colheres de sopa', 1), ('109', 60, '½ cenoura', 2), ('112', 60, '½ chuchu', 3), ('260', 5, '1 colher de chá', 4)) as v(ref, grams, label, pos) on true
join public.foods f on f.source = 'TACO' and f.source_ref = v.ref and f.owner_id is null;

with rec as (
  insert into public.recipes (slug, name, summary, meal_types, prep_minutes, servings, cost_level, tags, goals, steps, basis_note)
  values ('lentilha-arroz-cebola', 'Lentilha com arroz e cebola dourada', 'Versão simples da mujadara. 100% vegetal.', array['lunch','dinner']::text[], 35, 1, 1,
          array['vegano','vegetariano','sem-lactose','sem-gluten','sem-ovo','sem-peixe','sem-castanhas','sem-soja']::text[], array['maintain','gain','lose']::public.goal_kind[], array['Doure a cebola fatiada no azeite em fogo médio-baixo por 12 minutos.','Misture a lentilha e o arroz já cozidos.','Cubra com a cebola dourada e ajuste o sal.']::text[], 'Soma dos ingredientes no estado listado (ex.: arroz e feijão já cozidos). Temperos sem valor energético relevante não entram no cálculo.')
  on conflict (slug) do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, position)
select rec.id, f.id, v.grams, v.label, v.pos from rec
join (values ('577', 150, '¾ de xícara', 0), ('1', 100, '3 colheres de sopa', 1), ('107', 50, '½ cebola', 2), ('260', 10, '1 colher de sopa', 3)) as v(ref, grams, label, pos) on true
join public.foods f on f.source = 'TACO' and f.source_ref = v.ref and f.owner_id is null;

with rec as (
  insert into public.recipes (slug, name, summary, meal_types, prep_minutes, servings, cost_level, tags, goals, steps, basis_note)
  values ('tofu-legumes-arroz', 'Tofu salteado com legumes e arroz integral', 'Proteína vegetal em 15 minutos.', array['lunch','dinner']::text[], 15, 1, 2,
          array['vegano','vegetariano','sem-lactose','sem-gluten','sem-ovo','sem-peixe','sem-castanhas']::text[], array['lose','maintain']::public.goal_kind[], array['Seque o tofu, corte em cubos e doure no óleo.','Junte cenoura e pimentão em tiras e salteie 3 minutos.','Adicione o brócolis já cozido e sirva sobre o arroz.']::text[], 'Soma dos ingredientes no estado listado (ex.: arroz e feijão já cozidos). Temperos sem valor energético relevante não entram no cálculo.')
  on conflict (slug) do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, position)
select rec.id, f.id, v.grams, v.label, v.pos from rec
join (values ('584', 150, '½ bloco', 0), ('100', 80, '1 xícara', 1), ('110', 50, '½ cenoura', 2), ('145', 50, '½ pimentão', 3), ('272', 5, '1 colher de chá', 4), ('1', 100, '3 colheres de sopa', 5)) as v(ref, grams, label, pos) on true
join public.foods f on f.source = 'TACO' and f.source_ref = v.ref and f.owner_id is null;

with rec as (
  insert into public.recipes (slug, name, summary, meal_types, prep_minutes, servings, cost_level, tags, goals, steps, basis_note)
  values ('sardinha-mandioca-salada', 'Sardinha assada com mandioca e salada', 'Ômega-3 com custo baixo.', array['lunch','dinner']::text[], 40, 1, 1,
          array['sem-lactose','sem-gluten','sem-ovo','sem-castanhas','sem-soja','alto-proteina']::text[], array['maintain','gain']::public.goal_kind[], array['Asse as sardinhas temperadas a 220 °C por 20 minutos.','Cozinhe a mandioca até ficar macia.','Sirva com salada de tomate, cebola e pepino.']::text[], 'Soma dos ingredientes no estado listado (ex.: arroz e feijão já cozidos). Temperos sem valor energético relevante não entram no cálculo.')
  on conflict (slug) do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, position)
select rec.id, f.id, v.grams, v.label, v.pos from rec
join (values ('318', 100, '3 sardinhas', 0), ('129', 120, '2 pedaços', 1), ('157', 60, '½ tomate', 2), ('107', 20, 'rodelas', 3), ('142', 50, '½ pepino', 4)) as v(ref, grams, label, pos) on true
join public.foods f on f.source = 'TACO' and f.source_ref = v.ref and f.owner_id is null;

with rec as (
  insert into public.recipes (slug, name, summary, meal_types, prep_minutes, servings, cost_level, tags, goals, steps, basis_note)
  values ('iogurte-morango-aveia', 'Iogurte com morango e aveia', 'Lanche frio, pronto em 2 minutos.', array['morning_snack','afternoon_snack','supper']::text[], 2, 1, 1,
          array['vegetariano','sem-ovo','sem-peixe','sem-castanhas','sem-soja']::text[], array['lose','maintain','gain']::public.goal_kind[], array['Coloque o iogurte em uma tigela, cubra com os morangos picados e a aveia.']::text[], 'Soma dos ingredientes no estado listado (ex.: arroz e feijão já cozidos). Temperos sem valor energético relevante não entram no cálculo.')
  on conflict (slug) do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, position)
select rec.id, f.id, v.grams, v.label, v.pos from rec
join (values ('449', 170, '1 pote', 0), ('239', 100, '7 morangos', 1), ('7', 15, '1 colher de sopa', 2)) as v(ref, grams, label, pos) on true
join public.foods f on f.source = 'TACO' and f.source_ref = v.ref and f.owner_id is null;

with rec as (
  insert into public.recipes (slug, name, summary, meal_types, prep_minutes, servings, cost_level, tags, goals, steps, basis_note)
  values ('maca-castanha', 'Maçã com castanha-do-pará', 'Lanche portátil, sem preparo.', array['morning_snack','afternoon_snack']::text[], 1, 1, 1,
          array['vegano','vegetariano','sem-lactose','sem-gluten','sem-ovo','sem-peixe','sem-soja']::text[], array['lose','maintain','gain']::public.goal_kind[], array['Lave a maçã. Sirva com as castanhas.']::text[], 'Soma dos ingredientes no estado listado (ex.: arroz e feijão já cozidos). Temperos sem valor energético relevante não entram no cálculo.')
  on conflict (slug) do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, position)
select rec.id, f.id, v.grams, v.label, v.pos from rec
join (values ('222', 130, '1 maçã média', 0), ('589', 10, '2 unidades', 1)) as v(ref, grams, label, pos) on true
join public.foods f on f.source = 'TACO' and f.source_ref = v.ref and f.owner_id is null;

with rec as (
  insert into public.recipes (slug, name, summary, meal_types, prep_minutes, servings, cost_level, tags, goals, steps, basis_note)
  values ('sanduiche-atum', 'Sanduíche integral de atum', 'Lanche substancioso para levar.', array['afternoon_snack','dinner']::text[], 7, 1, 2,
          array['sem-ovo','sem-castanhas','sem-soja','alto-proteina']::text[], array['maintain','gain','lose']::public.goal_kind[], array['Misture o atum com o requeijão.','Monte o sanduíche com alface e tomate.']::text[], 'Soma dos ingredientes no estado listado (ex.: arroz e feijão já cozidos). Temperos sem valor energético relevante não entram no cálculo.')
  on conflict (slug) do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, position)
select rec.id, f.id, v.grams, v.label, v.pos from rec
join (values ('52', 50, '2 fatias', 0), ('277', 60, '½ lata, drenado', 1), ('468', 15, '1 colher de sopa', 2), ('78', 15, '2 folhas', 3), ('157', 30, '3 rodelas', 4)) as v(ref, grams, label, pos) on true
join public.foods f on f.source = 'TACO' and f.source_ref = v.ref and f.owner_id is null;

with rec as (
  insert into public.recipes (slug, name, summary, meal_types, prep_minutes, servings, cost_level, tags, goals, steps, basis_note)
  values ('cuscuz-ovo', 'Cuscuz de milho com ovo e azeite', 'Nordeste no café da manhã.', array['breakfast','dinner']::text[], 15, 1, 1,
          array['vegetariano','sem-lactose','sem-gluten','sem-peixe','sem-castanhas','sem-soja']::text[], array['maintain','gain']::public.goal_kind[], array['Prepare o cuscuz na cuscuzeira conforme a embalagem.','Cozinhe o ovo por 10 minutos.','Sirva o cuscuz regado com azeite e o ovo fatiado.']::text[], 'Soma dos ingredientes no estado listado (ex.: arroz e feijão já cozidos). Temperos sem valor energético relevante não entram no cálculo.')
  on conflict (slug) do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, position)
select rec.id, f.id, v.grams, v.label, v.pos from rec
join (values ('533', 150, '1 fatia grossa', 0), ('488', 50, '1 ovo', 1), ('260', 5, '1 colher de chá', 2)) as v(ref, grams, label, pos) on true
join public.foods f on f.source = 'TACO' and f.source_ref = v.ref and f.owner_id is null;

with rec as (
  insert into public.recipes (slug, name, summary, meal_types, prep_minutes, servings, cost_level, tags, goals, steps, basis_note)
  values ('vitamina-banana-aveia', 'Vitamina de banana com aveia', 'Bebida rápida antes ou depois do treino.', array['breakfast','afternoon_snack']::text[], 3, 1, 1,
          array['vegetariano','sem-ovo','sem-peixe','sem-castanhas','sem-soja']::text[], array['gain','maintain']::public.goal_kind[], array['Dissolva o leite em pó em 200 ml de água gelada.','Bata com a banana e a aveia por 30 segundos e sirva.']::text[], 'Leite integral em pó reconstituído: a TACO 4ª ed. marca o leite fluido como amostra em reavaliação (sem valores), por isso usamos o pó. Água sem valor energético.')
  on conflict (slug) do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, position)
select rec.id, f.id, v.grams, v.label, v.pos from rec
join (values ('459', 26, '2 colheres de sopa (leite em pó) + 200 ml de água', 0), ('179', 90, '1 banana', 1), ('7', 20, '2 colheres de sopa', 2)) as v(ref, grams, label, pos) on true
join public.foods f on f.source = 'TACO' and f.source_ref = v.ref and f.owner_id is null;

with rec as (
  insert into public.recipes (slug, name, summary, meal_types, prep_minutes, servings, cost_level, tags, goals, steps, basis_note)
  values ('mamao-linhaca', 'Mamão com linhaça', 'Ceia leve, rica em fibras.', array['supper','morning_snack']::text[], 2, 1, 1,
          array['vegano','vegetariano','sem-lactose','sem-gluten','sem-ovo','sem-peixe','sem-castanhas','sem-soja']::text[], array['lose','maintain']::public.goal_kind[], array['Corte o mamão, retire as sementes e polvilhe a linhaça.']::text[], 'Soma dos ingredientes no estado listado (ex.: arroz e feijão já cozidos). Temperos sem valor energético relevante não entram no cálculo.')
  on conflict (slug) do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, position)
select rec.id, f.id, v.grams, v.label, v.pos from rec
join (values ('226', 150, '½ mamão papaia', 0), ('594', 10, '1 colher de sopa', 1)) as v(ref, grams, label, pos) on true
join public.foods f on f.source = 'TACO' and f.source_ref = v.ref and f.owner_id is null;

with rec as (
  insert into public.recipes (slug, name, summary, meal_types, prep_minutes, servings, cost_level, tags, goals, steps, basis_note)
  values ('sopa-legumes-frango', 'Sopa de legumes com frango', 'Jantar quente e saciante.', array['dinner','supper']::text[], 35, 1, 1,
          array['sem-lactose','sem-gluten','sem-ovo','sem-peixe','sem-castanhas','sem-soja']::text[], array['lose','maintain']::public.goal_kind[], array['Refogue a cebola no azeite.','Junte os legumes em cubos e cubra com água; cozinhe 20 minutos.','Adicione o frango cozido e desfiado e ajuste o sal.']::text[], 'Soma dos ingredientes no estado listado (ex.: arroz e feijão já cozidos). Temperos sem valor energético relevante não entram no cálculo.')
  on conflict (slug) do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, position)
select rec.id, f.id, v.grams, v.label, v.pos from rec
join (values ('408', 80, '½ filé desfiado', 0), ('91', 100, '1 batata pequena', 1), ('109', 60, '½ cenoura', 2), ('70', 80, '½ abobrinha', 3), ('112', 60, '½ chuchu', 4), ('107', 20, '2 colheres de sopa', 5), ('260', 5, '1 colher de chá', 6)) as v(ref, grams, label, pos) on true
join public.foods f on f.source = 'TACO' and f.source_ref = v.ref and f.owner_id is null;

with rec as (
  insert into public.recipes (slug, name, summary, meal_types, prep_minutes, servings, cost_level, tags, goals, steps, basis_note)
  values ('macarrao-bolonhesa', 'Macarrão à bolonhesa', 'Clássico de domingo, porção controlada.', array['lunch','dinner']::text[], 30, 1, 2,
          array['sem-ovo','sem-peixe','sem-castanhas','sem-soja','alto-proteina']::text[], array['maintain','gain']::public.goal_kind[], array['Cozinhe o macarrão em água fervente com sal até ficar al dente.','Aqueça a carne moída já cozida com o molho de tomate.','Misture ao macarrão e finalize com o parmesão.']::text[], 'Macarrão pesado CRU (80 g secos ≈ 1 prato após o cozimento). Carne pesada já cozida.')
  on conflict (slug) do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, position)
select rec.id, f.id, v.grams, v.label, v.pos from rec
join (values ('40', 80, '80 g secos', 0), ('326', 80, '4 colheres de sopa', 1), ('159', 100, '½ xícara', 2), ('464', 10, '1 colher de sopa ralado', 3)) as v(ref, grams, label, pos) on true
join public.foods f on f.source = 'TACO' and f.source_ref = v.ref and f.owner_id is null;

with rec as (
  insert into public.recipes (slug, name, summary, meal_types, prep_minutes, servings, cost_level, tags, goals, steps, basis_note)
  values ('pao-frances-ovo-tomate', 'Pão francês com ovo e tomate', 'Clássico da padaria, sem lactose.', array['breakfast','afternoon_snack']::text[], 10, 1, 1,
          array['vegetariano','sem-lactose','sem-peixe','sem-castanhas','sem-soja']::text[], array['maintain','gain','lose']::public.goal_kind[], array['Cozinhe o ovo por 10 minutos e fatie.','Abra o pão, regue com azeite e monte com ovo e tomate.']::text[], 'Soma dos ingredientes no estado listado (ex.: arroz e feijão já cozidos). Temperos sem valor energético relevante não entram no cálculo.')
  on conflict (slug) do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, position)
select rec.id, f.id, v.grams, v.label, v.pos from rec
join (values ('53', 50, '1 pão', 0), ('488', 50, '1 ovo', 1), ('157', 40, '4 rodelas', 2), ('260', 3, 'um fio', 3)) as v(ref, grams, label, pos) on true
join public.foods f on f.source = 'TACO' and f.source_ref = v.ref and f.owner_id is null;

with rec as (
  insert into public.recipes (slug, name, summary, meal_types, prep_minutes, servings, cost_level, tags, goals, steps, basis_note)
  values ('frutas-aveia', 'Tigela de frutas com aveia', 'Fresca, vegana e sem preparo.', array['breakfast','morning_snack','afternoon_snack']::text[], 5, 1, 1,
          array['vegano','vegetariano','sem-lactose','sem-ovo','sem-peixe','sem-castanhas','sem-soja']::text[], array['lose','maintain','gain']::public.goal_kind[], array['Corte as frutas em cubos.','Cubra com a aveia e sirva.']::text[], 'Soma dos ingredientes no estado listado (ex.: arroz e feijão já cozidos). Temperos sem valor energético relevante não entram no cálculo.')
  on conflict (slug) do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, position)
select rec.id, f.id, v.grams, v.label, v.pos from rec
join (values ('182', 80, '1 banana pequena', 0), ('226', 150, '½ mamão papaia', 1), ('7', 20, '2 colheres de sopa', 2)) as v(ref, grams, label, pos) on true
join public.foods f on f.source = 'TACO' and f.source_ref = v.ref and f.owner_id is null;
