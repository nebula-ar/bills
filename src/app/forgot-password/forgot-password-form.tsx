"use client";

import { Loader2 } from "@/components/icons";
import { useState, useTransition, type FormEvent } from "react";

import { requestPasswordResetAction } from "./actions";

export function ForgotPasswordForm() {
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    setError(null);

    startTransition(async () => {
      const resultado = await requestPasswordResetAction({ email });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setEnviado(true);
    });
  }

  if (enviado) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm font-semibold text-emerald-800">
        Si ese email tiene una cuenta en Bills, te mandamos un link para restablecer la contraseña. Revisá también spam.
      </div>
    );
  }

  return (
    <form className="grid gap-4" noValidate onSubmit={handleSubmit}>
      <label className="grid gap-1.5" htmlFor="email">
        <span className="text-[11px] font-extrabold uppercase tracking-[1px] text-slate-600">Email</span>
        <span className="flex min-h-12 items-center rounded-xl border border-slate-300 bg-white px-3.5 transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
          <input
            aria-describedby={error ? "forgot-password-error" : undefined}
            aria-invalid={error ? true : undefined}
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect="off"
            autoFocus
            className="min-w-0 flex-1 bg-transparent py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
            disabled={isPending}
            id="email"
            name="email"
            placeholder="nombre@negocio.com"
            required
            spellCheck={false}
            type="email"
          />
        </span>
      </label>

      {error ? (
        <p
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
          id="forgot-password-error"
          role="alert"
        >
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
            Enviando...
          </>
        ) : (
          "Mandar link de recuperación"
        )}
      </button>
    </form>
  );
}
