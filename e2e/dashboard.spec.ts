import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./helpers";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("el filtro de rango se refleja en el panel", async ({ page }) => {
    await page.goto("/?range=7d");
    await expect(page.getByText("Últimos 7 días").first()).toBeVisible();

    await page.goto("/?range=month");
    await expect(page.getByText("Este mes").first()).toBeVisible();
  });
});
