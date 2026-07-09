"use client";

import { LoginErrorCode } from "@/lib/auth-errors";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";

type LoginFormProps = {
  callbackUrl: string;
};

const errorMessages: Record<string, string> = {
  [LoginErrorCode.RateLimited]: "Demasiados intentos fallidos. Esperá unos minutos antes de volver a probar.",
  [LoginErrorCode.InvalidCredentials]: "Email/usuario o contraseña incorrectos. Revisá tus datos e intentá de nuevo.",
  [LoginErrorCode.Network]: "No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.",
};

function resolveErrorMessage(code: string | null | undefined) {
  if (!code) return errorMessages[LoginErrorCode.InvalidCredentials];
  return errorMessages[code] ?? errorMessages[LoginErrorCode.InvalidCredentials];
}

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      try {
        const result = await signIn("credentials", {
          email: formData.get("email"),
          password: formData.get("password"),
          redirect: false,
          callbackUrl,
        });

        if (!result?.ok) {
          setError(resolveErrorMessage(result?.error));
          return;
        }

        // Ruta relativa (callbackUrl siempre empieza con "/") en lugar de result.url,
        // que NextAuth arma como URL absoluta con NEXTAUTH_URL y rompería el redirect
        // cuando se entra desde otro origen (ej. la IP de la LAN en el celular).
        router.push(callbackUrl);
        router.refresh();
      } catch {
        setError(resolveErrorMessage(LoginErrorCode.Network));
      }
    });
  }

  return (
    <form className="grid gap-5" noValidate onSubmit={handleSubmit}>
      <div className="grid gap-4">
        <label className="grid gap-2 text-sm font-black text-slate-700" htmlFor="email">
          Email o usuario
          <span className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm transition focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
            <Mail aria-hidden="true" className="shrink-0 text-slate-400" size={20} />
            <input
              aria-describedby={error ? "login-error" : undefined}
              aria-invalid={error ? true : undefined}
              autoCapitalize="none"
              autoComplete="username"
              autoCorrect="off"
              className="min-w-0 flex-1 bg-transparent text-base font-semibold text-slate-950 outline-none placeholder:text-slate-400"
              disabled={isPending}
              enterKeyHint="next"
              id="email"
              name="email"
              placeholder="Tu email o usuario"
              required
              spellCheck={false}
              type="text"
            />
          </span>
        </label>

        <label className="grid gap-2 text-sm font-black text-slate-700" htmlFor="password">
          Contraseña
          <span className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm transition focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
            <Lock aria-hidden="true" className="shrink-0 text-slate-400" size={20} />
            <input
              aria-describedby={error ? "login-error" : undefined}
              aria-invalid={error ? true : undefined}
              autoComplete="current-password"
              className="min-w-0 flex-1 bg-transparent text-base font-semibold text-slate-950 outline-none placeholder:text-slate-400"
              disabled={isPending}
              enterKeyHint="go"
              id="password"
              name="password"
              placeholder="••••••••"
              required
              type={showPassword ? "text" : "password"}
            />
            <button
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPassword}
              className="relative size-6 shrink-0 text-slate-400 transition-colors hover:text-slate-600 active:scale-90 disabled:opacity-50"
              disabled={isPending}
              onClick={() => setShowPassword((value) => !value)}
              tabIndex={-1}
              type="button"
            >
              <Eye
                aria-hidden="true"
                className={`absolute inset-0 m-auto transition-all duration-200 ${
                  showPassword ? "scale-50 rotate-12 opacity-0" : "scale-100 rotate-0 opacity-100"
                }`}
                size={20}
              />
              <EyeOff
                aria-hidden="true"
                className={`absolute inset-0 m-auto transition-all duration-200 ${
                  showPassword ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-12 opacity-0"
                }`}
                size={20}
              />
            </button>
          </span>
        </label>

        {error ? (
          <p
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 duration-300 animate-in fade-in slide-in-from-top-1"
            id="login-error"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <button
          className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-base font-black text-white shadow-[0_16px_34px_rgba(37,99,235,0.28)] transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isPending}
          type="submit"
        >
          {isPending ? (
            <>
              <Loader2 aria-hidden="true" className="size-5 animate-spin" />
              Iniciando sesión...
            </>
          ) : (
            "Ingresar"
          )}
        </button>
      </div>
    </form>
  );
}
