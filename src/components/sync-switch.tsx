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
  /** Cuando el texto va fuera del switch (p. ej. en la ficha del catálogo). */
  ariaLabel?: string;
  /**
   * Id del <form> al que pertenece. Permite que el switch viva FUERA del
   * formulario —en el encabezado de un panel, por ejemplo— y su valor se envíe
   * igual. Es HTML del montón, no un truco: el atributo `form` existe para esto.
   */
  form?: string;
};

export function SyncSwitch({ name, defaultChecked = false, label, ariaLabel, form }: SyncSwitchProps) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <span className="inline-flex items-center gap-2.5">
      <SwitchComponent
        aria-label={ariaLabel}
        change={(args) => setChecked(Boolean(args.checked))}
        checked={checked}
      />
      {label ? <span className="text-sm font-semibold text-slate-700">{label}</span> : null}
      {name && checked ? <input form={form} name={name} type="hidden" value="on" /> : null}
    </span>
  );
}
