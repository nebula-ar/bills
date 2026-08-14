"use client";

// Selector de fecha con Syncfusion EJ2 DatePicker (ej2-calendars), reemplazo
// del `<input type="date">` nativo de los formularios de Gestión. La interfaz
// hacia afuera sigue siendo ISO local (yyyy-mm-dd) en un input oculto: los
// parsers de las acciones del servidor no cambian.
import { useState } from "react";

import { DatePickerComponent } from "@syncfusion/ej2-react-calendars";

function parseISODateLocal(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function toISODateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type SyncDatePickerProps = {
  name?: string;
  /** ISO local yyyy-mm-dd, o "" para sin fecha. */
  defaultValue?: string;
  placeholder?: string;
};

export function SyncDatePicker({
  name,
  defaultValue = "",
  placeholder = "Seleccionar fecha",
}: SyncDatePickerProps) {
  const [value, setValue] = useState(defaultValue);

  return (
    <>
      {name ? <input name={name} type="hidden" value={value} /> : null}
      <DatePickerComponent
        change={(args) => setValue(args.value ? toISODateLocal(args.value) : "")}
        format="dd/MM/yyyy"
        placeholder={placeholder}
        value={defaultValue ? parseISODateLocal(defaultValue) : undefined}
        width="100%"
      />
    </>
  );
}
