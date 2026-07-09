"use client";

import { registerBusinessAction } from "@/app/register/actions";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState, useTransition, type KeyboardEvent } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = { emoji: string; title: string; subtitle: string; cheer: string };

const STEPS: Step[] = [
  { emoji: "💈", title: "¿Cómo se llama tu barbería?", subtitle: "Empecemos por lo más importante.", cheer: "¡Arranquemos!" },
  { emoji: "👋", title: "¿Cómo te llamás?", subtitle: "Así te saludamos en el panel.", cheer: "¡Hola!" },
  { emoji: "📧", title: "¿Cuál es tu email?", subtitle: "Lo vas a usar para entrar.", cheer: "¡Genial!" },
  { emoji: "🔒", title: "Creá tu contraseña", subtitle: "Al menos 6 caracteres.", cheer: "¡Seguridad primero!" },
  { emoji: "✂️", title: "¿Vos también atendés?", subtitle: "Podés cargar tus propias ventas.", cheer: "¡Buena!" },
  { emoji: "🏪", title: "¿Cómo se llama tu local?", subtitle: "Después sumás más locales y tu equipo desde el panel.", cheer: "¡Último paso!" },
];

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-lg font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100";
// Botón "chunky" con sombra sólida tipo Duolingo (se hunde al apretar).
const primaryBtn =
  "flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-base font-black text-white shadow-[0_4px_0_#1d4ed8] transition active:translate-y-[3px] active:shadow-[0_1px_0_#1d4ed8] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-[0_4px_0_#e2e8f0] disabled:active:translate-y-0 disabled:active:shadow-[0_4px_0_#e2e8f0]";

const KEYFRAMES =
  "@keyframes bbPop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.12);opacity:1}100%{transform:scale(1)}}" +
  "@keyframes bbFall{0%{transform:translateY(-12%) rotate(0);opacity:1}100%{transform:translateY(115vh) rotate(540deg);opacity:0}}";

