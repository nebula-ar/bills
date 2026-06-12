"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      className="text-zinc-300 hover:text-zinc-50"
      onClick={() => signOut({ callbackUrl: "/login" })}
      type="button"
    >
      Salir
    </button>
  );
}
