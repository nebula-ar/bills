"use client";

import { useState } from "react";
import gsap from "gsap";
import { CheckCircle2, User, Clock, DollarSign } from "lucide-react";

export function InteractiveMockup() {
  const [appointments, setAppointments] = useState([
    { id: 1, name: "Lucas M.", service: "Corte + Barba", time: "10:00 AM", price: "$15", status: "pending" },
    { id: 2, name: "Martín T.", service: "Corte Clásico", time: "11:30 AM", price: "$10", status: "pending" },
    { id: 3, name: "Diego G.", service: "Perfilado", time: "01:00 PM", price: "$5", status: "pending" },
  ]);

  const completeAppointment = (id: number) => {
    const card = document.getElementById(`appt-${id}`);
    if (card) {
      gsap.to(card, {
        scale: 0.95,
        opacity: 0.5,
        duration: 0.3,
        ease: "power2.inOut",
        onComplete: () => {
          setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: "completed" } : a));
          gsap.to(card, {
            scale: 1,
            opacity: 1,
            backgroundColor: "#F0FDF4", // green-50
            borderColor: "#86EFAC", // green-300
            duration: 0.4,
            ease: "power2.out"
          });
        }
      });
    }
  };

  return (
    <div className="flex-1 p-6 flex flex-col gap-5 relative h-full bg-slate-50 min-h-[400px]">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h3 className="text-slate-900 font-bold font-montserrat text-lg">Próximos Turnos</h3>
          <p className="text-slate-500 text-sm font-medium">Hoy, {new Date().toLocaleDateString('es-ES', { month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="h-10 w-10 bg-blue-100 border border-blue-200 rounded-full flex items-center justify-center shadow-sm">
          <User className="w-5 h-5 text-blue-600" />
        </div>
      </div>
      
      <div className="flex flex-col gap-4 flex-1 overflow-hidden">
        {appointments.map((appt) => (
          <div
            key={appt.id}
            id={`appt-${appt.id}`}
            onClick={() => appt.status === "pending" && completeAppointment(appt.id)}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-3 relative overflow-hidden shadow-sm ${
              appt.status === "completed" 
                ? "bg-green-50 border-green-300" 
                : "bg-white border-slate-200 hover:border-blue-500 hover:shadow-[0_8px_30px_rgba(37,99,235,0.12)] hover:-translate-y-1"
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-slate-900 font-bold">{appt.name}</span>
              <span className="text-blue-700 font-black">{appt.price}</span>
            </div>
            <div className="flex justify-between items-center text-sm text-slate-500 font-medium">
              <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>{appt.time}</span>
              </div>
              <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-md">{appt.service}</span>
            </div>

            {/* Action overlay on hover for pending */}
            {appt.status === "pending" && (
              <div className="absolute inset-0 bg-blue-600/10 backdrop-blur-[2px] opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="bg-blue-600 text-white px-5 py-2 rounded-full text-sm font-bold flex items-center gap-1.5 shadow-lg transform hover:scale-105 transition-transform">
                  <DollarSign className="w-4 h-4" />
                  Cobrar Turno
                </div>
              </div>
            )}
            
            {/* Completed badge */}
            {appt.status === "completed" && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white px-3 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Pagado
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Bottom stats mini-dashboard */}
      <div className="mt-auto grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 mb-1 font-medium">Ingresos de Hoy</p>
          <p className="text-slate-900 font-black text-2xl">$145</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 mb-1 font-medium">Turnos</p>
          <p className="text-slate-900 font-black text-2xl">8 <span className="text-sm text-slate-400 font-medium">restantes</span></p>
        </div>
      </div>
    </div>
  );
}
