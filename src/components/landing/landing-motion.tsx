"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function LandingMotion({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      const media = gsap.matchMedia();

      media.add(
        {
          reduceMotion: "(prefers-reduced-motion: reduce)",
          desktop: "(min-width: 768px)",
        },
        (context) => {
          const { reduceMotion, desktop } = context.conditions as {
            reduceMotion: boolean;
            desktop: boolean;
          };

          if (reduceMotion) {
            gsap.set(root.querySelectorAll("[data-motion]"), {
              clearProps: "all",
            });
            return;
          }

          const heroCopy = root.querySelectorAll(
            "[data-motion='hero-copy'] > *",
          );
          const heroVisual = root.querySelector("[data-motion='hero-visual']");
          const heroFloaters = root.querySelectorAll(
            "[data-motion='hero-floater']",
          );

          const heroTimeline = gsap.timeline({
            defaults: { ease: "power3.out" },
          });

          heroTimeline
            .from(heroCopy, {
              autoAlpha: 0,
              y: 28,
              duration: 0.72,
              stagger: 0.08,
            })
            .from(
              heroVisual,
              {
                autoAlpha: 0,
                y: 36,
                rotation: 1.5,
                scale: 0.97,
                duration: 0.9,
                ease: "power4.out",
              },
              0.18,
            )
            .from(
              heroFloaters,
              {
                autoAlpha: 0,
                y: 18,
                scale: 0.94,
                duration: 0.52,
                stagger: 0.1,
              },
              0.62,
            );

          root.querySelectorAll<HTMLElement>("[data-motion='reveal']").forEach(
            (element) => {
              gsap.from(element, {
                autoAlpha: 0,
                y: desktop ? 34 : 22,
                duration: desktop ? 0.78 : 0.6,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: element,
                  start: "top 86%",
                  once: true,
                },
              });
            },
          );

          root.querySelectorAll<HTMLElement>("[data-motion='stagger']").forEach(
            (group) => {
              const items = group.querySelectorAll("[data-motion-item]");
              if (!items.length) return;

              gsap.from(items, {
                autoAlpha: 0,
                y: desktop ? 30 : 18,
                duration: 0.62,
                ease: "power3.out",
                stagger: 0.09,
                scrollTrigger: {
                  trigger: group,
                  start: "top 82%",
                  once: true,
                },
              });
            },
          );

          if (desktop) {
            const worldImage = root.querySelector(
              "[data-motion='world-image']",
            );
            const worldSection = root.querySelector("#rubros");

            if (worldImage && worldSection) {
              gsap.fromTo(
                worldImage,
                { yPercent: -4, scale: 1.04 },
                {
                  yPercent: 4,
                  scale: 1,
                  ease: "none",
                  scrollTrigger: {
                    trigger: worldSection,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: 0.7,
                  },
                },
              );
            }
          }
        },
      );

      return () => media.revert();
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className="min-h-screen overflow-x-clip [-webkit-tap-highlight-color:transparent]">
      {children}
    </div>
  );
}
