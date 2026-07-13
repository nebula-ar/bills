import Link from "next/link";
import { Scissors } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-[#0A0A0B] border-t border-[#353436] pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          <div className="col-span-2">
            <Link href="/" className="inline-flex items-center gap-2 text-xl font-bold text-white mb-4 font-montserrat">
              <Scissors className="w-5 h-5 text-[#d4af37]" />
              Barber Bills
            </Link>
            <p className="text-gray-400 max-w-sm">
              The modern operating system for ambitious barbershops. Built to fill chairs and automate payouts.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 font-montserrat">Product</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="#features" className="hover:text-[#d4af37] transition-colors">Features</Link></li>
              <li><Link href="#pricing" className="hover:text-[#d4af37] transition-colors">Pricing</Link></li>
              <li><Link href="#testimonials" className="hover:text-[#d4af37] transition-colors">Wall of Love</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 font-montserrat">Company</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/about" className="hover:text-[#d4af37] transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-[#d4af37] transition-colors">Contact</Link></li>
              <li><Link href="/privacy" className="hover:text-[#d4af37] transition-colors">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-[#353436] flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Barber Bills. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
            <a href="#" className="hover:text-white transition-colors">Instagram</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
