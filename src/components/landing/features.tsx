"use client";

import { motion } from "framer-motion";
import { Calculator, CalendarCheck, SmartphoneNfc, TrendingUp } from "lucide-react";

const features = [
  {
    icon: <CalendarCheck className="w-6 h-6 text-[#d4af37]" />,
    title: "24/7 Booking & No-Shows",
    description: "Let clients book while you sleep. Collect upfront deposits and eliminate the cost of empty chairs.",
  },
  {
    icon: <SmartphoneNfc className="w-6 h-6 text-[#00e5ff]" />,
    title: "Chair-Side Checkout",
    description: "Close out tickets right from your phone. Tap-to-pay, QR codes, or cash—everything syncs instantly.",
  },
  {
    icon: <Calculator className="w-6 h-6 text-[#d4af37]" />,
    title: "Painless Payouts",
    description: "Automate the math. We calculate booth rents and commission splits instantly at the end of every shift.",
  },
  {
    icon: <TrendingUp className="w-6 h-6 text-[#00e5ff]" />,
    title: "Executive Reports",
    description: "Stop guessing. See your top services, best-performing barbers, and exact profit margins in one tap.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-[#0A0A0B] relative border-t border-[#353436]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-6 font-montserrat">
            Everything you need. <br />
            <span className="text-gray-500">Nothing you don&apos;t.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group p-8 rounded-2xl bg-[#12121A] border border-[#353436] hover:border-[#d4af37] transition-all hover:bg-[#201F20] shadow-[0_4px_30px_rgba(0,0,0,0.5)] backdrop-blur-md"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#353436] to-[#12121A] flex items-center justify-center mb-6 border border-[#353436] group-hover:scale-110 transition-transform group-hover:shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-white mb-3 font-montserrat">{feature.title}</h3>
              <p className="text-gray-400 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
