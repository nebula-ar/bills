import { AbsoluteFill, Sequence } from "remotion";

import { BillsIntro } from "./BillsIntro";
import { Toma, type Encuadre } from "./Toma";

export const PROMO_FPS = 30;

// Las tomas se encadenan solapadas: cada una entra con fundido mientras la
// anterior todavía está en pantalla. Eso da el corte suave que pide el brief en
// vez de un cambio seco.
const SOLAPE = 10;

// Cada escena dura entre 1,5 y 2,2 segundos: "rápidas pero elegantes". Nada se
// queda quieto lo suficiente como para aburrir.
type Escena = { archivo: string; desde: Encuadre; hasta: Encuadre; duracion: number };

const ESCENAS: Escena[] = [
  // 1. La app aparece: fundido y un scale-up mínimo, como si la cámara se
  //    posara sobre el producto.
  {
    archivo: "promo/02-dashboard.png",
    desde: { escala: 1.0, x: 0, y: -0.2 },
    hasta: { escala: 1.08, x: 0, y: -0.1 },
    duracion: 66,
  },
  // 2. Acercamiento a los números que importan (ventas del día, ganancia,
  //    ticket promedio), arriba a la derecha.
  {
    archivo: "promo/02-dashboard.png",
    desde: { escala: 1.2, x: 0.35, y: -0.75 },
    hasta: { escala: 1.5, x: 0.5, y: -0.65 },
    duracion: 60,
  },
  // 3. Paneo horizontal muy sutil sobre lo más vendido y el rendimiento por
  //    empleado: muestra densidad de información sin que se lea forzado.
  {
    archivo: "promo/02-dashboard.png",
    desde: { escala: 1.35, x: -0.5, y: 0.35 },
    hasta: { escala: 1.35, x: 0.5, y: 0.2 },
    duracion: 62,
  },
  // 4. Transición al catálogo. Encuadre alto: la grilla de productos todavía no
  //    tiene fotos cargadas y no conviene mostrarla de lleno.
  {
    archivo: "promo/03-productos.png",
    desde: { escala: 1.25, x: 0, y: -0.8 },
    hasta: { escala: 1.12, x: 0, y: -0.6 },
    duracion: 55,
  },
  // 5. El mostrador, entrando desde el detalle hacia el plano general: se
  //    entiende de qué se trata la pantalla antes de operar en ella.
  {
    archivo: "promo/04-mostrador.png",
    desde: { escala: 1.45, x: -0.6, y: -0.7 },
    hasta: { escala: 1.15, x: -0.2, y: -0.3 },
    duracion: 58,
  },
  // 6. La venta armada, sobre el panel derecho: el pedido con sus renglones.
  //    El encuadre a la derecha deja fuera la fila de vendedores.
  {
    archivo: "promo/06-venta.png",
    desde: { escala: 1.5, x: 0.92, y: -0.55 },
    hasta: { escala: 1.6, x: 0.95, y: 0.1 },
    duracion: 62,
  },
  // 7. El total. Es el momento de énfasis del video: la cámara se cierra sobre
  //    el número y el botón de cobrar.
  {
    archivo: "promo/06-venta.png",
    desde: { escala: 1.9, x: 0.95, y: 0.8 },
    hasta: { escala: 2.1, x: 0.96, y: 0.86 },
    duracion: 58,
  },
  // 8. Zoom-out final: la app entera, quieta y legible, como pide el cierre.
  {
    archivo: "promo/02-dashboard.png",
    desde: { escala: 1.18, x: 0, y: 0 },
    hasta: { escala: 1.0, x: 0, y: 0 },
    duracion: 70,
  },
];

const CIERRE_DURACION = 78;

// Offsets acumulados con solape. Se calcula una vez para no repetir aritmética
// en el JSX, donde un error de un frame es invisible hasta el render final.
const OFFSETS = ESCENAS.reduce<number[]>((acc, escena, i) => {
  const anterior = acc[i - 1] ?? 0;
  const duracionAnterior = ESCENAS[i - 1]?.duracion ?? 0;
  acc.push(i === 0 ? 0 : anterior + duracionAnterior - SOLAPE);
  return acc;
}, []);

const ULTIMA = OFFSETS[OFFSETS.length - 1] + ESCENAS[ESCENAS.length - 1].duracion;

export const PROMO_DURACION_EN_FRAMES = ULTIMA - SOLAPE + CIERRE_DURACION;

export const Promo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#f5f4ef" }}>
    {ESCENAS.map((escena, i) => (
      <Sequence
        key={`${escena.archivo}-${i}`}
        from={OFFSETS[i]}
        durationInFrames={escena.duracion}
      >
        <Toma
          archivo={escena.archivo}
          desde={escena.desde}
          hasta={escena.hasta}
          duracion={escena.duracion}
          // La primera toma no cruza con nada: entra desde el fondo limpio.
          fadeIn={i === 0 ? 20 : SOLAPE}
        />
      </Sequence>
    ))}

    <Sequence from={ULTIMA - SOLAPE} durationInFrames={CIERRE_DURACION}>
      <BillsIntro duracion={CIERRE_DURACION} />
    </Sequence>
  </AbsoluteFill>
);
