export enum StaffErrorCode {
  STAFF_NOT_FOUND = "STAFF_NOT_FOUND",
  BRANCH_NOT_FOUND = "BRANCH_NOT_FOUND",
  NAME_REQUIRED = "NAME_REQUIRED",
  PIN_NOT_CONFIGURED = "PIN_NOT_CONFIGURED",
  INVALID_PIN = "INVALID_PIN",
  INVALID_PIN_FORMAT = "INVALID_PIN_FORMAT",
}

export class StaffError extends Error {
  constructor(public readonly code: StaffErrorCode) {
    super(code);
    this.name = "StaffError";
  }
}
