import { Composition } from "remotion";

import { BillsIntro, INTRO_DURACION_EN_FRAMES, INTRO_FPS } from "./BillsIntro";
import { Promo, PROMO_DURACION_EN_FRAMES, PROMO_FPS } from "./Promo";

// 16:9 a 1080p: el formato del video promocional de producto (web, YouTube,
// landing). Para una historia vertical se duplica la composición con 1080x1920
// en vez de tocar ésta: las escenas usan unidades relativas y se acomodan.
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Promo"
      component={Promo}
      durationInFrames={PROMO_DURACION_EN_FRAMES}
      fps={PROMO_FPS}
      width={1920}
      height={1080}
    />

    {/* El cierre suelto, para poder iterar el logo sin re-renderizar el promo. */}
    <Composition
      id="BillsIntro"
      component={BillsIntro}
      durationInFrames={INTRO_DURACION_EN_FRAMES}
      fps={INTRO_FPS}
      width={1920}
      height={1080}
    />
  </>
);
