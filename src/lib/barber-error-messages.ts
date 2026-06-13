import { BarberErrorCode } from "@/modules/barbers/barber.errors";

const barberErrorMessages: Record<BarberErrorCode, string> = {
  [BarberErrorCode.BARBER_NOT_FOUND]: "No encontramos ese barbero activo para esta sucursal.",
  [BarberErrorCode.PIN_NOT_CONFIGURED]: "Ese barbero todavía no tiene PIN configurado.",
  [BarberErrorCode.INVALID_PIN]: "El PIN no es correcto.",
  [BarberErrorCode.INVALID_PIN_FORMAT]: "Ingresá un PIN numérico de 4 a 8 dígitos.",
};

export function getBarberErrorMessage(code: BarberErrorCode) {
  return barberErrorMessages[code];
}
