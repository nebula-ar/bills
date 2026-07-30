// Achica la foto EN EL NAVEGADOR antes de subirla.
//
// Una foto de celular pesa 3-6 MB y el límite de body de una server action es de
// 1 MB. Además, subir 5 MB por una miniatura de 150px desde el celular del
// dueño (con datos móviles, en el mostrador) es una mala idea aunque entrara.
// El servidor igual re-procesa lo que llega: esto es para que el viaje sea corto,
// no para confiar en el cliente.

const MAX_SIDE = 1024;
const QUALITY = 0.82;

export async function resizeImageForUpload(file: File): Promise<File> {
  // Sin soporte de canvas (o en un entorno raro), mandamos el original y que el
  // servidor decida.
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      return file;
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", QUALITY);
    });

    if (!blob) {
      return file;
    }

    return new File([blob], "foto.webp", { type: "image/webp" });
  } catch {
    // HEIC que el navegador no sabe decodificar, por ejemplo: lo manda entero y
    // sharp se encarga del otro lado.
    return file;
  }
}
