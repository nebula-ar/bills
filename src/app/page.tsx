import Link from "next/link";
import { Scissors } from "lucide-react";
import { HeroSection } from "@/components/landing/hero";
import { FeaturesSection } from "@/components/landing/features";
import { TestimonialsSection } from "@/components/landing/testimonials";
import { CTASection } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#131314] text-white selection:bg-[#d4af37]/30 font-sans">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#131314]/80 backdrop-blur-md border-b border-[#353436]">
        <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-[#d4af37]" />
            <span className="text-xl font-bold tracking-tight text-white font-montserrat">Barber Bills</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-white transition-colors hidden sm:block">
              Log in
            </Link>
            <Link href="/dashboard" className="px-4 py-2 text-sm font-medium bg-gradient-to-b from-[#f2ca50] to-[#d4af37] text-black rounded-md hover:shadow-[0_0_15px_rgba(0,229,255,0.3)] transition-all font-semibold">
              Open Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        <HeroSection />
        <FeaturesSection />
        <TestimonialsSection />
        <CTASection />
      </main>

      <Footer />
    </div>
  );
}
