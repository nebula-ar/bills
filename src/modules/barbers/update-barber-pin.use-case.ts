import { hash } from "bcryptjs";

import { BarberError, BarberErrorCode } from "./barber.errors";
import { updateBarberPinHash } from "./barber.repository";

export type UpdateBarberPinInput = {
  barberId: string;
  pin: string;
};

export async function updateBarberPin(input: UpdateBarberPinInput) {
  const pin = input.pin.trim();

  if (!/^\d{4,8}$/.test(pin)) {
    throw new BarberError(BarberErrorCode.INVALID_PIN_FORMAT);
  }

  const pinHash = await hash(pin, 12);
  const result = await updateBarberPinHash(input.barberId, pinHash);

  if (result.count === 0) {
    throw new BarberError(BarberErrorCode.BARBER_NOT_FOUND);
  }
}
