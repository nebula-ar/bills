import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Scissors } from "lucide-react";
import { HeroSection } from "@/components/landing/hero";
import { FeaturesSection } from "@/components/landing/features";
import { PricingSection } from "@/components/landing/pricing";
import { TestimonialsSection } from "@/components/landing/testimonials";
import { FAQSection } from "@/components/landing/faq";
import { faqs } from "@/components/landing/faq-data";
import { CTASection } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";
import { Preloader } from "@/components/landing/Preloader";
import { ScrollIndicator } from "@/components/landing/ScrollIndicator";
import { Navbar } from "@/components/landing/Navbar";
import { getCurrentSession } from "@/lib/auth";
import { getBarberSession } from "@/lib/barber-session";

export const metadata: Metadata = {
  title: "Software para Barberías en Argentina | Barber Bills",
  description:
    "Gestioná turnos, cobros y comisiones de tu barbería en un solo sistema. Sin comisión sobre tus ventas. Probá gratis Barber Bills, hecho para Argentina.",
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.a,
    },
  })),
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Barber Bills",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "Software de gestión para barberías: turnos, POS, comisiones y reportes multi-sucursal.",
  offers: {
    "@type": "Offer",
    price: "9900",
    priceCurrency: "ARS",
  },
};

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <Preloader />
      <ScrollIndicator />

      <Navbar />

      {/* Main Content */}
      <main className="relative z-10">
        <HeroSection />
        <FeaturesSection />
        <PricingSection />
        <TestimonialsSection />
        <FAQSection />
        <CTASection />
      </main>

      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}
