"use client";

import { MapPin, Users } from "@/components/icons";
import { useState } from "react";

type StaffAccessPanelProps = {
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
  lockedStaffId?: string;
};

const maxPinLength = 8;

export function StaffAccessPanel({ branch, lockedStaffId }: StaffAccessPanelProps) {
  const lockedStaff = lockedStaffId ? branch.users.find((staff) => staff.id === lockedStaffId) ?? null : null;
  const [pin, setPin] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState(lockedStaff?.id ?? branch.users[0]?.id ?? "");

  return (
    <section className="grid gap-4">
      <input name="branchId" type="hidden" value={branch.id} />

      {lockedStaff ? (
        <>
          <input name="staffId" type="hidden" value={lockedStaff.id} />
          <input name="terminalLocked" type="hidden" value="1" />
          <div className="flex items-center gap-3 rounded-2xl bg-primary/10 p-3 ring-1 ring-primary/15">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-white">
              <Users aria-hidden="true" size={19} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-black leading-tight text-slate-950">{lockedStaff.name ?? "Empleado"}</p>
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-bold text-slate-500">
                <MapPin aria-hidden="true" size={13} />
                {branch.business.name} · {branch.name}
              </p>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-1.5 text-sm font-bold text-slate-500">
            <MapPin aria-hidden="true" className="text-primary" size={15} />
            <span className="truncate">
              {branch.business.name} · {branch.name}
            </span>
          </div>
          <fieldset className="grid gap-2.5">
          <legend className="mb-1 text-base font-black tracking-tight text-slate-950">¿Quién registra?</legend>
          <div className="grid gap-2.5">
            {branch.users.map((staff) => {
              const isSelected = staff.id === selectedStaffId;

              return (
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 shadow-sm transition ${
                    isSelected ? "border-primary bg-primary/10" : "border-slate-200 bg-white hover:border-primary/20"
                  }`}
                  key={staff.id}
                >
                  <input
                    checked={isSelected}
                    className="sr-only"
                    name="staffId"
                    required
                    type="radio"
                    value={staff.id}
                    onChange={() => setSelectedStaffId(staff.id)}
                  />
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${isSelected ? "bg-primary text-white" : "bg-slate-100 text-slate-500"}`}>
                    <Users aria-hidden="true" size={18} />
                  </span>
                  <span className="min-w-0 flex-1 text-base font-black text-slate-950">{staff.name ?? "Empleado"}</span>
                  <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-black ${isSelected ? "bg-primary text-white" : "bg-slate-100 text-slate-300"}`}>
                    {isSelected ? "✓" : ""}
                  </span>
                </label>
              );
            })}
          </div>
          </fieldset>
        </>
      )}

      {/* PIN: usa el teclado numérico del teléfono, sin teclado en pantalla */}
      <label className="grid gap-2 rounded-2xl border border-primary/15 bg-primary/10 p-4 shadow-sm">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-primary">Ingresá tu PIN</span>
        <input
          autoComplete="off"
          className="w-full rounded-2xl border-2 border-primary/20 bg-white px-4 py-4 text-center text-3xl font-black tracking-[0.4em] text-primary outline-none transition placeholder:tracking-[0.3em] placeholder:text-slate-300 focus:border-primary focus:ring-4 focus:ring-primary/15"
          inputMode="numeric"
          maxLength={maxPinLength}
          minLength={4}
          name="pin"
          pattern="[0-9]*"
          placeholder="••••"
          required
          style={{ WebkitTextSecurity: "disc" } as React.CSSProperties}
          type="text"
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, maxPinLength))}
        />
        <span className="text-center text-xs font-bold text-primary">4 a 8 números · se valida al confirmar</span>
      </label>
    </section>
  );
}
