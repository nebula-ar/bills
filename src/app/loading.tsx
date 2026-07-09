// Skeleton global mientras las rutas server (dashboard, historial, caja) resuelven
// sus agregaciones. Next lo muestra automáticamente vía Suspense durante la
// navegación, así no queda la pantalla en blanco.
export default function Loading() {
  return (
    <main className="mx-auto min-h-screen w-full min-w-0 max-w-[560px] bg-[#f6f7fb] px-4 pb-28 pt-6 lg:max-w-[1080px] lg:px-8">
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded-full bg-slate-200" />
        <div className="h-7 w-44 animate-pulse rounded-lg bg-slate-200" />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="h-24 animate-pulse rounded-[1.25rem] bg-white shadow-sm ring-1 ring-slate-950/5" key={index} />
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <div className="h-52 animate-pulse rounded-[1.5rem] bg-white shadow-sm ring-1 ring-slate-950/5" />
        <div className="h-40 animate-pulse rounded-[1.5rem] bg-white shadow-sm ring-1 ring-slate-950/5" />
      </div>
    </main>
  );
}
