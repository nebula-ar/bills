import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FAQSection } from "@/components/landing/faq";
import { Footer } from "@/components/landing/footer";
import { HeroSection } from "@/components/landing/hero";
import { LandingMotion } from "@/components/landing/landing-motion";
import { Navbar } from "@/components/landing/Navbar";
import { PricingSection } from "@/components/landing/pricing";
import { TestimonialsSection } from "@/components/landing/testimonials";
import { CTASection } from "@/components/landing/cta";
import { AdaptableSection, FeaturesSection } from "@/components/landing/features";
import { faqs } from "@/components/landing/faq-data";
import { getCurrentSession } from "@/lib/auth";
import { getStaffSession } from "@/lib/terminal-session";

export const metadata: Metadata = {
  title: "Software de gestión para negocios | Bills",
  description:
    "Ventas, caja, stock y clientes en un solo lugar. Bills se adapta a barberías, kioscos, tiendas, servicios y más negocios de Argentina.",
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: { "@type": "Answer", text: faq.a },
  })),
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Bills",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "Software de gestión para negocios: ventas, caja, stock, clientes y reportes.",
  offers: { "@type": "Offer", price: "9900", priceCurrency: "ARS" },
};

export default async function LandingPage() {
  const adminSession = await getCurrentSession();
  // Con sesión, la home no es la landing sino el desvío: panel o mostrador. No
  // se cae más derecho al panel, porque el dueño que entra a cobrar tenía que
  // saber de antemano por dónde se iba a vender.
  if (adminSession?.user) redirect("/entrar");

  const staffSession = await getStaffSession();
  if (staffSession) redirect("/terminal");

  return (
    <LandingMotion>
      <div className="min-h-screen bg-bills-paper font-sans text-bills-ink selection:bg-bills-lime">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <AdaptableSection />
        <PricingSection />
        <TestimonialsSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
      </div>
    </LandingMotion>
  );
}
