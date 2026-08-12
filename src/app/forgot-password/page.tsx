import Link from "next/link";

import { ArrowLeft } from "@/components/icons";
import { BrandLogo } from "@/lib/brand-logo";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-50 px-5 py-10">
      <div className="flex w-full max-w-[400px] flex-col gap-6">
        <Link
          className="flex items-center gap-1.5 self-start text-[13px] font-bold text-slate-500 transition hover:text-slate-700"
          href="/login"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Volver a ingresar
        </Link>

        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <BrandLogo height={26} variant="blue" />

          <h1 className="mt-5 text-2xl font-black tracking-tight text-slate-950">¿Olvidaste tu contraseña?</h1>
          <p className="mt-2 text-sm text-slate-500">Poné tu email y elegí una contraseña nueva.</p>

          <div className="mt-6">
            <ForgotPasswordForm />
          </div>
        </div>
      </div>
    </main>
  );
}
