"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Lock, Mail } from "lucide-react";

type LoginFormProps = {
  callbackUrl: string;
};

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);

    startTransition(async () => {
      const result = await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirect: false,
        callbackUrl,
      });

      if (!result?.ok) {
        setError("No pudimos iniciar sesión. Revisá tus datos e intentá de nuevo.");
        return;
      }

      router.push(result.url ?? callbackUrl);
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="grid gap-5">
      <div className="grid gap-4">
        <label className="grid gap-2 text-sm font-black text-slate-700">
          Email
          <span className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
            <Mail aria-hidden="true" className="shrink-0 text-slate-400" size={20} />
            <input
              autoComplete="email"
              className="min-w-0 flex-1 bg-transparent text-base font-semibold text-slate-950 outline-none placeholder:text-slate-400"
              name="email"
              placeholder="admin@barberia.com"
              required
              type="email"
            />
          </span>
        </label>

        <label className="grid gap-2 text-sm font-black text-slate-700">
          Contraseña
          <span className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
            <Lock aria-hidden="true" className="shrink-0 text-slate-400" size={20} />
            <input
              autoComplete="current-password"
              className="min-w-0 flex-1 bg-transparent text-base font-semibold text-slate-950 outline-none placeholder:text-slate-400"
              name="password"
              placeholder="••••••••"
              required
              type="password"
            />
          </span>
        </label>

        <button className="justify-self-end text-sm font-black text-blue-600 hover:text-blue-700" type="button">
          ¿Olvidaste tu contraseña?
        </button>

        {error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        ) : null}

        <button
          className="rounded-2xl bg-blue-600 px-4 py-4 text-base font-black text-white shadow-[0_16px_34px_rgba(37,99,235,0.28)] hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Ingresando..." : "Ingresar"}
        </button>
      </div>
    </form>
  );
}
