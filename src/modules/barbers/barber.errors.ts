export enum BarberErrorCode {
  BARBER_NOT_FOUND = "BARBER_NOT_FOUND",
  BRANCH_NOT_FOUND = "BRANCH_NOT_FOUND",
  NAME_REQUIRED = "NAME_REQUIRED",
  PIN_NOT_CONFIGURED = "PIN_NOT_CONFIGURED",
  INVALID_PIN = "INVALID_PIN",
  INVALID_PIN_FORMAT = "INVALID_PIN_FORMAT",
}

export class BarberError extends Error {
  constructor(public readonly code: BarberErrorCode) {
    super(code);
    this.name = "BarberError";
  }
}
