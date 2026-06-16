"use client";

import { Building2, MapPin, Scissors } from "lucide-react";
import { useMemo, useState } from "react";

type BarberAccessPanelProps = {
  branch: {
    id: string;
    name: string;
    business: {
      name: string;
    };
    users: Array<{
      id: string;
      name: string | null;
    }>;
  };
};

const keypadValues = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "backspace"];
const maxPinLength = 8;

export function BarberAccessPanel({ branch }: BarberAccessPanelProps) {
  const [pin, setPin] = useState("");
  const [selectedBarberId, setSelectedBarberId] = useState(branch.users[0]?.id ?? "");

  const selectedBarber = useMemo(
    () => branch.users.find((barber) => barber.id === selectedBarberId),
    [branch.users, selectedBarberId],
  );

  function appendDigit(digit: string) {
    setPin((currentPin) => (currentPin.length >= maxPinLength ? currentPin : `${currentPin}${digit}`));
  }

  function removeLastDigit() {
    setPin((currentPin) => currentPin.slice(0, -1));
  }

  return (
    <section className="grid gap-5">
      <input name="branchId" type="hidden" value={branch.id} />

      <div className="grid gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Seleccionar negocio</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Elegí la sucursal</h2>
        </div>

        <div className="rounded-[1.8rem] border-2 border-blue-600 bg-blue-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white">
              <Building2 aria-hidden="true" size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-black text-slate-950">{branch.business.name}</p>
              <p className="mt-1 flex items-center gap-1 text-sm font-bold text-slate-500">
                <MapPin aria-hidden="true" size={15} />
                {branch.name}
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-blue-700">Activa</span>
          </div>
        </div>
      </div>

      <fieldset className="grid gap-3">
        <legend>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Seleccionar barbero</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">¿Quién registra?</h2>
        </legend>

        <div className="grid gap-3">
          {branch.users.map((barber) => {
            const isSelected = barber.id === selectedBarberId;

            return (
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-[1.6rem] border-2 p-3 shadow-sm transition ${
                  isSelected ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-200"
                }`}
                key={barber.id}
              >
                <input
                  checked={isSelected}
                  className="sr-only"
                  name="barberId"
                  required
                  type="radio"
                  value={barber.id}
                  onChange={() => setSelectedBarberId(barber.id)}
                />
                <span className={`grid size-12 place-items-center rounded-2xl ${isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                  <Scissors aria-hidden="true" size={21} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-black text-slate-950">{barber.name ?? "Barbero"}</span>
                  <span className="text-sm font-bold text-slate-500">Tocá para usar este perfil</span>
                </span>
                <span className={`grid size-7 place-items-center rounded-full text-sm font-black ${isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-300"}`}>
                  {isSelected ? "✓" : ""}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="rounded-[2rem] border border-blue-100 bg-blue-50 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Ingresar PIN</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-blue-950">{selectedBarber?.name ?? "Barbero"}</h2>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-blue-700">4 a 8 números</span>
        </div>

        <input
          aria-label="PIN del barbero"
          className="sr-only"
          inputMode="numeric"
          maxLength={maxPinLength}
          minLength={4}
          name="pin"
          pattern="[0-9]*"
          required
          type="text"
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, maxPinLength))}
        />

        <div className="mt-4 flex justify-center gap-3 rounded-3xl bg-white px-4 py-4 shadow-sm">
          {Array.from({ length: 4 }).map((_, index) => (
            <span
              aria-hidden="true"
              className={`size-4 rounded-full ${pin.length > index ? "bg-blue-600" : "bg-slate-200"}`}
              key={index}
            />
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {keypadValues.map((value, index) => {
            if (!value) {
              return <span aria-hidden="true" key={`empty-${index}`} />;
            }

            const isBackspace = value === "backspace";

            return (
              <button
                aria-label={isBackspace ? "Borrar último número" : `Ingresar ${value}`}
                className="grid h-14 place-items-center rounded-2xl bg-white text-xl font-black text-blue-950 shadow-sm transition hover:bg-blue-100 active:scale-[0.98]"
                key={value}
                type="button"
                onClick={isBackspace ? removeLastDigit : () => appendDigit(value)}
              >
                {isBackspace ? "⌫" : value}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-center text-xs font-bold text-blue-700">El PIN se valida al confirmar la venta.</p>
      </div>
    </section>
  );
}
