# NUTRI//FLOW

**YOUR BODY. YOUR DATA. YOUR EVOLUTION.**

Plataforma de acompanhamento nutricional: diário alimentar com dados da TACO, contador de calorias e macros em tempo real, metas estimadas, planos alimentares, receitas, progresso de peso, relatórios e um assistente de IA cujos números são sempre calculados pelo app.

## Início rápido

Requer Node.js 20.9 ou mais recente.

```bash
git clone <url-do-repositório> nutriflow
cd nutriflow
npm install
npm run dev                     # http://localhost:3000
```

Sem nenhuma configuração o app sobe no **modo local** (detalhes abaixo): crie uma conta em `/signup` e use tudo, sem banco externo.

## Funcionalidades

- **Diário alimentar** por refeição, com busca tolerante a acentos e erros de digitação, porções em g/ml/medidas caseiras e totais em tempo real
- **597 alimentos da TACO** (4ª ed.) com legendas da fonte preservadas, mais alimentos personalizados por rótulo
- **Metas estimadas** (Mifflin-St Jeor + atividade) com limites de segurança, ou metas manuais
- **Receitas** com nutrição calculada pelos ingredientes, favoritas e criação própria
- **Planos alimentares** diários e semanais, com lista de compras, separados do consumo real
- **Progresso**: peso, medidas, marcos e água
- **Relatórios** com gráficos e exportação em CSV e PDF
- **AI Nutrition Lab** (opcional): assistente que sugere cardápios usando ferramentas determinísticas do app
- **LGPD**: exportação completa dos dados e exclusão de conta

---

## Stack

| Camada | Escolha |
|---|---|
| App | Next.js 16 (App Router, Turbopack, Server Actions, `proxy.ts`), React 19, TypeScript |
| Estilo | Tailwind CSS v4 com tokens em `src/app/globals.css` (espelhados em `src/lib/design/tokens.ts`) |
| Motion | GSAP + ScrollTrigger + SplitText + MorphSVG (landing), Motion for React (interface) |
| 3D | Three.js puro, carregado sob demanda, com fallback SVG |
| Dados | Supabase (Auth + Postgres + RLS) via `@supabase/ssr`, ou modo local em arquivo JSON para testes |
| Gráficos | Recharts + SVG próprio (instrumento de calorias, sparklines) |
| Validação | Zod 4 (cliente e servidor) |
| IA | Anthropic Messages API via rota de servidor com streaming SSE e tool use (sem SDK) |
| Testes | Vitest (cálculos + integração RLS), Playwright (E2E + axe) |

Fontes tipográficas (OFL, via `next/font/google`, baixadas no build e servidas pelo próprio app): **Archivo** condensada (títulos) e **Instrument Sans** (texto, números tabulares).

## Como rodar

### Modo local (sem Supabase)

Sem `NEXT_PUBLIC_SUPABASE_URL` e chave definidas, o app roda sozinho: auth e dados ficam em `.local-db/nutriflow.json`, criado na primeira execução já com a TACO e as receitas (`src/lib/local-db`). Basta `npm install` e `npm run dev`, criar uma conta em `/signup` e usar. As regras de acesso das policies RLS são aplicadas em memória. Não há envio de e-mail (recuperação de senha não tem efeito). Para recomeçar do zero, apague a pasta `.local-db`. Serve só para testes na sua máquina.

Conta de teste usada na verificação do modo local: `demo@nutriflow.test` / `demo12345`.

### Com Supabase

```bash
npm install
cp .env.example .env.local      # preencha as chaves do Supabase
```

### 1. Banco de dados

**Supabase na nuvem**
```bash
npx supabase link --project-ref SEU_REF
npx supabase db push            # aplica supabase/migrations (schema + RLS + TACO + receitas)
```
Em *Authentication → URL Configuration*, adicione `http://localhost:3000/**` (e o domínio de produção) às Redirect URLs.

**Supabase local** (Docker)
```bash
npx supabase start              # usa supabase/config.toml e aplica as migrations
```
Copie a `API URL`, a `anon/publishable key` e a `service_role key` exibidas para o `.env.local`.

### 2. App
```bash
npm run dev                     # http://localhost:3000
npm run build && npm start      # produção
```

Sem as variáveis do Supabase, o app usa o modo local. A página `/setup` mostra quais variáveis estão definidas.

## Testes

```bash
npm test                        # 40 testes: cálculos (porções, unidades, Mifflin-St Jeor, somas, plano, CSV) e banco do modo local
SUPABASE_TEST_URL=... SUPABASE_TEST_ANON_KEY=... npm run test:integration   # RLS e integridade contra um Supabase real
npm run build && npm start &    # servidor apontando para um Supabase de TESTE
npx playwright test             # E2E desktop + mobile + acessibilidade (axe WCAG A/AA)
```
- O teste do AI Lab roda com `E2E_AI=1` e um servidor com `ANTHROPIC_API_KEY` (ou um mock compatível em `AI_BASE_URL`).
- O teste de recuperação de senha roda com `MAIL_DIR` apontando para a caixa de um SMTP de teste.
- O projeto de teste precisa de **confirmação de e-mail desativada** para os fluxos automatizados de cadastro.

