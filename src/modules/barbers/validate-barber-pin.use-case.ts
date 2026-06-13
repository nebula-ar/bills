import { compare } from "bcryptjs";

import { BarberError, BarberErrorCode } from "./barber.errors";
import { findActiveBarberForPinValidation } from "./barber.repository";

export type ValidateBarberPinInput = {
  barberId: string;
  pin: string;
  branchId?: string;
};

export async function validateBarberPin(input: ValidateBarberPinInput) {
  const pin = input.pin.trim();

  if (!isValidPin(pin)) {
    throw new BarberError(BarberErrorCode.INVALID_PIN_FORMAT);
  }

  const barber = await findActiveBarberForPinValidation(input.barberId, input.branchId);

  if (!barber) {
    throw new BarberError(BarberErrorCode.BARBER_NOT_FOUND);
  }

  if (!barber.pinHash) {
    throw new BarberError(BarberErrorCode.PIN_NOT_CONFIGURED);
  }

  const pinMatches = await compare(pin, barber.pinHash);

  if (!pinMatches) {
    throw new BarberError(BarberErrorCode.INVALID_PIN);
  }

  return { barberId: barber.id };
}

function isValidPin(pin: string) {
  return /^\d{4,8}$/.test(pin);
}
