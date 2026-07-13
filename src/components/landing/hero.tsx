"use client";

import { motion } from "framer-motion";
import { ArrowRight, Scissors } from "lucide-react";
import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-24 pb-32">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-[#d4af37]/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-[#d4af37] mb-8"
            >
              <Scissors className="w-4 h-4" />
              <span>Built by barbers, for barbers</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-5xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1] text-white font-montserrat"
            >
              Run your shop, <br />
              <span className="text-gray-500">not a spreadsheet.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-xl text-gray-400 mb-10 max-w-xl leading-relaxed"
            >
              The all-in-one POS, booking, and management system built to fill chairs and automate your payouts. Stop managing, start cutting.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-b from-[#f2ca50] to-[#d4af37] text-black rounded-lg font-bold transition-all hover:shadow-[0_0_20px_rgba(0,229,255,0.4)] text-lg"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="#features"
                className="inline-flex items-center justify-center px-8 py-4 bg-transparent text-[#d4af37] rounded-lg font-semibold hover:bg-white/5 border border-[#d4af37]/50 hover:border-[#d4af37] transition-colors text-lg"
              >
                Explore Features
              </Link>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="flex-1 relative w-full aspect-square max-w-lg mx-auto lg:max-w-none"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-[#d4af37]/20 to-[#00e5ff]/20 rounded-3xl blur-2xl" />
            <div className="relative h-full w-full bg-[#12121A] border border-[#353436] rounded-3xl overflow-hidden shadow-2xl flex flex-col backdrop-blur-xl">
              {/* Mockup Top Bar */}
              <div className="h-12 border-b border-[#353436] flex items-center px-4 gap-2 bg-[#0A0A0B]">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                  <div className="w-3 h-3 rounded-full bg-green-500/50" />
                </div>
                <div className="mx-auto px-24 py-1.5 rounded-md bg-[#201F20] text-xs text-gray-500 flex-1 text-center font-mono">
                  barberbills.app
                </div>
              </div>
              {/* Mockup Content */}
              <div className="flex-1 p-6 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div className="h-6 w-32 bg-[#353436] rounded-md" />
                  <div className="h-8 w-8 bg-[#d4af37]/20 border border-[#d4af37]/50 rounded-full" />
                </div>
                <div className="h-24 w-full bg-gradient-to-r from-[#201F20] to-[#12121A] border border-[#353436] rounded-xl mt-4" />
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="h-32 bg-[#201F20] rounded-xl border border-[#353436]" />
                  <div className="h-32 bg-[#201F20] rounded-xl border border-[#353436]" />
                </div>
                <div className="h-40 w-full bg-[#201F20] rounded-xl border border-[#353436] mt-4" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
