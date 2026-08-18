import { CustomerAccountEntryType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  deleteCustomer,
  getCustomerDetail,
  getCustomersForManagement,
  updateCustomer,
} from "@/modules/customers/customer.use-cases";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { borrarNegociosDePrueba, crearInquilinos, enTandas, type Inquilino } from "./inquilinos";

/**
 * Clientes: el módulo con los datos más sensibles de la app.
 *
 * Acá no hay productos: hay nombres, teléfonos, direcciones y —lo más
 * delicado— cuánto DEBE cada persona. Una fuga en catálogo muestra precios; una
 * fuga acá muestra la libreta de fiados del negocio de al lado.
 *
 * Se testea aparte porque el módulo tiene una asimetría que conviene mirar de
 * frente. En `customer.repository.ts` conviven dos familias:
 *
 *   findCustomerById(customerId, businessId)   <- filtra por inquilino
 *   findCustomerBalance(customerId)            <- NO filtra
 *   findCustomerAccountEntries(customerId)     <- NO filtra
 *   findCustomerSales(customerId)              <- NO filtra
 *   updateCustomerRecord(customerId, input)    <- NO filtra
 *
 * Hoy es seguro porque TODOS los casos de uso llaman `requireCustomer(id,
 * businessId)` antes de tocar las de abajo. Es disciplina real y está aplicada
 * de forma consistente. Pero la garantía vive en que alguien se acuerde: el día
 * que una pantalla nueva llame `findCustomerAccountEntries(id)` sin validar
 * antes, sirve la deuda de un cliente ajeno y nada rompe.
 *
 * Estos tests son ese "nada rompe". Ahora rompe.
 */

const INQUILINOS = 6;
const TANDA = 3;

let inquilinos: Inquilino[] = [];
/** customerId por inquilino, en el mismo orden. */
let clientes: string[] = [];

function vecinoDe(indice: number): number {
  return (indice + 1) % INQUILINOS;
}

beforeAll(async () => {
  inquilinos = await crearInquilinos(INQUILINOS, 1);

  clientes = await enTandas(inquilinos, TANDA, async (inquilino, indice) => {
    const cliente = await prisma.customer.create({
      data: {
        businessId: inquilino.businessId,
        // Mismo nombre en los 6: si algo filtrara por nombre en vez de por
        // negocio, con nombres distintos el test pasaría igual.
        name: "E2E-Cliente Fiado",
        phone: `1100000${indice}`,
      },
      select: { id: true },
    });

    // Deuda: el dato que de verdad no puede cruzarse. El monto identifica al
    // dueño, así que si aparece el ajeno se sabe de quién se filtró.
    await prisma.customerAccountEntry.create({
      data: {
        customerId: cliente.id,
        type: CustomerAccountEntryType.CHARGE,
        amount: 10_000 + indice,
        occurredAt: new Date(),
      },
    });

    return cliente.id;
  });
});

afterAll(async () => {
  await borrarNegociosDePrueba();
  await prisma.$disconnect();
});

describe("Aislamiento de clientes", () => {
  test("la lista solo trae los clientes propios", async () => {
    const listas = await enTandas(inquilinos, TANDA, (inquilino) =>
      getCustomersForManagement(inquilino.businessId),
    );

    listas.forEach((lista, indice) => {
      expect(lista.map((fila) => fila.id)).toEqual([clientes[indice]!]);
      // Y el saldo es el propio: la deuda lleva el índice del dueño.
      expect(lista[0]!.balance).toBe(10_000 + indice);
    });
  });

  test("la ficha de un cliente ajeno no se abre", async () => {
    // Este es el caso fatal: `/clientes/<id>` con el id de un cliente de otro
    // negocio. Si abriera, se ven nombre, teléfono, deuda e historial completo.
    const intentos = await enTandas(inquilinos, TANDA, async (inquilino, indice) => {
      try {
        const ficha = await getCustomerDetail(clientes[vecinoDe(indice)]!, inquilino.businessId);
        return { abrio: true, ficha };
      } catch {
        return { abrio: false, ficha: null };
      }
    });

    expect(intentos.filter((intento) => intento.abrio)).toEqual([]);
  });

  test("la ficha propia sí se abre y trae su deuda", async () => {
    // El complemento del anterior. Sin esto, un caso de uso que tirara SIEMPRE
    // pasaría el test de arriba y nadie se enteraría de que rompió la pantalla.
    const fichas = await enTandas(inquilinos, TANDA, (inquilino, indice) =>
      getCustomerDetail(clientes[indice]!, inquilino.businessId),
    );

    fichas.forEach((ficha, indice) => {
      expect(ficha.customer.id).toBe(clientes[indice]!);
      expect(ficha.balance).toBe(10_000 + indice);
      expect(ficha.entries).toHaveLength(1);
    });
  });

  test("editar un cliente ajeno no lo toca", async () => {
    const antes = await prisma.customer.findMany({
      where: { id: { in: clientes } },
      select: { id: true, name: true, phone: true },
      orderBy: { id: "asc" },
    });

    const intentos = await enTandas(inquilinos, TANDA, async (inquilino, indice) => {
      try {
        await updateCustomer(clientes[vecinoDe(indice)]!, {
          businessId: inquilino.businessId,
          name: "ROBADO",
          phone: "1199999999",
        });
        return "no falló";
      } catch {
        return "falló";
      }
    });

    expect(intentos.filter((resultado) => resultado === "no falló")).toEqual([]);

    const despues = await prisma.customer.findMany({
      where: { id: { in: clientes } },
      select: { id: true, name: true, phone: true },
      orderBy: { id: "asc" },
    });
    expect(despues).toEqual(antes);
  });

  test("borrar un cliente ajeno no lo borra", async () => {
    const intentos = await enTandas(inquilinos, TANDA, async (inquilino, indice) => {
      try {
        await deleteCustomer(clientes[vecinoDe(indice)]!, inquilino.businessId);
        return "no falló";
      } catch {
        return "falló";
      }
    });

    expect(intentos.filter((resultado) => resultado === "no falló")).toEqual([]);

    // Ninguno quedó marcado como borrado.
    const vivos = await prisma.customer.count({ where: { id: { in: clientes }, deleted: false } });
    expect(vivos).toBe(INQUILINOS);
  });
});
