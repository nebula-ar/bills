"use client";

import { registerBusinessAction } from "@/app/register/actions";
import { ArrowLeft, ArrowRight, Check, Loader2, MapPin, Plus, Store, Trash2, X } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState, useTransition } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PIN_RE = /^\d{4,8}$/;
const USERNAME_RE = /^[a-z0-9._-]{3,20}$/;

type BarberDraft = { name: string; pin: string };
type BranchDraft = { name: string; address: string; barbers: BarberDraft[] };

const STEPS = [
  { emoji: "💈", title: "¿Cómo se llama tu barbería?", subtitle: "Empecemos por lo más importante.", cheer: "¡Arranquemos!" },
  { emoji: "🔑", title: "Creá tu cuenta", subtitle: "Con estos datos entrás al panel de administración.", cheer: "¡Buen comienzo!" },
  { emoji: "✂️", title: "¿Vos también atendés?", subtitle: "Si cortás, te sumamos como barbero con tu PIN.", cheer: "¡Vas muy bien!" },
  { emoji: "🏪", title: "Tu local y tu equipo", subtitle: "Cargá tu primera sucursal y tus barberos.", cheer: "¡Último paso!" },
];

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100";
const pinClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-bold tracking-[0.2em] text-slate-950 outline-none transition placeholder:tracking-normal placeholder:font-semibold focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100";
// Botón "chunky" con sombra sólida tipo Duolingo (se hunde al apretar).
const primaryBtn =
  "flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-base font-black text-white shadow-[0_4px_0_#1d4ed8] transition active:translate-y-[3px] active:shadow-[0_1px_0_#1d4ed8] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-[0_4px_0_#e2e8f0] disabled:active:translate-y-0 disabled:active:shadow-[0_4px_0_#e2e8f0]";

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
      <style>{"@keyframes bbFall{0%{transform:translateY(-12%) rotate(0deg);opacity:1}100%{transform:translateY(115vh) rotate(540deg);opacity:0}}"}</style>
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

