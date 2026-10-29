import { expect, test } from "@playwright/test";
import { shot, signupAndOnboard } from "./helpers";

test.describe.configure({ mode: "default" });

test("landing: carrega, sem erros de console, CTA leva ao cadastro", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Your body/i);
  // demonstração real: 150 g de arroz cozido = 192,5 kcal (TACO)
  await expect(page.getByText(/× 150 g ÷ 100 g = 192,5 kcal/)).toBeVisible();
  await shot(page, "01-landing");
  await page.getByRole("link", { name: /Começar agora/ }).first().click();
  await page.waitForURL("**/signup");
  expect(errors).toEqual([]);
});

test("rotas privadas exigem login e erros de login são claros", async ({ page }) => {
  await page.goto("/diary");
  await page.waitForURL(/\/login\?next=%2Fdiary/);
  await page.getByLabel("E-mail").fill("ninguem@teste.dev");
  await page.getByLabel("Senha").fill("errada123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "E-mail ou senha incorretos" })).toBeVisible();
  await shot(page, "02-login-error");
});

test("cadastro → onboarding → diário: adicionar, editar sem duplicar, remover e desfazer", async ({ page }) => {
  await signupAndOnboard(page);
  await expect(page.getByRole("heading", { name: /Your daily performance/i })).toBeVisible();
  await shot(page, "03-dashboard-empty", true);

  await page.goto("/diary");
  await page.getByRole("button", { name: /Registrar alimento/ }).first().click();
  await page.getByLabel("Buscar alimento").fill("arroz tipo 1 cozido");
  await page.getByRole("button", { name: /Arroz, tipo 1, cozido/ }).first().click();
  const qty = page.getByLabel("Quantidade");
  await qty.fill("150");
  await expect(page.getByText("128,3 kcal × 150 g ÷ 100 g = 192,5 kcal")).toBeVisible();
  await page.getByLabel("Refeição", { exact: true }).first().selectOption("lunch");
  await page.getByRole("button", { name: /Adicionar ao diário/ }).click();
  await expect(page.getByText(/Adicionado: Arroz, tipo 1, cozido · 193 kcal/)).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();

  const summary = page.locator("dl").filter({ hasText: "Consumido" }).first(); // barra de totais
  await expect(summary).toContainText("193"); // 192,5 arredonda para 193
  await shot(page, "04-diary-one-item", true);

  // editar: 150 g → 200 g. Deve haver UM item com 257 kcal (128,3 × 2 = 256,6)
  await page.getByRole("button", { name: "Editar Arroz, tipo 1, cozido" }).first().click();
  await page.getByLabel("Quantidade").fill("200");
  await page.getByRole("button", { name: /Salvar alteração/ }).click();
  await expect(page.getByRole("button", { name: "Editar Arroz, tipo 1, cozido" })).toHaveCount(2); // nome + lápis do MESMO item
  await expect(summary).toContainText("257");
  await page.reload();
  await expect(page.getByRole("button", { name: "Editar Arroz, tipo 1, cozido" })).toHaveCount(2);
  await expect(page.locator("dl").filter({ hasText: "Consumido" }).first()).toContainText("257");

  // remover e desfazer
  await page.getByRole("button", { name: "Remover Arroz, tipo 1, cozido" }).click();
  await expect(page.locator("dl").filter({ hasText: "Consumido" }).first()).toContainText(/Consumido\s*0/);
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.locator("dl").filter({ hasText: "Consumido" }).first()).toContainText("257");

  // persistência após sair e entrar
  await page.goto("/dashboard");
  await expect(page.getByText("257").first()).toBeVisible();
  await shot(page, "05-dashboard-after-log", true);
});

test("alimento sem dado de energia não pode ser registrado; criar alimento de rótulo", async ({ page }) => {
  await signupAndOnboard(page);
  await page.goto("/foods");
  await page.getByLabel("Buscar alimento").fill("leite de vaca integral");
  await page.getByRole("button", { name: /^Leite, de vaca, integral Leite/ }).first().click();
  await expect(page.getByRole("button", { name: /Registrar no diário/ })).toBeDisabled();
  await expect(page.getByText(/não informa energia/)).toBeVisible();
  await shot(page, "06-foods-missing-data", true);

  await page.getByRole("button", { name: /Criar alimento/ }).first().click();
  await page.getByLabel("Nome").fill("Iogurte grego teste");
  await page.getByLabel("Valores referentes a").fill("100");
  await page.getByLabel("Calorias (kcal)").fill("120");
  await page.getByLabel("Proteínas (g)").fill("10");
  await page.getByLabel("Medida caseira (opcional)").fill("1 pote");
  await page.getByLabel(/Equivale a/).fill("170");
  await page.getByRole("button", { name: /Salvar e usar/ }).click();
  await expect(page.getByRole("heading", { name: "Iogurte grego teste" })).toBeVisible();
  await expect(page.getByText("sem dado").first()).toBeVisible(); // carboidratos não informados ≠ 0
});

