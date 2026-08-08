import { Landmark, ReceiptText, ShoppingBag } from "@/components/icons";
import Link from "next/link";

export function StaffTerminalNav({
  saleHref,
  active,
  showCashClose = false,
}: {
  saleHref: string;
  active: "sell" | "sales" | "cash";
  showCashClose?: boolean;
}) {
  const base = "grid place-items-center gap-1 rounded-2xl px-2 py-2 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
  const on = "bg-primary/10 text-primary";
  const off = "text-slate-500 hover:bg-primary/10 hover:text-primary";

  return (
    <nav className="shrink-0 border-t border-slate-200 bg-white px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      <div className={`grid gap-2 ${showCashClose ? "grid-cols-3" : "grid-cols-2"}`}>
        <Link className={`${base} ${active === "sell" ? on : off}`} href={saleHref}>
          <ShoppingBag aria-hidden="true" size={18} />
          Nueva venta
        </Link>
        <Link className={`${base} ${active === "sales" ? on : off}`} href="/terminal/mis-ventas">
          <ReceiptText aria-hidden="true" size={18} />
          Mis ventas
        </Link>
        {showCashClose ? (
          <Link className={`${base} ${active === "cash" ? on : off}`} href="/terminal/cierre">
            <Landmark aria-hidden="true" size={18} />
            Cerrar caja
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
