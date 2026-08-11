"use client";

import { Eye, EyeOff, Loader2 } from "@/components/icons";
import { useState, useTransition, type FormEvent } from "react";

import { resetPasswordAction } from "./actions";

export function ResetPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const datos = new FormData(event.currentTarget);
    const password = String(datos.get("password") ?? "");
    const confirmar = String(datos.get("confirmar") ?? "");

    setError(null);
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden");
      return;
    }

    startTransition(async () => {
      const resultado = await resetPasswordAction({ password });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setListo(true);
      // Navegación completa, no router.push: igual que el login, la sesión
      // vive en cookies que el árbol cacheado del cliente no conoce.
      window.setTimeout(() => window.location.assign("/login"), 1800);
    });
  }

  if (listo) {
    return (
      <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm font-semibold text-emerald-800">
        Contraseña actualizada. Te llevamos al login…
      </p>
    );
  }

  return (
    <form className="grid gap-4" noValidate onSubmit={handleSubmit}>
      <label className="grid gap-1.5" htmlFor="password">
        <span className="text-[11px] font-extrabold uppercase tracking-[1px] text-slate-600">Contraseña nueva</span>
        <span className="flex min-h-12 items-center rounded-xl border border-slate-300 bg-white px-3.5 transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
          <input
            autoComplete="new-password"
            className="min-w-0 flex-1 bg-transparent py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
            disabled={isPending}
            id="password"
            minLength={8}
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
            {showPassword ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
          </button>
        </span>
      </label>

      <label className="grid gap-1.5" htmlFor="confirmar">
        <span className="text-[11px] font-extrabold uppercase tracking-[1px] text-slate-600">Repetila</span>
        <span className="flex min-h-12 items-center rounded-xl border border-slate-300 bg-white px-3.5 transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
          <input
            autoComplete="new-password"
            className="min-w-0 flex-1 bg-transparent py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
            disabled={isPending}
            id="confirmar"
            minLength={8}
            name="confirmar"
            placeholder="••••••••••••"
            required
            type={showPassword ? "text" : "password"}
          />
        </span>
      </label>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">
          {error}
        </p>
      ) : null}

      <button
        className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-extrabold text-white shadow-sm shadow-primary/25 transition hover:bg-primary-strong active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? (
          <>
            <Loader2 aria-hidden="true" className="size-5 animate-spin" />
            Guardando...
          </>
        ) : (
          "Guardar contraseña"
        )}
      </button>
    </form>
  );
}
