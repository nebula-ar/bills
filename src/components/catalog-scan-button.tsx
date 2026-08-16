"use client";

import { lookupProductByCode } from "@/app/catalog/scan-actions";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { ScanProductSheet } from "@/components/scan-product-sheet";
import { QrCode } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

// Carga de mercadería con la cámara: escaneás, y si el código no está en el
// catálogo se abre el alta guiada; si ya está, te avisa (para no duplicarlo).
// Al terminar vuelve al escáner, listo para el siguiente producto de la caja.
//
// Antes de preguntar nada se busca el código en la base pública de productos: si
// está, el nombre viene escrito y la foto es la del producto. Solo si no está se
// guarda el cuadro de la cámara, que apuntando al código suele ser... el código.

type CatalogScanButtonProps = {
  branchId: string;
  categories: { id: string; name: string }[];
  units: { value: string; label: string }[];
  // Disparador propio. Sin esto rinde la píldora "Escanear" del header; el
  // catálogo vacío lo usa para que la tarjeta entera abra la cámara, en vez de
  // ser una tarjeta con un botón adentro repitiendo su propio título.
  renderTrigger?: (open: () => void) => ReactNode;
  // Modo controlado, para cuando quien abre la cámara vive afuera: el selector
  // de "Nuevo producto" es un diálogo del catálogo, no un botón de acá, y el
  // «+» flotante tiene que llegar al mismo lugar. Los dos props van juntos; si
  // no vienen, el componente maneja su estado como siempre.
  scanning?: boolean;
  onScanningChange?: (open: boolean) => void;
};

export function CatalogScanButton({
  branchId,
  categories,
  units,
  renderTrigger,
  scanning: scanningProp,
  onScanningChange,
}: CatalogScanButtonProps) {
  const router = useRouter();
  const [scanningPropio, setScanningPropio] = useState(false);
  const controlado = scanningProp !== undefined;
  const scanning = controlado ? scanningProp : scanningPropio;
  const setScanning = (open: boolean) => {
    if (!controlado) setScanningPropio(open);
    onScanningChange?.(open);
  };
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [pending, setPending] = useState<{
    code: string;
    photo: File | null;
    preview: string | null;
    // La foto que ya está online: no hay archivo que subir, la baja el servidor.
    fromDirectory: boolean;
    suggestedName: string;
  } | null>(null);

  // La preview se crea con createObjectURL: hay que soltarla o se filtra memoria.
  // La de la base pública es una URL común y no se toca.
  useEffect(() => {
    const preview = pending?.fromDirectory ? null : pending?.preview;
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [pending?.preview, pending?.fromDirectory]);

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

      const suggestion = result.suggestion;

      if (suggestion) {
        setFeedback({ tone: "ok", text: `Lo encontramos: ${suggestion.name}` });
        window.setTimeout(() => setFeedback(null), 1800);
      }

      // Con foto de la base no hace falta sacar ninguna. Sin ella, se guarda el
      // cuadro de la cámara como antes (y en el alta se puede descartar).
      const photo = suggestion?.imageUrl ? null : await takePhoto();
      const preview = suggestion?.imageUrl ?? (photo ? URL.createObjectURL(photo) : null);

      setScanning(false);
      setPending({
        code,
        photo,
        preview,
        fromDirectory: Boolean(suggestion?.imageUrl),
        suggestedName: suggestion?.name ?? "",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {renderTrigger ? (
        renderTrigger(() => setScanning(true))
      ) : controlado ? // Controlado y sin trigger propio: el botón que abre la cámara vive
      // afuera, así que acá no se dibuja ninguno. Solo queda la maquinaria
      // (cámara, búsqueda del código, alta guiada).
      null : (
        <button
          // Apple reserva el pill (rounded-full) para la acción azul primaria;
          // los botones utilitarios oscuros (Sign In, Bag) van en rounded-md,
          // así que este no se pilliza aunque el resto de la pantalla sí.
          className="flex items-center gap-2 rounded-md bg-[#1d1d1f] px-4 py-2.5 text-sm font-black text-white transition active:scale-95"
          onClick={() => setScanning(true)}
          type="button"
        >
          <QrCode className="size-4" />
          Escanear
        </button>
      )}

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
          photoFromDirectory={pending.fromDirectory}
          photoPreview={pending.preview}
          suggestedName={pending.suggestedName}
          units={units}
        />
      ) : null}
    </>
  );
}