test("receitas, plano gerado e registro do planejado no diário", async ({ page }) => {
  await signupAndOnboard(page, { lactose: true });
  await page.goto("/recipes");
  await expect(page.getByText(/receita\(s\)/)).toBeVisible();
  // filtro de restrição ativo: nenhuma receita com lactose (ex.: omelete com queijo)
  await expect(page.getByRole("link", { name: "Omelete de espinafre e queijo minas" })).toHaveCount(0);
  await shot(page, "07-recipes", true);
  await page.getByRole("link", { name: /Frango grelhado, arroz integral/ }).click();
  await expect(page.getByText("480").first()).toBeVisible();
  await page.getByRole("button", { name: /Adicionar 1×/ }).click();
  await expect(page.getByText(/porção\(ões\) · 480 kcal registradas/)).toBeVisible();
  await shot(page, "08-recipe-detail", true);

  await page.goto("/plan");
  await page.getByRole("button", { name: /Gerar plano/ }).click();
  await page.waitForURL(/\/plan\?id=/);
  await expect(page.getByRole("tab")).toHaveCount(7);
  await shot(page, "09-plan", true);
  await page.getByRole("button", { name: "Registrar", exact: true }).first().click();
  await expect(page.getByText("Realizada").first()).toBeVisible();
  await page.getByRole("button", { name: /Lista de compras/ }).click();
  await expect(page.getByRole("heading", { name: "Lista de compras" })).toBeVisible();
  await shot(page, "10-shopping");
});

test("AI Nutrition Lab: streaming, ferramentas e totais calculados pelo app", async ({ page }) => {
  test.skip(!process.env.E2E_AI, "Requer servidor com ANTHROPIC_API_KEY (ou mock em ANTHROPIC_BASE_URL)");
  await signupAndOnboard(page);
  await page.goto("/lab");
  await page.getByRole("button", { name: "Monte um cardápio para hoje dentro da minha meta", exact: true }).click();
  await expect(page.getByText("Totais calculados pelo app")).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/Pronto. Total calculado pelo app/)).toBeVisible();
  await page.getByRole("button", { name: /Salvar como plano/ }).click();
  await expect(page.getByRole("link", { name: /Abrir plano/ })).toBeVisible();
  await shot(page, "11-lab", true);
  // histórico persistido
  await page.reload();
  await page.getByRole("button", { name: /^Monte um cardápio para hoje dentro da minha meta \d/ }).first().click();
  await expect(page.getByText("Totais calculados pelo app")).toBeVisible();
});

test("progresso, relatórios (CSV) e exclusão de conta", async ({ page }) => {
  const email = await signupAndOnboard(page);
  await page.goto("/progress");
  await page.getByLabel("Peso em kg").fill("67,9");
  await page.getByLabel("Data da pesagem").fill("2026-10-20");
  await page.getByRole("button", { name: /Salvar pesagem/ }).click();
  await expect(page.getByText("Pesagem registrada")).toBeVisible();
  await expect(page.getByText("67,9 kg").first()).toBeVisible();
  await shot(page, "12-progress", true);

  await page.goto("/reports?p=month");
  await expect(page.getByRole("heading", { name: "Relatórios" })).toBeVisible();
  await shot(page, "13-reports", true);

  await page.goto("/settings");
  await page.getByPlaceholder(email).fill(email);
  await page.getByRole("button", { name: /Excluir conta definitivamente/ }).click();
  await page.waitForURL("**/?conta=excluida");
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("senha1234");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "E-mail ou senha incorretos" })).toBeVisible();
});

test("mobile @mobile: navegação inferior e registro rápido", async ({ page }) => {
  await signupAndOnboard(page);
  await shot(page, "14-mobile-dashboard", true);
  await page.getByRole("button", { name: "Registrar alimento" }).last().click();
  await page.getByLabel("Buscar alimento").fill("banana prata");
  await page.getByRole("button", { name: /Banana, prata, crua/ }).first().click();
  await shot(page, "15-mobile-logger");
  await page.getByRole("button", { name: /Adicionar ao diário/ }).click();
  await expect(page.getByText(/Adicionado: Banana, prata/)).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();
  await page.getByRole("navigation", { name: "Navegação rápida" }).getByRole("link", { name: "Diário" }).click();
  await expect(page.getByRole("button", { name: /Editar Banana/ }).first()).toBeVisible();
  await shot(page, "16-mobile-diary", true);
});

test("recuperação de senha por e-mail (requer caixa de e-mail de teste)", async ({ page }) => {
  const dir = process.env.MAIL_DIR;
  test.skip(!dir, "Defina MAIL_DIR com o diretório onde o SMTP de teste grava as mensagens");
  const fs = await import("node:fs");
  const email = await signupAndOnboard(page);
  await page.getByRole("button", { name: "Sair" }).first().click();
  await page.waitForURL("**/login");
  const before = new Set(fs.readdirSync(dir!));
  await page.goto("/forgot-password");
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Enviar link" }).click();
  await expect(page.getByText(/Se houver uma conta/)).toBeVisible();
  let link = "";
  for (let i = 0; i < 20 && !link; i++) {
    await page.waitForTimeout(500);
    for (const f of fs.readdirSync(dir!).filter((f: string) => !before.has(f))) {
      const raw = fs.readFileSync(`${dir}/${f}`, "utf8").replace(/=\r?\n/g, "").replace(/=3D/g, "=");
      if (!raw.includes(email)) continue;
      const m = raw.match(/href="([^"]+verify[^"]+)"/);
      if (m) link = m[1].replace(/&amp;/g, "&");
    }
  }
  expect(link).toContain("type=recovery");
  await page.goto(link);
  await page.waitForURL("**/reset-password");
  await page.getByLabel("Nova senha", { exact: true }).fill("novaSenha99");
  await page.getByLabel("Confirmar nova senha").fill("novaSenha99");
  await page.getByRole("button", { name: /Salvar nova senha/ }).click();
  await page.waitForURL("**/dashboard?senha=atualizada");
  await expect(page.getByText("Senha atualizada com sucesso.")).toBeVisible();
});
