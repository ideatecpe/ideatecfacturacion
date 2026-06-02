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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {documentTypes.map((item, i) => (
          <button
            key={i}
            onClick={() => router.push(item.href)}
            className="group p-4 bg-white rounded-xl border-2 border-transparent hover:border-brand-blue shadow-sm hover:shadow-md transition-all text-left flex gap-3 items-start"
          >
            <div className="p-2.5 rounded-lg bg-blue-50 text-brand-blue group-hover:bg-brand-blue group-hover:text-white transition-colors shrink-0">
              <item.icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 group-hover:text-brand-blue transition-colors">{item.title}</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
