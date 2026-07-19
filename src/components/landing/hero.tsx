"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, Scissors, Calendar, CreditCard, PieChart, MapPin, Link as LinkIcon, LogOut, Sliders, Wallet, TrendingUp, Home, ShoppingBag, Receipt, MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { MagneticButton } from "./MagneticButton";

gsap.registerPlugin(ScrollTrigger);

export function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  
  // Layers
  const heroTextLayerRef = useRef<HTMLDivElement>(null);
  const mockupLayerRef = useRef<HTMLDivElement>(null);
  const mockupWrapperRef = useRef<HTMLDivElement>(null);
  const scalerRef = useRef<HTMLDivElement>(null);
  
  // Text Features
  const featText1Ref = useRef<HTMLDivElement>(null);
  const featText2Ref = useRef<HTMLDivElement>(null);
  const featText3Ref = useRef<HTMLDivElement>(null);

  // Phone Screens
  const screen1Ref = useRef<HTMLDivElement>(null);
  const screen2Ref = useRef<HTMLDivElement>(null);
  const screen3Ref = useRef<HTMLDivElement>(null);
  
  // Elements
  const underlineRef = useRef<SVGPathElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 0. Responsive Fixed-Size Phone Scaler
    const setScale = () => {
      if (!scalerRef.current) return;
      // We want the phone (360x780) to fit within 100vw width and a safe % of vh
      // For mobile, we must ensure it fits within the viewport height without clipping the bottom
      const isMobile = window.innerWidth < 768;
      const safeHeight = isMobile ? window.innerHeight * 0.60 : window.innerHeight * 0.70;
      
      const scaleX = window.innerWidth / 400; // Extra padding for width
      const scaleY = safeHeight / 780; 
      
      const scale = Math.min(1, scaleX, scaleY); // Never scale up beyond 1x
      gsap.set(scalerRef.current, { scale });
    };
    setScale();
    window.addEventListener("resize", setScale);

    // 1. Entrance Animation
    // Arranca recién cuando el Preloader termina de tapar la pantalla (evento
    // "preloader:bg-hidden"), en vez de un delay fijo adivinado: con un número
    // fijo, ambas animaciones terminaban solapándose (cruce de opacidad que
    // hacía fallar el contraste de forma intermitente en el audit de a11y).
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const entranceTl = gsap.timeline({ paused: true, defaults: { ease: "expo.out", duration: 1.2 } });
    if (prefersReducedMotion) {
      entranceTl.timeScale(20);
    }

    entranceTl.fromTo(
      titleRef.current,
      { opacity: 0, y: 50, clipPath: "polygon(0 0, 100% 0, 100% 0, 0 0)" },
      { opacity: 1, y: 0, clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)" }
    )
    .fromTo(
      textRef.current,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0 },
      "-=0.9"
    )
    .fromTo(
      ctaRef.current,
      { opacity: 0, scale: 0.95 },
      { opacity: 1, scale: 1 },
      "-=1"
    );

    let fallbackTimer: number | undefined;
    const startEntrance = () => {
      entranceTl.play();
      if (fallbackTimer !== undefined) {
        window.clearTimeout(fallbackTimer);
      }
    };

    if (prefersReducedMotion) {
      // El Preloader también corre a timeScale(20) en este caso: no hace falta esperar.
      startEntrance();
    } else {
      window.addEventListener("preloader:bg-hidden", startEntrance, { once: true });
      // Red de seguridad por si el Preloader no llega a emitir el evento (p.ej. se
      // desmonta antes de tiempo): el hero no debe quedar invisible para siempre.
      fallbackTimer = window.setTimeout(startEntrance, 4000);
    }

    // Initial setups
    let pathLength = 0;
    if (underlineRef.current) {
      pathLength = underlineRef.current.getTotalLength();
      gsap.set(underlineRef.current, { strokeDasharray: pathLength, strokeDashoffset: pathLength });
    }

    // Sin filter/blur: es una propiedad no compositable (repinta en cada frame de
    // scroll en vez de solo componer capas GPU) y era la causa principal del
    // scroll trabado/lag en el hero. opacity+scale dan un efecto de aparición
    // similar a un costo de frame mucho menor.
    gsap.set(mockupLayerRef.current, { opacity: 0, y: 150, scale: 0.85 });
    
    // Hide feature texts and screens initially
    gsap.set([featText1Ref.current, featText2Ref.current, featText3Ref.current], { opacity: 0, y: 50 });
    gsap.set([screen1Ref.current, screen2Ref.current, screen3Ref.current], { opacity: 0 });

    // GSAP MatchMedia for responsive scroll sequence
    let mm = gsap.matchMedia();

    mm.add("(min-width: 768px)", () => {
      // DESKTOP SEQUENCE
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: pinRef.current,
          start: "top top",
          end: "+=4000",
          scrub: 0.5,
          pin: true,
          pinSpacing: true,
        }
      });

      if (underlineRef.current) {
        scrollTl.to(underlineRef.current, { strokeDashoffset: 0, duration: 1, ease: "power2.out" });
      }
      scrollTl.to({}, { duration: 0.5 });

      scrollTl.to(heroTextLayerRef.current, { opacity: 0, y: -100, duration: 1 }, "p2")
              .to(mockupLayerRef.current, { opacity: 1, y: 0, scale: 1, duration: 1 }, "p2")
              .to(mockupWrapperRef.current, { x: () => Math.min(window.innerWidth * 0.25, 288), duration: 1, ease: "power2.inOut" }, "p2+=0.5")
              
      scrollTl.to(featText1Ref.current, { opacity: 1, y: 0, duration: 0.5 }, "p3")
              .to(screen1Ref.current, { opacity: 1, duration: 0.5 }, "p3")
              .to(featText1Ref.current!.querySelector('h3'), { backgroundPosition: "0% 0", duration: 1.5, ease: "none" }, "p3+=0.5");

      scrollTl.to(featText1Ref.current, { opacity: 0, y: -50, duration: 0.5 }, "p4")
              .to(screen1Ref.current, { opacity: 0, duration: 0.5 }, "p4")
              .to(featText2Ref.current, { opacity: 1, y: 0, duration: 0.5 }, "p4+=0.3")
              .to(screen2Ref.current, { opacity: 1, duration: 0.5 }, "p4+=0.3")
              .to(featText2Ref.current!.querySelector('h3'), { backgroundPosition: "0% 0", duration: 1.5, ease: "none" }, "p4+=0.8");

      scrollTl.to(featText2Ref.current, { opacity: 0, y: -50, duration: 0.5 }, "p5")
              .to(screen2Ref.current, { opacity: 0, duration: 0.5 }, "p5")
              .to(featText3Ref.current, { opacity: 1, y: 0, duration: 0.5 }, "p5+=0.3")
              .to(screen3Ref.current, { opacity: 1, duration: 0.5 }, "p5+=0.3")
              .to(featText3Ref.current!.querySelector('h3'), { backgroundPosition: "0% 0", duration: 2, ease: "none" }, "p5+=0.8");
    });

    mm.add("(max-width: 767px)", () => {
      // MOBILE SEQUENCE
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: pinRef.current,
          start: "top top",
          end: "+=3000",
          scrub: 0.5,
          pin: true,
          pinSpacing: true,
        }
      });

      if (underlineRef.current) {
        scrollTl.to(underlineRef.current, { strokeDashoffset: 0, duration: 1, ease: "power2.out" });
      }
      scrollTl.to({}, { duration: 0.5 });

      scrollTl.to(heroTextLayerRef.current, { opacity: 0, y: -100, duration: 1 }, "p2")
              .to(mockupLayerRef.current, { opacity: 1, y: 0, scale: 0.85, duration: 1 }, "p2")
              // Changed y from 150 to 50 to prevent bottom clipping
              .to(mockupWrapperRef.current, { y: 50, duration: 1, ease: "power2.inOut" }, "p2+=0.5")

      scrollTl.to(featText1Ref.current, { opacity: 1, y: 0, duration: 0.5 }, "p3")
              .to(screen1Ref.current, { opacity: 1, duration: 0.5 }, "p3")
              .to(featText1Ref.current!.querySelector('h3'), { backgroundPosition: "0% 0", duration: 1.5, ease: "none" }, "p3+=0.5");

      scrollTl.to(featText1Ref.current, { opacity: 0, y: -20, duration: 0.5 }, "p4")
              .to(screen1Ref.current, { opacity: 0, duration: 0.5 }, "p4")
              .to(featText2Ref.current, { opacity: 1, y: 0, duration: 0.5 }, "p4+=0.3")
              .to(screen2Ref.current, { opacity: 1, duration: 0.5 }, "p4+=0.3")
              .to(featText2Ref.current!.querySelector('h3'), { backgroundPosition: "0% 0", duration: 1.5, ease: "none" }, "p4+=0.8");

      scrollTl.to(featText2Ref.current, { opacity: 0, y: -20, duration: 0.5 }, "p5")
              .to(screen2Ref.current, { opacity: 0, duration: 0.5 }, "p5")
              .to(featText3Ref.current, { opacity: 1, y: 0, duration: 0.5 }, "p5+=0.3")
              .to(screen3Ref.current, { opacity: 1, duration: 0.5 }, "p5+=0.3")
              .to(featText3Ref.current!.querySelector('h3'), { backgroundPosition: "0% 0", duration: 2, ease: "none" }, "p5+=0.8");
    });

    return () => {
      window.removeEventListener("resize", setScale);
      window.removeEventListener("preloader:bg-hidden", startEntrance);
      if (fallbackTimer !== undefined) {
        window.clearTimeout(fallbackTimer);
      }
      mm.revert();
      ScrollTrigger.getAll().forEach(t => t.kill());
      entranceTl.kill();
    };
  }, []);

  return (
    <div id="hero" ref={containerRef} className="bg-transparent">
      <div ref={pinRef} className="relative h-[100svh] w-full overflow-hidden flex items-center justify-center pt-16 md:pt-20">
        
        <div className="absolute inset-0 z-20 flex items-start md:items-center justify-center pointer-events-none">
          <div className="w-full max-w-6xl mx-auto px-6 md:px-12 flex justify-start">
            <div className="w-full md:w-1/2 relative h-40 md:h-auto flex items-center text-center md:text-left">
               <div ref={featText1Ref} className="absolute inset-x-0">
               <h3 className="text-2xl md:text-4xl lg:text-5xl font-bold font-montserrat mb-4 leading-tight text-transparent bg-clip-text bg-no-repeat" style={{ backgroundImage: 'linear-gradient(to right, #2563eb 50%, #0f172a 50%)', backgroundSize: '200% 100%', backgroundPosition: '100% 0' }}>Métricas al Instante</h3>
               <p className="text-base md:text-lg text-slate-600">Tu negocio en tiempo real. Ticket promedio, comisiones y ganancias netas calculadas automáticamente sin Excel.</p>
            </div>
            <div ref={featText2Ref} className="absolute inset-x-0">
               <h3 className="text-2xl md:text-4xl lg:text-5xl font-bold font-montserrat mb-4 leading-tight text-transparent bg-clip-text bg-no-repeat" style={{ backgroundImage: 'linear-gradient(to right, #2563eb 50%, #0f172a 50%)', backgroundSize: '200% 100%', backgroundPosition: '100% 0' }}>Cobro en la Silla</h3>
               <p className="text-base md:text-lg text-slate-600">Cierra ventas desde tu celular. Acepta cualquier medio de pago sin moverte del lugar de trabajo.</p>
            </div>
            <div ref={featText3Ref} className="absolute inset-x-0">
               <h3 className="text-2xl md:text-4xl lg:text-5xl font-bold font-montserrat mb-4 leading-tight text-transparent bg-clip-text bg-no-repeat" style={{ backgroundImage: 'linear-gradient(to right, #2563eb 50%, #0f172a 50%)', backgroundSize: '200% 100%', backgroundPosition: '100% 0' }}>Control Total</h3>
               <p className="text-base md:text-lg text-slate-600">Mantén un registro claro de cada transacción. Qué se cobró, cuándo y quién lo hizo, todo a tu alcance en cualquier momento.</p>
            </div>
            </div>
          </div>
        </div>

        <div ref={heroTextLayerRef} className="absolute inset-0 flex flex-col items-center justify-center px-6 z-30 pointer-events-none">
          <div className="text-center max-w-3xl mx-auto pointer-events-auto">
            <h1
              ref={titleRef}
              className="text-4xl sm:text-5xl lg:text-[4rem] font-semibold tracking-tight mb-6 leading-[1.2] lg:leading-[1.1] text-slate-800 font-montserrat"
            >
              Administra tu barbería, <br className="hidden sm:block" />
              <span className="relative inline-block text-slate-900 font-bold whitespace-nowrap px-2 mt-2 sm:mt-0">
                no un Excel.
                <svg 
                  className="absolute -bottom-0 sm:-bottom-1 left-0 w-full h-4 sm:h-5 pointer-events-none" 
                  viewBox="0 0 200 20" 
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="barber-gradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#2563EB" />
                      <stop offset="40%" stopColor="#60A5FA" />
                      <stop offset="50%" stopColor="#F8FAFC" />
                      <stop offset="60%" stopColor="#F87171" />
                      <stop offset="100%" stopColor="#DC2626" />
                    </linearGradient>
                  </defs>
                  <path 
                    ref={underlineRef}
                    d="M 4,14 Q 100,18 196,14" 
                    fill="none" 
                    stroke="url(#barber-gradient)" 
                    strokeWidth="3.5" 
                    strokeLinecap="round" 
                  />
                </svg>
              </span>
            </h1>

            <p
              ref={textRef}
              className="text-base sm:text-lg lg:text-xl text-slate-600 mb-10 leading-relaxed max-w-xl mx-auto font-normal px-4"
            >
              El sistema todo en uno creado para llenar sillas y automatizar tus comisiones. Deja de administrar, empieza a cortar.
            </p>

            <div
              ref={ctaRef}
              className="flex flex-col sm:flex-row gap-4 justify-center px-4"
            >
              <MagneticButton
                href="/register"
                className="px-8 py-4 w-full sm:w-auto"
                roundedClass="rounded-xl"
              >
                Prueba Gratis
              </MagneticButton>
              <Link
                href="#features"
                className="inline-flex items-center justify-center px-6 sm:px-8 py-3.5 sm:py-4 bg-white text-slate-600 rounded-xl font-bold hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 transition-colors text-base sm:text-lg shadow-sm w-full sm:w-auto"
              >
                Explorar Funciones
              </Link>
            </div>
          </div>
        </div>

        <div ref={mockupLayerRef} className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none pt-20">
          <div ref={mockupWrapperRef} className="relative flex items-center justify-center">
            
            {/* The Scaler: Maintains 100% authentic proportions regardless of device size */}
            <div ref={scalerRef} className="flex items-center justify-center origin-center">
              
              {/* The Fixed-Size Authentic Phone (iPhone Pro Max proportions) */}
              <div className="w-[360px] h-[780px] relative bg-slate-900 rounded-[3rem] border-[12px] border-slate-900 shadow-[0_30px_80px_-15px_rgba(0,0,0,0.5)] flex flex-col items-center overflow-hidden pointer-events-auto ring-1 ring-white/20">
                
                {/* Dynamic Island / Notch */}
                <div className="absolute top-0 inset-x-0 flex justify-center z-50">
                  <div className="w-32 h-7 bg-slate-900 rounded-b-3xl"></div>
                </div>
                
                <div className="flex-1 w-full bg-slate-50 relative overflow-hidden">
                  
                  {/* Screen 1: Stats / Resumen (Inicio) */}
                  <div ref={screen1Ref} className="absolute inset-0 bg-slate-50 pb-20 flex flex-col overflow-y-auto hidden-scrollbar">
                    <div className="p-6 pt-12">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <div className="text-sm text-slate-500 font-medium flex items-center gap-1">Hola, Matías Toledo <span className="text-base">👋</span></div>
                          <div className="text-3xl font-black text-slate-900 tracking-tight">Resumen</div>
                        </div>
                        <div className="flex gap-2">
                          <div className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center bg-white shadow-sm text-slate-600"><Receipt className="w-5 h-5" /></div>
                          <div className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center bg-white shadow-sm text-slate-600"><LogOut className="w-5 h-5" /></div>
                        </div>
                      </div>

                      <div className="flex gap-2 mb-6">
                        <div className="px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-bold shadow-[0_4px_12px_rgba(37,99,235,0.3)]">Hoy</div>
                        <div className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-full text-sm font-bold shadow-sm">7d</div>
                        <div className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-full text-sm font-bold shadow-sm">14d</div>
                        <div className="w-9 h-9 rounded-full border border-slate-200 ml-auto flex items-center justify-center bg-white shadow-sm text-slate-600"><Sliders className="w-4 h-4" /></div>
                      </div>

                      <div className="bg-blue-600 rounded-[2rem] p-6 text-white mb-4 shadow-[0_12px_24px_-8px_rgba(37,99,235,0.5)] bg-gradient-to-br from-blue-500 to-blue-700">
                         <div className="text-blue-100 font-medium mb-1">Ventas de hoy</div>
                         <div className="text-[3.5rem] leading-none font-black mb-5">$ 0</div>
                         <div className="flex items-center gap-2 mb-3">
                           <div className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-xl text-sm font-bold flex items-center gap-1.5 border border-white/10">
                             <Receipt className="w-4 h-4" /> 0 ventas
                           </div>
                         </div>
                         <div className="text-blue-200 text-xs">martes, 14 de julio</div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4">
                         <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-3">
                           <div className="text-[11px] font-black text-slate-500 uppercase flex items-center gap-1.5 tracking-wider"><Wallet className="text-red-500 w-4 h-4"/> GASTOS</div>
                           <div className="text-2xl font-black text-red-600">$ 0</div>
                         </div>
                         <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-3">
                           <div className="text-[11px] font-black text-slate-500 uppercase flex items-center gap-1.5 tracking-wider"><TrendingUp className="text-emerald-500 w-4 h-4"/> NETO</div>
                           <div className="text-2xl font-black text-emerald-600">$ 0</div>
                         </div>
                         <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-3">
                           <div className="text-[11px] font-black text-slate-500 flex items-center gap-1.5 tracking-wider uppercase"><PieChart className="text-blue-500 w-4 h-4"/> Ticket promedio</div>
                           <div className="text-xl font-black text-slate-900">$ 0</div>
                         </div>
                         <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-3">
                           <div className="text-[11px] font-black text-slate-500 flex items-center gap-1.5 tracking-wider uppercase"><Scissors className="text-blue-500 w-4 h-4"/> Servicios</div>
                           <div className="text-xl font-black text-slate-900">0</div>
                         </div>
                      </div>
                    </div>
                    {/* Bottom Navbar - Screen 1 (Inicio Active) */}
                    <div className="absolute bottom-0 inset-x-0 h-20 bg-white border-t border-slate-100 flex justify-between items-center px-6 z-20 pb-4 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] rounded-b-[2rem]">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-10 h-10 rounded-[14px] bg-blue-50 flex items-center justify-center text-blue-600"><Home className="w-5 h-5" /></div>
                        <span className="text-[10px] font-bold text-blue-600">Inicio</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 text-slate-400 mt-2">
                        <ShoppingBag className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold">Vender</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 text-slate-400 mt-2">
                        <Receipt className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold">Historial</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 text-slate-400 mt-2">
                        <Wallet className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold">Gastos</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 text-slate-400 mt-2">
                        <MoreHorizontal className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold">Más</span>
                      </div>
                    </div>
                  </div>

                  {/* Screen 2: POS */}
                  <div ref={screen2Ref} className="absolute inset-0 bg-slate-50 pb-20 flex flex-col overflow-y-auto hidden-scrollbar">
                    <div className="p-6 pt-14">
                      <div className="text-sm text-slate-500 font-medium">Barbería El Rulo</div>
                      <div className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Puntos de venta</div>
                      <p className="text-[13px] leading-snug text-slate-500 mb-6 pr-4">Tocá una caja para vender, o copiá su link para que los barberos carguen ventas con su PIN.</p>
                      
                      <div className="flex flex-col gap-4">
                        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-4">
                           <div className="flex items-center gap-4">
                             <div className="w-14 h-14 rounded-[1.25rem] bg-blue-600 flex items-center justify-center text-white shrink-0">
                               <Home className="w-6 h-6" />
                             </div>
                             <div className="flex-1 min-w-0">
                               <div className="font-black text-lg text-slate-900 tracking-tight">Sucursal Centro</div>
                               <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3"/> Av. Corrientes 1234, CABA</div>
                               <div className="flex gap-1.5 mt-2.5">
                                 <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full flex items-center gap-1"><Scissors className="w-3 h-3"/> 2 barberos</span>
                                 <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full flex items-center gap-1"><ShoppingBag className="w-3 h-3"/> 6 servicios</span>
                               </div>
                             </div>
                             <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                               <ArrowRight className="w-5 h-5" />
                             </div>
                           </div>
                           <div className="bg-slate-50/80 w-full py-3.5 rounded-2xl text-center font-bold text-slate-700 text-[13px] flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors">
                             <LinkIcon className="w-4 h-4 text-slate-500" /> Links de terminales
                           </div>
                        </div>

                        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-4 opacity-50">
                           <div className="flex items-center gap-4">
                             <div className="w-14 h-14 rounded-[1.25rem] bg-blue-600 flex items-center justify-center text-white shrink-0">
                               <Home className="w-6 h-6" />
                             </div>
                             <div className="flex-1 min-w-0">
                               <div className="font-black text-lg text-slate-900 tracking-tight">Sucursal Norte</div>
                               <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3"/> Av. Maipú 890, Vicente Lópe</div>
                               <div className="flex gap-1.5 mt-2.5">
                                 <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full flex items-center gap-1"><Scissors className="w-3 h-3"/> 2 barberos</span>
                                 <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full flex items-center gap-1"><ShoppingBag className="w-3 h-3"/> 6 servicios</span>
                               </div>
                             </div>
                             <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                               <ArrowRight className="w-5 h-5" />
                             </div>
                           </div>
                        </div>
                      </div>
                    </div>
                    {/* Bottom Navbar - Screen 2 (Vender Active) */}
                    <div className="absolute bottom-0 inset-x-0 h-20 bg-white border-t border-slate-100 flex justify-between items-center px-6 z-20 pb-4 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] rounded-b-[2rem]">
                      <div className="flex flex-col items-center gap-1 text-slate-400 mt-2">
                        <Home className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold">Inicio</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-10 h-10 rounded-[14px] bg-blue-50 flex items-center justify-center text-blue-600"><ShoppingBag className="w-5 h-5" /></div>
                        <span className="text-[10px] font-bold text-blue-600">Vender</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 text-slate-400 mt-2">
                        <Receipt className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold">Historial</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 text-slate-400 mt-2">
                        <Wallet className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold">Gastos</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 text-slate-400 mt-2">
                        <MoreHorizontal className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold">Más</span>
                      </div>
                    </div>
                  </div>

                  {/* Screen 3: Historial Ventas */}
                  <div ref={screen3Ref} className="absolute inset-0 bg-slate-50 pb-20 flex flex-col overflow-y-auto hidden-scrollbar">
                    <div className="p-6 pt-14">
                      <div className="text-sm text-slate-500 font-medium">Historial</div>
                      <div className="text-3xl font-black text-slate-900 mb-6">Ventas</div>
                      
                      <div className="flex flex-col gap-3">
                        <div className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center shadow-sm">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mr-4">
                             <Receipt className="w-5 h-5 text-slate-500" />
                          </div>
                          <div className="flex-1">
                             <div className="font-bold text-slate-900">Lucas Gómez</div>
                             <div className="text-xs text-slate-500">QR • Corte y barba x1</div>
                          </div>
                          <div className="text-right">
                             <div className="font-bold text-slate-900">$ 14.500</div>
                             <div className="text-xs text-slate-400">10:34 p. m. hs</div>
                          </div>
                        </div>
                        <div className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center shadow-sm">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mr-4">
                             <Receipt className="w-5 h-5 text-slate-500" />
                          </div>
                          <div className="flex-1">
                             <div className="font-bold text-slate-900">Lucas Gómez</div>
                             <div className="text-xs text-slate-500 truncate w-32">Mercado Pago • Corte...</div>
                          </div>
                          <div className="text-right">
                             <div className="font-bold text-slate-900">$ 9.000</div>
                             <div className="text-xs text-slate-400">10:33 p. m. hs</div>
                          </div>
                        </div>
                        <div className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center shadow-sm opacity-50">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mr-4">
                             <Receipt className="w-5 h-5 text-slate-500" />
                          </div>
                          <div className="flex-1">
                             <div className="font-bold text-slate-900">Lucas Gómez</div>
                             <div className="text-xs text-slate-500 truncate w-32">Débito • Lavado x1,...</div>
                          </div>
                          <div className="text-right">
                             <div className="font-bold text-slate-900">$ 29.000</div>
                             <div className="text-xs text-slate-400">09:45 p. m. hs</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="absolute bottom-24 right-6 w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-[0_10px_20px_-5px_rgba(37,99,235,0.5)]">
                      <Plus className="w-7 h-7" />
                    </div>
                    {/* Bottom Navbar - Screen 3 (Historial Active) */}
                    <div className="absolute bottom-0 inset-x-0 h-20 bg-white border-t border-slate-100 flex justify-between items-center px-6 z-20 pb-4 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] rounded-b-[2rem]">
                      <div className="flex flex-col items-center gap-1 text-slate-400 mt-2">
                        <Home className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold">Inicio</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 text-slate-400 mt-2">
                        <ShoppingBag className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold">Vender</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-10 h-10 rounded-[14px] bg-blue-50 flex items-center justify-center text-blue-600"><Receipt className="w-5 h-5" /></div>
                        <span className="text-[10px] font-bold text-blue-600">Historial</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 text-slate-400 mt-2">
                        <Wallet className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold">Gastos</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 text-slate-400 mt-2">
                        <MoreHorizontal className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold">Más</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
