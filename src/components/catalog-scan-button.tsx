"use client";

import { lookupProductByCode } from "@/app/catalog/scan-actions";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { ScanProductSheet } from "@/components/scan-product-sheet";
import { QrCode } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Carga de mercadería con la cámara: escaneás, y si el código no está en el
// catálogo se abre el alta guiada; si ya está, te avisa (para no duplicarlo).
// Al terminar vuelve al escáner, listo para el siguiente producto de la caja.

type CatalogScanButtonProps = {
  branchId: string;
  categories: { id: string; name: string }[];
  units: { value: string; label: string }[];
};

export function CatalogScanButton({ branchId, categories, units }: CatalogScanButtonProps) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [pending, setPending] = useState<{ code: string; photo: File | null; preview: string | null } | null>(null);

  // La preview se crea con createObjectURL: hay que soltarla o se filtra memoria.
  useEffect(() => {
    const preview = pending?.preview;
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [pending?.preview]);

  async function handleDetect(code: string, takePhoto: () => Promise<File | null>) {
    if (busy) return;
    setBusy(true);

    try {
      const result = await lookupProductByCode({ code, branchId });

      if (result.found) {
        setFeedback({ tone: "warn", text: `Ya lo tenés: ${result.product.name}` });
        window.setTimeout(() => setFeedback(null), 2200);
        return;
      }

      // Aprovechamos que la cámara está apuntando al producto para quedarnos con
      // la foto: en el alta ya viene lista y no hay que sacarla aparte.
      const photo = await takePhoto();
      const preview = photo ? URL.createObjectURL(photo) : null;

      setScanning(false);
      setPending({ code, photo, preview });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-black text-white transition active:scale-95"
        onClick={() => setScanning(true)}
        type="button"
      >
        <QrCode className="size-4" />
        Escanear
      </button>

      <BarcodeScanner
        feedback={feedback}
        hint="Apuntá al código del producto para cargarlo."
        mode="single"
        onClose={() => setScanning(false)}
        onDetect={handleDetect}
        open={scanning}
        title="Cargar producto"
      />

      {pending ? (
        <ScanProductSheet
          branchId={branchId}
          categories={categories}
          code={pending.code}
          onClose={() => setPending(null)}
          onCreated={(_id, name) => {
            setPending(null);
            toast.success(`${name} agregado al catálogo.`);
            router.refresh();
            // Volvemos al escáner: quien está cargando una caja tiene varios más.
            setScanning(true);
          }}
          open
          photo={pending.photo}
          photoPreview={pending.preview}
          units={units}
        />
      ) : null}
    </>
  );
}
