"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";

import { formatAmountInput } from "@/lib/money";

type MoneyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "defaultValue" | "onChange" | "type" | "value"
> & {
  name: string;
  defaultValue?: string | number | null;
};

// Campo de plata para los formularios que se mandan al servidor.
//
// Se escribe y se manda con separador de miles ("28.000"), porque a ojo "28000"
// y "280000" son el mismo borrón y así se cargan precios con un cero de más.
// Del otro lado no hace falta nada nuevo: el punto siempre fue separador de
// miles acá, y los parsers de las acciones ya lo limpian antes de convertir.
export function MoneyInput({ defaultValue, name, ...rest }: MoneyInputProps) {
  const initial = formatAmountInput(String(defaultValue ?? ""));
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  // React resetea el form después de una server action; como acá el valor es
  // estado nuestro, el reset nativo no lo toca y el monto quedaría escrito.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) {
      return;
    }
    const restore = () => setValue(initial);
    form.addEventListener("reset", restore);
    return () => form.removeEventListener("reset", restore);
  }, [initial]);

  return (
    <input
      {...rest}
      inputMode="numeric"
      name={name}
      onChange={(event) => setValue(formatAmountInput(event.target.value))}
      ref={inputRef}
      type="text"
      value={value}
    />
  );
}
