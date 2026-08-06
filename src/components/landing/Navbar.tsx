import Link from "next/link";

export function Navbar() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-slate-300/70 bg-bills-paper/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
        <Link href="/" className="inline-flex items-center gap-2.5 text-[22px] font-black tracking-[-0.06em] text-slate-950">
          <span className="grid h-8 w-8 -rotate-3 place-items-center rounded-[10px] bg-slate-950 text-sm font-black text-[#d7ef62]">B</span>
          Bills
        </Link>
        <div className="hidden items-center gap-7 text-sm font-bold text-slate-500 md:flex">
          <Link href="/#producto" className="transition hover:text-slate-950">Producto</Link>
          <Link href="/#rubros" className="transition hover:text-slate-950">Rubros</Link>
          <Link href="/#precios" className="transition hover:text-slate-950">Precios</Link>
          <Link href="/#testimonios" className="transition hover:text-slate-950">Historias</Link>
        </div>
        <div className="flex items-center gap-4 text-sm font-extrabold">
          <Link href="/login" className="hidden text-slate-600 transition hover:text-[#3158e8] sm:inline">Iniciar sesión</Link>
          <Link href="/register" className="rounded-full bg-slate-950 px-4 py-2.5 text-xs text-white transition hover:bg-[#3158e8] active:scale-95 sm:px-5 sm:text-sm">Probá gratis</Link>
        </div>
      </div>
    </nav>
  );
}
