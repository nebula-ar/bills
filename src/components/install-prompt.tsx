"use client";

import { useEffect, useState } from "react";

import { X } from "@/components/icons";

// Cartel para instalar la PWA. En iOS no existe prompt automático, así que
// mostramos las instrucciones (Compartir → Agregar a inicio). En Android/Chrome
// capturamos `beforeinstallprompt` y ofrecemos un botón que instala de verdad.
const DISMISS_KEY = "bb-install-hint-dismissed";

type Mode = "ios" | "android";

// Tipo mínimo del evento de instalación (no está en las libs de TS por defecto).
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      // Modo privado / storage bloqueado: seguimos igual.
    }

    const nav = window.navigator as Navigator & { standalone?: boolean };
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    if (standalone) return; // Ya está instalada.

    const ua = nav.userAgent || "";
    const isIOS =
      /iphone|ipad|ipod/i.test(ua) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
    // Chrome/Firefox/Edge en iOS no permiten "Agregar a inicio"; solo Safari.
    const iosOtherBrowser = /crios|fxios|edgios/i.test(ua);
    const inAppBrowser = /fban|fbav|instagram|line|micromessenger/i.test(ua);

    if (isIOS) {
      if (iosOtherBrowser || inAppBrowser) return;
      // Diferido para no llamar a setState en el cuerpo del efecto (evita renders en cascada).
      const timer = setTimeout(() => {
        setMode("ios");
        setVisible(true);
      }, 1200);
      return () => clearTimeout(timer);
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallEvent);
      setMode("android");
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  }

  if (!mode) return null;

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center px-3 transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
      }`}
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      role="dialog"
      aria-label="Instalar Bills"
    >
      <div className="pointer-events-auto relative w-full max-w-[440px] rounded-3xl bg-white p-4 shadow-2xl shadow-slate-950/20 ring-1 ring-slate-950/5">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar"
          className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full text-slate-400 active:scale-90"
        >
          <X className="size-5" />
        </button>

        <div className="flex items-center gap-3 pr-8">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundImage: "linear-gradient(135deg, #2563eb, #1d4ed8)" }}
          >
            <StoreGlyph />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-black tracking-tight text-slate-950">
              Instalá Bills
            </p>
            <p className="text-[13px] font-medium text-slate-500">
              Tenela como app en tu pantalla de inicio.
            </p>
          </div>
        </div>

        {mode === "ios" ? (
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 text-[13px] font-semibold text-slate-600">
            <span>Tocá</span>
            <span className="flex size-6 items-center justify-center rounded-lg bg-blue-600 text-white">
              <ShareGlyph />
            </span>
            <span>
              y elegí <span className="font-black text-slate-900">Agregar a inicio</span>.
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={install}
            className="mt-3 w-full rounded-2xl bg-blue-600 py-3 text-[15px] font-black text-white shadow-[0_4px_0_#1d4ed8] transition active:translate-y-[3px] active:shadow-none"
          >
            Instalar app
          </button>
        )}
      </div>
    </div>
  );
}

// Glifo del producto: un local, no unas tijeras — Bills ya no es solo para
// barberías. Va inline (no por Iconify) porque este cartel aparece antes de que
// el usuario tenga sesión y conviene que no dependa de nada.
function StoreGlyph() {
  return (
    <svg
      width={26}
      height={26}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffffff"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9.5 4.5 4h15L21 9.5" />
      <path d="M3 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 3 0" />
      <path d="M5 11.5V20h14v-8.5" />
      <path d="M9.5 20v-5h5v5" />
    </svg>
  );
}

function ShareGlyph() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 15V4" />
      <path d="m8 8 4-4 4 4" />
      <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6" />
    </svg>
  );
}
