"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { anularComprobanteAction, emitComprobanteAction, generateCertificate, updateFiscalData } from "@/app/facturacion/actions";
import { AfipQrCode } from "@/components/afip-qr-code";
import { PageEnter } from "@/components/page-enter";
import { Skeleton } from "@/components/ui/skeleton";
import { SyncSelect } from "@/components/sync-select";
import { TaxCondition } from "@/generated/prisma/enums";
import type { AfipStatus, InvoiceType } from "@/generated/prisma/client";
import { Ban, CheckCircle2, Eye, EyeOff, KeyRound, Lock, QrCode, ReceiptText, TriangleAlert } from "@/components/icons";
import { AFIP_STATUS_LABELS, TAX_CONDITION_LABELS } from "@/lib/invoice-labels";
import { validateTaxId } from "@/lib/tax-id";

import {
  ColumnDirective,
  ColumnsDirective,
  Filter,
  GridComponent,
  Inject,
  Page,
  Sort,
} from "@syncfusion/ej2-react-grids";
import { DialogComponent } from "@syncfusion/ej2-react-popups";
import { ToastComponent } from "@syncfusion/ej2-react-notifications";
import { ProgressButtonComponent } from "@syncfusion/ej2-react-splitbuttons";

export type ComprobanteRow = {
  id: string;
  fechaLabel: string;
  detalle: string;
  cliente: string | null;
  invoiceType: InvoiceType | null;
  afipStatus: AfipStatus;
  afipError: string | null;
  cae: string | null;
  caeVencimiento: string | null;
  afipVoucherNumber: number | null;
  qrUrl: string | null;
  total: number;
};

export type FiscalProfileData = {
  businessName: string;
  cuit: string | null;
  taxCondition: TaxCondition | null;
  salesPointNumber: number | null;
  hasCertificate: boolean;
  certificateCreatedAt: string | null;
  flash: { status: "success" | "error"; message: string } | null;
  comprobantes: ComprobanteRow[];
};

const TAX_CONDITION_OPTIONS = Object.values(TaxCondition);

const AFIP_BADGE_STYLES: Record<AfipStatus, string> = {
  NOT_CONFIGURED: "bg-slate-100 text-slate-500",
  PENDING: "bg-amber-50 text-amber-700",
  ISSUED: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-rose-50 text-rose-700",
};

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

function invoiceLabel(invoiceType: InvoiceType | null) {
  return invoiceType ? `Factura ${invoiceType}` : "Comprobante";
}

// El ProgressButton de EJ2 con `enableProgress` arranca su indicador al tocar
// y lo apaga con stopProgress(). El duration alto hace que el fill no se
// complete solo: el indicador queda hasta que la llamada a AFIP termina y el
// finally llama a stopProgress(). Mismo patrón para emitir y anular.
const PROGRESS_DURATION = 300_000;

