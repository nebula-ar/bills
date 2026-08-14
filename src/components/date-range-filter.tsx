"use client";

// Filtro por rango de fechas del dashboard con Syncfusion EJ2 DateRangePicker
// (ej2-calendars). Reemplaza los dos inputs nativos type="date" del bottom
// sheet de filtros. La interfaz hacia afuera sigue siendo ISO local
// (yyyy-mm-dd), igual que los query params del dashboard, así el resto de la
// lógica no cambia.
import { DateRangePickerComponent, type RangeEventArgs } from "@syncfusion/ej2-react-calendars";

type DateRangeFilterProps = {
  from: string; // ISO local yyyy-mm-dd
  to: string;
  onChange: (from: string, to: string) => void;
};

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

export function DateRangeFilter({ from, to, onChange }: DateRangeFilterProps) {
  const start = parseISODateLocal(from);
  const end = parseISODateLocal(to);

  function handleChange(args: RangeEventArgs) {
    if (!args.startDate || !args.endDate) return;
    onChange(toISODateLocal(args.startDate), toISODateLocal(args.endDate));
  }

  return (
    // IMPORTANTE: el evento es `change` (evento de modelo de EJ2) y NO
    // `onChange`: el wrapper React de Syncfusion special-casea `onChange` y
    // entrega un objeto reducido {syntheticEvent, nativeEvent, value, target}
    // sin startDate/endDate, con lo que el rango elegido nunca llegaría a
    // customFrom/customTo.
    <DateRangePickerComponent
      change={handleChange}
      endDate={end ?? new Date()}
      format="dd/MM/yyyy"
      placeholder="Desde – Hasta"
      separator="–"
      startDate={start ?? new Date()}
      width="100%"
    />
  );
}
