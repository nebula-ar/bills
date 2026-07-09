import { Landmark, ReceiptText, Scissors } from "lucide-react";
import Link from "next/link";

export function BarberTerminalNav({
  saleHref,
  active,
  showCashClose = false,
}: {
  saleHref: string;
  active: "sell" | "sales" | "cash";
  showCashClose?: boolean;
}) {
  const base = "grid place-items-center gap-1 rounded-2xl px-2 py-2 text-xs font-black transition";
  const on = "bg-blue-50 text-blue-700";
  const off = "text-slate-500 hover:bg-blue-50 hover:text-blue-700";

  return (
    <nav className="shrink-0 border-t border-slate-200 bg-white px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      <div className={`grid gap-2 ${showCashClose ? "grid-cols-3" : "grid-cols-2"}`}>
        <Link className={`${base} ${active === "sell" ? on : off}`} href={saleHref}>
          <Scissors aria-hidden="true" size={18} />
          Nueva venta
        </Link>
        <Link className={`${base} ${active === "sales" ? on : off}`} href="/barber/mis-ventas">
          <ReceiptText aria-hidden="true" size={18} />
          Mis ventas
        </Link>
        {showCashClose ? (
          <Link className={`${base} ${active === "cash" ? on : off}`} href="/barber/cierre">
            <Landmark aria-hidden="true" size={18} />
            Cerrar caja
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