const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 5.6 + (i % 4) * 3) % 100,
  delay: (i % 6) * 0.12,
  duration: 1.9 + (i % 4) * 0.25,
  color: ["#2563eb", "#4f46e5", "#10b981", "#f59e0b", "#ec4899"][i % 5],
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

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isBarber, setIsBarber] = useState(false);
  const [branchName, setBranchName] = useState("");

  function stepValid() {
    switch (step) {
      case 0:
        return businessName.trim().length > 0;
      case 1:
        return ownerName.trim().length > 0;
      case 2:
        return EMAIL_RE.test(email.trim());
      case 3:
        return password.length >= 6;
      case 4:
        return true;
      case 5:
        return branchName.trim().length > 0;
      default:
        return true;
    }
  }

  function goNext() {
    setError(null);
    if (!stepValid()) return;
    if (step < STEPS.length - 1) {
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
      goNext();
    }
  }

  function submit() {
    const branches = [
      { name: branchName.trim(), address: "", barbers: isBarber ? [{ name: ownerName.trim(), pin: "" }] : [] },
    ];

    setError(null);
    setPhase("success");
    startTransition(async () => {
      const result = await registerBusinessAction({
        businessName,
        ownerName,
        email,
        username: "",
        password,
        branches,
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

  const progress = ((step + 1) / STEPS.length) * 100;
  const meta = STEPS[step];

  return (
    <main className="flex min-h-[100dvh] flex-col bg-white text-slate-950 sm:items-center sm:justify-center sm:bg-slate-100 sm:p-6">
      <style>{KEYFRAMES}</style>
      <section className="relative flex w-full flex-1 flex-col overflow-hidden bg-white sm:min-h-[600px] sm:max-w-md sm:flex-none sm:rounded-[2.5rem] sm:shadow-[0_24px_80px_rgba(15,23,42,0.16)] sm:ring-1 sm:ring-slate-200">
        {/* Bienvenida */}
        {phase === "welcome" ? (
          <div className="flex flex-1 flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] sm:px-8 sm:py-10">
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
              <div
                className="grid size-24 place-items-center rounded-[2rem] bg-gradient-to-br from-blue-600 to-indigo-600 text-5xl shadow-[0_18px_40px_rgba(37,99,235,0.35)]"
                style={{ animation: "bbPop .6s cubic-bezier(.34,1.56,.64,1) both" }}
              >
                💈
              </div>
              <div className="duration-500 animate-in fade-in slide-in-from-bottom-2" style={stagger(1)}>
                <h1 className="text-3xl font-black tracking-tight">¡Creá tu barbería!</h1>
                <p className="mx-auto mt-3 max-w-xs text-base font-semibold leading-7 text-slate-500">
                  Te hacemos unas preguntas rápidas y en un minuto tenés todo listo. 💪
                </p>
              </div>
              <ul className="grid w-full gap-2 text-left duration-500 animate-in fade-in slide-in-from-bottom-2" style={stagger(2)}>
                {[
                  { emoji: "💈", label: "El nombre de tu barbería" },
                  { emoji: "🔑", label: "Tu cuenta de administrador" },
                  { emoji: "🏪", label: "Tu primer local" },
                ].map((item) => (
                  <li className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" key={item.label}>
                    <span className="text-xl">{item.emoji}</span>
                    {item.label}
                  </li>
                ))}
              </ul>
              <button
                className={`${primaryBtn} duration-500 animate-in fade-in slide-in-from-bottom-2`}
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
              <Link className="font-black text-blue-600" href="/login">
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
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-[width] duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="shrink-0 text-xs font-black tabular-nums text-slate-400">
                {step + 1}/{STEPS.length}
              </span>
            </div>

            {/* Contenido + botón, centrados como un grupo (botón al alcance del pulgar) */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 sm:px-8">
              <div className={`my-auto w-full py-6 duration-300 animate-in fade-in ${dir === 1 ? "slide-in-from-right-8" : "slide-in-from-left-8"}`} key={step}>
                  <div className="flex flex-col items-center gap-2.5 text-center">
                    <div
                      className="grid size-20 place-items-center rounded-[1.75rem] bg-blue-50 text-4xl"
                      style={{ animation: "bbPop .5s cubic-bezier(.34,1.56,.64,1) both" }}
                    >
                      {meta.emoji}
                    </div>
                    <span
                      className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-600 duration-500 animate-in fade-in slide-in-from-bottom-2"
                      style={stagger(1)}
                    >
                      {meta.cheer}
                    </span>
                    <h1 className="text-2xl font-black tracking-tight text-slate-950 duration-500 animate-in fade-in slide-in-from-bottom-2" style={stagger(2)}>
                      {meta.title}
                    </h1>
                    <p className="text-sm font-semibold leading-6 text-slate-500 duration-500 animate-in fade-in slide-in-from-bottom-2" style={stagger(3)}>
                      {meta.subtitle}
                    </p>
                  </div>

                  <div className="mt-6 duration-500 animate-in fade-in slide-in-from-bottom-2" style={stagger(4)}>
                    {step === 0 ? (
                      <input
                        autoFocus
                        className={inputClass}
                        enterKeyHint="next"
                        onChange={(event) => setBusinessName(event.target.value)}
                        onKeyDown={onEnter}
                        placeholder="Ej: Barbería El Rulo"
                        value={businessName}
                      />
                    ) : null}

                    {step === 1 ? (
                      <input
                        autoFocus
                        className={inputClass}
                        enterKeyHint="next"
                        onChange={(event) => setOwnerName(event.target.value)}
                        onKeyDown={onEnter}
                        placeholder="Ej: Matías"
                        value={ownerName}
                      />
                    ) : null}

                    {step === 2 ? (
                      <input
                        autoCapitalize="none"
                        autoFocus
                        className={inputClass}
                        enterKeyHint="next"
                        inputMode="email"
                        onChange={(event) => setEmail(event.target.value)}
                        onKeyDown={onEnter}
                        placeholder="tucorreo@ejemplo.com"
                        type="email"
                        value={email}
                      />
                    ) : null}

                    {step === 3 ? (
                      <input
                        autoFocus
                        className={inputClass}
                        enterKeyHint="go"
                        onChange={(event) => setPassword(event.target.value)}
                        onKeyDown={onEnter}
                        placeholder="Al menos 6 caracteres"
                        type="password"
                        value={password}
                      />
                    ) : null}

                    {step === 4 ? (
                      <div className="grid gap-3">
                        <ChoiceCard emoji="✂️" hint="Te sumo como barbero" onClick={() => setIsBarber(true)} selected={isBarber} title="Sí, yo también corto" />
                        <ChoiceCard emoji="📊" hint="Solo administro el negocio" onClick={() => setIsBarber(false)} selected={!isBarber} title="No, solo administro" />
                      </div>
                    ) : null}

                    {step === 5 ? (
                      <input
                        autoFocus
                        className={inputClass}
                        enterKeyHint="go"
                        onChange={(event) => setBranchName(event.target.value)}
                        onKeyDown={onEnter}
                        placeholder="Ej: Sucursal Centro"
                        value={branchName}
                      />
                    ) : null}
                  </div>

                  {error ? (
                    <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm font-semibold text-rose-700">{error}</p>
                  ) : null}

                  <button className={`${primaryBtn} mt-7`} disabled={!stepValid() || isPending} onClick={goNext} type="button">
                    {step === STEPS.length - 1 ? "Crear mi barbería 🎉" : "Continuar"}
                    {step === STEPS.length - 1 ? null : <ArrowRight className="size-5" />}
                  </button>
                </div>
              </div>
          </>
        ) : null}

        {/* Celebración */}
        {phase === "success" ? (
          <div className="relative flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
            <Confetti />
            <div
              className="grid size-24 place-items-center rounded-full bg-emerald-100 text-5xl"
              style={{ animation: "bbPop .6s cubic-bezier(.34,1.56,.64,1) both" }}
            >
              🎉
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">¡Tu barbería está lista!</h1>
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

function ChoiceCard({ emoji, title, hint, selected, onClick }: { emoji: string; title: string; hint: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition active:scale-[0.99] ${
        selected ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-200"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="text-3xl">{emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-slate-950">{title}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
      <span className={`grid size-6 shrink-0 place-items-center rounded-full text-white transition ${selected ? "bg-blue-600" : "bg-slate-200"}`}>
        {selected ? <Check className="size-4" /> : null}
      </span>
    </button>
  );
}
