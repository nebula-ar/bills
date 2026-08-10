import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const INTRO_FPS = 30;
export const INTRO_DURACION_EN_FRAMES = 150; // 5 segundos

// Marca de Bills, tomada de los tokens reales: el azul es el `themeColor` de
// `src/app/layout.tsx` y el papel/tinta salen de `globals.css`. No se inventan
// colores nuevos para el video: si mañana cambia la marca, cambia en un lugar.
const AZUL = "#3158e8";
const TINTA = "#111315";
const PAPEL = "#f5f4ef";

// `duracion` entra por parámetro porque esta escena también se usa dentro de una
// `<Sequence>` del promo: ahí `useVideoConfig()` devuelve el largo de la
// composición entera, no el del tramo, y el fundido de salida quedaría fuera de
// cuadro.
export const BillsIntro: React.FC<{ duracion?: number }> = ({ duracion }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const largo = duracion ?? durationInFrames;

  // `spring` en vez de una curva lineal: el rebote corto es lo que hace que se
  // sienta una app y no una presentación.
  const entrada = spring({ frame, fps, config: { damping: 14, mass: 0.6 } });

  // Fundido de salida en el último medio segundo, para poder encadenar escenas
  // sin un corte seco.
  const salida = interpolate(frame, [largo - fps / 2, largo], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: PAPEL,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Inter, system-ui, sans-serif",
        opacity: salida,
      }}
    >
      <div
        style={{
          transform: `scale(${entrada})`,
          textAlign: "center",
          padding: "0 96px",
        }}
      >
        <div
          style={{
            width: 150,
            height: 150,
            borderRadius: 44,
            backgroundColor: AZUL,
            margin: "0 auto 48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: PAPEL,
            fontSize: 96,
            fontWeight: 900,
            letterSpacing: "-0.06em",
          }}
        >
          B
        </div>

        <h1
          style={{
            color: TINTA,
            fontSize: 80,
            fontWeight: 900,
            lineHeight: 0.98,
            letterSpacing: "-0.07em",
            margin: 0,
          }}
        >
          Gestioná tu negocio,
          <br />
          no un Excel.
        </h1>

        <p
          style={{
            color: TINTA,
            opacity: 0.65,
            fontSize: 34,
            lineHeight: 1.35,
            marginTop: 32,
            fontWeight: 500,
          }}
        >
          Ventas, caja y stock en un solo lugar.
        </p>
      </div>
    </AbsoluteFill>
  );
};
