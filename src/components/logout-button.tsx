"use client";

import { useState } from "react";

import { LogOut } from "@/components/icons";
import { logoutAction } from "@/app/login/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LogoutButtonProps = {
  className?: string;
  label?: string;
};

// Cerrar sesión es la acción que tira la sesión completa: un toque accidental
// en el mostrador se paga caro. Desde NEBU-33 pasa por el ConfirmDialog:
// confirmación informativa + feedback de estado (loading → éxito) antes de
// redirigir a /login.
export function LogoutButton({ className, label = "Cerrar sesión" }: LogoutButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        aria-label={label}
        className={cn("justify-start gap-2 text-slate-600 hover:text-primary", className)}
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="ghost"
      >
        <LogOut aria-hidden="true" className="size-4" />
        {label}
      </Button>
      <ConfirmDialog
        cancelLabel="Cancelar"
        confirmLabel="Sí, cerrar sesión"
        description="Se cierra tu sesión en este dispositivo. El turno de caja en curso no se pierde: podés volver a entrar con tu usuario y contraseña."
        onConfirm={async () => {
          await logoutAction();
        }}
        onOpenChange={setOpen}
        onSuccess={() => {
          window.location.assign("/login");
        }}
        open={open}
        title="¿Cerrar sesión?"
      />
    </>
  );
}
