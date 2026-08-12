"use client";

import { useMemo, useState, useTransition } from "react";

import { generateCertificate, updateFiscalData } from "@/app/facturacion/actions";
import { PageEnter } from "@/components/page-enter";
import { Skeleton } from "@/components/ui/skeleton";
import { TaxCondition } from "@/generated/prisma/enums";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock, ReceiptText } from "@/components/icons";
import { TAX_CONDITION_LABELS } from "@/lib/invoice-labels";
import { validateTaxId } from "@/lib/tax-id";
import { SelectField } from "@/components/ui/select-field";

export type FiscalProfileData = {
  businessName: string;
  cuit: string | null;
  taxCondition: TaxCondition | null;
  salesPointNumber: number | null;
  hasCertificate: boolean;
  certificateCreatedAt: string | null;
  flash: { status: "success" | "error"; message: string } | null;
};

const TAX_CONDITION_OPTIONS = Object.values(TaxCondition);

export function FiscalProfileManager({ data }: { data: FiscalProfileData }) {
  const [cuit, setCuit] = useState(data.cuit ?? "");
  const [showPassword, setShowPassword] = useState(false);
  const [isGenerating, startGenerating] = useTransition();

  const cuitCheck = useMemo(() => (cuit.trim().length > 0 ? validateTaxId(cuit) : null), [cuit]);
  const cuitHasError = cuitCheck !== null && (!cuitCheck.valid || cuitCheck.kind !== "CUIT");

  const fiscallyConfigured = Boolean(data.cuit && data.taxCondition && data.salesPointNumber != null);

  // Generar el certificado es una llamada lenta a AFIP: si el botón quedara
  // habilitado, un doble toque mandaría la operación dos veces. La transición
  // deshabilita el submit y muestra el spinner mientras corre.
  function submitGenerateCertificate(formData: FormData) {
    startGenerating(async () => {
      await generateCertificate(formData);
    });
  }

  return (
    <PageEnter>
      <main className="mx-auto min-h-dvh w-full min-w-0 max-w-[560px] overflow-x-clip bg-[var(--background)] px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-6 text-slate-950 lg:max-w-[720px] lg:px-8">
      <header className="flex items-center justify-between gap-4 duration-500 animate-in fade-in slide-in-from-top-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500">{data.businessName}</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">Facturación</h1>
        </div>
      </header>

      {data.flash ? (
        <div
          className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold duration-300 animate-in fade-in ${
            data.flash.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {data.flash.message}
        </div>
      ) : null}

      {/* Datos fiscales */}
      <form
        action={updateFiscalData}
        className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-950/5 duration-500 animate-in fade-in slide-in-from-bottom-2"
      >
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ReceiptText className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black text-slate-950">Datos fiscales</h2>
            <p className="text-xs text-slate-500">Necesarios para poder facturar electrónicamente (AFIP/ARCA).</p>
          </div>
          {fiscallyConfigured ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[0.7rem] font-bold text-emerald-700">
              <CheckCircle2 className="size-3.5" />
              Completo
            </span>
          ) : null}
        </div>

        <div className="space-y-4">
          <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
            CUIT
            <input
              className={`rounded-2xl border bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:bg-white focus:ring-4 ${
                cuitHasError ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100" : "border-slate-200 focus:border-primary/40 focus:ring-primary/15"
              }`}
              inputMode="numeric"
              name="cuit"
              onChange={(event) => setCuit(event.target.value)}
              placeholder="20-40937847-2"
              value={cuit}
            />
            {cuitHasError ? <span className="normal-case text-xs font-semibold text-rose-600">CUIT inválido (revisá el dígito verificador).</span> : null}
          </label>

          <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
            Condición frente al IVA
            <SelectField
              ariaLabel="Condición frente al IVA"
              defaultValue={data.taxCondition ?? ""}
              name="taxCondition"
              options={[
                { value: "", label: "Elegí una opción" },
                ...TAX_CONDITION_OPTIONS.map((condition) => ({
                  value: condition,
                  label: TAX_CONDITION_LABELS[condition],
                })),
              ]}
            />
          </label>

          <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
            Punto de venta AFIP
            <input
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
              defaultValue={data.salesPointNumber ?? ""}
              inputMode="numeric"
              max={9999}
              min={1}
              name="salesPointNumber"
              placeholder="1"
              type="number"
            />
          </label>

          <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
            Mientras no estén completos, el negocio no puede emitir comprobantes fiscales (las ventas se siguen registrando igual).
          </p>
        </div>

        <button
          className="mt-4 w-full rounded-2xl bg-primary px-4 py-4 text-base font-black text-white shadow-sm shadow-primary/25 transition hover:bg-primary-strong active:scale-[0.99]"
          type="submit"
        >
          Guardar datos fiscales
        </button>
      </form>

      {/* Certificado de producción */}
      <div
        className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-950/5 duration-500 animate-in fade-in slide-in-from-bottom-2"
        style={{ animationDelay: "80ms", animationFillMode: "backwards" }}
      >
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600">
            <Lock className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black text-slate-950">Facturación real (producción)</h2>
            <p className="text-xs text-slate-500">Generá el certificado con tu Clave Fiscal para poder emitir comprobantes de verdad.</p>
          </div>
        </div>

        {data.hasCertificate ? (
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3.5 text-sm font-bold text-emerald-700">
            <CheckCircle2 className="size-4 shrink-0" />
            Certificado generado{data.certificateCreatedAt ? ` el ${new Date(data.certificateCreatedAt).toLocaleDateString("es-AR")}` : ""}. Ya podés facturar de verdad.
          </div>
        ) : !fiscallyConfigured ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
            Completá primero los datos fiscales de arriba para poder generar el certificado.
          </p>
        ) : (
          <form action={submitGenerateCertificate} className="space-y-3">
            <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
              Usuario de Clave Fiscal
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
                name="claveFiscalUsername"
                placeholder="Tu CUIT o usuario de AFIP"
                required
                type="text"
              />
            </label>
            <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
              Contraseña de Clave Fiscal
              <div className="relative">
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 pr-12 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
                  name="claveFiscalPassword"
                  required
                  type={showPassword ? "text" : "password"}
                />
                <button
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center text-slate-400"
                  onClick={() => setShowPassword((value) => !value)}
                  type="button"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </label>
            <p className="flex items-start gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
              <KeyRound className="mt-0.5 size-3.5 shrink-0" />
              Se usa una sola vez para generar el certificado. Nunca la guardamos.
            </p>
            <button
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-4 text-base font-black text-white shadow-sm shadow-violet-600/25 transition hover:bg-violet-700 active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
              disabled={isGenerating}
              type="submit"
            >
              {isGenerating ? <Loader2 className="size-4 animate-spin" /> : null}
              {isGenerating ? "Generando…" : "Generar certificado"}
            </button>
          </form>
        )}
      </div>
    </main>
    </PageEnter>
  );
}

// Estado skeleton de FiscalProfileManager: mismo shell, header y tarjeta de
// datos fiscales (CUIT, condición IVA, punto de venta, botones) que el
// componente real.
export function FiscalProfileManagerSkeleton() {
  return (
    <main className="mx-auto min-h-dvh w-full min-w-0 max-w-[560px] overflow-x-clip bg-[var(--background)] px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-6 text-slate-950 lg:max-w-[720px] lg:px-8">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-7 w-36" />
        </div>
      </header>

      {/* Datos fiscales */}
      <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-950/5">
        <div className="mb-4 flex items-center gap-2.5">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="space-y-2" key={index}>
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </div>
          ))}
          <div className="flex gap-3">
            <Skeleton className="h-11 w-32 rounded-xl" />
            <Skeleton className="h-11 flex-1 rounded-xl" />
          </div>
        </div>
      </div>
    </main>
  );
}
