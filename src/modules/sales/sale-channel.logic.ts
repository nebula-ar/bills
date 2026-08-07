import { SaleChannel } from "@/generated/prisma/enums";

/**
 * Qué queda guardado de mesa y mozo según por dónde salió la venta.
 *
 * Se guardan los NOMBRES, no los ids: el ticket tiene que seguir diciendo
 * "Mesa 4 · Nico" dentro de un año, aunque la mesa se haya borrado y el
 * empleado ya no trabaje. Un comprobante no se reescribe porque cambió una
 * ficha.
 *
 * Y solo si la venta salió de una mesa. Una venta de mostrador con `tableName`
 * cargado imprime un ticket que dice "Mesa 4" sobre algo que se cobró en la
 * caja, y ensucia cualquier corte por canal.
 */
export function datosDeMesa(input: {
  channel?: SaleChannel;
  tableName?: string | null;
  waiterName?: string | null;
}): { tableName: string | null; waiterName: string | null } {
  if (input.channel !== SaleChannel.TABLE) {
    return { tableName: null, waiterName: null };
  }

  return {
    // Vacío o solo espacios es lo mismo que no haber elegido: null, para que la
    // consulta pueda preguntar por "las que tienen mesa" sin filtrar strings.
    tableName: input.tableName?.trim() || null,
    waiterName: input.waiterName?.trim() || null,
  };
}
