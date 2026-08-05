"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ArrowRight } from "lucide-react";

interface MagneticButtonProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  roundedClass?: string;
}

export function MagneticButton({ href, children, className = "", roundedClass = "rounded-[2rem]" }: MagneticButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLAnchorElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const button = buttonRef.current;
    const text = textRef.current;

    if (!container || !button || !text) return;

    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { left, top, width, height } = container.getBoundingClientRect();
      
      const x = (clientX - (left + width / 2));
      const y = (clientY - (top + height / 2));
      
      const moveX = x * 0.3;
      const moveY = y * 0.3;
      
      const rotateX = (y / height) * 20; // 3D tilt up to 20 deg
      const rotateY = (x / width) * 20;

      gsap.to(button, {
        x: moveX,
        y: moveY,
        rotationX: -rotateX,
        rotationY: rotateY,
        transformPerspective: 1000,
        duration: 1,
        ease: "power3.out",
      });

      // Text moves slightly more for strong parallax (3D pop)
      gsap.to(text, {
        x: moveX * 0.4,
        y: moveY * 0.4,
        duration: 1,
        ease: "power3.out",
      });
    };

    const handleMouseLeave = () => {
      gsap.to(button, {
        x: 0,
        y: 0,
        rotationX: 0,
        rotationY: 0,
        duration: 1,
        ease: "elastic.out(1, 0.3)",
      });
      gsap.to(text, {
        x: 0,
        y: 0,
        duration: 1,
        ease: "elastic.out(1, 0.3)",
      });
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative p-4 -m-4 cursor-pointer flex items-center justify-center perspective-1000">
      <Link 
        ref={buttonRef}
        href={href} 
        style={{ transformStyle: "preserve-3d" }}
        className={`group relative overflow-hidden ${roundedClass} bg-slate-900 text-white flex items-center justify-center transition-colors duration-300 ${className}`}
      >
        <div 
          className={`absolute inset-0 bg-primary ${roundedClass} translate-y-[101%] group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)]`} 
        />
        <div ref={textRef} className="relative overflow-hidden h-5 flex items-center justify-center" style={{ transform: "translateZ(30px)" }}>
          
          {/* Ghost element to maintain button's max width securely without layout shifts */}
          <span className="invisible flex items-center gap-1.5 font-bold text-sm tracking-tight">
            <span>{children}</span>
            <ArrowRight className="w-4 h-4" />
          </span>

          {/* Normal state (centered text, no arrow) */}
          <span className="absolute flex items-center justify-center w-full h-full font-bold text-sm tracking-tight transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:-translate-y-[120%]">
            {children}
          </span>
          
          {/* Hover state (text + arrow appears from bottom) */}
          <span className="absolute top-0 left-0 flex items-center justify-center gap-1.5 w-full h-full font-bold text-sm tracking-tight transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] translate-y-[120%] group-hover:translate-y-0">
            <span>{children}</span>
            <div className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-500 delay-100 ease-[cubic-bezier(0.19,1,0.22,1)] flex items-center">
              <ArrowRight className="w-4 h-4" />
            </div>
          </span>

        </div>
      </Link>
    </div>
  );
}
