import Link from "next/link";

import { ArrowRight, ShoppingBag, TrendingUp } from "@/components/icons";
import { LogoutButton } from "@/components/logout-button";
import { requireAdminSession } from "@/lib/auth";
import { findUserWithSellsAs } from "@/modules/auth/user.repository";

// La primera pantalla después de entrar. El dueño de un comercio chico usa la
// app para dos cosas que no se parecen en nada —mirar cómo va el negocio y
// cobrar en el mostrador— y hasta ahora caía siempre en el panel: para vender
// tenía que aprender por dónde se iba. Acá elige, y la elección alcanza.
//
// Mismo sistema visual que el login (y que la landing): fondo crema, tarjeta
// hueso, tipografía display pesada y el azul #3158e8 como único acento. Entrar
// no puede sentirse como cambiar de producto.
export default async function EntrarPage() {
  const session = await requireAdminSession();
  const user = await findUserWithSellsAs(session.user.id);

  // Solo el nombre de pila: "Hola, María Fernanda Gómez" no lo saluda nadie.
  const firstName = (user?.name ?? "").trim().split(" ")[0] ?? "";
  // Tiene gemelo empleado, así que el mostrador ya sabe que cobra él. Sin
  // gemelo la venta también se puede hacer, pero el POS va a preguntar quién
  // atiende: no le prometemos algo que no va a pasar.
  const sellsAsSelf = Boolean(user?.sellsAsId);

  return (
    <main className="flex min-h-[100dvh] flex-col bg-[#f5f4ef] pb-24 text-slate-950 sm:items-center sm:justify-center sm:px-6 sm:py-10 sm:pb-32">
      {/* En celular ocupa toda la pantalla (es una PWA y esta es la primera
          pantalla real de la sesión); de sm para arriba se vuelve tarjeta. */}
      <section className="flex w-full flex-1 flex-col bg-[#fffef9] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] sm:min-h-0 sm:max-w-[26rem] sm:flex-none sm:rounded-[28px] sm:border sm:border-slate-950/10 sm:px-8 sm:py-10 sm:shadow-[0_30px_80px_-20px_rgba(17,19,21,0.32)]">
        <div className="flex flex-1 flex-col justify-center gap-7 sm:flex-none">
          <div className="grid gap-5">
            <span className="inline-flex w-fit items-center gap-2.5 text-lg font-black tracking-[-0.04em] text-slate-950">
              <span className="grid size-9 place-items-center rounded-xl bg-slate-950 text-base font-black text-[#d7ef62]">B</span>
              Bills
            </span>

            <div>
              <h1 className="text-[2.5rem] font-black leading-[0.95] tracking-[-0.06em] text-slate-950">
                Hola{firstName ? `, ${firstName}` : ""}
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">¿Qué querés hacer?</p>
            </div>
          </div>

          <div className="grid gap-3">
            <Link
              className="group flex items-center gap-4 rounded-[20px] border border-slate-950/10 bg-white p-5 transition hover:border-[#3158e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3158e8] focus-visible:ring-offset-2 active:scale-[0.99]"
              href="/dashboard"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-slate-950 text-[#d7ef62]">
                <TrendingUp className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xl font-black tracking-[-0.04em] text-slate-950">Panel</span>
                <span className="mt-0.5 block text-sm leading-5 text-slate-600">
                  Ventas, caja, stock y reportes.
                </span>
              </span>
              <ArrowRight className="size-5 shrink-0 text-slate-400 transition group-hover:text-[#3158e8]" />
            </Link>

            <Link
              className="group flex items-center gap-4 rounded-[20px] border border-slate-950/10 bg-white p-5 transition hover:border-[#3158e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3158e8] focus-visible:ring-offset-2 active:scale-[0.99]"
              href="/pos"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#3158e8] text-white">
                <ShoppingBag className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xl font-black tracking-[-0.04em] text-slate-950">Vender</span>
                <span className="mt-0.5 block text-sm leading-5 text-slate-600">
                  {sellsAsSelf
                    ? "Cobrás en el mostrador y la venta queda a tu nombre."
                    : "Cobrás en el mostrador, eligiendo quién atiende."}
                </span>
              </span>
              <ArrowRight className="size-5 shrink-0 text-slate-400 transition group-hover:text-[#3158e8]" />
            </Link>
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200 pt-6 sm:mt-8">
          <LogoutButton className="-ml-2 px-2" />
        </div>
      </section>
    </main>
  );
}