export function FiscalProfileManager({ data }: { data: FiscalProfileData }) {
  const router = useRouter();
  const [cuit, setCuit] = useState(data.cuit ?? "");
  const [showPassword, setShowPassword] = useState(false);
  const [isGenerating, startGenerating] = useTransition();

  // ── Toast de feedback: resultados de AFIP (emitido, anulado, errores) y el
  // flash que llegaba por URL. Reemplaza el banner de estado viejo. El flash
  // se muestra una vez por mensaje distinto (ref, no estado: no hace falta
  // re-render para acordarse de cuál ya se avisó).
  const toastRef = useRef<ToastComponent | null>(null);
  const shownFlashRef = useRef<string | null>(null);
  useEffect(() => {
    if (data.flash && data.flash.message !== shownFlashRef.current) {
      shownFlashRef.current = data.flash.message;
      toastRef.current?.show({
        title: data.flash.status === "success" ? "Listo" : "No se pudo completar",
        content: data.flash.message,
        cssClass: `e-facturacion-toast e-facturacion-toast-${data.flash.status}`,
        timeOut: data.flash.status === "error" ? 6000 : 3200,
      });
    }
  }, [data.flash]);

  function showToast(kind: "success" | "error", title: string, content?: string) {
    toastRef.current?.show({
      title,
      content,
      cssClass: `e-facturacion-toast e-facturacion-toast-${kind}`,
      timeOut: kind === "error" ? 6000 : 3200,
    });
  }

  const cuitCheck = useMemo(() => (cuit.trim().length > 0 ? validateTaxId(cuit) : null), [cuit]);
  const cuitHasError = cuitCheck !== null && (!cuitCheck.valid || cuitCheck.kind !== "CUIT");

  const fiscallyConfigured = Boolean(data.cuit && data.taxCondition && data.salesPointNumber != null);

  // ── Grilla de comprobantes: las filas viven en estado y se sincronizan con
  // la data fresca del server tras un router.refresh() (emitir/anular), sin
  // perder lo que el DataGrid esté mostrando. pageSettings estable con useMemo
  // (misma referencia entre renders): sin esto, ej2-react-base lo trata como
  // controlled prop cambiada y traga el refresh del dataSource en prod (ver
  // el mismo fix en catalog-manager, NEBU-48).
  const [items, setItems] = useState(data.comprobantes);
  const [syncedComprobantes, setSyncedComprobantes] = useState(data.comprobantes);
  if (data.comprobantes !== syncedComprobantes) {
    setSyncedComprobantes(data.comprobantes);
    setItems(data.comprobantes);
  }

  const pageSettings = useMemo(() => ({ pageSize: 10, pageSizes: [10, 20, 50] }), []);

  // ── Dialog de comprobante: detalle (CAE/QR) y confirmaciones de emitir/anular.
  const [selected, setSelected] = useState<ComprobanteRow | null>(null);
  const [mode, setMode] = useState<"detalle" | "emitir" | "anular">("detalle");

  const [emitting, setEmitting] = useState(false);
  const [emitError, setEmitError] = useState<string | null>(null);
  const emitPbRef = useRef<ProgressButtonComponent | null>(null);

  const [anulando, setAnulando] = useState(false);
  const [anularError, setAnularError] = useState<string | null>(null);
  const [anularReason, setAnularReason] = useState("");
  const anularPbRef = useRef<ProgressButtonComponent | null>(null);

  function openDialog(row: ComprobanteRow) {
    setEmitError(null);
    setAnularError(null);
    setAnularReason("");
    setSelected(row);
    setMode("detalle");
  }

  function closeDialog() {
    if (emitting || anulando) return;
    setSelected(null);
    setMode("detalle");
  }

  // Emitir comprobante: llamada lenta a AFIP. El ProgressButton muestra el
  // spinner mientras corre; el resultado viaja en el Toast y la grilla se
  // refresca (el estado AFIP de la fila cambia a emitida/fallida).
  async function handleEmit() {
    if (!selected || emitting) return;
    setEmitting(true);
    setEmitError(null);
    try {
      const result = await emitComprobanteAction(selected.id);
      if (result.ok) {
        showToast("success", "Comprobante emitido", `La ${invoiceLabel(selected.invoiceType).toLowerCase()} de ${money(selected.total)} quedó registrada en AFIP.`);
        setSelected(null);
        setMode("detalle");
        router.refresh();
      } else {
        setEmitError(result.error);
        showToast("error", "AFIP no emitió el comprobante", result.error);
      }
    } finally {
      emitPbRef.current?.progressComplete();
      setEmitting(false);
    }
  }

  // Anular venta todavía no facturada: revierte stock y cuenta corriente.
  async function handleAnular() {
    if (!selected || anulando) return;
    setAnulando(true);
    setAnularError(null);
    try {
      const formData = new FormData();
      formData.set("saleId", selected.id);
      if (anularReason.trim().length > 0) formData.set("reason", anularReason.trim());
      const result = await anularComprobanteAction(formData);
      if (result.ok) {
        showToast("success", "Venta anulada", "La venta se anuló y ya no figura en el historial de comprobantes.");
        setSelected(null);
        setMode("detalle");
        router.refresh();
      } else {
        setAnularError(result.error);
        showToast("error", "No se pudo anular", result.error);
      }
    } finally {
      anularPbRef.current?.progressComplete();
      setAnulando(false);
    }
  }

  // Generar certificado: llamada lenta contra AFIP con Clave Fiscal. El
  // ProgressButton queda con spinner mientras corre (el redirect de la action
  // navega al terminar; stopProgress es inofensivo si la página ya cambió).
  const certFormRef = useRef<HTMLFormElement>(null);
  const certPbRef = useRef<ProgressButtonComponent | null>(null);

  function handleGenerateCertificate() {
    const form = certFormRef.current;
    if (!form || isGenerating) return;
    const formData = new FormData(form);
    const username = String(formData.get("claveFiscalUsername") ?? "").trim();
    const password = String(formData.get("claveFiscalPassword") ?? "");
    if (!username || !password) {
      certPbRef.current?.progressComplete();
      showToast("error", "Faltan datos", "Completá el usuario y la contraseña de Clave Fiscal.");
      return;
    }
    startGenerating(async () => {
      try {
        await generateCertificate(formData);
      } finally {
        certPbRef.current?.progressComplete();
      }
    });
  }

  return (
    <PageEnter>
      <main className="mx-auto min-h-dvh w-full min-w-0 max-w-[560px] overflow-x-clip bg-[var(--background)] px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-6 text-slate-950 lg:max-w-[720px] lg:px-8">
      <header className="flex items-center justify-between gap-4 duration-500 animate-in fade-in slide-in-from-top-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500">{data.businessName}</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">Facturación</h1>
        </div>
      </header>

      {/* Datos fiscales */}
      <form
        action={updateFiscalData}
        className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-950/5 duration-500 animate-in fade-in slide-in-from-bottom-2"
      >
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ReceiptText className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black text-slate-950">Datos fiscales</h2>
            <p className="text-xs text-slate-500">Necesarios para poder facturar electrónicamente (AFIP/ARCA).</p>
          </div>
          {fiscallyConfigured ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[0.7rem] font-bold text-emerald-700">
              <CheckCircle2 className="size-3.5" />
              Completo
            </span>
          ) : null}
        </div>

        <div className="space-y-4">
          <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
            CUIT
            <input
              className={`rounded-2xl border bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:bg-white focus:ring-4 ${
                cuitHasError ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100" : "border-slate-200 focus:border-primary/40 focus:ring-primary/15"
              }`}
              inputMode="numeric"
              name="cuit"
              onChange={(event) => setCuit(event.target.value)}
              placeholder="20-40937847-2"
              value={cuit}
            />
            {cuitHasError ? <span className="normal-case text-xs font-semibold text-rose-600">CUIT inválido (revisá el dígito verificador).</span> : null}
          </label>

          <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
            Condición frente al IVA
            <SyncSelect
              ariaLabel="Condición frente al IVA"
              defaultValue={data.taxCondition ?? ""}
              name="taxCondition"
              options={[
                { value: "", label: "Elegí una opción" },
                ...TAX_CONDITION_OPTIONS.map((condition) => ({
                  value: condition,
                  label: TAX_CONDITION_LABELS[condition],
                })),
              ]}
              placeholder="Elegí una opción"
            />
          </label>

          <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
            Punto de venta AFIP
            <input
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
              defaultValue={data.salesPointNumber ?? ""}
              inputMode="numeric"
              max={9999}
              min={1}
              name="salesPointNumber"
              placeholder="1"
              type="number"
            />
          </label>

          <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
            Mientras no estén completos, el negocio no puede emitir comprobantes fiscales (las ventas se siguen registrando igual).
          </p>
        </div>

        <button
          className="mt-4 w-full rounded-2xl bg-primary px-4 py-4 text-base font-black text-white shadow-sm shadow-primary/25 transition hover:bg-primary-strong active:scale-[0.99]"
          type="submit"
        >
          Guardar datos fiscales
        </button>
      </form>

      {/* Certificado de producción */}
      <div
        className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-950/5 duration-500 animate-in fade-in slide-in-from-bottom-2"
        style={{ animationDelay: "80ms", animationFillMode: "backwards" }}
      >
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600">
            <Lock className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black text-slate-950">Facturación real (producción)</h2>
            <p className="text-xs text-slate-500">Generá el certificado con tu Clave Fiscal para poder emitir comprobantes de verdad.</p>
          </div>
        </div>

        {data.hasCertificate ? (
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3.5 text-sm font-bold text-emerald-700">
            <CheckCircle2 className="size-4 shrink-0" />
            Certificado generado{data.certificateCreatedAt ? ` el ${new Date(data.certificateCreatedAt).toLocaleDateString("es-AR")}` : ""}. Ya podés facturar de verdad.
          </div>
        ) : !fiscallyConfigured ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
            Completá primero los datos fiscales de arriba para poder generar el certificado.
          </p>
        ) : (
          // OJO con el submit nativo: el form NO tiene `action` (la generación la
          // dispara el ProgressButton con onClick) y el ProgressButton de EJ2 no
          // aplica `type` al <button> que renderiza — el default HTML sería
          // "submit" y mandaría la contraseña de Clave Fiscal por GET a la URL.
          // `onSubmit` bloquea ese submit nativo (Enter incluido) y redirige al
          // mismo handler del botón.
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              handleGenerateCertificate();
            }}
            ref={certFormRef}
          >
            <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
              Usuario de Clave Fiscal
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
                name="claveFiscalUsername"
                placeholder="Tu CUIT o usuario de AFIP"
                required
                type="text"
              />
            </label>
            <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
              Contraseña de Clave Fiscal
              <div className="relative">
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 pr-12 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
                  name="claveFiscalPassword"
                  required
                  type={showPassword ? "text" : "password"}
                />
                <button
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center text-slate-400"
                  onClick={() => setShowPassword((value) => !value)}
                  type="button"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </label>
            <p className="flex items-start gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
              <KeyRound className="mt-0.5 size-3.5 shrink-0" />
              Se usa una sola vez para generar el certificado. Nunca la guardamos.
            </p>
            <ProgressButtonComponent
              content="Generar certificado"
              cssClass="e-facturacion-pb"
              disabled={isGenerating}
              duration={PROGRESS_DURATION}
              enableProgress
              isPrimary
              onClick={handleGenerateCertificate}
              ref={certPbRef}
              style={{ width: "100%" }}
              type="button"
            />
          </form>
        )}
      </div>

      {/* Comprobantes AFIP: historial en DataGrid de Syncfusion EJ2. Reemplaza
          al estado de la pantalla vieja (que no tenía listado) y le da al
          dueño el historial de comprobantes con su estado AFIP, con acciones
          de emitir/anular/detalle en el Dialog. */}
      <div
        className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-950/5 duration-500 animate-in fade-in slide-in-from-bottom-2"
        style={{ animationDelay: "160ms", animationFillMode: "backwards" }}
      >
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-cyan-600">
            <QrCode className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black text-slate-950">Comprobantes</h2>
            <p className="text-xs text-slate-500">Últimas ventas y su estado en AFIP/ARCA. Tocá una fila para ver el detalle.</p>
          </div>
        </div>

        <div className="overflow-hidden">
          <GridComponent
            allowFiltering
            allowPaging
            allowSorting
            allowTextWrap
            cssClass="e-facturacion-grid e-gestion-grid e-dashboard-grid"
            dataSource={items}
            emptyRecordTemplate={() => (
              <div className="flex flex-col items-center gap-1 py-6 text-center">
                <ReceiptText className="size-6 text-slate-300" />
                <p className="text-sm font-bold text-slate-600">Todavía no hay comprobantes</p>
                <p className="text-xs text-slate-500">Cuando registres ventas, van a aparecer acá con su estado AFIP.</p>
              </div>
            )}
            height="auto"
            pageSettings={pageSettings}
            recordClick={(args) => {
              const row = args.data as ComprobanteRow | undefined;
              if (row?.id) openDialog(row);
            }}
            width="100%"
          >
            <ColumnsDirective>
              <ColumnDirective field="fechaLabel" headerText="Fecha" width={120} />
              <ColumnDirective field="detalle" headerText="Detalle" template={(row: ComprobanteRow) => <span className="block truncate text-slate-500">{row.detalle}</span>} width="auto" />
              <ColumnDirective
                field="afipStatus"
                headerText="Estado"
                template={(row: ComprobanteRow) => (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-bold ${AFIP_BADGE_STYLES[row.afipStatus]}`}>
                    {row.afipStatus === "ISSUED" ? <CheckCircle2 className="size-3" /> : null}
                    {row.afipStatus === "FAILED" ? <TriangleAlert className="size-3" /> : null}
                    {row.invoiceType ? `Factura ${row.invoiceType} · ` : ""}
                    {AFIP_STATUS_LABELS[row.afipStatus]}
                  </span>
                )}
                width={160}
              />
              <ColumnDirective
                field="cae"
                headerText="CAE"
                hideAtMedia="(min-width: 641px)"
                template={(row: ComprobanteRow) =>
                  row.cae ? <span className="text-xs font-bold text-slate-700" style={{ fontVariantNumeric: "tabular-nums" }}>{row.cae}</span> : <span className="text-slate-400">—</span>
                }
                width={130}
              />
              <ColumnDirective
                field="total"
                headerText="Total"
                template={(row: ComprobanteRow) => (
                  <span className="text-sm font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {money(row.total)}
                  </span>
                )}
                textAlign="Right"
                type="number"
                width={110}
              />
              {/* Acción explícita: además del toque en la fila, deja abrir el
                  detalle con teclado (la fila de la grilla no es focuseable). */}
              <ColumnDirective
                headerText=""
                template={(row: ComprobanteRow) => (
                  <button
                    aria-label={`Ver detalle de ${invoiceLabel(row.invoiceType).toLowerCase()}`}
                    className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-black text-slate-600 transition hover:bg-slate-50 active:scale-95"
                    onClick={() => openDialog(row)}
                    type="button"
                  >
                    Ver
                  </button>
                )}
                width={70}
              />
            </ColumnsDirective>
            <Inject services={[Page, Sort, Filter]} />
          </GridComponent>
        </div>
      </div>

      {/* Dialog del comprobante: detalle (CAE + QR) y confirmaciones de
          emitir/anular. El contenido cambia según el modo; los botones de
          acción lenta son ProgressButton con spinner mientras AFIP responde. */}
      <DialogComponent
        animationSettings={{ duration: 200, effect: "Fade" }}
        close={closeDialog}
        cssClass="e-facturacion-dialog e-gestion-dialog"
        header={selected ? (mode === "detalle" ? "Comprobante" : mode === "emitir" ? "Emitir factura" : "Anular venta") : ""}
        isModal
        overlayClick={closeDialog}
        showCloseIcon
        visible={selected !== null}
        width="92%"
      >
        {selected ? (
          <div className="px-1 pb-1">
            {mode === "detalle" ? (
              <DetalleComprobante row={selected} onEmitir={() => setMode("emitir")} onAnular={() => setMode("anular")} />
            ) : null}
            {mode === "emitir" ? (
              <div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-700">{selected.cliente ?? "Cliente anónimo"}</p>
                    <p className="text-xs text-slate-500">{selected.fechaLabel}</p>
                  </div>
                  <span className="shrink-0 text-lg font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {money(selected.total)}
                  </span>
                </div>
                <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
                  La emisión es una llamada a AFIP/ARCA y puede tardar unos segundos. No cierres la pantalla mientras se procesa.
                </p>
                {emitError ? (
                  <p className="mt-2 rounded-2xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700" role="alert">
                    {emitError}
                  </p>
                ) : null}
                <div className="mt-4 flex gap-3">
                  <button
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 transition active:scale-95 disabled:opacity-50"
                    disabled={emitting}
                    onClick={() => setMode("detalle")}
                    type="button"
                  >
                    Volver
                  </button>
                  <ProgressButtonComponent
                    content="Emitir factura"
                    cssClass="e-facturacion-pb"
                    disabled={emitting}
                    duration={PROGRESS_DURATION}
                    enableProgress
                    isPrimary
                    onClick={handleEmit}
                    ref={emitPbRef}
                    style={{ flex: 1 }}
                    type="button"
                  />
                </div>
              </div>
            ) : null}
            {mode === "anular" ? (
              <div>
                <p className="rounded-2xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                  La venta se anula: se devuelve el stock y se revierte la cuenta corriente si correspondía. No se puede deshacer.
                </p>
                <textarea
                  className="mt-3 min-h-20 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
                  disabled={anulando}
                  maxLength={500}
                  onChange={(event) => setAnularReason(event.target.value)}
                  placeholder="Motivo de la anulación (opcional)"
                  value={anularReason}
                />
                {anularError ? (
                  <p className="mt-2 rounded-2xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700" role="alert">
                    {anularError}
                  </p>
                ) : null}
                <div className="mt-4 flex gap-3">
                  <button
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 transition active:scale-95 disabled:opacity-50"
                    disabled={anulando}
                    onClick={() => setMode("detalle")}
                    type="button"
                  >
                    Volver
                  </button>
                  <ProgressButtonComponent
                    content="Anular venta"
                    cssClass="e-facturacion-pb e-facturacion-pb-danger"
                    disabled={anulando}
                    duration={PROGRESS_DURATION}
                    enableProgress
                    onClick={handleAnular}
                    ref={anularPbRef}
                    style={{ flex: 1 }}
                    type="button"
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogComponent>

      <ToastComponent
        position={{ X: "Center", Y: "Bottom" }}
        ref={toastRef}
        showCloseButton
        width="min(24rem, calc(100vw - 2rem))"
      />
    </main>
    </PageEnter>
  );
}

// Detalle del comprobante dentro del Dialog: datos AFIP (CAE, vencimiento,
// número de comprobante) y, si está emitida, el QR fiscal (RG 4291/2018).
function DetalleComprobante({
  row,
  onEmitir,
  onAnular,
}: {
  row: ComprobanteRow;
  onEmitir: () => void;
  onAnular: () => void;
}) {
  const emitida = row.afipStatus === "ISSUED";

  return (
    <div>
      <div className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-700">{row.cliente ?? "Cliente anónimo"}</p>
          <p className="text-xs text-slate-500">
            {row.fechaLabel} · {row.detalle}
          </p>
        </div>
        <span className="shrink-0 text-lg font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
          {money(row.total)}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">Estado AFIP</p>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${AFIP_BADGE_STYLES[row.afipStatus]}`}>
          {emitida ? <CheckCircle2 className="size-3" /> : null}
          {row.afipStatus === "FAILED" ? <TriangleAlert className="size-3" /> : null}
          {row.invoiceType ? `Factura ${row.invoiceType} · ` : ""}
          {AFIP_STATUS_LABELS[row.afipStatus]}
        </span>
      </div>

      {emitida && row.cae ? (
        <div className="mt-3 flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
          {row.qrUrl ? <AfipQrCode size={88} url={row.qrUrl} /> : null}
          <div className="min-w-0 text-sm">
            <p className="font-bold text-slate-950">CAE {row.cae}</p>
            {row.caeVencimiento ? (
              <p className="text-xs text-slate-500">Vence {new Date(row.caeVencimiento).toLocaleDateString("es-AR")}</p>
            ) : null}
            {row.afipVoucherNumber != null ? (
              <p className="text-xs text-slate-500">N° {row.afipVoucherNumber}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {row.afipStatus === "FAILED" && row.afipError ? (
            <p className="rounded-2xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">{row.afipError}</p>
          ) : null}
          {row.afipStatus === "NOT_CONFIGURED" ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
              Esta venta se creó antes de completar los datos fiscales. Probá emitir igual: si el negocio ya está configurado, va a facturar.
            </p>
          ) : null}
          <button
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3.5 text-sm font-black text-primary transition active:scale-[0.99]"
            onClick={onEmitir}
            type="button"
          >
            <QrCode className="size-4" />
            {row.afipStatus === "FAILED" ? "Reintentar factura" : "Emitir factura"}
          </button>
          <button
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm font-black text-rose-600 transition active:scale-[0.99]"
            onClick={onAnular}
            type="button"
          >
            <Ban className="size-4" />
            Anular venta
          </button>
        </div>
      )}
    </div>
  );
}

// Estado skeleton de FiscalProfileManager: mismo shell, header y tarjeta de
// datos fiscales (CUIT, condición IVA, punto de venta, botones) que el
// componente real.
export function FiscalProfileManagerSkeleton() {
  return (
    <main className="mx-auto min-h-dvh w-full min-w-0 max-w-[560px] overflow-x-clip bg-[var(--background)] px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-6 text-slate-950 lg:max-w-[720px] lg:px-8">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-7 w-36" />
        </div>
      </header>

      {/* Datos fiscales */}
      <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-950/5">
        <div className="mb-4 flex items-center gap-2.5">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="space-y-2" key={index}>
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </div>
          ))}
          <div className="flex gap-3">
            <Skeleton className="h-11 w-32 rounded-xl" />
            <Skeleton className="h-11 flex-1 rounded-xl" />
          </div>
        </div>
      </div>
    </main>
  );
}
