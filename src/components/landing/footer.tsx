import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-slate-950 px-5 pb-8 pt-14 text-white sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-[1fr_auto_auto]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2.5 text-[22px] font-black tracking-[-0.06em]">
            <span className="grid h-8 w-8 -rotate-3 place-items-center rounded-[10px] bg-[#d7ef62] text-sm font-black text-slate-950">B</span>
            Bills
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-6 text-slate-400">Gestión simple para negocios que quieren trabajar con más claridad.</p>
        </div>
        <div>
          <p className="mb-4 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Producto</p>
          <div className="space-y-2 text-sm font-semibold text-slate-300">
            <Link className="block transition hover:text-[#d7ef62]" href="/#producto">Funciones</Link>
            <Link className="block transition hover:text-[#d7ef62]" href="/#rubros">Rubros</Link>
            <Link className="block transition hover:text-[#d7ef62]" href="/#precios">Precios</Link>
          </div>
        </div>
        <div>
          <p className="mb-4 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Empresa</p>
          <div className="space-y-2 text-sm font-semibold text-slate-300">
            <Link className="block transition hover:text-[#d7ef62]" href="/about">Sobre Bills</Link>
            <Link className="block transition hover:text-[#d7ef62]" href="/contact">Contacto</Link>
            <Link className="block transition hover:text-[#d7ef62]" href="/privacy">Privacidad</Link>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-14 flex max-w-7xl flex-col gap-2 border-t border-slate-800 pt-5 text-xs font-semibold text-slate-500 sm:flex-row sm:justify-between">
        <span>© {new Date().getFullYear()} Bills</span>
        <span>Hecho para negocios de Argentina</span>
      </div>
    </footer>
  );
}
