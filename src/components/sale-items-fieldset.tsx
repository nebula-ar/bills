"use client";

import { useState } from "react";

export type SaleServiceOption = {
  serviceId: string;
  name: string;
  price: number;
};

export type SalePaymentOption = {
  label: string;
  value: string;
};

type SaleItemsFieldsetProps = {
  paymentOptions: SalePaymentOption[];
  serviceOptions: SaleServiceOption[];
  submitLabel?: string;
  variant?: "default" | "barberMobile";
};

export function SaleItemsFieldset({
  paymentOptions,
  serviceOptions,
  submitLabel = "Confirmar venta",
  variant = "default",
}: SaleItemsFieldsetProps) {
  const [items, setItems] = useState<Record<string, number>>({});

  const selectedItems = serviceOptions
    .filter((serviceOption) => items[serviceOption.serviceId])
    .map((serviceOption) => ({
      ...serviceOption,
      quantity: items[serviceOption.serviceId] ?? 0,
    }));

  const total = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  function addService(serviceId: string) {
    setItems((currentItems) => ({
      ...currentItems,
      [serviceId]: (currentItems[serviceId] ?? 0) + 1,
    }));
  }

  function decreaseService(serviceId: string) {
    setItems((currentItems) => {
      const currentQuantity = currentItems[serviceId] ?? 0;

      if (currentQuantity <= 1) {
        const remainingItems = { ...currentItems };
        delete remainingItems[serviceId];
        return remainingItems;
      }

      return {
        ...currentItems,
        [serviceId]: currentQuantity - 1,
      };
    });
  }

  function removeService(serviceId: string) {
    setItems((currentItems) => {
      const remainingItems = { ...currentItems };
      delete remainingItems[serviceId];
      return remainingItems;
    });
  }

  function updateQuantity(serviceId: string, value: string) {
    const quantity = Number(value);

    if (!Number.isInteger(quantity) || quantity < 1) {
      return;
    }

    setItems((currentItems) => ({
      ...currentItems,
      [serviceId]: quantity,
    }));
  }

  const hasItems = selectedItems.length > 0;

  if (variant === "barberMobile") {
    return (
      <div className="grid gap-5 pb-24">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Servicios</p>
              <h2 className="text-xl font-black text-slate-950">Elegí lo vendido</h2>
            </div>
            <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
              {serviceOptions.length} opciones
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {serviceOptions.map((serviceOption) => {
              const quantity = items[serviceOption.serviceId] ?? 0;
              const isSelected = quantity > 0;

              return (
                <button
                  aria-pressed={isSelected}
                  className={`relative min-h-28 rounded-[1.6rem] border-2 p-3 text-left shadow-sm transition active:scale-[0.98] ${
                    isSelected
                      ? "border-blue-600 bg-blue-50 text-blue-950"
                      : "border-slate-200 bg-white text-slate-950 hover:border-blue-200"
                  }`}
                  key={serviceOption.serviceId}
                  type="button"
                  onClick={() => addService(serviceOption.serviceId)}
                >
                  <span
                    className={`absolute right-3 top-3 grid size-6 place-items-center rounded-full border text-xs font-black ${
                      isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-slate-50 text-slate-300"
                    }`}
                  >
                    {isSelected ? "✓" : "+"}
                  </span>
                  <span className="block max-w-[7rem] text-sm font-black leading-5">{serviceOption.name}</span>
                  <span className="mt-3 block text-lg font-black text-blue-700">{formatMoney(serviceOption.price)}</span>
                  {isSelected ? (
                    <span className="mt-3 inline-flex rounded-full bg-white px-2 py-1 text-xs font-black text-blue-700">
                      {quantity} en venta
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Resumen</p>
              <h2 className="text-xl font-black text-slate-950">Seleccionados</h2>
            </div>
            {hasItems ? (
              <button
                className="rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-500 shadow-sm hover:text-red-600"
                type="button"
                onClick={() => setItems({})}
              >
                Limpiar
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3">
            {hasItems ? (
              selectedItems.map((item) => (
                <div className="rounded-[1.5rem] bg-white p-3 shadow-sm" key={item.serviceId}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{item.name}</p>
                      <p className="text-sm font-bold text-slate-500">{formatMoney(item.price)} c/u</p>
                    </div>
                    <button
                      aria-label={`Quitar ${item.name}`}
                      className="grid size-8 place-items-center rounded-full bg-slate-100 text-lg font-black text-slate-400 hover:bg-red-50 hover:text-red-600"
                      type="button"
                      onClick={() => removeService(item.serviceId)}
                    >
                      ×
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 p-1">
                      <button
                        aria-label={`Restar ${item.name}`}
                        className="grid size-9 place-items-center rounded-full text-lg font-black text-slate-600 hover:bg-white"
                        type="button"
                        onClick={() => decreaseService(item.serviceId)}
                      >
                        −
                      </button>
                      <input
                        aria-label={`Cantidad de ${item.name}`}
                        className="w-11 bg-transparent text-center text-base font-black text-slate-950 outline-none"
                        min={1}
                        step={1}
                        type="number"
                        value={item.quantity}
                        onChange={(event) => updateQuantity(item.serviceId, event.target.value)}
                      />
                      <button
                        aria-label={`Sumar ${item.name}`}
                        className="grid size-9 place-items-center rounded-full text-lg font-black text-slate-600 hover:bg-white"
                        type="button"
                        onClick={() => addService(item.serviceId)}
                      >
                        +
                      </button>
                    </div>
                    <p className="text-right text-base font-black text-slate-950">{formatMoney(item.price * item.quantity)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-5 text-center text-sm font-bold text-slate-500">
                Tocá un servicio para sumarlo a la venta.
              </div>
            )}
          </div>
        </section>

        <fieldset className="rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-sm">
          <legend className="px-1 text-xs font-black uppercase tracking-[0.18em] text-blue-600">Método de pago</legend>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {paymentOptions.map((paymentOption, index) => (
              <label
                className="cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-center text-sm font-black text-slate-700 transition has-[:checked]:border-blue-600 has-[:checked]:bg-blue-600 has-[:checked]:text-white"
                key={paymentOption.value}
              >
                <input
                  className="sr-only"
                  defaultChecked={index === 0}
                  name="paymentMethod"
                  required
                  type="radio"
                  value={paymentOption.value}
                />
                {paymentOption.label}
              </label>
            ))}
          </div>
        </fieldset>

        {selectedItems.map((item) => (
          <div key={item.serviceId}>
            <input name="serviceId[]" type="hidden" value={item.serviceId} />
            <input name="quantity[]" type="hidden" value={item.quantity} />
          </div>
        ))}

        <section className="fixed inset-x-0 bottom-[4.5rem] z-20 mx-auto max-w-md px-4">
          <div className="rounded-[1.8rem] border border-blue-100 bg-white/95 p-4 shadow-[0_18px_50px_rgba(37,99,235,0.22)] backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Total</p>
                <p className="text-2xl font-black text-slate-950">{formatMoney(total)}</p>
              </div>
              <button
                className="rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white shadow-sm hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={!hasItems}
                type="submit"
              >
                {submitLabel}
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)] lg:items-start">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Servicios</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Elegí lo vendido</h2>
          </div>
          <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            {serviceOptions.length} opciones
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
          {serviceOptions.map((serviceOption) => {
            const quantity = items[serviceOption.serviceId] ?? 0;

            return (
              <button
                aria-label={`Agregar ${serviceOption.name}`}
                className={`min-h-28 rounded-3xl border p-3 text-left shadow-sm transition active:scale-[0.98] ${
                  quantity > 0
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                    : "border-slate-200 bg-slate-50 hover:border-blue-200 hover:bg-white"
                }`}
                key={serviceOption.serviceId}
                type="button"
                onClick={() => addService(serviceOption.serviceId)}
              >
                <span className="block text-sm font-black leading-5 text-slate-950">{serviceOption.name}</span>
                <span className="mt-2 block text-lg font-black text-blue-700">{formatMoney(serviceOption.price)}</span>
                <span className="mt-3 inline-flex rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-500">
                  {quantity > 0 ? `${quantity} agregado${quantity === 1 ? "" : "s"}` : "Tocar para sumar"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <aside className="grid gap-4 lg:sticky lg:top-5">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Resumen</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Venta actual</h2>
            </div>
            {hasItems ? (
              <button
                className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                type="button"
                onClick={() => setItems({})}
              >
                Limpiar
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3">
            {hasItems ? (
              selectedItems.map((item) => (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3" key={item.serviceId}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{item.name}</p>
                      <p className="text-sm font-bold text-slate-500">{formatMoney(item.price)} c/u</p>
                    </div>
                    <button
                      aria-label={`Quitar ${item.name}`}
                      className="rounded-full px-2 py-1 text-sm font-black text-slate-400 hover:bg-red-50 hover:text-red-600"
                      type="button"
                      onClick={() => removeService(item.serviceId)}
                    >
                      ×
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white p-1">
                      <button
                        aria-label={`Restar ${item.name}`}
                        className="grid size-9 place-items-center rounded-xl text-lg font-black text-slate-600 hover:bg-slate-100"
                        type="button"
                        onClick={() => decreaseService(item.serviceId)}
                      >
                        −
                      </button>
                      <input
                        aria-label={`Cantidad de ${item.name}`}
                        className="w-12 bg-transparent text-center text-base font-black text-slate-950 outline-none"
                        min={1}
                        step={1}
                        type="number"
                        value={item.quantity}
                        onChange={(event) => updateQuantity(item.serviceId, event.target.value)}
                      />
                      <button
                        aria-label={`Sumar ${item.name}`}
                        className="grid size-9 place-items-center rounded-xl text-lg font-black text-slate-600 hover:bg-slate-100"
                        type="button"
                        onClick={() => addService(item.serviceId)}
                      >
                        +
                      </button>
                    </div>
                    <p className="text-right text-base font-black text-slate-950">{formatMoney(item.price * item.quantity)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-bold text-slate-500">
                Todavía no agregaste servicios.
              </div>
            )}
          </div>
        </section>

        <fieldset className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <legend className="px-1 text-xs font-black uppercase tracking-[0.18em] text-blue-600">Método de pago</legend>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {paymentOptions.map((paymentOption, index) => (
              <label
                className="cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-center text-sm font-black text-slate-700 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-600 has-[:checked]:text-white"
                key={paymentOption.value}
              >
                <input
                  className="sr-only"
                  defaultChecked={index === 0}
                  name="paymentMethod"
                  required
                  type="radio"
                  value={paymentOption.value}
                />
                {paymentOption.label}
              </label>
            ))}
          </div>
        </fieldset>

        {selectedItems.map((item) => (
          <div key={item.serviceId}>
            <input name="serviceId[]" type="hidden" value={item.serviceId} />
            <input name="quantity[]" type="hidden" value={item.quantity} />
          </div>
        ))}

        <section className="sticky bottom-4 z-10 rounded-[2rem] border border-blue-100 bg-white/95 p-4 shadow-[0_16px_50px_rgba(37,99,235,0.18)] backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Total</p>
              <p className="text-3xl font-black text-slate-950">{formatMoney(total)}</p>
            </div>
            <button
              className="rounded-3xl bg-blue-600 px-5 py-4 text-base font-black text-white shadow-sm hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={!hasItems}
              type="submit"
            >
              {submitLabel}
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}
