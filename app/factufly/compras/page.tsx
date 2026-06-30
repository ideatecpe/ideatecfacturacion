"use client";
import { useRouter } from 'next/navigation';
import { Truck, ClipboardList } from 'lucide-react';

const opciones = [
  { title: 'Gestión de Proveedores', desc: 'Administra tu lista de proveedores: registro, edición y datos de contacto.', icon: Truck,         href: '/factufly/compras/proveedores' },
  { title: 'Gestión de Órdenes',     desc: 'Administra tus órdenes de compra a proveedores y abastece tu stock.',      icon: ClipboardList, href: '/factufly/compras/ordenes' },
];

export default function ComprasPage() {
  const router = useRouter();

  return (
    <div className="mx-auto space-y-4 animate-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-1">
        <h2 className="text-base font-bold text-gray-900">¿Qué deseas gestionar?</h2>
        <p className="text-xs text-gray-500">Selecciona una opción para continuar.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto">
        {opciones.map((item, i) => (
          <button
            key={i}
            onClick={() => router.push(item.href)}
            className="group px-2 py-4 bg-white rounded-xl border border-[#E2EAF6] shadow-sm transition-all text-left flex gap-3 items-start"
            style={{ borderColor: "#E2EAF6" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#0f2e64"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(15,46,100,0.1)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#E2EAF6"; e.currentTarget.style.boxShadow = ""; }}
          >
            <div
              className="p-2 rounded-lg shrink-0 transition-colors"
              style={{ background: "rgba(15,46,100,0.07)", color: "#0f2e64" }}
            >
              <item.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[13px] font-bold leading-tight" style={{ color: "#0f2e64" }}>{item.title}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
