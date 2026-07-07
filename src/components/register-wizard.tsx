"use client";

import { registerBusinessAction } from "@/app/register/actions";
import { ArrowLeft, ArrowRight, Check, MapPin, Plus, Scissors, Sparkles, Store, Trash2, X } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState, useTransition } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PIN_RE = /^\d{4,8}$/;

type BarberDraft = { name: string; pin: string };
type BranchDraft = { name: string; address: string; barbers: BarberDraft[] };

const STEPS = [
  { title: "¿Cómo se llama tu barbería?", subtitle: "Empecemos con lo más importante." },
  { title: "Tu cuenta", subtitle: "Con estos datos entrás al panel de administración." },
  { title: "¿Vos también atendés?", subtitle: "Si cortás, te sumamos como barbero con tu PIN." },
  { title: "Tus locales y barberos", subtitle: "Cargá tu primera sucursal. Podés agregar más y sumar barberos." },
];

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100";
const pinClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-bold tracking-[0.2em] text-slate-950 outline-none transition placeholder:tracking-normal placeholder:font-semibold focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100";

export function RegisterWizard() {
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
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
    if (step === 1) return ownerName.trim().length > 0 && EMAIL_RE.test(email.trim()) && password.length >= 6;
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
    setDir(-1);
    setStep((current) => Math.max(0, current - 1));
  }

  function submit() {
    const finalBranches = branches.map((branch, index) =>
      index === 0 && isBarber ? { ...branch, barbers: [{ name: ownerName, pin: ownerPin }, ...branch.barbers] } : branch,
    );

    startTransition(async () => {
      const result = await registerBusinessAction({
        businessName,
        ownerName,
        email,
        password,
        branches: finalBranches,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const signInResult = await signIn("credentials", { email: email.trim().toLowerCase(), password, redirect: false });
      // Navegación completa (no router.push): el layout es server component y así
      // se re-ejecuta con la sesión nueva y aparece la barra de navegación.
      window.location.assign(signInResult?.ok ? "/" : "/login");
    });
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <main className="flex min-h-[100dvh] items-center bg-slate-100 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-slate-950 sm:px-6 sm:py-10">
      <section className="mx-auto flex min-h-[560px] w-full max-w-md flex-col rounded-[2.5rem] bg-white px-6 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.16)] ring-1 ring-slate-200">
        {/* Encabezado + progreso */}
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-600/30">
            <span className="text-lg font-black">BB</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Crear tu barbería</p>
            <p className="text-xs font-semibold text-slate-400">Paso {step + 1} de {STEPS.length}</p>
          </div>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>

        {/* Título del paso */}
        <div className="mt-6">
          <h1 className="text-2xl font-black tracking-tight text-slate-950">{STEPS[step].title}</h1>
          <p className="mt-1.5 text-sm font-semibold leading-6 text-slate-500">{STEPS[step].subtitle}</p>
        </div>

        {/* Contenido del paso (animado) */}
        <div className="mt-5 min-h-0 flex-1">
          <div
            className={`duration-300 animate-in fade-in ${dir === 1 ? "slide-in-from-right-6" : "slide-in-from-left-6"}`}
            key={step}
          >
            {step === 0 ? (
              <div className="grid gap-2">
                <label className="text-xs font-black uppercase tracking-wide text-slate-500" htmlFor="businessName">
                  Nombre de la barbería
                </label>
                <input
                  className={inputClass}
                  id="businessName"
                  onChange={(event) => setBusinessName(event.target.value)}
                  placeholder="Ej: Barbería El Rulo"
                  value={businessName}
                />
                <p className="mt-2 flex items-start gap-2 rounded-2xl bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-700">
                  <Sparkles className="mt-0.5 size-4 shrink-0" />
                  Vas a poder cambiar todo esto después desde el panel.
                </p>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500" htmlFor="ownerName">
                    Tu nombre
                  </label>
                  <input className={inputClass} id="ownerName" onChange={(e) => setOwnerName(e.target.value)} placeholder="Ej: Matías" value={ownerName} />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500" htmlFor="email">
                    Email
                  </label>
                  <input
                    autoCapitalize="none"
                    className={inputClass}
                    id="email"
                    inputMode="email"
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tucorreo@ejemplo.com"
                    type="email"
                    value={email}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500" htmlFor="password">
                    Contraseña
                  </label>
                  <input
                    className={inputClass}
                    id="password"
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Al menos 6 caracteres"
                    type="password"
                    value={password}
                  />
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="grid gap-4">
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-2xl bg-blue-600 text-white">
                      <Scissors className="size-5" />
                    </span>
                    <div>
                      <p className="text-sm font-black text-slate-950">Sí, yo también corto</p>
                      <p className="text-xs text-slate-500">Te sumamos como barbero</p>
                    </div>
                  </div>
                  <button
                    aria-checked={isBarber}
                    aria-label="Vos también atendés"
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${isBarber ? "bg-emerald-500" : "bg-slate-300"}`}
                    onClick={() => setIsBarber((value) => !value)}
                    role="switch"
                    type="button"
                  >
                    <span
                      className="absolute left-1 top-1 size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out"
                      style={{ transform: isBarber ? "translateX(1.25rem)" : "translateX(0)" }}
                    />
                  </button>
                </div>
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
                ) : (
                  <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">Tranqui, esto lo podés activar más adelante.</p>
                )}
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
                <p className="px-1 text-xs text-slate-400">
                  Sumá tus barberos (podés dejarlos sin PIN y cargarlo después). Todo esto se edita luego desde el panel.
                </p>
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
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>
        ) : null}

        {/* Navegación */}
        <div className="mt-6 flex items-center gap-3">
          {step > 0 ? (
            <button
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition active:scale-95"
              onClick={goBack}
              type="button"
            >
              <ArrowLeft className="size-5" />
            </button>
          ) : null}
          <button
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-base font-black text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            disabled={!stepValid() || isPending}
            onClick={goNext}
            type="button"
          >
            {step === STEPS.length - 1 ? (
              <>
                {isPending ? "Creando…" : "Crear mi barbería"}
                {!isPending ? <Sparkles className="size-5" /> : null}
              </>
            ) : (
              <>
                Continuar
                <ArrowRight className="size-5" />
              </>
            )}
          </button>
        </div>

        <p className="mt-5 text-center text-xs font-medium text-slate-400">
          ¿Ya tenés cuenta?{" "}
          <Link className="font-black text-blue-600" href="/login">
            Iniciar sesión
          </Link>
        </p>
      </section>
    </main>
  );
}
