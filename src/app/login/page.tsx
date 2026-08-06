import Link from "next/link";

import { ArrowLeft, ShieldCheck } from "@/components/icons";
import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams: Promise<{
    callbackUrl?: string | string[];
    error?: string | string[];
  }>;
};

// Puntos editoriales del panel izquierdo (posiciones del nodo WMXMk, escala y 0.75).
const EDITORIAL_DOTS = [
  { x: 352, y: 330, size: 11 },
  { x: 280, y: 297, size: 8 },
  { x: 340, y: 261, size: 16 },
  { x: 250, y: 229, size: 10 },
  { x: 359, y: 208, size: 8 },
  { x: 315, y: 186, size: 14 },
  { x: 276, y: 154, size: 7 },
  { x: 342, y: 132, size: 12 },
  { x: 326, y: 99, size: 9 },
  { x: 290, y: 79, size: 18 },
] as const;

// Contenido estático de marketing del panel editorial (copiado del diseño).
const LAST_SALES = [
  { concept: "Corte + barba", amount: "$ 18.000" },
  { concept: "Venta de productos", amount: "$ 7.500" },
  { concept: "Corte clásico", amount: "$ 12.000" },
] as const;

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = getSafeCallbackUrl(getSingleParam(params.callbackUrl));
  const hasError = Boolean(getSingleParam(params.error));

  // El botón "Continuar con Google" se muestra solo si el proveedor está
  // habilitado en el entorno (SUPABASE_GOOGLE_ENABLED=1) y configurado en el
  // proyecto Supabase. Regla del repo: no prometer lo que no va a pasar.
  const showGoogle = process.env.SUPABASE_GOOGLE_ENABLED === "1";

  return (
    <main className="min-h-[100dvh] bg-[#070A19]">
      {/* ===== Mobile (< lg): fondo oscuro + hoja de acceso (nodo W97ZG) ===== */}
      <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#070A19] lg:hidden">
        {/* Halos radiales azul y violeta de fondo */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-80px] top-[72px] h-[210px] w-[240px] rounded-full bg-[radial-gradient(circle_at_center,#2563EB80_0%,#2563EB00_70%)] blur-[28px]" />
          <div className="absolute right-[-60px] top-[104px] h-[190px] w-[210px] rounded-full bg-[radial-gradient(circle_at_center,#7C3AED70_0%,#7C3AED00_70%)] blur-[28px]" />
        </div>

        {/* Volver */}
        <div className="relative z-10 flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
          <Link
            className="flex items-center gap-1.5 text-[13px] font-bold text-white transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070A19]"
            href="/"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Volver
          </Link>
        </div>

        {/* Franja de acento gradiente */}
        <div aria-hidden="true" className="relative z-10 mt-4 h-1 w-full bg-linear-to-r from-blue-600 to-violet-600" />

        {/* Hoja blanca de acceso */}
        <section className="relative z-10 mt-5 flex flex-1 flex-col items-center gap-4 rounded-t-[32px] bg-white px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-[18px]">
          <div aria-hidden="true" className="h-[5px] w-[46px] shrink-0 rounded-full bg-slate-300" />

          <h1 className="text-center font-montserrat text-[23px] font-bold text-slate-950">Ingresá a Bills</h1>
          <p className="text-center text-xs text-slate-500">Deslizá hacia arriba para acceder a tu negocio</p>

          {hasError ? <LoginErrorBanner /> : null}

          <LoginForm callbackUrl={callbackUrl} showGoogle={showGoogle} variant="mobile" />
        </section>
      </div>

      {/* ===== Desktop (≥ lg): split screen (nodo WMXMk) ===== */}
      <div className="hidden min-h-[100dvh] lg:flex">
        {/* Panel editorial */}
        <aside className="relative hidden w-[420px] shrink-0 flex-col justify-between overflow-hidden bg-[#070A19] p-8 lg:flex">
          {/* Glows radiales */}
          <div aria-hidden="true" className="pointer-events-none absolute left-[15%] top-[25%] h-[260px] w-[270px] rounded-full bg-[radial-gradient(circle_at_center,#2563EB66_0%,#2563EB00_70%)] blur-[26px]" />
          <div aria-hidden="true" className="pointer-events-none absolute left-[44%] top-[8%] h-[180px] w-[210px] rounded-full bg-[radial-gradient(circle_at_center,#7C3AED55_0%,#7C3AED00_70%)] blur-[24px]" />

          {/* Puntos editoriales */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {EDITORIAL_DOTS.map((dot) => (
              <span
                className="absolute rounded-full bg-[#8BB3FF]/50"
                key={`${dot.x}-${dot.y}`}
                style={{ height: dot.size, left: dot.x, top: dot.y, width: dot.size }}
              />
            ))}
          </div>

          {/* Franja de acento */}
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[5px] bg-linear-to-r from-blue-600 to-violet-600" />

          {/* Marca Bills */}
          <div className="relative z-10 flex items-center gap-2.5">
            <span className="grid size-[34px] place-items-center rounded-[10px] bg-blue-600 font-funnel-sans text-xl font-extrabold text-white">
              B
            </span>
            {/* El spec del .pen dice #1A1A1A (resto de la versión clara del
                diseño): sobre #070A19 queda casi invisible, así que el wordmark
                se renderiza en blanco como se ve en el PNG. */}
            <span className="font-funnel-sans text-2xl font-extrabold text-white">Bills</span>
          </div>

          {/* Vista de negocio */}
          <div className="relative z-10 flex flex-col gap-4">
            <p className="text-[11px] font-extrabold tracking-[1.2px] text-[#8BB3FF]">PARA NEGOCIOS QUE NO PARAN</p>
            <h1 className="font-funnel-sans text-[38px] font-bold leading-[1.04] text-white">Tu negocio, en órbita :)</h1>
            <p className="text-[15px] font-medium leading-[1.45] text-[#B7C4E4]">
              Ventas, caja y stock para que tu negocio se sienta bajo control.
            </p>

            {/* Ventana flotante Bills */}
            <div className="flex flex-col gap-3.5 rounded-[28px] bg-white p-[18px] shadow-[0_18px_36px_#2563EB44]">
              <div className="flex items-center justify-between">
                <p className="font-funnel-sans text-base font-bold text-[#1A1A1A]">Resumen de hoy</p>
                <span className="flex items-center gap-[5px] rounded-full bg-emerald-50 px-2 py-[5px]">
                  <span className="size-[6px] rounded-full bg-emerald-600" />
                  <span className="text-[10px] font-bold text-emerald-700">Al día</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-[5px] rounded-[10px] bg-[#F6F7FB] p-3">
                  <span className="text-[9px] font-extrabold tracking-[0.8px] text-slate-500">VENTAS</span>
                  <span className="font-mono text-base font-bold text-[#5D5DFF]">$ 84.600</span>
                </div>
                <div className="flex flex-col gap-[5px] rounded-[10px] bg-[#F6F7FB] p-3">
                  <span className="text-[9px] font-extrabold tracking-[0.8px] text-slate-500">CAJA</span>
                  <span className="font-mono text-base font-bold text-[#E07A5F]">$ 42.100</span>
                </div>
              </div>

              <div>
                {LAST_SALES.map((sale) => (
                  <div
                    className="flex items-center justify-between border-b border-[#EEEEEE] py-2.5"
                    key={sale.concept}
                  >
                    <span className="text-xs font-semibold text-[#1A1A1A]">{sale.concept}</span>
                    <span className="font-mono text-[11px] font-bold text-[#5D5DFF]">{sale.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mensaje de confianza */}
          <div className="relative z-10 flex items-center gap-[9px]">
            <ShieldCheck aria-hidden="true" className="shrink-0 text-[#8BB3FF]" size={18} />
            <span className="text-xs font-semibold text-[#B7C4E4]">Datos seguros. Diseñado para negocios reales.</span>
          </div>
        </aside>

        {/* Área de acceso */}
        <div className="flex flex-1 items-center justify-center rounded-tr-[24px] rounded-br-[24px] bg-white px-9 py-12">
          <div className="flex w-full max-w-[360px] flex-col gap-[18px]">
            {/* Marca chica */}
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-blue-600 font-funnel-sans text-[17px] font-extrabold text-white">
                B
              </span>
              <span className="font-funnel-sans text-xl font-extrabold text-slate-950">Bills</span>
            </div>

            <div className="grid gap-2.5">
              <h2 className="font-funnel-sans text-[30px] font-bold leading-[1.08] text-slate-950">Bienvenido de nuevo</h2>
              <p className="text-sm font-medium leading-[1.45] text-slate-500">Ingresá con la cuenta de tu negocio para continuar.</p>
            </div>

            {hasError ? <LoginErrorBanner /> : null}

            <LoginForm callbackUrl={callbackUrl} showGoogle={showGoogle} variant="desktop" />
          </div>
        </div>
      </div>
    </main>
  );
}

function LoginErrorBanner() {
  return (
    <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">
      No pudimos iniciar sesión. Revisá tus datos e intentá de nuevo.
    </p>
  );
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getSafeCallbackUrl(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}
