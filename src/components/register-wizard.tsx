"use client";

import { checkEmailAvailableAction, registerBusinessAction } from "@/app/register/actions";
import { Vertical } from "@/generated/prisma/enums";
import { VERTICAL_ORDER, VERTICAL_PRESETS, verticalPreset } from "@/lib/vertical";
import { ArrowLeft, ArrowRight, Check, DynamicIcon, Loader2 } from "@/components/icons";
import { onboardingSteps } from "@/modules/onboarding/onboarding.logic";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useMemo, useState, useTransition, type KeyboardEvent } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-4 text-center text-lg font-semibold text-slate-950 outline-none transition focus:border-[#3158e8] focus:ring-4 focus:ring-[#3158e8]/12";
// Botón "chunky" con sombra sólida tipo Duolingo (se hunde al apretar).
const primaryBtn =
  "flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-4 text-base font-black text-white shadow-[0_4px_0_#3158e8] transition active:translate-y-[3px] active:shadow-[0_1px_0_#3158e8] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-[0_4px_0_#e2e8f0] disabled:active:translate-y-0 disabled:active:shadow-[0_4px_0_#e2e8f0]";

const KEYFRAMES =
  "@keyframes bbPop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.12);opacity:1}100%{transform:scale(1)}}" +
  "@keyframes bbFall{0%{transform:translateY(-12%) rotate(0);opacity:1}100%{transform:translateY(115vh) rotate(540deg);opacity:0}}";

const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 5.6 + (i % 4) * 3) % 100,
  delay: (i % 6) * 0.12,
  duration: 1.9 + (i % 4) * 0.25,
  color: ["#3158e8", "#d7ef62", "#0f172a", "#3158e8", "#d7ef62"][i % 5],
  size: 7 + (i % 3) * 4,
}));

