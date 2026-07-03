"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/app/components/ui/Button";

export interface VehiculoData {
  placa: string;
  entidadAutorizacion?: string;
  numeroAutorizacion?: string;
}

interface Props {
  onAgregar: (vehiculo: VehiculoData) => void;
  onCerrar: () => void;
}

// Tabla estática — entidades emisoras de autorización especial (Tabla 20 SUNAT)
const ENTIDADES_AUTORIZACION = [
  { codigo: "01", label: "SUCAMEC - Superintendencia Nacional de Control de Servicios de Seguridad" },
  { codigo: "02", label: "DIGEMID - Dirección General de Medicamentos Insumos y Drogas" },
  { codigo: "03", label: "DIGESA - Dirección General de Salud Ambiental" },
  { codigo: "04", label: "SENASA - Servicio Nacional de Sanidad Agraria" },
  { codigo: "05", label: "SERFOR - Servicio Nacional Forestal y de Fauna Silvestre" },
  { codigo: "06", label: "PRODUCE - Ministerio de la Producción" },
  { codigo: "07", label: "MTC - Ministerio de Transportes y Comunicaciones" },
  { codigo: "08", label: "OSINERGMIN - Organismo Supervisor de Inversión en Energía y Minería" },
  { codigo: "09", label: "ANA - Autoridad Nacional del Agua" },
  { codigo: "10", label: "OTROS" },
];

const inputClass =
  "w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue/50 outline-none transition-all text-sm";
const selectClass =
  "w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-blue/50 text-sm";
const labelClass = "text-xs font-bold text-gray-500 uppercase";

export default function ModalVehiculo({ onAgregar, onCerrar }: Props) {
  const [placa, setPlaca]                           = useState("");
  const [entidadAutorizacion, setEntidadAutorizacion] = useState("");
  const [numeroAutorizacion, setNumeroAutorizacion]   = useState("");

  const puedeAgregar = placa.trim().length > 0;

  const handleAgregar = () => {
    onAgregar({
      placa: placa.trim().toUpperCase(),
      entidadAutorizacion: entidadAutorizacion || undefined,
      numeroAutorizacion: numeroAutorizacion.trim() || undefined,
    });
    onCerrar();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h4 className="text-base font-bold text-gray-900">Agregar Vehículo</h4>
          <button type="button" onClick={onCerrar} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Placa */}
          <div className="space-y-1.5">
            <label className={labelClass}>Número de placa</label>
            <input
              type="text"
              placeholder="Ej. ABC-123"
              value={placa}
              onChange={(e) => setPlaca(e.target.value.toUpperCase())}
              maxLength={8}
              className={inputClass}
            />
          </div>

          {/* Autorización especial — opcional */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase">
              Autorización especial para el traslado{" "}
              <span className="text-gray-400 normal-case font-normal">(opcional)</span>
            </p>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <label className={labelClass}>Entidad emisora</label>
                <select
                  className={selectClass}
                  value={entidadAutorizacion}
                  onChange={(e) => setEntidadAutorizacion(e.target.value)}
                >
                  <option value="">Seleccione...</option>
                  {ENTIDADES_AUTORIZACION.map(e => (
                    <option key={e.codigo} value={e.codigo}>{e.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Número de autorización</label>
                <input
                  type="text"
                  placeholder="Número emitido por la entidad"
                  value={numeroAutorizacion}
                  onChange={(e) => setNumeroAutorizacion(e.target.value)}
                  className={inputClass}
                  disabled={!entidadAutorizacion}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <Button variant="outline" className="flex-1" onClick={onCerrar}>Cancelar</Button>
          <Button className="flex-1" disabled={!puedeAgregar} onClick={handleAgregar}>Agregar</Button>
        </div>
      </div>
    </div>
  );
}