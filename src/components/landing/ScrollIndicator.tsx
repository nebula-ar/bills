"use client";

import { motion, useScroll, useSpring } from "framer-motion";

export function ScrollIndicator() {
  const { scrollYProgress } = useScroll();
  
  // Add a slight spring physics so it feels ultra-premium and fluid
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <div className="fixed right-4 lg:right-6 top-1/2 -translate-y-1/2 z-50 h-[35vh] min-h-[250px] w-[2px] bg-slate-200 rounded-full overflow-hidden flex items-start">
      <motion.div 
        className="w-full bg-gradient-to-b from-blue-600 via-slate-500 to-red-600 rounded-full origin-top"
        style={{ 
          height: "100%",
          scaleY: smoothProgress 
        }}
      />
    </div>
  );
}
