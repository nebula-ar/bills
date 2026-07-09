import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./helpers";

test.describe("Historial de ventas", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("paginación: 'cargar más' suma ventas", async ({ page }) => {
    await page.goto("/sales");
    const rows = page.getByTestId("sale-row");
    await expect(rows.first()).toBeVisible();

    const before = await rows.count();
    expect(before).toBeGreaterThan(0);

    await page.getByTestId("load-more").click();

    await expect(async () => {
      expect(await rows.count()).toBeGreaterThan(before);
    }).toPass({ timeout: 10_000 });
  });
});
