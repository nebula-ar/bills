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
        style={{ display: "none" }}
      />
    </div>
  );
});
