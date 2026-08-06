"use client";

import { createAppointmentAction } from "@/app/turnos/actions";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useTransition } from "react";
import { toast } from "sonner";

// La agenda conserva el formulario HTML renderizado en el servidor, pero la
// mutación se procesa desde el cliente para refrescar la ruta actual al terminar.
export function AppointmentFormHandler({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLDivElement>) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    event.preventDefault();
    startTransition(async () => {
      const result = await createAppointmentAction(new FormData(form));
      if (result.ok) {
        toast.success(result.message);
        form.reset();
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return <div onSubmit={submit}>{children}</div>;
}
