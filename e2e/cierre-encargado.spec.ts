import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { BARBERS, loginAsAdmin } from "./helpers";

const seedIds = JSON.parse(readFileSync("e2e/seed-ids.json", "utf8")) as {
  centroBranchId: string;
  nicoTerminalId: string;
};

// Serial y compartiendo la base sembrada: primero verificamos el estado inicial
// (Nico NO es encargado), después el admin lo marca y verificamos que sí puede.
test.describe.configure({ mode: "serial" });

test.describe("Encargados de cierre de caja", () => {
  async function abrirTurnoNico(page: import("@playwright/test").Page) {
    await page.goto(`/barber?terminal=${seedIds.nicoTerminalId}`);
    await page.locator('input[name="pin"]').fill(BARBERS.nico.pin);
    await page.getByRole("button", { name: "Empezar turno" }).click();
    await expect(page.getByRole("button", { name: "Salir" })).toBeVisible();
  }

  test("un barbero común no ve ni accede a cerrar caja", async ({ page }) => {
    await abrirTurnoNico(page);
    // No aparece la opción en el nav.
    await expect(page.getByRole("link", { name: "Cerrar caja" })).toHaveCount(0);
    // Y si entra directo a la URL, lo bloquea.
    await page.goto("/barber/cierre");
    await expect(page.getByText("Sin permiso")).toBeVisible();
  });

  test("un barbero encargado puede cerrar la caja de su sucursal", async ({ page }) => {
    // El admin marca a Nico como encargado.
    await loginAsAdmin(page);
    await page.goto("/barbers");
    await page.getByRole("button", { name: new RegExp(BARBERS.nico.name) }).click();
    const toggle = page.getByRole("switch", { name: "Puede cerrar caja" });
    await toggle.click();
    await expect(toggle).toBeChecked(); // el input oculto ya está en el DOM antes de enviar
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Barbero actualizado.").first()).toBeVisible();

    // Nico abre turno y ahora ve "Cerrar caja".
    await abrirTurnoNico(page);
    const cerrarLink = page.getByRole("link", { name: "Cerrar caja" });
    await expect(cerrarLink).toBeVisible();
    await cerrarLink.click();

    // Hace el arqueo y cierra → vuelve a la terminal con la notificación.
    await expect(page.getByRole("heading", { name: "Cerrar caja" })).toBeVisible();
    await page.getByRole("button", { name: "Cerrar caja" }).click();
    await expect(page.getByText(/Caja cerrada/i)).toBeVisible();
  });
});
