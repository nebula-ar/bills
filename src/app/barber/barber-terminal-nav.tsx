import { ReceiptText, Scissors } from "lucide-react";
import Link from "next/link";

export function BarberTerminalNav({ saleHref, active }: { saleHref: string; active: "sell" | "sales" }) {
  const base = "grid place-items-center gap-1 rounded-2xl px-2 py-2 text-xs font-black transition";
  const on = "bg-blue-50 text-blue-700";
  const off = "text-slate-500 hover:bg-blue-50 hover:text-blue-700";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-slate-200 bg-white/95 px-5 py-3 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur sm:bottom-8 sm:rounded-b-[2.5rem]">
      <div className="grid grid-cols-2 gap-2">
        <Link className={`${base} ${active === "sell" ? on : off}`} href={saleHref}>
          <Scissors aria-hidden="true" size={18} />
          Nueva venta
        </Link>
        <Link className={`${base} ${active === "sales" ? on : off}`} href="/barber/mis-ventas">
          <ReceiptText aria-hidden="true" size={18} />
          Mis ventas
        </Link>
      </div>
    </nav>
  );
}
