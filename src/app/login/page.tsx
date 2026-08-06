import Image from "next/image";
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

// Signos "+" dispersos del fondo oscuro mobile (textura del mockup W97ZG).
const EDITORIAL_PLUSES = [
  { x: 30, y: 140, size: 14 },
  { x: 336, y: 190, size: 11 },
  { x: 56, y: 300, size: 9 },
  { x: 322, y: 330, size: 12 },
  { x: 180, y: 250, size: 8 },
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

        {/* Textura de signos "+" dispersos (mockup mobile) */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {EDITORIAL_PLUSES.map((plus) => (
            <span
              className="absolute font-extrabold leading-none text-[#8BB3FF]/40"
              key={`${plus.x}-${plus.y}`}
              style={{ fontSize: plus.size, left: plus.x, top: plus.y }}
            >
              +
            </span>
          ))}
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

        {/* Marca Bills */}
        <div className="relative z-10 flex items-center gap-2.5 px-5 pt-4">
          <span className="grid size-8 place-items-center rounded-lg bg-blue-600 font-funnel-sans text-lg font-extrabold text-white">
            B
          </span>
          <span className="font-funnel-sans text-xl font-extrabold text-white">Bills</span>
        </div>

        {/* Ilustración en el espacio oscuro: la misma escena completa que en
            web, anclada al borde inferior para que la hoja de acceso la cubra
            apenas (como en el mockup mobile), sin hueco entre ambas. */}
        <div className="relative z-10 flex min-h-0 flex-1 items-end justify-center px-6">
          <Image
            alt="Ilustración: tu negocio con ventas, caja y stock en órbita"
            className="-mb-10 max-h-[300px] w-auto max-w-full object-contain"
            height={1024}
            priority
            src="/login/illustrations/login-orbit-desktop-v1.png"
            width={1536}
          />
        </div>

        {/* Hoja blanca de acceso */}
        <section className="relative z-10 flex flex-col items-center gap-4 rounded-t-[32px] bg-white px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-[18px]">
          <div aria-hidden="true" className="h-[5px] w-[46px] shrink-0 rounded-full bg-slate-300" />

          <h1 className="text-center font-montserrat text-[23px] font-bold text-slate-950">Ingresá a Bills</h1>
          <p className="text-center text-xs text-slate-500">Accedé a tu negocio para continuar</p>

          {hasError ? <LoginErrorBanner /> : null}

          <LoginForm callbackUrl={callbackUrl} showGoogle={showGoogle} variant="mobile" />
        </section>
      </div>

      {/* ===== Desktop (≥ lg): split screen (nodo WMXMk) ===== */}
      <div className="hidden min-h-[100dvh] lg:flex">
        {/* Panel editorial */}
        <aside className="relative hidden w-[50%] max-w-[900px] shrink-0 flex-col justify-between overflow-hidden bg-[#070A19] p-8 lg:flex">
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

            {/* Ilustración principal: la dueña del negocio con ventas, caja y
                stock en órbita (reemplaza la tarjeta de preview del mockup). */}
            <Image
              alt="Ilustración: tu negocio con ventas, caja y stock en órbita"
              className="mx-auto w-full max-w-[620px]"
              height={1024}
              priority
              src="/login/illustrations/login-orbit-desktop-v1.png"
              width={1536}
            />
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