function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {CONFETTI.map((piece, i) => (
        <span
          className="absolute top-0 rounded-[2px]"
          key={i}
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size * 1.6,
            backgroundColor: piece.color,
            animation: `bbFall ${piece.duration}s linear ${piece.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}

// Entrada en cascada: cada elemento aparece con un pequeño retraso.
function stagger(index: number) {
  return { animationDelay: `${index * 70}ms`, animationFillMode: "backwards" as const };
}

export function RegisterWizard() {
  const [isPending, startTransition] = useTransition();
  const [phase, setPhase] = useState<"welcome" | "form" | "success">("welcome");
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // El rubro va primero: define el vocabulario y los iconos de todo lo que sigue.
  const [vertical, setVertical] = useState<Vertical>(Vertical.KIOSK);
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Por defecto atiende el dueño: es el caso de la enorme mayoría de los
  // comercios chicos, y así el paso se resuelve sin escribir nada.
  const [ownerSells, setOwnerSells] = useState(true);
  const [firstStaffName, setFirstStaffName] = useState("");

  const steps = useMemo(() => onboardingSteps(vertical), [vertical]);
  const preset = verticalPreset(vertical);
  const meta = steps[step];

  function stepValid() {
    switch (meta.id) {
      case "vertical":
        return Boolean(vertical);
      case "businessName":
        return businessName.trim().length > 0;
      case "ownerName":
        return ownerName.trim().length > 0;
      case "email":
        return EMAIL_RE.test(email.trim());
      case "password":
        return password.length >= 6;
      case "staff":
        // Tiene que quedar alguien que atienda: el dueño o el primer empleado.
        return ownerSells || firstStaffName.trim().length > 0;
      default:
        return true;
    }
  }

  async function goNext() {
    setError(null);
    if (!stepValid() || checking) return;
    // Validamos el email (formato + que no esté en uso) YA en su paso, no al final.
    if (meta.id === "email") {
      setChecking(true);
      const available = await checkEmailAvailableAction(email.trim().toLowerCase());
      setChecking(false);
      if (!available) {
        setError("Ya hay una cuenta con ese email. Probá con otro o iniciá sesión.");
        return;
      }
    }
    if (step < steps.length - 1) {
      setDir(1);
      setStep((current) => current + 1);
      return;
    }
    submit();
  }

  function goBack() {
    setError(null);
    if (step === 0) {
      setPhase("welcome");
      return;
    }
    setDir(-1);
    setStep((current) => Math.max(0, current - 1));
  }

  function onEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void goNext();
    }
  }

  function submit() {
    const staffs = ownerSells ? [{ name: ownerName.trim(), pin: "" }] : [{ name: firstStaffName.trim(), pin: "" }];
    // Un solo local, con el nombre del negocio: no se lo volvemos a preguntar.
    const branches = [{ name: businessName.trim(), address: "", staffs }];

    setError(null);
    setPhase("success");
    startTransition(async () => {
      const result = await registerBusinessAction({
        businessName,
        vertical,
        ownerName,
        email,
        username: "",
        password,
        branches,
        // Con "Yo atiendo", el empleado que se acaba de armar es el dueño: el
        // alta deja las dos filas atadas para que el mostrador ya sepa quién
        // cobra (ver registerBusiness).
        ownerSells,
      });

      if (!result.ok) {
        setError(result.error);
        setPhase("form");
        return;
      }

      const signInResult = await signIn("credentials", { email: email.trim().toLowerCase(), password, redirect: false });
      // Navegación completa (no router.push): el layout es server component y así
      // se re-ejecuta con la sesión nueva y aparece la barra de navegación.
      window.location.assign(signInResult?.ok ? "/" : "/login");
    });
  }

  const progress = ((step + 1) / steps.length) * 100;
  const isWelcome = phase === "welcome";

  // El alto de la tarjeta es FIJO, no mínimo. Con `min-h` crecía con el
  // contenido y scrolleaba la página entera, así que el `overflow-y-auto` de
  // adentro no se usaba nunca y el botón terminaba fuera de pantalla. Fijando
  // el alto, el que scrollea es el contenido y el pie queda anclado abajo.
  return (
    <main
      className={
        isWelcome
          ? "flex min-h-[100dvh] flex-col bg-slate-100 text-slate-950 sm:items-center sm:justify-center sm:px-6 sm:py-10"
          : "flex h-[100dvh] flex-col bg-[#fffef9] text-slate-950 sm:h-auto sm:min-h-[100dvh] sm:items-center sm:justify-center sm:bg-[#f5f4ef] sm:p-6"
      }
    >
      <style>{KEYFRAMES}</style>
      <section
        className={
          isWelcome
            ? "relative flex w-full flex-1 flex-col overflow-hidden bg-white sm:min-h-0 sm:max-w-[28rem] sm:flex-none sm:rounded-[2.5rem] sm:shadow-2xl sm:shadow-slate-950/15"
            : "relative flex w-full flex-1 flex-col overflow-hidden bg-[#fffef9] sm:max-h-[calc(100dvh-3rem)] sm:min-h-[600px] sm:max-w-md sm:flex-none sm:rounded-[28px] sm:border sm:border-slate-950/10 sm:shadow-[0_30px_80px_-20px_rgba(17,19,21,0.32)]"
        }
      >
        {/* Bienvenida */}
        {phase === "welcome" ? (
          <div className="flex flex-1 flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] sm:px-8 sm:py-10">
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
              <div
                aria-label="Bienvenida a Bills"
                className="grid size-24 place-items-center rounded-[2rem] bg-linear-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-600/30"
                role="img"
                style={{ animation: "bbPop .6s cubic-bezier(.34,1.56,.64,1) both" }}
              >
                <DynamicIcon className="size-12" name="solar:shop-2-bold" />
              </div>
              <div className="duration-500 animate-in fade-in slide-in-from-bottom-2" style={stagger(1)}>
                <h1 className="text-3xl font-black tracking-[-0.06em]">¡Creá tu negocio!</h1>
                <p className="mx-auto mt-3 max-w-xs text-base font-semibold leading-7 text-slate-500">
                  Unas preguntas rápidas y en un minuto tenés el sistema armado a tu medida.
                </p>
              </div>
              <ul className="grid w-full gap-2 text-left duration-500 animate-in fade-in slide-in-from-bottom-2" style={stagger(2)}>
                {[
                  { icon: "solar:shop-2-bold", label: "De qué es tu negocio" },
                  { icon: "solar:key-bold", label: "Tu cuenta de administrador" },
                  { icon: "solar:box-bold", label: "Y a vender: el catálogo lo cargás adentro" },
                ].map((item) => (
                  <li className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" key={item.label}>
                    <DynamicIcon className="size-5 text-blue-600" name={item.icon} />
                    {item.label}
                  </li>
                ))}
              </ul>
              <button
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-base font-black text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.98] duration-500 animate-in fade-in slide-in-from-bottom-2"
                onClick={() => setPhase("form")}
                style={stagger(3)}
                type="button"
              >
                Empezar
                <ArrowRight className="size-5" />
              </button>
            </div>
            <p className="shrink-0 pt-4 text-center text-xs font-medium text-slate-400">
              ¿Ya tenés cuenta?{" "}
              <Link className="font-black text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" href="/login">
                Iniciar sesión
              </Link>
            </p>
          </div>
        ) : null}

        {/* Formulario */}
        {phase === "form" ? (
          <>
            <div className="flex shrink-0 items-center gap-3 px-6 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 sm:pt-8">
              <button
                aria-label="Volver"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition active:scale-90"
                onClick={goBack}
                type="button"
              >
                <ArrowLeft className="size-5" />
              </button>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[#3158e8] transition-[width] duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="shrink-0 text-xs font-black tabular-nums text-slate-400">
                {step + 1}/{steps.length}
              </span>
            </div>

            {/* Contenido + botón, centrados como un grupo (botón al alcance del pulgar) */}
            {/* `overflow-x-hidden` es obligatorio, no cosmético: por
                especificación, declarar `overflow-y` distinto de `visible`
                promueve el eje X a `auto`. Como los pasos entran con
                `slide-in-from-right-8`, cada cambio de paso desplaza el
                contenido 2rem y aparecía un scrollbar horizontal fantasma. */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-6 sm:px-8">
              <div
                className={`my-auto w-full py-4 duration-300 animate-in fade-in ${dir === 1 ? "slide-in-from-right-8" : "slide-in-from-left-8"}`}
                key={step}
              >
                <div className="flex flex-col items-center gap-2.5 text-center">
                  {/* En el paso del rubro no va icono: son 80px para mostrar un
                      local genérico arriba de una grilla con ocho iconos de
                      local. Es la diferencia entre que el paso entre en
                      pantalla o haya que scrollear. En el resto sí va: ahí le
                      da identidad a un paso que si no es solo un input, y sale
                      del rubro elegido —una verdulería no se reconoce en unas
                      tijeras—. */}
                  {meta.id === "vertical" ? null : (
                    <div
                      className="grid size-20 place-items-center rounded-[1.75rem] bg-[#eef1ff] text-[#3158e8]"
                      style={{ animation: "bbPop .5s cubic-bezier(.34,1.56,.64,1) both" }}
                    >
                      <DynamicIcon className="size-10" name={meta.icon} />
                    </div>
                  )}
                  <h1
                    className="text-2xl font-black tracking-[-0.06em] text-slate-950 duration-500 animate-in fade-in slide-in-from-bottom-2"
                    style={stagger(2)}
                  >
                    {meta.title}
                  </h1>
                  <p
                    className="text-sm font-semibold leading-6 text-slate-500 duration-500 animate-in fade-in slide-in-from-bottom-2"
                    style={stagger(3)}
                  >
                    {meta.subtitle}
                  </p>
                </div>

                <div className="mt-6 duration-500 animate-in fade-in slide-in-from-bottom-2" style={stagger(4)}>
                  {meta.id === "vertical" ? (
                    // Grilla de fichas, no lista: ocho rubros en fila vertical
                    // no entraban en una pantalla de celular. Las columnas van
                    // DECLARADAS (`grid-cols-2`, no `grid` a secas); sin
                    // declararlas la columna se dimensiona a `max-content` y
                    // basta un texto que no corte para que la grilla se pase de
                    // ancho y aparezca scroll horizontal.
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {VERTICAL_ORDER.map((option) => {
                        const optionPreset = VERTICAL_PRESETS[option];
                        const selected = vertical === option;

                        return (
                          <button
                            aria-pressed={selected}
                            className={`relative flex min-w-0 flex-col items-center gap-1.5 rounded-xl border-2 p-2.5 text-center transition active:scale-[0.98] ${
                              selected ? "border-[#3158e8] bg-[#eef1ff]" : "border-slate-300 bg-white"
                            }`}
                            key={option}
                            onClick={() => setVertical(option)}
                            type="button"
                          >
                            <span
                              className={`grid size-9 shrink-0 place-items-center rounded-lg ${
                                selected ? "bg-[#3158e8] text-white" : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              <DynamicIcon className="size-5" name={optionPreset.icon} />
                            </span>
                            <span className="text-xs font-black leading-tight text-balance text-slate-950">
                              {optionPreset.label}
                            </span>
                            {selected ? (
                              <span className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-[#3158e8] text-white">
                                <Check className="size-3" />
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {meta.id === "businessName" ? (
                    <input
                      className={inputClass}
                      enterKeyHint="next"
                      onChange={(event) => setBusinessName(event.target.value)}
                      onKeyDown={onEnter}
                      placeholder={meta.placeholder}
                      value={businessName}
                    />
                  ) : null}

                  {meta.id === "ownerName" ? (
                    <input
                      className={inputClass}
                      enterKeyHint="next"
                      onChange={(event) => setOwnerName(event.target.value)}
                      onKeyDown={onEnter}
                      placeholder={meta.placeholder}
                      value={ownerName}
                    />
                  ) : null}

                  {meta.id === "email" ? (
                    <>
                      <input
                        autoCapitalize="none"
                        className={inputClass}
                        enterKeyHint="next"
                        inputMode="email"
                        onChange={(event) => setEmail(event.target.value)}
                        onKeyDown={onEnter}
                        placeholder={meta.placeholder}
                        type="email"
                        value={email}
                      />
                      {email.trim() !== "" && !EMAIL_RE.test(email.trim()) ? (
                        <p className="mt-2 text-center text-xs font-semibold text-rose-500">
                          Poné un email válido (ej: nombre@correo.com).
                        </p>
                      ) : null}
                    </>
                  ) : null}

                  {meta.id === "password" ? (
                    <input
                      className={inputClass}
                      enterKeyHint="go"
                      onChange={(event) => setPassword(event.target.value)}
                      onKeyDown={onEnter}
                      placeholder={meta.placeholder}
                      type="password"
                      value={password}
                    />
                  ) : null}

                  {meta.id === "staff" ? (
                    <div className="grid gap-3">
                      <ChoiceCard
                        hint={`Quedás cargado como ${preset.labels.staffSingular.toLowerCase()}`}
                        icon={preset.staffIcon}
                        onClick={() => setOwnerSells(true)}
                        selected={ownerSells}
                        title="Yo atiendo"
                      />
                      <ChoiceCard
                        hint={`Cargamos a tu primer ${preset.labels.staffSingular.toLowerCase()}`}
                        icon="solar:users-group-two-rounded-bold"
                        onClick={() => setOwnerSells(false)}
                        selected={!ownerSells}
                        title="Atiende otra persona"
                      />
                      {!ownerSells ? (
                        <div className="grid gap-2 duration-300 animate-in fade-in slide-in-from-bottom-2">
                          <label className="text-xs font-black uppercase tracking-wide text-slate-500" htmlFor="firstStaff">
                            ¿Cómo se llama?
                          </label>
                          <input
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-[#3158e8] focus:ring-4 focus:ring-[#3158e8]/12"
                            enterKeyHint="next"
                            id="firstStaff"
                            onChange={(event) => setFirstStaffName(event.target.value)}
                            onKeyDown={onEnter}
                            placeholder="Ej: Juan Pérez"
                            value={firstStaffName}
                          />
                          <p className="text-xs text-slate-500">
                            Sumás más {preset.labels.staffPlural.toLowerCase()} (y sus PIN) desde el panel.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

              </div>
            </div>

            {/* El botón vive FUERA del área que scrollea.
                Antes iba adentro, junto al contenido: en los pasos cortos se
                veía bien, pero el primero tiene ocho rubros y el botón quedaba
                abajo de todo. Había que scrollear para descubrir que existía, y
                un botón que no se ve es un paso que no se completa. */}
            <div className="shrink-0 border-t border-slate-200/70 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-8 sm:pb-8">
              {error ? (
                <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm font-semibold text-rose-700">
                  {error}
                </p>
              ) : null}

              <button
                className={primaryBtn}
                disabled={!stepValid() || isPending || checking}
                onClick={() => void goNext()}
                type="button"
              >
                {checking ? (
                  <>
                    <Loader2 className="size-5 animate-spin" />
                    Verificando…
                  </>
                ) : step === steps.length - 1 ? (
                  "Crear mi negocio"
                ) : (
                  <>
                    Continuar
                    <ArrowRight className="size-5" />
                  </>
                )}
              </button>
            </div>
          </>
        ) : null}

        {/* Celebración */}
        {phase === "success" ? (
          <div className="relative flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
            <Confetti />
            {/* Lima sobre negro, no el azul pálido de los pasos: esta es la
                pantalla de premio y tiene que verse distinta de las diez que
                vino completando. */}
            <div
              className="grid size-24 place-items-center rounded-full bg-[#d7ef62] text-slate-950"
              style={{ animation: "bbPop .6s cubic-bezier(.34,1.56,.64,1) both" }}
            >
              <DynamicIcon className="size-12" name={preset.icon} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-[-0.06em]">¡Tu negocio está listo!</h1>
              <p className="mt-2 flex items-center justify-center gap-2 text-sm font-bold text-slate-500">
                <Loader2 className="size-4 animate-spin" />
                Entrando al panel…
              </p>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function ChoiceCard({
  icon,
  title,
  hint,
  selected,
  onClick,
}: {
  icon: string;
  title: string;
  hint: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition active:scale-[0.99] ${
        selected ? "border-[#3158e8] bg-[#eef1ff]" : "border-slate-300 bg-white hover:border-[#3158e8]/40"
      }`}
      onClick={onClick}
      type="button"
    >
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-xl ${
          selected ? "bg-[#3158e8] text-white" : "bg-slate-100 text-slate-500"
        }`}
      >
        <DynamicIcon className="size-5" name={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-slate-950">{title}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
      <span className={`grid size-6 shrink-0 place-items-center rounded-full text-white transition ${selected ? "bg-[#3158e8]" : "bg-slate-200"}`}>
        {selected ? <Check className="size-4" /> : null}
      </span>
    </button>
  );
}
