"use client";
import { useRouter } from 'next/navigation';
import { FileText, AlertCircle, Plus, Truck, Receipt, ReceiptText } from 'lucide-react';

const documentTypes = [
  { title: 'Boleta y Factura Electrónica', desc: 'Para personas naturales y empresas (con o sin RUC).', icon: ReceiptText,    href: '/factufly/operaciones/boleta-facturaelectronica'},
  { title: 'Nota de Crédito',     desc: 'Para anular o modificar comprobantes emitidos previamente.',       icon: AlertCircle, href: '/factufly/operaciones/nota-credito' },
  { title: 'Nota de Débito',      desc: 'Para aumentar el valor de un comprobante emitido previamente.',    icon: Plus,        href: '/factufly/operaciones/nota-debito'  },
  { title: 'Guía de Remisión',    desc: 'Para sustentar el traslado de bienes a nivel nacional.',           icon: Truck,       href: '/factufly/operaciones/guia-remision'},
];

export default function EmisionPage() {
  const router = useRouter();

  return (
    <div className="mx-auto space-y-4 animate-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-1">
        <h2 className="text-base font-bold text-gray-900">¿Qué comprobante deseas emitir?</h2>
        <p className="text-xs text-gray-500">Selecciona el tipo de documento para comenzar el proceso de emisión.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {documentTypes.map((item, i) => (
          <button
            key={i}
            onClick={() => router.push(item.href)}
            className="group p-3 bg-white rounded-xl border border-[#E2EAF6] shadow-sm transition-all text-left flex gap-3 items-start"
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
              <h3 className="text-xs font-bold leading-tight" style={{ color: "#0f2e64" }}>{item.title}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{item.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
