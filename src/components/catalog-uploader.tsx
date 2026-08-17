"use client";

import { UploaderComponent } from "@syncfusion/ej2-react-inputs";
import { memo, type RefObject } from "react";

// Uploader de EJ2 para las fotos de catálogo (alta y ficha), envuelto en `memo`.
//
// EJ2 mueve el `<input type=file>` que React renderiza adentro de su propio
// wrapper (browse button, drop area). Si React vuelve a reconciliar ese input
// —porque el form re-renderiza al cambiar de paso/pestaña o al guardar la
// foto— el input se pierde y el selector deja de abrir (NEBU-48, bug de QA).
// Las props acá son estables por contrato (`onFile` con useCallback, ref
// estable), así el memo corta el re-render y el input sobrevive mientras el
// diálogo está abierto. Cada apertura del diálogo monta uno nuevo (el form se
// desmonta al cerrar), así la foto se puede volver a elegir en cada sesión.
//
// NO lleva `style={{ display: "none" }}`. Se esconde por CSS
// (`.e-catalog-uploader`, ver syncfusion-catalog.css) con la técnica de 1px
// fuera de flujo, porque un input con `display: none` NO recibe el click
// programático en Chrome: el diálogo de archivos no abre y el botón parece
// roto. Verificado en el navegador.
/**
 * Abre el selector de archivos del Uploader.
 *
 * Vive acá, al lado del componente, porque el motivo por el que no es un
 * `querySelector` directo es un detalle de ESTE uploader: `element` ES el
 * `<input type=file>` —EJ2 se inicializa SOBRE el input, no lo envuelve—, así
 * que buscar adentro devuelve null y el click nunca sale. El botón queda mudo,
 * sin error en consola.
 *
 * Ya pasó dos veces: se arregló en la ficha y el alta se quedó con la versión
 * vieja. Una sola copia, entonces.
 *
 * Se contemplan los dos casos por si una versión futura de EJ2 cambia de
 * estrategia, y se cae al DOM si el ref todavía no llegó.
 */
export function abrirSelectorDeFoto(uploaderRef: RefObject<UploaderComponent | null>) {
  const el = uploaderRef.current?.element as HTMLElement | undefined;
  const input =
    el instanceof HTMLInputElement
      ? el
      : el?.querySelector<HTMLInputElement>("input[type=file]") ??
        document.querySelector<HTMLInputElement>(".e-catalog-uploader input[type=file]");

  input?.click();
}

export const CatalogUploader = memo(function CatalogUploader({
  uploaderRef,
  onFile,
}: {
  uploaderRef: RefObject<UploaderComponent | null>;
  onFile: (file: File | undefined) => void;
}) {
  return (
    // El div envuelve al Uploader para que React lo trate como una hoja: si
    // quedara directo, un re-render del form insertaría hermanos nuevos
    // (ej. el preview) con el input del Uploader como referencia — y EJ2 lo
    // movió a su propio wrapper, así el insertBefore revienta con
    // "NotFoundError" (NEBU-48).
    <div>
      <UploaderComponent
        allowedExtensions=".jpg,.jpeg,.png,.webp,.gif,.avif,.heic,.heif"
        autoUpload={false}
        cssClass="e-catalog-uploader"
        multiple={false}
        ref={uploaderRef}
        selected={(event) => onFile(event.filesData[0]?.rawFile)}
        showFileList={false}
      />
    </div>
  );
});
