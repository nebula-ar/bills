import Link from "next/link";

import { ArrowRight, ShoppingBag, TrendingUp } from "@/components/icons";
import { LogoutButton } from "@/components/logout-button";
// `requireAppSession` y no el `requireAdminSession` de master: esta rama sumó
// mozo, cajero, encargado y cocina, y con el guard de admin el hub los rebotaba
// contra `/` para siempre. Qué ve cada uno lo decide `destinosDelHub`.
import { requireAppSession } from "@/lib/auth";
import { BrandLogo } from "@/lib/brand-logo";
import { capabilitiesOf } from "@/lib/capabilities";
import { destinosDelHub } from "@/modules/auth/hub";
import { findUserWithSellsAs } from "@/modules/auth/user.repository";

// La primera pantalla después de entrar. El dueño de un comercio chico usa la
// app para dos cosas que no se parecen en nada —mirar cómo va el negocio y
// cobrar en el mostrador— y hasta ahora caía siempre en el panel: para vender
// tenía que aprender por dónde se iba. Acá elige, y la elección alcanza.
//
// Mismo sistema visual que el login (y que la landing): fondo crema, tarjeta
// hueso, tipografía display pesada y el azul var(--primary) como único acento. Entrar
// no puede sentirse como cambiar de producto.
export default async function EntrarPage() {
  // Acepta cualquier rol que trabaje con la app, no solo admin. Cuando esto
  // exigía admin, `/` mandaba acá a cualquiera con sesión y acá se lo devolvía
  // a `/`: un cajero rebotaba entre las dos rutas para siempre y la pantalla
  // quedaba trabada en su esqueleto, sin un error en el log.
  const session = await requireAppSession();
  const user = await findUserWithSellsAs(session.user.id);

  // Solo el nombre de pila: "Hola, María Fernanda Gómez" no lo saluda nadie.
  const firstName = (user?.name ?? "").trim().split(" ")[0] ?? "";
  // Tiene gemelo empleado, así que el mostrador ya sabe que cobra él. Sin
  // gemelo la venta también se puede hacer, pero el POS va a preguntar quién
  // atiende: no le prometemos algo que no va a pasar.
  const sellsAsSelf = Boolean(user?.sellsAsId);
  const destinos = destinosDelHub(capabilitiesOf(session.user.role));

  return (
    <main className="flex min-h-[100dvh] flex-col bg-[var(--background)] pb-24 text-slate-950 sm:items-center sm:justify-center sm:px-6 sm:py-10 sm:pb-32">
      {/* En celular ocupa toda la pantalla (es una PWA y esta es la primera
          pantalla real de la sesión); de sm para arriba se vuelve tarjeta. */}
      <section className="flex w-full flex-1 flex-col bg-[var(--card)] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] sm:min-h-0 sm:max-w-[26rem] sm:flex-none sm:rounded-3xl sm:border sm:border-slate-950/10 sm:px-8 sm:py-10 sm:shadow-[0_30px_80px_-20px_rgba(17,19,21,0.32)]">
        <div className="flex flex-1 flex-col justify-center gap-7 sm:flex-none">
          <div className="grid gap-5">
            {/* La marca real de master reemplaza a la "B" dibujada a mano. */}
            <span className="inline-flex w-fit items-center gap-2.5">
              <BrandLogo variant="blue" height={34} />
            </span>

            <div>
              <h1 className="text-[2.5rem] font-black leading-[0.95] tracking-[-0.06em] text-slate-950">
                Hola{firstName ? `, ${firstName}` : ""}
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">¿Qué querés hacer?</p>
            </div>
          </div>

          <div className="grid gap-3">
            {destinos.map((destino) => (
              <Link
                key={destino.href}
                className="group flex items-center gap-4 rounded-2xl border border-slate-950/10 bg-white p-5 transition hover:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 active:scale-[0.99]"
                href={destino.href}
              >
                <span
                  className={
                    destino.href === "/pos"
                      ? "grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--primary)] text-white"
                      : "grid size-12 shrink-0 place-items-center rounded-2xl bg-slate-950 text-[var(--accent-brand)]"
                  }
                >
                  {destino.href === "/pos" ? <ShoppingBag className="size-6" /> : <TrendingUp className="size-6" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xl font-black tracking-[-0.04em] text-slate-950">{destino.label}</span>
                  <span className="mt-0.5 block text-sm leading-5 text-slate-600">
                    {destino.href === "/pos" && sellsAsSelf
                      ? "Cobrás en el mostrador y la venta queda a tu nombre."
                      : destino.hint}
                  </span>
                </span>
                <ArrowRight className="size-5 shrink-0 text-slate-400 transition group-hover:text-[var(--primary)]" />
              </Link>
            ))}

            {destinos.length === 0 && (
              // Pasa con el mozo y el cocinero: sus pantallas todavía no
              // existen. Decirlo es mejor que dejar la pantalla vacía, y MUCHO
              // mejor que redirigir, que es como se armó el rebote.
              <p className="rounded-2xl border border-slate-950/10 bg-white p-5 text-sm leading-6 text-slate-600">
                Tu cuenta todavía no tiene pantallas asignadas. Pedile al
                encargado que revise tu rol.
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200 pt-6 sm:mt-8">
          <LogoutButton className="-ml-2 px-2" />
        </div>
      </section>
    </main>
  );
}
