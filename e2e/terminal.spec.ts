import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { STAFFS } from "./helpers";

// IDs sembrados (los vuelca scripts/e2e-prepare.mjs). Ruta relativa al cwd
// (raíz del proyecto, desde donde Playwright ejecuta).
const seedIds = JSON.parse(readFileSync("e2e/seed-ids.json", "utf8")) as {
  centroBranchId: string;
  nicoTerminalId: string;
};

// Entramos por el link de una terminal FIJA a Nico: así el empleado queda
// preseleccionado y el test es inmune a empleados agregados por otros tests.
test.describe("Terminal del empleado", () => {
  const empleado = STAFFS.nico;

  test("PIN incorrecto no abre el turno", async ({ page }) => {
    await page.goto(`/terminal?terminal=${seedIds.nicoTerminalId}`);
    await page.locator('input[name="pin"]').fill("0000");
    await page.getByRole("button", { name: "Empezar turno" }).click();
    // Sigue en la pantalla de PIN (no abrió el turno).
    await expect(page.getByRole("button", { name: "Empezar turno" })).toBeVisible();
  });

  test("PIN correcto abre el turno", async ({ page }) => {
    await page.goto(`/terminal?terminal=${seedIds.nicoTerminalId}`);
    await page.locator('input[name="pin"]').fill(empleado.pin);
    await page.getByRole("button", { name: "Empezar turno" }).click();
    // Turno abierto: aparece el botón Salir del header.
    await expect(page.getByRole("button", { name: "Salir" })).toBeVisible();
  });
});
