import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <section className="py-24 relative overflow-hidden bg-[#0A0A0B]">
      <div className="absolute inset-0 bg-[#d4af37]/5" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#d4af37]/10 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
        <h2 className="text-4xl lg:text-6xl font-extrabold text-white mb-6 font-montserrat">
          Ready to upgrade your shop?
        </h2>
        <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
          Join the modern barbershops that have stopped managing spreadsheets and started growing their business.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-b from-[#f2ca50] to-[#d4af37] text-black rounded-lg font-bold hover:shadow-[0_0_20px_rgba(0,229,255,0.4)] transition-all text-lg"
          >
            Create Your Account
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-8 py-4 bg-transparent text-[#d4af37] rounded-lg font-semibold hover:bg-white/5 border border-[#d4af37]/50 hover:border-[#d4af37] transition-colors text-lg"
          >
            Talk to Sales
          </Link>
        </div>
      </div>
    </section>
  );
}
