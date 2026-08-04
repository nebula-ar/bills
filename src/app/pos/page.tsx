import { PosTerminals } from "@/components/pos-terminals";
import { requireBusinessContext } from "@/lib/business-context";
import { getSaleEntryBranches } from "@/modules/sales/get-sale-entry-options.use-case";
import { diagnoseNoSaleBranches } from "@/modules/sales/sale.repository";
import { getTerminalsByBranchIds } from "@/modules/terminals/terminal.use-cases";
import { ArrowRight, MapPin, ShoppingBag, Store, Users } from "@/components/icons";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function PosLauncherPage() {
  // Con el contexto del negocio y no solo la sesión: los mensajes de "todavía
  // no cargaste nada" tienen que hablar del rubro. En una barbería son
  // servicios, no productos, igual que en el resto de la app.
  const { session, business } = await requireBusinessContext();

  const branches = await getSaleEntryBranches(session.user.businessId);

  // Con una sola sucursal esta pantalla no decide nada: es un toque de peaje
  // antes de cada venta, con el cliente esperando. Se va directo a cobrar.
  // (Los links de terminales para los empleados siguen estando en Terminales.)
  if (branches.length === 1) {
    redirect(`/sales/new?branchId=${branches[0].id}`);
  }

  // Cuando no hay nada que ofrecer hay que decir QUÉ falta. Recién después del
  // alta lo que falta es el catálogo, no la sucursal: el mensaje viejo mandaba
  // a Sucursales, que es justo lo único que ya estaba hecho.
  const missing = branches.length === 0 ? await diagnoseNoSaleBranches(session.user.businessId) : null;
  const gap = !missing
    ? null
    : !missing.hasBranch
      ? { text: "Todavía no cargaste ninguna sucursal.", href: "/branches", cta: "Cargar una sucursal" }
      : !missing.hasStaff
        ? { text: "Falta cargar a quién atiende.", href: "/staff", cta: "Cargar un empleado" }
        : !missing.hasPricedProduct
          ? {
              text: `Todavía no cargaste tus ${business.labels.catalogPlural.toLowerCase()}. Sin eso no hay nada para vender.`,
              href: "/catalog",
              cta: `Cargar mis ${business.labels.catalogPlural.toLowerCase()}`,
            }
          : { text: "No hay sucursales listas para vender.", href: "/branches", cta: "Ir a Sucursales" };

  const terminalsByBranch = await getTerminalsByBranchIds(branches.map((branch) => branch.id));
  const businessName = branches[0]?.business.name ?? "Bills";

  return (
    <main className="mx-auto min-h-screen w-full min-w-0 max-w-[560px] overflow-x-clip bg-[#f6f7fb] px-4 pb-28 pt-6 text-slate-950 lg:max-w-[1080px] lg:px-8">
      <header className="duration-500 animate-in fade-in slide-in-from-top-2">
        <p className="truncate text-sm font-medium text-slate-500">{businessName}</p>
        <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">Puntos de venta</h1>
        <p className="mt-1 text-sm text-slate-500">Tocá una caja para vender, o copiá su link para que los empleados carguen ventas con su PIN.</p>
      </header>

      {gap ? (
        <div className="mt-6 grid justify-items-center gap-4 rounded-[1.5rem] border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          <p className="max-w-sm">{gap.text}</p>
          <Link className="inline-flex rounded-full bg-blue-600 px-4 py-2.5 text-sm font-black text-white" href={gap.href}>
            {gap.cta}
          </Link>
        </div>
      ) : (
        <ul className="mt-5 space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
          {branches.map((branch, index) => (
            <li
              className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-slate-950/5 duration-500 animate-in fade-in slide-in-from-bottom-3"
              key={branch.id}
              style={{ animationDelay: `${Math.min(index * 60, 360)}ms`, animationFillMode: "backwards" }}
            >
              <Link className="flex items-center gap-4 transition active:scale-[0.99]" href={`/sales/new?branchId=${branch.id}`}>
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-600/25">
                  <Store className="size-7" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-black leading-tight text-slate-950">{branch.name}</p>
                  {branch.address ? (
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                      <MapPin className="size-3 shrink-0" />
                      {branch.address}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[0.7rem] font-bold text-slate-600">
                      <Users className="size-3" />
                      {branch.users.length} {branch.users.length === 1 ? "empleado" : "empleados"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[0.7rem] font-bold text-slate-600">
                      <ShoppingBag className="size-3" />
                      {branch.productPrices.length} {branch.productPrices.length === 1 ? "servicio" : "servicios"}
                    </span>
                  </div>
                </div>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                  <ArrowRight className="size-5" />
                </span>
              </Link>
              <PosTerminals
                branch={{ id: branch.id, name: branch.name, staffs: branch.users.map((staff) => ({ id: staff.id, name: staff.name })) }}
                customTerminals={terminalsByBranch.get(branch.id) ?? []}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
