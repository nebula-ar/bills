"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Box,
  CalendarDays,
  CircleDollarSign,
  PackageOpen,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import {
  landingHero,
  rubroExamples,
  type RubroExample,
} from "./landing-content";
import { BrandLogo } from "@/lib/brand-logo";

const exampleIcons = {
  barberia: CalendarDays,
  kiosco: PackageOpen,
  tienda: Box,
  servicios: UsersRound,
} as const;

function ExampleIcon({ example }: { example: RubroExample }) {
  const Icon = exampleIcons[example.id];
  return <Icon className="h-4 w-4" aria-hidden="true" />;
}

function DashboardPreview({ example }: { example: RubroExample }) {
  return (
    <div className="relative w-full max-w-[590px]">
      <div className="absolute -right-4 top-2 hidden rotate-3 text-xs font-bold text-slate-500 sm:block">
        Vista de ejemplo · se adapta a tu rubro
      </div>
      <div className="absolute -bottom-4 -left-3 z-10 rotate-[-6deg] rounded-2xl border border-slate-950 bg-[#d7ef62] px-4 py-3 text-xs font-black text-slate-950 shadow-[7px_8px_0_#111315] sm:-left-8">
        <span className="block">{example.note[0]}</span>
        <span className="mt-1 block text-[10px] font-bold text-slate-700">{example.note[1]}</span>
      </div>

      <div className="rotate-[1.5deg] rounded-[28px] border border-slate-950/10 bg-[#fffef9] p-3 shadow-[0_30px_80px_-20px_rgba(17,19,21,0.32)] sm:p-4">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-2 pb-3">
          <div className="flex items-center gap-2 text-xs font-black tracking-tight text-slate-950">
            <BrandLogo iconOnly height={24} variant="blue" />
            <span data-testid="dashboard-business-name">Bills / {example.businessName}</span>
          </div>
          <div className="flex gap-1" aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-slate-300" />
            <span className="h-2 w-2 rounded-full bg-slate-300" />
            <span className="h-2 w-2 rounded-full bg-slate-300" />
          </div>
        </div>

        <div className="grid min-h-[395px] grid-cols-[88px_1fr] sm:grid-cols-[132px_1fr]">
          <aside className="border-r border-slate-200/80 px-1 py-5 sm:px-2">
            <div className="mb-6 flex items-center gap-2 px-1 text-xs font-black text-slate-950">
              <BrandLogo iconOnly height={24} variant="blue" />
              <span className="hidden sm:inline">Bills</span>
            </div>
            <div className="space-y-1 text-[10px] font-bold sm:text-[11px]">
              <div className="rounded-lg bg-[#eef1ff] px-2 py-2 text-[#3158e8]">Resumen</div>
              <div className="px-2 py-2 text-slate-400">Cobros</div>
              <div className="px-2 py-2 text-slate-400">{example.catalogLabel}</div>
              <div className="px-2 py-2 text-slate-400">Clientes</div>
              <div className="px-2 py-2 text-slate-400">Caja</div>
              <div className="px-2 py-2 text-slate-400">Reportes</div>
            </div>
          </aside>

          <div className="min-w-0 px-3 py-5 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="mb-1 text-[10px] font-bold text-slate-500">{example.businessName}</p>
                <h2 className="text-2xl font-black tracking-[-0.07em] text-slate-950 sm:text-3xl">Resumen</h2>
              </div>
              <span className="shrink-0 rounded-lg border border-slate-200 px-2 py-2 text-[9px] font-bold text-slate-500">Últimos 7 días⌄</span>
            </div>

            <div className="mt-5 flex items-end justify-between rounded-2xl bg-slate-950 p-4 text-white">
              <div>
                <p className="mb-1 text-[10px] font-bold text-slate-500">Ventas del período</p>
                <p className="text-2xl font-black tracking-[-0.07em] sm:text-3xl">{example.metricValue}</p>
                <p className="mt-1 text-[9px] font-extrabold text-[#d7ef62]">{example.metricChange}</p>
              </div>
              <div className="flex h-10 items-end gap-1" aria-hidden="true">
                {[18, 28, 22, 35, 25, 39].map((height, index) => (
                  <span key={index} className="w-1.5 rounded-full bg-[#d7ef62]" style={{ height }} />
                ))}
              </div>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2">
              {example.secondaryMetrics.map((metric, index) => (
                <div key={metric.label} className="rounded-xl border border-slate-200/90 p-2.5 sm:p-3">
                  <span className="mb-1.5 block truncate text-[8px] font-bold text-slate-500 sm:text-[9px]">{metric.label}</span>
                  <strong className={`block truncate text-xs font-black tracking-[-0.05em] sm:text-sm ${index === 2 ? "text-emerald-600" : "text-slate-950"}`}>
                    {metric.value}
                  </strong>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-slate-200/80 pt-3">
              <div className="mb-1 flex items-center justify-between">
                <strong className="text-xs text-slate-950">Actividad reciente</strong>
                <span className="text-[10px] font-extrabold text-[#3158e8]">Ver todo</span>
              </div>
              {example.activity.map((item) => (
                <div key={item.title} className="flex items-center justify-between gap-2 border-b border-slate-100 py-2 last:border-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[#eef1ff] text-[10px] font-black text-[#3158e8]">{item.initials}</span>
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-extrabold text-slate-950">{item.title}</p>
                      <p className="truncate text-[9px] text-slate-500">{item.detail}</p>
                    </div>
                  </div>
                  <strong className="shrink-0 text-[10px] font-black text-slate-950">{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroSection() {
  const [selectedId, setSelectedId] = useState<RubroExample["id"] | null>(null);
  const selected = rubroExamples.find((example) => example.id === selectedId) ?? rubroExamples[0];
  const [titleStart, titleAccent] = landingHero.title.split(", ");
  const descriptionId = "hero-rubro-description";
  const heroDescription = selectedId ? selected.description : landingHero.description;
  const previewRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!selectedId || !previewRef.current) return;
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduceMotion) return;

      gsap.fromTo(
        previewRef.current,
        { autoAlpha: 0.72, y: 8, scale: 0.99 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.36,
          ease: "power3.out",
          clearProps: "all",
        },
      );
    },
    { dependencies: [selectedId], scope: previewRef, revertOnUpdate: true },
  );

  return (
    <section id="hero" className="relative overflow-hidden bg-bills-paper text-slate-950">
      <div className="mx-auto grid min-h-[760px] max-w-7xl items-center gap-12 px-5 pb-20 pt-32 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:px-12 lg:pb-28 lg:pt-44">
        <div data-motion="hero-copy">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 sm:text-xs">
            <span className="h-2 w-2 rounded-full bg-[#3158e8] shadow-[0_0_0_4px_rgba(49,88,232,0.14)]" />
            {landingHero.eyebrow}
          </div>
          <h1 className="mt-6 max-w-2xl text-[clamp(3.25rem,7vw,5.9rem)] font-black leading-[0.94] tracking-[-0.08em] text-slate-950">
            {titleStart}, <span className="text-[#3158e8]">{titleAccent}</span>
          </h1>
          <p id={descriptionId} data-testid="hero-rubro-description" aria-live="polite" className="mt-7 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
            {heroDescription}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#3158e8] active:scale-95">
              Empezar gratis <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link href="/#producto" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-black text-slate-700 transition hover:-translate-y-0.5 hover:bg-white active:scale-95">
              Ver cómo funciona
            </Link>
          </div>
          <p className="mt-4 text-xs font-semibold text-slate-400">{landingHero.finePrint}</p>

          <div id="ejemplos" className="mt-10">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Elegí un ejemplo</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Ejemplos por rubro">
              {rubroExamples.map((example) => {
                const active = example.id === selectedId;
                return (
                  <button
                    key={example.id}
                    type="button"
                    aria-pressed={active}
                    aria-controls={descriptionId}
                    onClick={() => setSelectedId(example.id)}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-xs font-extrabold transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3158e8] focus-visible:ring-offset-2 ${active ? "border-[#3158e8] bg-[#3158e8] text-white" : "border-slate-300 text-slate-600 hover:border-[#3158e8] hover:text-[#3158e8]"}`}
                  >
                    <ExampleIcon example={example} />
                    {example.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div data-motion="hero-visual" className="relative z-20 flex items-center justify-center lg:pt-4">
          <div className="absolute h-[min(70vw,34rem)] w-[min(70vw,34rem)] rounded-full bg-[#dfe7ff]" aria-hidden="true" />
          <div ref={previewRef} className="relative w-full max-w-[590px] will-change-transform">
            <DashboardPreview example={selected} />
          </div>
          <div
            data-motion="hero-floater"
            aria-hidden="true"
            className="absolute right-0 top-[26%] hidden rotate-2 rounded-2xl bg-bills-blue px-4 py-3 text-white shadow-lg shadow-blue-600/25 sm:block lg:-right-7"
          >
            <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-blue-100">Ventas en vivo</span>
            <strong className="mt-1 block text-lg font-black tracking-[-0.05em]">+ $ 24.800</strong>
          </div>
          <div
            data-motion="hero-floater"
            aria-hidden="true"
            className="absolute bottom-[27%] left-0 hidden -rotate-3 rounded-2xl border border-bills-ink bg-bills-lime px-4 py-3 text-bills-ink shadow-[6px_7px_0_var(--color-bills-ink)] sm:block lg:-left-8"
          >
            <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">Stock al día</span>
            <strong className="mt-1 block text-sm font-black">Sin sorpresas</strong>
          </div>
        </div>
      </div>

      <div className="border-y border-slate-800 bg-slate-950 px-5 py-4 text-white sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-xs text-slate-400">Un sistema para el negocio que ya tenés — <strong className="text-[#d7ef62]">y el que querés construir.</strong></p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-bold text-slate-300">
            <span><CircleDollarSign className="mr-1 inline h-3.5 w-3.5 text-[#d7ef62]" />Ventas</span>
            <span><WalletCards className="mr-1 inline h-3.5 w-3.5 text-[#d7ef62]" />Caja</span>
            <span><Box className="mr-1 inline h-3.5 w-3.5 text-[#d7ef62]" />Stock</span>
            <span><UsersRound className="mr-1 inline h-3.5 w-3.5 text-[#d7ef62]" />Clientes</span>
          </div>
        </div>
      </div>
    </section>
  );
}
