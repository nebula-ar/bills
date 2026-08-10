// Punto de entrada de Remotion. Vive fuera de `src/` a propósito: nada de esto
// entra al bundle que corre en el celular del comerciante, es una herramienta de
// marketing que sólo se ejecuta en la máquina de quien renderiza el video.
import { registerRoot } from "remotion";

import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
