"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import Link from "next/link";

import { BrandLogo } from "@/lib/brand-logo";

const mobileLinks = [
  { label: "Producto", href: "/#producto" },
  { label: "Rubros", href: "/#rubros" },
  { label: "Precios", href: "/#precios" },
  { label: "Historias", href: "/#testimonios" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
        menuButtonRef.current?.focus();
      }
    };
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(target)
      ) {
        closeMenu();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [menuOpen]);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 border-b border-slate-300/70 pt-[env(safe-area-inset-top)] backdrop-blur-xl transition-[background-color,box-shadow] duration-200 ${
        scrolled
          ? "bg-bills-paper shadow-lg shadow-slate-950/5"
          : "bg-bills-paper/90"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
        <Link href="/" className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bills-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bills-paper">
          <BrandLogo variant="blue" height={32} className="-rotate-3" />
        </Link>
        <div className="hidden items-center gap-7 text-sm font-bold text-slate-600 md:flex">
          <Link href="/#producto" className="rounded-lg transition hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bills-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bills-paper">Producto</Link>
          <Link href="/#rubros" className="rounded-lg transition hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bills-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bills-paper">Rubros</Link>
          <Link href="/#precios" className="rounded-lg transition hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bills-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bills-paper">Precios</Link>
          <Link href="/#testimonios" className="rounded-lg transition hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bills-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bills-paper">Historias</Link>
        </div>
        <div className="flex items-center gap-4 text-sm font-extrabold">
          <Link href="/login" className="hidden rounded-lg text-slate-600 transition hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bills-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bills-paper sm:inline">Iniciar sesión</Link>
          <Link href="/register" className="inline-flex min-h-11 items-center rounded-full bg-slate-950 px-4 py-2.5 text-xs text-white transition hover:bg-[var(--primary)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bills-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bills-paper sm:px-5 sm:text-sm">Probá gratis</Link>
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            className="-mr-1 inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-900/5 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] active:scale-95 md:hidden"
          >
            {menuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>
        </div>
      </div>
      {menuOpen ? (
        <div
          ref={menuRef}
          id="mobile-menu"
          className="absolute inset-x-0 top-full border-b border-slate-300/70 bg-bills-paper shadow-lg shadow-slate-950/5 motion-safe:animate-[mobile-menu-in_0.18s_ease-out] md:hidden"
        >
          <div className="mx-auto max-w-7xl px-5 py-2 sm:px-8">
            <div className="flex flex-col">
              {mobileLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMenu}
                  className="rounded-lg py-3.5 text-sm font-bold text-slate-600 transition hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bills-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bills-paper"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/login"
                onClick={closeMenu}
                className="rounded-lg py-3.5 text-sm font-bold text-slate-600 transition hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bills-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bills-paper"
              >
                Iniciar sesión
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
