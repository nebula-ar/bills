// Códigos de error de login compartidos entre el backend (NextAuth `authorize`)
// y el formulario de login del cliente, para no acoplarlos con strings sueltos.
// Este módulo no debe importar código server-only: lo consume el cliente.
export const LoginErrorCode = {
  // Lo lanza `authorize` cuando se supera el rate limit.
  RateLimited: "RATE_LIMITED",
  // Código que devuelve NextAuth cuando `authorize` retorna null.
  InvalidCredentials: "CredentialsSignin",
  // Falla de red del lado del cliente (el fetch de signIn lanzó una excepción).
  Network: "NETWORK_ERROR",
} as const;

export type LoginErrorCode = (typeof LoginErrorCode)[keyof typeof LoginErrorCode];
