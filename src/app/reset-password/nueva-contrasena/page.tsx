import Link from "next/link";

import { ArrowLeft } from "@/components/icons";
import { getCurrentSession } from "@/lib/auth";
import { BrandLogo } from "@/lib/brand-logo";
import { ResetPasswordForm } from "./reset-password-form";

export default async function NuevaContrasenaPage() {
  const session = await getCurrentSession();

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-50 px-5 py-10">
      <div className="flex w-full max-w-[400px] flex-col gap-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <BrandLogo height={26} variant="blue" />
          <h1 className="mt-5 text-2xl font-black tracking-tight text-slate-950">Elegí una contraseña nueva</h1>

          {session ? (
            <>
              <p className="mt-2 text-sm text-slate-500">Para {session.user.email}.</p>
              <div className="mt-6">
                <ResetPasswordForm />
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-500">Este link ya venció o ya se usó.</p>
              <Link
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-primary transition hover:underline"
                href="/forgot-password"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                Pedir un link nuevo
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
