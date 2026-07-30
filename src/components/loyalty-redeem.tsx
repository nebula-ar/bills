"use client";

import { redeemPointsAction } from "@/app/marketing/actions";
import { Loader2 } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

// Canje de puntos desde la ficha del cliente.
//
// Igual que la configuración de marketing: la acción devuelve resultado y acá
// se llama a `router.refresh()`. Un `redirect()` a la misma ruta no vuelve a
// pedir el árbol y el saldo seguiría mostrando los puntos ya canjeados.

export function LoyaltyRedeem({
  customerId,
  branchId,
  balance,
}: {
  customerId: string;
  branchId: string;
  balance: number;
}) {
  const router = useRouter();
  const [points, setPoints] = useState(String(balance));
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await redeemPointsAction({ customerId, branchId, points: Number(points) });

      if (result.ok) {
        toast.success(`Canjeaste ${result.points} puntos por $${result.value} a favor del cliente.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-end gap-2">
      <label className="grid gap-1 text-[0.65rem] font-black uppercase tracking-wide text-white/50">
        Canjear
        <input
          className="w-24 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-bold text-white outline-none"
          inputMode="numeric"
          onChange={(event) => setPoints(event.target.value.replace(/\D/g, ""))}
          value={points}
        />
      </label>
      <button
        className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950 transition active:scale-95 disabled:opacity-50"
        disabled={isPending || Number(points) <= 0}
        onClick={submit}
        type="button"
      >
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
        Canjear
      </button>
    </div>
  );
}
