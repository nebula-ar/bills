import { PosTerminals } from "@/components/pos-terminals";
import { requireAdminSession } from "@/lib/auth";
import { getSaleEntryBranches } from "@/modules/sales/get-sale-entry-options.use-case";
import { getBranchTerminals } from "@/modules/terminals/terminal.use-cases";
import { ArrowRight, MapPin, Scissors, ShoppingBag, Store } from "lucide-react";
import Link from "next/link";

export default async function PosLauncherPage() {
  const session = await requireAdminSession();

  const branches = await getSaleEntryBranches(session.user.businessId);
  const terminalsByBranch = await Promise.all(branches.map((branch) => getBranchTerminals(branch.id)));
  const businessName = branches[0]?.business.name ?? "Barber Bills";

  return (
    <main className="mx-auto min-h-screen w-full min-w-0 max-w-[560px] overflow-x-clip bg-[#f6f7fb] px-4 pb-28 pt-6 text-slate-950 lg:max-w-[1080px] lg:px-8">
      <header className="duration-500 animate-in fade-in slide-in-from-top-2">
        <p className="truncate text-sm font-medium text-slate-500">{businessName}</p>
        <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">Puntos de venta</h1>
        <p className="mt-1 text-sm text-slate-500">Tocá una caja para vender, o copiá su link para que los barberos carguen ventas con su PIN.</p>
      </header>

      {branches.length === 0 ? (
        <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No hay sucursales listas para vender. Cargá una sucursal con al menos un barbero y un servicio activos.
          <Link className="mt-4 inline-flex rounded-full bg-blue-600 px-4 py-2.5 text-sm font-black text-white" href="/branches">
            Ir a Sucursales
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
                      <Scissors className="size-3" />
                      {branch.users.length} {branch.users.length === 1 ? "barbero" : "barberos"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[0.7rem] font-bold text-slate-600">
                      <ShoppingBag className="size-3" />
                      {branch.servicePrices.length} {branch.servicePrices.length === 1 ? "servicio" : "servicios"}
                    </span>
                  </div>
                </div>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                  <ArrowRight className="size-5" />
                </span>
              </Link>
              <PosTerminals
                branch={{ id: branch.id, name: branch.name, barbers: branch.users.map((barber) => ({ id: barber.id, name: barber.name })) }}
                customTerminals={terminalsByBranch[index]}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