export function RegisterWizard() {
  const [isPending, startTransition] = useTransition();
  const [phase, setPhase] = useState<"welcome" | "form" | "success">("welcome");
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isBarber, setIsBarber] = useState(false);
  const [ownerPin, setOwnerPin] = useState("");
  const [branches, setBranches] = useState<BranchDraft[]>([{ name: "", address: "", barbers: [] }]);

  function updateBranch(index: number, patch: Partial<BranchDraft>) {
    setBranches((current) => current.map((branch, i) => (i === index ? { ...branch, ...patch } : branch)));
  }
  function addBranch() {
    setBranches((current) => [...current, { name: "", address: "", barbers: [] }]);
  }
  function removeBranch(index: number) {
    setBranches((current) => current.filter((_, i) => i !== index));
  }
  function addBarber(branchIndex: number) {
    setBranches((current) =>
      current.map((branch, i) => (i === branchIndex ? { ...branch, barbers: [...branch.barbers, { name: "", pin: "" }] } : branch)),
    );
  }
  function updateBarber(branchIndex: number, barberIndex: number, patch: Partial<BarberDraft>) {
    setBranches((current) =>
      current.map((branch, i) =>
        i === branchIndex
          ? { ...branch, barbers: branch.barbers.map((barber, j) => (j === barberIndex ? { ...barber, ...patch } : barber)) }
          : branch,
      ),
    );
  }
  function removeBarber(branchIndex: number, barberIndex: number) {
    setBranches((current) =>
      current.map((branch, i) =>
        i === branchIndex ? { ...branch, barbers: branch.barbers.filter((_, j) => j !== barberIndex) } : branch,
      ),
    );
  }

  function stepValid() {
    if (step === 0) return businessName.trim().length > 0;
    if (step === 1) {
      return (
        ownerName.trim().length > 0 &&
        EMAIL_RE.test(email.trim()) &&
        (username.trim() === "" || USERNAME_RE.test(username.trim())) &&
        password.length >= 6
      );
    }
    if (step === 2) return !isBarber || ownerPin.trim() === "" || PIN_RE.test(ownerPin.trim());
    if (step === 3) {
      return (
        branches[0]?.name.trim().length > 0 &&
        branches.every((branch) => branch.barbers.every((barber) => barber.pin.trim() === "" || PIN_RE.test(barber.pin.trim())))
      );
    }
    return true;
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

  function submit() {
    const finalBranches = branches.map((branch, index) =>
      index === 0 && isBarber ? { ...branch, barbers: [{ name: ownerName, pin: ownerPin }, ...branch.barbers] } : branch,
    );

    setError(null);
    setPhase("success");
    startTransition(async () => {
      const result = await registerBusinessAction({
        businessName,
        ownerName,
        email,
        username,
        password,
        branches: finalBranches,
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
      <section className="relative flex w-full flex-1 flex-col overflow-hidden bg-white sm:min-h-[600px] sm:max-w-md sm:flex-none sm:rounded-[2.5rem] sm:shadow-[0_24px_80px_rgba(15,23,42,0.16)] sm:ring-1 sm:ring-slate-200">
        {/* Bienvenida */}
        {phase === "welcome" ? (
          <div className="flex flex-1 flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] sm:px-8 sm:py-10">
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
              <div className="grid size-24 place-items-center rounded-[2rem] bg-gradient-to-br from-blue-600 to-indigo-600 text-5xl shadow-[0_18px_40px_rgba(37,99,235,0.35)] duration-500 animate-in zoom-in">
                💈
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight">¡Creá tu barbería!</h1>
                <p className="mx-auto mt-3 max-w-xs text-base font-semibold leading-7 text-slate-500">
                  Te hacemos 4 preguntas rápidas y en un minuto tenés todo listo. 💪
                </p>
              </div>
              <ul className="grid w-full gap-2 text-left">
                {[
                  { emoji: "💈", label: "El nombre de tu barbería" },
                  { emoji: "🔑", label: "Tu cuenta de administrador" },
                  { emoji: "✂️", label: "Tus sucursales y barberos" },
                ].map((item) => (
                  <li className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" key={item.label}>
                    <span className="text-xl">{item.emoji}</span>
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="shrink-0 pt-6">
              <button className={primaryBtn} onClick={() => setPhase("form")} type="button">
                Empezar
                <ArrowRight className="size-5" />
              </button>
              <p className="mt-4 text-center text-xs font-medium text-slate-400">
                ¿Ya tenés cuenta?{" "}
                <Link className="font-black text-blue-600" href="/login">
                  Iniciar sesión
                </Link>
              </p>
            </div>
          </div>
        ) : null}

        {/* Formulario */}
        {phase === "form" ? (
          <>
            <div className="flex shrink-0 items-center gap-3 px-6 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 sm:pt-8">
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

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-6 sm:px-8">
              <div className={`duration-300 animate-in fade-in ${dir === 1 ? "slide-in-from-right-6" : "slide-in-from-left-6"}`} key={step}>
                <div className="flex flex-col items-center gap-2.5 text-center">
                  <div className="grid size-20 place-items-center rounded-[1.75rem] bg-blue-50 text-4xl duration-300 animate-in zoom-in-95">
                    {meta.emoji}
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-600">{meta.cheer}</span>
                  <h1 className="text-2xl font-black tracking-tight text-slate-950">{meta.title}</h1>
                  <p className="text-sm font-semibold leading-6 text-slate-500">{meta.subtitle}</p>
                </div>

                <div className="mt-6">
                  {step === 0 ? (
                    <input
                      autoFocus
                      className={`${inputClass} text-center text-lg`}
                      onChange={(event) => setBusinessName(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && goNext()}
                      placeholder="Ej: Barbería El Rulo"
                      value={businessName}
                    />
                  ) : null}

                  {step === 1 ? (
                    <div className="grid gap-3.5">
                      <Field label="Tu nombre">
                        <input className={inputClass} onChange={(e) => setOwnerName(e.target.value)} placeholder="Ej: Matías" value={ownerName} />
                      </Field>
                      <Field label="Email">
                        <input
                          autoCapitalize="none"
                          className={inputClass}
                          inputMode="email"
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="tucorreo@ejemplo.com"
                          type="email"
                          value={email}
                        />
                      </Field>
                      <Field hint="Para entrar sin el email." label="Usuario (opcional)">
                        <input
                          autoCapitalize="none"
                          className={inputClass}
                          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                          placeholder="Ej: matias"
                          value={username}
                        />
                      </Field>
                      <Field label="Contraseña">
                        <input
                          className={inputClass}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Al menos 6 caracteres"
                          type="password"
                          value={password}
                        />
                      </Field>
                    </div>
                  ) : null}

                  {step === 2 ? (
                    <div className="grid gap-3">
                      <ChoiceCard emoji="✂️" hint="Te sumo como barbero con tu PIN" onClick={() => setIsBarber(true)} selected={isBarber} title="Sí, yo también corto" />
                      <ChoiceCard emoji="📊" hint="Podés activarlo más adelante" onClick={() => setIsBarber(false)} selected={!isBarber} title="No, solo administro" />
                      {isBarber ? (
                        <div className="grid gap-2 duration-300 animate-in fade-in slide-in-from-bottom-2">
                          <label className="text-xs font-black uppercase tracking-wide text-slate-500" htmlFor="ownerPin">
                            Tu PIN (opcional)
                          </label>
                          <input
                            className={pinClass}
                            id="ownerPin"
                            inputMode="numeric"
                            maxLength={8}
                            onChange={(e) => setOwnerPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                            placeholder="Ej: 1234"
                            value={ownerPin}
                          />
                          <p className="text-xs text-slate-500">Con este PIN cargás tus ventas desde la terminal.</p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {step === 3 ? (
                    <div className="grid gap-4">
                      {isBarber ? (
                        <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
                          <Check className="size-4 shrink-0" />
                          Ya quedás como barbero en la primera sucursal.
                        </p>
                      ) : null}
                      {branches.map((branch, branchIndex) => (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5" key={branchIndex}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
                              <Store className="size-3.5" />
                              Sucursal {branchIndex + 1}
                            </span>
                            {branches.length > 1 ? (
                              <button
                                aria-label="Quitar sucursal"
                                className="flex size-7 items-center justify-center rounded-full bg-white text-rose-500 ring-1 ring-slate-950/5"
                                onClick={() => removeBranch(branchIndex)}
                                type="button"
                              >
                                <X className="size-4" />
                              </button>
                            ) : null}
                          </div>
                          <input
                            className={`${inputClass} mt-2`}
                            onChange={(e) => updateBranch(branchIndex, { name: e.target.value })}
                            placeholder="Nombre (ej: Sucursal Centro)"
                            value={branch.name}
                          />
                          <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-white px-3 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100">
                            <MapPin className="size-4 shrink-0 text-slate-400" />
                            <input
                              className="w-full bg-transparent px-2 py-3 text-sm font-semibold text-slate-950 outline-none"
                              onChange={(e) => updateBranch(branchIndex, { address: e.target.value })}
                              placeholder="Dirección (opcional)"
                              value={branch.address}
                            />
                          </div>

                          {branch.barbers.map((barber, barberIndex) => (
                            <div className="mt-2 flex items-center gap-2" key={barberIndex}>
                              <input
                                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-950 outline-none focus:border-blue-400"
                                onChange={(e) => updateBarber(branchIndex, barberIndex, { name: e.target.value })}
                                placeholder="Barbero"
                                value={barber.name}
                              />
                              <input
                                className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold tracking-widest text-slate-950 outline-none focus:border-blue-400"
                                inputMode="numeric"
                                maxLength={8}
                                onChange={(e) => updateBarber(branchIndex, barberIndex, { pin: e.target.value.replace(/\D/g, "").slice(0, 8) })}
                                placeholder="PIN"
                                value={barber.pin}
                              />
                              <button
                                aria-label="Quitar barbero"
                                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-400 ring-1 ring-slate-950/5"
                                onClick={() => removeBarber(branchIndex, barberIndex)}
                                type="button"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          ))}

                          <button
                            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white py-2.5 text-xs font-black text-blue-600 transition active:scale-[0.99]"
                            onClick={() => addBarber(branchIndex)}
                            type="button"
                          >
                            <Plus className="size-3.5" />
                            Agregar barbero
                          </button>
                        </div>
                      ))}

                      <button
                        className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-slate-100 py-3 text-sm font-black text-slate-700 transition active:scale-[0.99]"
                        onClick={addBranch}
                        type="button"
                      >
                        <Plus className="size-4" />
                        Agregar otra sucursal
                      </button>
                    </div>
                  ) : null}
                </div>

                {error ? (
                  <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>
                ) : null}
              </div>
            </div>

            <div className="shrink-0 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:px-8">
              <button className={primaryBtn} disabled={!stepValid() || isPending} onClick={goNext} type="button">
                {step === STEPS.length - 1 ? "Crear mi barbería 🎉" : "Continuar"}
                {step === STEPS.length - 1 ? null : <ArrowRight className="size-5" />}
              </button>
            </div>
          </>
        ) : null}

        {/* Celebración */}
        {phase === "success" ? (
          <div className="relative flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
            <Confetti />
            <div className="grid size-24 place-items-center rounded-full bg-emerald-100 text-5xl duration-500 animate-in zoom-in">🎉</div>
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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
      {children}
      {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
    </label>
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
      <span
        className={`grid size-6 shrink-0 place-items-center rounded-full text-white transition ${selected ? "bg-blue-600" : "bg-slate-200"}`}
      >
        {selected ? <Check className="size-4" /> : null}
      </span>
    </button>
  );
}
