"use client";

import { saveMarketingSettingsAction } from "@/app/marketing/actions";
import { Check, Loader2 } from "@/components/icons";
import { Field, inputClass } from "@/components/manager-ui";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

// Configuración de marketing.
//
// El formulario manda la acción y después llama a `router.refresh()`, en vez de
// que la acción redirija con un flash en la URL.
//
// El motivo no es estético: un `redirect()` a la MISMA ruta desde una server
// action no vuelve a pedir el árbol, y la pantalla se queda con los datos de
// antes. Se ve clarísimo acá — se prende la página pública, el token queda
// guardado en la base, y la pantalla sigue diciendo "prendé la página pública".
// Con refresh() el dato aparece en el acto.

export function MarketingSettingsForm({
  showPublicPage,
  publicPageActive,
  publicNote,
  googleReviewUrl,
  pointsPerAmount,
  pointValue,
}: {
  showPublicPage: boolean;
  publicPageActive: boolean;
  publicNote: string | null;
  googleReviewUrl: string | null;
  pointsPerAmount: number | null;
  pointValue: number | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await saveMarketingSettingsAction(formData);

      if (result.ok) {
        toast.success("Configuración guardada.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form action={submit} className="grid gap-3 sm:grid-cols-2">
      {showPublicPage ? (
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
          <input defaultChecked={publicPageActive} name="publicPageActive" type="checkbox" />
          Página pública activa
        </label>
      ) : null}

      {showPublicPage ? (
        <Field label="Qué mostrar en la página" className="sm:col-span-2" hint="Horarios, dirección, cómo llegar">
          <input
            className={inputClass}
            defaultValue={publicNote ?? ""}
            name="publicNote"
            placeholder="Lun a sáb de 9 a 20. Av. Siempreviva 742."
          />
        </Field>
      ) : null}

      <Field label="Link para reseñas" className="sm:col-span-2" hint="El de tu ficha de Google Maps">
        <input
          className={inputClass}
          defaultValue={googleReviewUrl ?? ""}
          name="googleReviewUrl"
          placeholder="https://g.page/r/..."
        />
      </Field>

      <Field label="Pesos por punto" hint="Cada cuánto se gana 1 punto">
        <input
          className={inputClass}
          defaultValue={pointsPerAmount ?? ""}
          inputMode="numeric"
          name="pointsPerAmount"
          placeholder="1000"
        />
      </Field>

      <Field label="Cuánto vale un punto" hint="En pesos, al canjear">
        <input
          className={inputClass}
          defaultValue={pointValue ?? ""}
          inputMode="numeric"
          name="pointValue"
          placeholder="50"
        />
      </Field>

      <button
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-black text-white transition active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400 sm:col-span-2"
        disabled={isPending}
        type="submit"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        Guardar
      </button>
    </form>
  );
}
