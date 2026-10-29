import { defineConfig } from "@playwright/test";

/**
 * E2E contra um servidor já em execução (npm run build && npm start) apontando
 * para um Supabase de teste. Define BASE_URL para outro host se necessário.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: process.env.BASE_URL ?? "http://localhost:3000", viewport: { width: 1440, height: 900 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { browserName: "chromium" }, grepInvert: /@mobile/ },
    { name: "mobile", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, grep: /@mobile/ },
  ],
});
