import Link from "next/link";
import { redirect } from "next/navigation";
import { Scissors } from "lucide-react";
import { HeroSection } from "@/components/landing/hero";
import { TestimonialsSection } from "@/components/landing/testimonials";
import { CTASection } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";
import { Preloader } from "@/components/landing/Preloader";
import { ScrollIndicator } from "@/components/landing/ScrollIndicator";
import { Navbar } from "@/components/landing/Navbar";
import { getCurrentSession } from "@/lib/auth";
import { getBarberSession } from "@/lib/barber-session";

export default async function LandingPage() {
  const adminSession = await getCurrentSession();

  if (adminSession?.user) {
    redirect("/dashboard");
  }

  const barberSession = await getBarberSession();

  if (barberSession) {
    redirect("/barber");
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900 selection:bg-blue-500/30 font-sans relative">
      <Preloader />
      <ScrollIndicator />
      
      <Navbar />

      {/* Main Content */}
      <main className="relative z-10">
        <HeroSection />
        <TestimonialsSection />
        <CTASection />
      </main>

      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}
