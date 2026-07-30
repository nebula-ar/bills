import { StaffErrorCode } from "@/modules/staff/staff.errors";

const staffErrorMessages: Record<StaffErrorCode, string> = {
  [StaffErrorCode.STAFF_NOT_FOUND]: "No encontramos ese empleado para administrar.",
  [StaffErrorCode.BRANCH_NOT_FOUND]: "No encontramos esa sucursal activa.",
  [StaffErrorCode.NAME_REQUIRED]: "Completá el nombre del empleado.",
  [StaffErrorCode.PIN_NOT_CONFIGURED]: "Ese empleado todavía no tiene PIN configurado.",
  [StaffErrorCode.INVALID_PIN]: "El PIN no es correcto.",
  [StaffErrorCode.INVALID_PIN_FORMAT]: "Ingresá un PIN numérico de 4 a 8 dígitos.",
};

export function getStaffErrorMessage(code: StaffErrorCode) {
  return staffErrorMessages[code];
}
