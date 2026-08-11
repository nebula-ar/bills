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

// Borrado de un turno: el flujo feliz que pide NEBU-36 — confirmar en el modal
// borra y el turno desaparece del DOM sin recargar la página.
//
// Va en un describe aparte, sin modo serial: los tres tests de arriba usan
// `select[name=...]` nativos que la página ya no renderiza (desde el refactor
// de SelectField) y fallan en main sin estos cambios. Este describe no depende
// de ellos.
test.describe("Turnos: borrar un turno", () => {
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

  test("confirmar en el modal borra el turno sin recargar", async ({ page }) => {
    // Nombre único por corrida: si un run anterior falló a mitad del borrado,
    // no queda un turno viejo con el mismo nombre que rompa este test.
    const nombre = `Borrar E2E ${Date.now()}`;
    const day = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 10);
      return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
    })();
    await page.goto(`/turnos?day=${day}`);

    const alta = page.locator("form", { hasText: "Agendar" });
    await alta.locator('input[name="time"]').fill("10:00");
    await alta.locator('input[name="customerName"]').fill(nombre);
    await alta.getByRole("button", { name: "Agendar" }).click({ noWaitAfter: true });
    await expect(page.getByText(nombre, { exact: true })).toBeVisible({ timeout: 30_000 });

    const turno = page.getByRole("listitem").filter({ hasText: nombre });
    await turno.getByRole("button", { name: "Borrar", exact: true }).click();

    // El modal muestra a quién y a qué hora antes de confirmar.
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByRole("heading", { name: "¿Borrar el turno?" })).toBeVisible();
    await expect(dialog.getByText(nombre)).toBeVisible();

    // Cancelar no borra nada: el diálogo se cierra y el turno sigue.
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByRole("listitem").filter({ hasText: nombre })).toBeVisible();

    // Confirmar borra con spinner y sin recargar: router.refresh() no dispara
    // `load`, así que si la página recargara el contador sumaría y fallaría.
    let loads = 0;
    page.on("load", () => loads++);
    await turno.getByRole("button", { name: "Borrar", exact: true }).click();
    await dialog.getByRole("button", { name: "Sí, borrar" }).click();

    await expect(page.getByText(nombre, { exact: true })).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    expect(loads).toBe(0);
  });
});
