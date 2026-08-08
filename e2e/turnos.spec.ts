import { expect, test } from "@playwright/test";

import { elegirVendedor, loginAsAdmin } from "./helpers";

// Turnos: la agenda que la landing venía prometiendo y no existía.
// La suite puede cruzar medianoche: usar un día futuro evita que una prueba
// agende en un "hoy" y la siguiente consulte el día calendario siguiente.
const appointmentDay = (() => {
  const day = new Date();
  day.setDate(day.getDate() + 7);
  return `${day.getFullYear()}-${`${day.getMonth() + 1}`.padStart(2, "0")}-${`${day.getDate()}`.padStart(2, "0")}`;
})();

test.describe("Turnos", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    // El seed es un kiosco; la agenda es de los rubros de servicio.
    await page.goto("/settings");
    const fila = page.locator("li", { hasText: "Agenda del día y cobro en la silla" });
    const prender = fila.getByRole("button", { name: "Prender" });
    if (await prender.count()) {
      await prender.click();
      await expect(fila.getByRole("button", { name: "Apagar" })).toBeVisible();
    }
  });

  test("agendar un turno y verlo en el día", async ({ page }) => {
    await page.goto(`/turnos?day=${appointmentDay}`);

    const alta = page.locator("form", { hasText: "Agendar" });
    await alta.locator('input[name="time"]').fill("11:30");
    await alta.locator('input[name="customerName"]').fill("Rodrigo E2E");
    await alta.locator('select[name="staffId"]').selectOption({ label: "Nico Fernández" });
    await alta.getByRole("button", { name: "Agendar" }).click({ noWaitAfter: true });

    await expect(page.getByText("Rodrigo E2E")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("11:30")).toBeVisible();
  });

  test("no deja pisar dos turnos del mismo empleado", async ({ page }) => {
    await page.goto(`/turnos?day=${appointmentDay}`);

    const alta = page.locator("form", { hasText: "Agendar" });
    // El caso anterior ya reservó a Nico de 11:30 a 12:00. Intentar 11:45
    // prueba el cruce sin sumar otra escritura independiente a la agenda.
    await alta.locator('input[name="time"]').fill("11:45");
    await alta.locator('input[name="customerName"]').fill("Segundo E2E");
    await alta.locator('select[name="staffId"]').selectOption({ label: "Nico Fernández" });
    await alta.getByRole("button", { name: "Agendar" }).click({ noWaitAfter: true });

    await expect(page.getByText(/Se pisa con el turno/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Segundo E2E")).toHaveCount(0);
  });

  test("cobrar un turno lo deja atendido y enlazado a la venta", async ({ page }) => {
    await page.goto(`/turnos?day=${appointmentDay}`);

    const alta = page.locator("form", { hasText: "Agendar" });
    await alta.locator('input[name="time"]').fill("17:00");
    await alta.locator('input[name="customerName"]').fill("Cobrar E2E");
    await alta.locator('select[name="staffId"]').selectOption({ label: "Nico Fernández" });
    await alta.locator('select[name="productId"]').selectOption({ label: "Alfajor triple" });
    await alta.getByRole("button", { name: "Agendar" }).click({ noWaitAfter: true });
    await expect(page.getByText("Cobrar E2E")).toBeVisible({ timeout: 30_000 });

    const turno = page.getByRole("listitem").filter({ hasText: "Cobrar E2E" });
    await turno.getByRole("link", { name: "Cobrar" }).click();

    // El POS arranca con el servicio del turno ya cargado.
    await elegirVendedor(page);
    await expect(page.getByRole("button", { name: "Cobrar" }).first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Cobrar" }).first().click();
    await page.getByRole("button", { name: /Confirmar venta/ }).click();
    await expect(page.getByText("¡Venta registrada!")).toBeVisible({ timeout: 30_000 });

    await page.goto(`/turnos?day=${appointmentDay}`);
    await expect(page.getByRole("listitem").filter({ hasText: "Cobrar E2E" }).getByText("Cobrado")).toBeVisible({
      timeout: 30_000,
    });
  });
});
