import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./helpers";

test.describe("Terminales", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("crear una terminal propia", async ({ page }) => {
    await page.goto("/terminals");
    await page.getByRole("button", { name: "Nueva terminal" }).click();
    await page.locator('input[name="name"]').fill("Silla E2E");
    await page.getByRole("button", { name: "Crear terminal", exact: true }).click();
    await expect(page.getByText("Silla E2E").first()).toBeVisible();
  });
});
