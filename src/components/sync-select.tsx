"use client";

// Desplegable con Syncfusion EJ2 DropDownList (ej2-dropdowns), con la misma
// interfaz que SelectField: el valor viaja en un input oculto, así los
// formularios con server action siguen mandando el campo igual que antes y no
// hay que tocar ninguna acción del servidor.
//
// ⚠️ DIFERENCIA DE CONTRATO con el viejo SelectField: este arranca en ""
// (placeholder) cuando no recibe `defaultValue`; SelectField inicializaba en
// `options[0]`. Antes de usar un SyncSelect sin defaultValue, verificá que el
// servidor caiga en un fallback seguro con valor vacío (como "" → CASH en
// método de pago), o pasale el default explícito. Un pago/registro que dependa
// de "la primera opción" necesita `defaultValue={options[0]?.value}`.
import { useState } from "react";

import { DropDownListComponent } from "@syncfusion/ej2-react-dropdowns";

export type SyncSelectOption = { value: string; label: string };

type SyncSelectProps = {
  name?: string;
  defaultValue?: string;
  options: SyncSelectOption[];
  ariaLabel?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
};

export function SyncSelect({
  name,
  defaultValue,
  options,
  ariaLabel,
  placeholder = "Seleccionar…",
  onChange,
}: SyncSelectProps) {
  const [value, setValue] = useState(defaultValue ?? "");

  return (
    <>
      {name ? <input name={name} type="hidden" value={value} /> : null}
      <DropDownListComponent
        aria-label={ariaLabel}
        change={(args) => {
          const next = String(args.value ?? "");
          setValue(next);
          onChange?.(next);
        }}
        dataSource={options}
        fields={{ text: "label", value: "value" }}
        placeholder={placeholder}
        value={value}
        width="100%"
      />
    </>
  );
}
