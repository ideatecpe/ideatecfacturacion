"use client";
import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';

interface Props {
  cliente: {
    numeroDocumento: string
    razonSocial: string
    tipoDocumento: string   // '01' DNI | '06' RUC | '04' CE
    ubigeo: string
    direccionLineal: string
    departamento: string
    provincia: string
    distrito: string
  }
  onGuardar: (extra: {
    nombreComercial: string
    telefono: string
    correo: string
    direccionLineal: string
  }) => Promise<void>
  onCerrar: () => void
}

export function ModalGuardarClienteBoleta({ cliente, onGuardar, onCerrar }: Props) {
  const esDNI = cliente.tipoDocumento === '01'

  const [nombreComercial, setNombreComercial] = useState('')
  const [telefono, setTelefono] = useState('')
  const [correo, setCorreo] = useState('')
  const [direccionLineal, setDireccionLineal] = useState(cliente.direccionLineal ?? '')
  const [guardando, setGuardando] = useState(false)

  const tipoLabel = esDNI ? 'DNI' : cliente.tipoDocumento === '06' ? 'RUC' : 'CE'

  const handleSubmit = async () => {
    setGuardando(true)
    try {
      await onGuardar({ nombreComercial, telefono, correo, direccionLineal })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-800">Guardar Cliente</h2>
            <p className="text-xs text-gray-400 mt-0.5">Completa los datos para registrar en tu base</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Datos de la API — bloque informativo de solo lectura */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 space-y-1.5">
            <p className="text-sm font-semibold text-gray-800 leading-snug">{cliente.razonSocial}</p>
            <p className="text-xs text-gray-500 font-mono">
              <span className="font-bold text-gray-400 uppercase mr-1">{tipoLabel}</span>
              {cliente.numeroDocumento}
            </p>
            {!esDNI && cliente.direccionLineal && (
              <p className="text-xs text-gray-400 leading-snug">{cliente.direccionLineal}</p>
            )}
          </div>

          {/* Dirección lineal editable — para DNI siempre, para RUC/CE solo si vino vacía */}
          {(esDNI || !cliente.direccionLineal) && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">
                Dirección {esDNI ? '(opcional)' : ''}
              </label>
              <input
                type="text"
                value={direccionLineal}
                onChange={(e) => setDireccionLineal(e.target.value)}
                placeholder="Ej: Av. Los Álamos 123"
                className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all"
              />
            </div>
          )}

          {/* Campos extra — solo para RUC / CE */}
          {!esDNI && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Nombre Comercial (opcional)</label>
                <input
                  type="text"
                  value={nombreComercial}
                  onChange={(e) => setNombreComercial(e.target.value)}
                  placeholder="Nombre comercial"
                  className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Teléfono (opcional)</label>
                  <input
                    type="text"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="999 999 999"
                    className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Correo (opcional)</label>
                  <input
                    type="email"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    placeholder="correo@email.com"
                    className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all"
                  />
                </div>
              </div>
            </>
          )}

          {/* Para DNI: teléfono y correo opcionales también */}
          {esDNI && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Teléfono (opcional)</label>
                <input
                  type="text"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="999 999 999"
                  className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Correo (opcional)</label>
                <input
                  type="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="correo@email.com"
                  className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <Button variant="outline" className="flex-1" type="button" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button className="flex-1" type="button" onClick={handleSubmit} disabled={guardando}>
            {guardando ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Guardando...
              </span>
            ) : 'Guardar Cliente'}
          </Button>
        </div>
      </div>
    </div>
  )
}