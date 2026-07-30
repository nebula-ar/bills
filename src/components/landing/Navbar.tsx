"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Store } from "lucide-react";
import gsap from "gsap";
import { MagneticButton } from "./MagneticButton";

export function Navbar() {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scrolling down & past 100px
        setIsVisible(false);
      } else {
        // Scrolling up
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  useEffect(() => {
    if (navRef.current) {
      gsap.to(navRef.current, {
        y: isVisible ? 0 : -100,
        opacity: isVisible ? 1 : 0,
        duration: 0.3,
        ease: "power2.out"
      });
    }
  }, [isVisible]);

  return (
    <nav ref={navRef} className="fixed top-0 inset-x-0 z-50 bg-white/70 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        {/* Placeholder for the logo (Preloader will animate its logo to this exact spot and fade this one in) */}
        <div id="navbar-logo-placeholder" className="flex items-center gap-3 opacity-0">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md">
            <Store className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900 font-montserrat">Bills</span>
        </div>
        
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/login" className="group relative hidden sm:flex items-center justify-center h-5 overflow-hidden">
            <span className="flex items-center font-medium text-sm tracking-tight text-slate-500 transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:-translate-y-full">
              Iniciar sesión
            </span>
            <span className="absolute top-0 left-0 flex items-center justify-center w-full font-medium text-sm tracking-tight text-blue-600 transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] translate-y-full group-hover:translate-y-0">
              Iniciar sesión
            </span>
          </Link>
          <MagneticButton href="/register" className="px-4 py-2 sm:px-6 sm:py-3 text-xs sm:text-sm">
            Prueba Gratis
          </MagneticButton>
        </div>
      </div>
    </nav>
  );
}
