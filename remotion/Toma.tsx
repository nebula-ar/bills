import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";

// Una toma es una captura real de la app con movimiento de cámara encima. La
// imagen NUNCA se deforma: se escala en proporción y se recorta el sobrante, que
// es lo que pide el brief ("sin deformar la interfaz").
//
// El encuadre se expresa en porcentaje del alto/ancho de la imagen, así se puede
// apuntar a una zona concreta (las métricas, el total) sin coordenadas mágicas
// atadas a una resolución.
export type Encuadre = {
  escala: number;
  x: number; // -1 (izquierda) .. 1 (derecha)
  y: number; // -1 (arriba) .. 1 (abajo)
};

type TomaProps = {
  archivo: string;
  desde: Encuadre;
  hasta: Encuadre;
  duracion: number;
  /** Frames de fundido de entrada. El primer plano del video no lleva. */
  fadeIn?: number;
};

// Curva suave de entrada y salida: el movimiento arranca y frena despacio. Con
// `linear` la cámara se siente mecánica, que es justo lo que el brief evita.
const CINE = Easing.bezier(0.33, 0, 0.15, 1);

export const Toma: React.FC<TomaProps> = ({ archivo, desde, hasta, duracion, fadeIn = 12 }) => {
  const frame = useCurrentFrame();

  const avance = interpolate(frame, [0, duracion], [0, 1], {
    easing: CINE,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacidad = interpolate(frame, [0, fadeIn], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const escala = desde.escala + (hasta.escala - desde.escala) * avance;
  const x = desde.x + (hasta.x - desde.x) * avance;
  const y = desde.y + (hasta.y - desde.y) * avance;

  // Cuánto puede desplazarse sin descubrir el borde: la mitad del excedente que
  // genera la escala. Así el encuadre nunca deja ver fondo vacío.
  //
  // Ojo con el divisor por `escala`: en `scale(s) translate(t%)` el translate se
  // aplica en el sistema YA escalado, así que un t% se convierte en s·t% de
  // pantalla. Sin dividir, con escala 2 la imagen se va al doble de lejos de lo
  // pedido y el encuadre termina fuera de cuadro.
  const margen = (escala - 1) / (2 * escala);
  const desplazamientoX = -x * margen * 100;
  const desplazamientoY = -y * margen * 100;

  return (
    <AbsoluteFill style={{ backgroundColor: "#f5f4ef", opacity: opacidad, overflow: "hidden" }}>
      <Img
        src={staticFile(archivo)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${escala}) translate(${desplazamientoX}%, ${desplazamientoY}%)`,
        }}
      />
    </AbsoluteFill>
  );
};
