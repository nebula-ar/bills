"use client";

import { LogOut } from "@/components/icons";
import { logoutAction } from "@/app/login/actions";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LogoutButtonProps = {
  className?: string;
  label?: string;
};

export function LogoutButton({ className, label = "Cerrar sesión" }: LogoutButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
      window.location.assign("/login");
    });
  }

  return (
    <Button
      aria-label={label}
      className={cn("justify-start gap-2 text-slate-600 hover:text-primary", className)}
      disabled={isPending}
      onClick={handleLogout}
      size="sm"
      type="button"
      variant="ghost"
    >
      <LogOut aria-hidden="true" className="size-4" />
      {isPending ? "Cerrando..." : label}
    </Button>
  );
}
