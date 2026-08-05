"use client";

import { useRouter } from "next/navigation";
import { useTransition, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

export type RefreshActionResult = { ok: boolean; message: string };

export function RefreshActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: (formData: FormData) => Promise<RefreshActionResult>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      try {
        const result = await action(formData);
        if (!result.ok) {
          toast.error(result.message);
          return;
        }

        toast.success(result.message);
        if (resetOnSuccess) form.reset();
        router.refresh();
      } catch {
        toast.error("No pudimos completar la operación. Intentá de nuevo.");
      }
    });
  }

  return (
    <form className={className} onSubmit={submit}>
      <fieldset className="contents" disabled={isPending}>
        {children}
      </fieldset>
    </form>
  );
}
