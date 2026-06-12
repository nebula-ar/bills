"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
    <form action={handleSubmit} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="grid gap-5">
        <label className="grid gap-2 text-sm font-medium text-zinc-200">
          Email
          <input
            autoComplete="email"
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-50"
            name="email"
            required
            type="email"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-200">
          Contraseña
          <input
            autoComplete="current-password"
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-50"
            name="password"
            required
            type="password"
          />
        </label>

        {error ? (
          <p className="rounded-xl border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <button
          className="rounded-lg bg-amber-400 px-4 py-3 font-semibold text-zinc-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Ingresando..." : "Ingresar"}
        </button>
      </div>
    </form>
  );
}
