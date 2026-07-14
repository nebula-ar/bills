"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import Image from "next/image";

export function AureolaBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLImageElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Ultra-slow, majestic organic movement
    if (orbRef.current) {
      // Rotation and breathing scale
      gsap.to(orbRef.current, {
        rotation: 360,
        scale: 1.15,
        duration: 40,
        ease: "none",
        repeat: -1,
        yoyo: true,
        transformOrigin: "center center"
      });
    }

    // Advanced Interactive mouse movement (parallax)
    const handleMouseMove = (e: MouseEvent) => {
      if (!wrapperRef.current || !orbRef.current) return;
      const { clientX, clientY } = e;
      const xNorm = (clientX / window.innerWidth - 0.5); // -0.5 to 0.5
      const yNorm = (clientY / window.innerHeight - 0.5);

      // Wrapper moves opposite to mouse for depth
      gsap.to(wrapperRef.current, {
        x: xNorm * -50,
        y: yNorm * -50,
        duration: 2.5,
        ease: "power2.out",
      });

      // The orb moves slightly with the mouse
      gsap.to(orbRef.current, {
        x: xNorm * 80,
        y: yNorm * 80,
        duration: 1.5,
        ease: "power2.out"
      });
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div ref={containerRef} className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-slate-50 flex items-center justify-center">
      {/* Heavy grain overlay for that tactile Awwwards WebGL feel */}
      <div 
        className="absolute inset-0 opacity-[0.08] mix-blend-multiply z-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
      
      {/* 3D Orb Layer */}
      <div ref={wrapperRef} className="relative w-full h-full flex items-center justify-center">
        <Image
          ref={orbRef}
          src="/orb.jpg"
          alt="Abstract 3D Orb"
          width={1200}
          height={1200}
          className="w-[80vw] max-w-[1000px] h-auto object-cover opacity-80 mix-blend-multiply blur-xl"
          priority
        />
      </div>
    </div>
  );
}
