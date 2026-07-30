import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { HeroSection } from "@/components/landing/hero";
import { FAQSection } from "@/components/landing/faq";
import { faqs } from "@/components/landing/faq-data";
import { CTASection } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";
import { Preloader } from "@/components/landing/Preloader";
import { ScrollIndicator } from "@/components/landing/ScrollIndicator";
import { Navbar } from "@/components/landing/Navbar";
import { getCurrentSession } from "@/lib/auth";
import { getStaffSession } from "@/lib/terminal-session";

// Secciones debajo del pliegue con librerías de animación pesadas (framer-motion,
// gsap): se cargan en un chunk aparte para no sumar su parseo/ejecución al
// bloqueo del hilo principal durante la carga inicial del hero. Siguen
// renderizadas en el servidor (ssr: true, el default) para no perder el
// contenido de cara a SEO.
const FeaturesSection = dynamic(() =>
  import("@/components/landing/features").then((m) => m.FeaturesSection)
);
const PricingSection = dynamic(() =>
  import("@/components/landing/pricing").then((m) => m.PricingSection)
);
const TestimonialsSection = dynamic(() =>
  import("@/components/landing/testimonials").then((m) => m.TestimonialsSection)
);

export const metadata: Metadata = {
  title: "Software para Negocios en Argentina | Bills",
  description:
    "Gestioná turnos, cobros y comisiones de tu negocio en un solo sistema. Sin comisión sobre tus ventas. Probá gratis Bills, hecho para Argentina.",
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
  name: "Bills",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "Software de gestión para negocios: turnos, POS, comisiones y reportes multi-sucursal.",
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

  const staffSession = await getStaffSession();

  if (staffSession) {
    redirect("/terminal");
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