## Arquitetura

```
src/
  app/
    (marketing)/          landing + privacidade
    (auth)/               login, cadastro, recuperação/redefinição de senha + server actions
    (app)/                área autenticada (layout com sidebar/bottom-nav, registro rápido global)
      actions/            server actions: diário, alimentos, perfil, peso/água, plano, receitas, IA
      dashboard diary foods plan lab recipes progress reports profile settings
    api/ai/chat/          rota SSE do AI Nutrition Lab
    onboarding/  setup/  auth/callback/
  components/{landing,app,ui,brand}
  lib/
    nutrition/            cálculos puros e testados (calc, units, energy, meals, plan, diary-state)
    data/                 consultas e cálculo autoritativo no servidor
    ai/                   cliente Anthropic (SSE) + agente com ferramentas determinísticas
    supabase/             clientes server/browser/admin (escolhem o modo local sem variáveis)
    local-db/             modo local: banco em arquivo, auth com cookie assinado e regras de acesso iguais às RLS
  proxy.ts                renovação de sessão e proteção otimista de rotas
supabase/migrations/      schema + RLS + seed TACO (597 alimentos) + 20 receitas
scripts/                  geradores dos seeds a partir da planilha oficial da TACO
```

### Precisão dos dados
- **Fonte:** TACO 4ª ed. (NEPA/UNICAMP, 2011), extraída da planilha oficial por `scripts/build_taco_seed.py`. Valores por 100 g de parte comestível.
- Legendas preservadas em `nutrient_flags`: `Tr` (traço → 0), `NA` (não aplicável → 0 em macros), `*` (amostra em reavaliação → **sem valor**). Ex.: leite de vaca fluido não tem energia na 4ª ed.; o app bloqueia o registro e sugere alternativas ou cadastro por rótulo.
- **Fórmula:** valor da porção = valor de referência × quantidade ÷ quantidade de referência. ml↔g só com densidade cadastrada (bebidas: ≈1 g/ml, marcado como estimativa). Medidas caseiras só com conversão em gramas definida pelo usuário.
- **Autoridade no servidor:** o cliente nunca envia calorias. Server actions leem o alimento/receita do banco (com RLS) e gravam um *snapshot* nutricional no diário. A pré-visualização no cliente usa a mesma biblioteca.
- **Receitas:** nutrição = soma dos ingredientes no estado listado ÷ rendimento; a base do cálculo aparece em cada receita.
- **Planejado ≠ consumido:** `meal_plans`/`meal_plan_items` são separados de `diary_entries`.

### Metas e segurança
Mifflin-St Jeor + fator de atividade; déficit máximo de 500 kcal (≤ 20% do gasto), superávit ≤ 350 kcal, pisos de 1.200/1.500 kcal, alerta para ritmo > 1% do peso/semana. Menores de 18 anos e quem indica gestação/condição médica/histórico de TA **não** recebem meta automática. Metas manuais abaixo de 1.200 kcal exigem confirmação de acompanhamento profissional.

### IA
A IA escolhe; o app calcula. Ferramentas: `search_foods`, `list_recipes` (já filtradas por alergias/restrições), `propose_plan`, `propose_meal`. Os totais exibidos nos cartões vêm de funções determinísticas; receitas que violam restrições são rejeitadas no servidor. O provedor recebe apenas objetivo, metas, restrições e a mensagem, sem nome ou e-mail. Limite de 40 mensagens/hora por usuário.

### Segurança e LGPD
RLS em todas as tabelas (testada em `tests/integration/rls.test.ts`), chave de IA e service role só no servidor, validação Zod no cliente e no servidor, logs sem dados pessoais, exportação completa dos dados (JSON) e exclusão de conta com remoção em cascata.

## Status

| Item | Situação |
|---|---|
| Landing, auth, onboarding, diário, alimentos, receitas, plano, progresso, relatórios, perfil, configurações | Implementado e validado E2E contra Supabase Auth (GoTrue) + PostgREST + Postgres reais |
| AI Nutrition Lab | Implementado e validado com um servidor compatível (mock) da Messages API. **Pendente:** definir `ANTHROPIC_API_KEY` para uso real |
| Lembretes | Funcionam com o app aberto (notificação do navegador ou aviso na tela); push em segundo plano exigiria service worker + VAPID |
| Fotos de receitas | Não incluídas (sem acervo licenciado). Cada receita recebe uma ilustração gerada dos ingredientes; `recipes.image_url` aceita foto própria com crédito |
| TBCA | Estrutura pronta (`source = 'TBCA'`); a TBCA não foi importada por exigir termo de uso/acesso próprio |

O NUTRI//FLOW não substitui acompanhamento com nutricionista ou médico.

## Créditos dos dados

Composição de alimentos: TACO, Tabela Brasileira de Composição de Alimentos, 4ª ed. revisada e ampliada. NEPA/UNICAMP, Campinas, 2011. A planilha original está em `references/`.

## Licença

Código sob a licença [MIT](LICENSE). Os dados da TACO pertencem ao NEPA/UNICAMP e seguem os termos da fonte.
