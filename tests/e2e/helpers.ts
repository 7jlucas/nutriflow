import { expect, type Page } from "@playwright/test";

export const SHOTS = process.env.SHOTS_DIR;
export async function shot(page: Page, name: string, fullPage = false) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage });
}

/** Cria conta + onboarding completo. Retorna o e-mail. */
export async function signupAndOnboard(page: Page, opts: { lactose?: boolean } = {}) {
  const email = `e2e${Date.now()}${Math.floor(Math.random() * 1000)}@teste.dev`;
  await page.goto("/signup");
  await page.getByLabel("Nome").fill("Ana Souza");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("senha1234");
  await page.getByLabel("Confirmar senha").fill("senha1234");
  await page.locator("input[name=consent]").check();
  await page.getByRole("button", { name: /Criar/ }).click();
  await page.waitForURL("**/onboarding");
  await page.getByLabel("Idade (anos)").fill("32");
  await page.getByLabel("Altura (cm)").fill("165");
  await page.getByRole("radio", { name: "Feminino" }).click();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.getByLabel("Peso atual (kg)").fill("68.5");
  await page.getByRole("radio", { name: /Emagrecer/ }).click();
  await page.getByLabel(/Meta de peso/).fill("63");
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.getByRole("radio", { name: /Moderado/ }).click();
  await page.getByRole("button", { name: /Continuar/ }).click();
  if (opts.lactose) await page.getByRole("button", { name: "Lactose", exact: true }).click();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await expect(page.getByText("1.730")).toBeVisible();
  await page.getByRole("button", { name: /Concluir/ }).click();
  await page.waitForURL("**/dashboard**");
  return email;
}
