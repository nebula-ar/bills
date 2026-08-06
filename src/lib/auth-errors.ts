// Códigos de error compartidos entre la Server Action y el formulario.
// y el formulario de login del cliente, para no acoplarlos con strings sueltos.
// Este módulo no debe importar código server-only: lo consume el cliente.
export const LoginErrorCode = {
  RateLimited: "RATE_LIMITED",
  InvalidCredentials: "INVALID_CREDENTIALS",
  Network: "NETWORK_ERROR",
} as const;

export type LoginErrorCode = (typeof LoginErrorCode)[keyof typeof LoginErrorCode];
