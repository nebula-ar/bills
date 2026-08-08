"use client";

import { Eye, EyeOff, Loader2 } from "@/components/icons";
import { LoginErrorCode } from "@/lib/auth-errors";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { googleSignInAction, loginAction } from "./actions";

type LoginFormProps = {
  callbackUrl: string;
  /** "mobile": hoja inferior (W97ZG); "desktop": panel de acceso (WMXMk). */
  variant: "mobile" | "desktop";
  /** El botón de Google solo se renderiza si el proveedor está configurado. */
  showGoogle: boolean;
};

const errorMessages: Record<string, string> = {
  [LoginErrorCode.RateLimited]: "Demasiados intentos fallidos. Esperá unos minutos antes de volver a probar.",
  [LoginErrorCode.InvalidCredentials]: "Email/usuario o contraseña incorrectos. Revisá tus datos e intentá de nuevo.",
  [LoginErrorCode.Network]: "No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.",
};

function resolveErrorMessage(code: string | null | undefined) {
  return errorMessages[code ?? LoginErrorCode.InvalidCredentials] ?? errorMessages[LoginErrorCode.InvalidCredentials];
}

// Logo oficial de Google (4 colores), 20px como en el diseño.
function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 48 48" width={size}>
      <path d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" fill="#EA4335" />
      <path d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" fill="#4285F4" />
      <path d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" fill="#FBBC05" />
      <path d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" fill="#34A853" />
    </svg>
  );
}

export function LoginForm({ callbackUrl, variant, showGoogle }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Los dos layouts conviven en el DOM (uno oculto por breakpoint). La variante
  // desktop conserva los ids estables (email/password/login-error) porque la
  // suite e2e y los autofill los usan; la mobile los prefija con "mobile-".
  const isDesktop = variant === "desktop";
  const idPrefix = isDesktop ? "" : "mobile-";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      try {
        const result = await loginAction({
          identifier: String(formData.get("email") ?? ""),
          password: String(formData.get("password") ?? ""),
          // "Recordarme" decide la duración de la sesión (8 h sin marcar,
          // 30 días marcando) vía la cookie de preferencia bills.remember.
          remember: formData.get("remember") === "1",
        });

        if (!result.ok) {
          setError(resolveErrorMessage(result.error));
          return;
        }

        router.push(callbackUrl);
        router.refresh();
      } catch {
        setError(resolveErrorMessage(LoginErrorCode.Network));
      }
    });
  }

  return (
    <form className={`grid ${isDesktop ? "gap-[18px]" : "gap-4"}`} noValidate onSubmit={handleSubmit}>
      <div className="grid gap-2.5">
        <label className="grid gap-1.5" htmlFor={`${idPrefix}email`}>
          <span className={`text-[11px] font-extrabold uppercase tracking-[1px] ${isDesktop ? "text-slate-600" : "text-slate-500"}`}>
            {isDesktop ? "Correo electrónico" : "Email o usuario"}
          </span>
          <span className="flex min-h-12 items-center rounded-xl border border-slate-300 bg-white px-3.5 transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
            <input
              aria-describedby={error ? `${idPrefix}login-error` : undefined}
              aria-invalid={error ? true : undefined}
              autoCapitalize="none"
              autoComplete="username"
              autoCorrect="off"
              className="min-w-0 flex-1 bg-transparent py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
              disabled={isPending}
              enterKeyHint="next"
              id={`${idPrefix}email`}
              name="email"
              placeholder="nombre@negocio.com"
              required
              spellCheck={false}
              type="text"
            />
          </span>
        </label>

        <label className="grid gap-1.5" htmlFor={`${idPrefix}password`}>
          <span className={`text-[11px] font-extrabold uppercase tracking-[1px] ${isDesktop ? "text-slate-600" : "text-slate-500"}`}>
            Contraseña
          </span>
          <span className="flex min-h-12 items-center rounded-xl border border-slate-300 bg-white px-3.5 transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
            <input
              aria-describedby={error ? `${idPrefix}login-error` : undefined}
              aria-invalid={error ? true : undefined}
              autoComplete="current-password"
              className="min-w-0 flex-1 bg-transparent py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
              disabled={isPending}
              enterKeyHint="go"
              id={`${idPrefix}password`}
              name="password"
              placeholder="••••••••••••"
              required
              type={showPassword ? "text" : "password"}
            />
            <button
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPassword}
              className="relative -mr-1 grid size-11 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 active:scale-95 disabled:opacity-50"
              disabled={isPending}
              onClick={() => setShowPassword((value) => !value)}
              type="button"
            >
              <Eye aria-hidden="true" className={`absolute inset-0 m-auto transition-all duration-200 ${showPassword ? "scale-50 rotate-12 opacity-0" : "scale-100 rotate-0 opacity-100"}`} size={20} />
              <EyeOff aria-hidden="true" className={`absolute inset-0 m-auto transition-all duration-200 ${showPassword ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-12 opacity-0"}`} size={20} />
            </button>
          </span>
        </label>
      </div>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 duration-300 animate-in fade-in slide-in-from-top-1" id={`${idPrefix}login-error`} role="alert">
          {error}
        </p>
      ) : null}

      {isDesktop ? (
        <div className="flex items-center justify-between pt-1">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              className="size-4 cursor-pointer rounded border border-slate-300 bg-white accent-primary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending}
              name="remember"
              type="checkbox"
              value="1"
            />
            <span className="text-xs font-semibold text-slate-500">Recordarme</span>
          </label>
          {/* El flujo de recuperación de contraseña es follow-up: hoy el enlace
              lleva a Contacto (no hay página de reset todavía). */}
          <Link
            className="text-xs font-bold text-primary transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            href="/contact"
          >
            ¿Olvidaste tu clave?
          </Link>
        </div>
      ) : (
        <Link
          className="text-center text-xs font-bold text-primary transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          href="/contact"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      )}

      <button
        className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-extrabold text-white shadow-[0_4px_10px_#3158e833] transition hover:bg-primary-strong active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-primary"
        disabled={isPending}
        type="submit"
      >
        {isPending ? (
          <>
            <Loader2 aria-hidden="true" className="size-5 animate-spin" />
            {isDesktop ? "Iniciando sesión..." : "Ingresando..."}
          </>
        ) : isDesktop ? (
          "Iniciar sesión"
        ) : (
          "Entrar a Bills"
        )}
      </button>

      {isDesktop ? (
        <p className="flex items-center justify-center gap-1.5 text-[13px] font-medium text-slate-500">
          ¿Todavía no usás Bills?{" "}
          <Link
            className="text-[13px] font-extrabold text-primary transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            href="/register"
          >
            Creá tu cuenta
          </Link>
        </p>
      ) : (
        <Link
          className="text-center text-xs font-bold text-primary transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          href="/register"
        >
          ¿No tenés cuenta? Registrá tu negocio
        </Link>
      )}

      {showGoogle ? (
        <button
          className={`flex h-12 items-center justify-center gap-2.5 rounded-xl border bg-white text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] ${isDesktop ? "border-slate-300" : "border-[#D7DDEA]"}`}
          onClick={() => {
            // OAuth con Google vía Supabase (signInWithOAuth). El botón solo se
            // muestra si el proveedor está habilitado en el entorno
            // (SUPABASE_GOOGLE_ENABLED=1) y configurado en el proyecto Supabase.
            googleSignInAction().catch(() => {
              setError(resolveErrorMessage(LoginErrorCode.Network));
            });
          }}
          type="button"
        >
          <GoogleLogo size={20} />
          Continuar con Google
        </button>
      ) : null}
    </form>
  );
}
