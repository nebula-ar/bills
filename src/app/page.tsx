import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FAQSection } from "@/components/landing/faq";
import { Footer } from "@/components/landing/footer";
import { HeroSection } from "@/components/landing/hero";
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
  if (adminSession?.user) redirect("/dashboard");

  const staffSession = await getStaffSession();
  if (staffSession) redirect("/terminal");

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f5f4ef] font-sans text-slate-950 selection:bg-[#d7ef62]">
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
  );
}
