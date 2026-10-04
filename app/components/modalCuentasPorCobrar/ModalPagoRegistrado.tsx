'use client'
import React from 'react'
import { createPortal } from 'react-dom'
import { User, X } from 'lucide-react'
import { ResultadoPago, ResultadoPagoProps } from './ResultadoPago'

/**
 * Se abre después de pagar una cuota desde "Ver cuotas": la misma constancia
 * (imprimir, PDF, WhatsApp) que deja el cobro por cliente.
 */
export const ModalPagoRegistrado = ({ onClose, ...resultado }: ResultadoPagoProps & { onClose: () => void }) =>
  createPortal(
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 flex flex-col animate-in zoom-in-95 duration-200" style={{ maxHeight: '92vh' }}>
        <div className="border-b border-gray-100 rounded-t-2xl px-6 py-4 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-[#EEF3FB] border border-[#D0E0F7] rounded-xl flex items-center justify-center shrink-0">
              <User size={18} className="text-brand-blue" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 truncate">{resultado.clienteNombre}</h3>
              <p className="text-gray-500 text-xs mt-0.5">
                {resultado.clienteDoc
                  ? `${resultado.clienteDoc.length === 11 ? 'RUC' : 'DNI'}: ${resultado.clienteDoc}`
                  : 'Sin documento'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-lg transition-colors cursor-pointer">
            <X size={17} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <ResultadoPago {...resultado} />
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex justify-end shrink-0 bg-gray-50/40 rounded-b-2xl">
          <button onClick={onClose}
            className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-all cursor-pointer">
            <X size={14} /> Listo
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
