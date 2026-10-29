import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signupAndOnboard } from "./helpers";

// auditoria no estado final (sem animações de entrada em andamento)
test.use({ reducedMotion: "reduce" });

async function audit(page: import("@playwright/test").Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  return serious.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

test("acessibilidade (axe, WCAG A/AA): páginas públicas", async ({ page }) => {
  for (const path of ["/", "/login", "/signup", "/forgot-password", "/privacidade"]) {
    await page.goto(path);
    await page.waitForTimeout(2500);
    expect(await audit(page), path).toEqual([]);
  }
});

test("acessibilidade (axe, WCAG A/AA): área autenticada", async ({ page }) => {
  await signupAndOnboard(page);
  for (const path of ["/dashboard", "/diary", "/foods", "/plan", "/recipes", "/progress", "/reports", "/profile", "/settings", "/lab"]) {
    await page.goto(path);
    await page.waitForTimeout(1200);
    expect(await audit(page), path).toEqual([]);
  }
});
