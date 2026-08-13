// Configuración global de Syncfusion EJ2: license key + locale español.
//
// Este módulo se importa desde componentes client (browser). Se ejecuta una
// sola vez en el module scope — antes de que renderice cualquier componente
// EJ2 — así la license queda registrada y el locale `es` aplicado desde el
// primer render (sin parpadeo en inglés).
//
// Dónde vive la license key: Syncfusion exige registrarla en el bundle del
// cliente (los componentes EJ2 verifican la license en runtime en el browser).
// La key NO es un secreto: Syncfusion la entrega para incrustarla en el cliente
// y un banner de licencia inválida aparecería si no se registrara. Para no
// hardcodearla, se puede overridear por entorno con NEXT_PUBLIC_SYNCFUSION_LICENSE_KEY;
// por defecto se usa la key de la licencia de Bills.
import { L10n, registerLicense, setCulture } from "@syncfusion/ej2-base";
import esLocale from "@syncfusion/ej2-locale/src/es.json";

const SYNC_FUSION_LICENSE_KEY =
  process.env.NEXT_PUBLIC_SYNCFUSION_LICENSE_KEY ??
  "Ngo9BigBOggjHTQxAR8/V1JAaF5cX2pCd1p/TH5YfUNzdUVEY1ZUTXxaS1ZhSXxVdk1iW35bcXdRRGlVVEF9XEY=";

registerLicense(SYNC_FUSION_LICENSE_KEY);

// Locale global `es`: todos los textos internos de los componentes EJ2 del
// dashboard (grid: "No hay registros que mostrar", paginación, calendarios,
// diálogos, tooltips, empty states) renderizan en español.
L10n.load(esLocale as unknown as Record<string, Record<string, string>>);
setCulture("es");
