"use client";

// Toggle con Syncfusion EJ2 Switch (ej2-buttons), reemplazo del checkbox
// nativo de los formularios de Gestión. El valor viaja en un input oculto que
// solo existe cuando está activado — el mismo contrato del checkbox de antes
// (`formData.get("active") !== null`).
import { useState } from "react";

import { SwitchComponent } from "@syncfusion/ej2-react-buttons";

type SyncSwitchProps = {
  name?: string;
  defaultChecked?: boolean;
  label?: string;
};

export function SyncSwitch({ name, defaultChecked = false, label }: SyncSwitchProps) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <span className="inline-flex items-center gap-2.5">
      <SwitchComponent
        change={(args) => setChecked(Boolean(args.checked))}
        checked={checked}
      />
      {label ? <span className="text-sm font-semibold text-slate-700">{label}</span> : null}
      {name && checked ? <input name={name} type="hidden" value="on" /> : null}
    </span>
  );
}
