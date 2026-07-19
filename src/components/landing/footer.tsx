import Link from "next/link";
import { Scissors } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-[#0A0A0B] pt-16 pb-8 relative z-10 -mt-[1px]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          <div className="col-span-2">
            <Link href="/" className="inline-flex items-center gap-2 text-xl font-bold text-white mb-4 font-montserrat">
              <Scissors className="w-5 h-5 text-[#38BDF8]" />
              Barber Bills
            </Link>
            <p className="text-gray-400 max-w-sm">
              El sistema operativo moderno para barberías ambiciosas. Creado para llenar sillas y automatizar pagos.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 font-montserrat">Producto</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="#features" className="hover:text-[#38BDF8] transition-colors">Funciones</Link></li>
              <li><Link href="#pricing" className="hover:text-[#38BDF8] transition-colors">Precios</Link></li>
              <li><Link href="#testimonials" className="hover:text-[#38BDF8] transition-colors">Testimonios</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 font-montserrat">Empresa</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/about" className="hover:text-[#38BDF8] transition-colors">Nosotros</Link></li>
              <li><Link href="/contact" className="hover:text-[#38BDF8] transition-colors">Contacto</Link></li>
              <li><Link href="/privacy" className="hover:text-[#38BDF8] transition-colors">Privacidad</Link></li>
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-[#1E293B] flex justify-center items-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Barber Bills. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
