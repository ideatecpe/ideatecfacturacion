"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { consultaRuc } from "@/app/components/apiConsultasJsonPe/consultaRuc";

export interface TransportistaPublicoData {
  ruc: string;
  razonSocial: string;
  registroMTC?: string;
  entidadAutorizacion?: string;
  numeroAutorizacion?: string;
}

interface Props {
  onAgregar: (transportista: TransportistaPublicoData) => void;
  onCerrar: () => void;
}

const ENTIDADES_AUTORIZACION = [
  {
    codigo: "01",
    label:
      "SUCAMEC - Superintendencia Nacional de Control de Servicios de Seguridad",
  },
  {
    codigo: "02",
    label: "DIGEMID - Dirección General de Medicamentos Insumos y Drogas",
  },
  { codigo: "03", label: "DIGESA - Dirección General de Salud Ambiental" },
  { codigo: "04", label: "SENASA - Servicio Nacional de Sanidad Agraria" },
  {
    codigo: "05",
    label: "SERFOR - Servicio Nacional Forestal y de Fauna Silvestre",
  },
  { codigo: "06", label: "PRODUCE - Ministerio de la Producción" },
  { codigo: "07", label: "MTC - Ministerio de Transportes y Comunicaciones" },
  {
    codigo: "08",
    label:
      "OSINERGMIN - Organismo Supervisor de Inversión en Energía y Minería",
  },
  { codigo: "09", label: "ANA - Autoridad Nacional del Agua" },
  { codigo: "10", label: "OTROS" },
];

const inputClass =
  "w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue/50 outline-none transition-all text-sm";
const selectClass =
  "w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-blue/50 text-sm";
const labelClass = "text-xs font-bold text-gray-500 uppercase";

export default function ModalTransportistaPublico({
  onAgregar,
  onCerrar,
}: Props) {
  const [ruc, setRuc] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [registroMTC, setRegistroMTC] = useState("");
  const [entidadAutorizacion, setEntidadAutorizacion] = useState("");
  const [numeroAutorizacion, setNumeroAutorizacion] = useState("");
  const [hint, setHint] = useState<{ text: string; color: string } | null>(
    null,
  );
  const [loadingRuc, setLoadingRuc] = useState(false);

  // handleRuc actualizado
  const handleRuc = async (val: string) => {
    setRuc(val);
    setRazonSocial("");
    setHint(null);

    if (val.length === 11) {
      setLoadingRuc(true);
      setHint({ text: "Consultando RUC...", color: "#185FA5" });
      try {
        const data = await consultaRuc(val);
        if (data) {
          setRazonSocial(data.razonSocial);
          setHint({ text: `✓ ${data.razonSocial}`, color: "#15803d" });
        } else {
          setHint({ text: "RUC no encontrado en SUNAT", color: "#DC2626" });
        }
      } catch {
        setHint({ text: "Error al consultar RUC", color: "#DC2626" });
      } finally {
        setLoadingRuc(false);
      }
    } else if (val.length > 0) {
      setHint({ text: `${val.length}/11 dígitos`, color: "#B45309" });
    }
  };

  const puedeAgregar = ruc.length === 11 && razonSocial.length > 0;

  const handleAgregar = () => {
    onAgregar({
      ruc,
      razonSocial,
      registroMTC: registroMTC.trim() || undefined,
      entidadAutorizacion: entidadAutorizacion || undefined,
      numeroAutorizacion: numeroAutorizacion.trim() || undefined,
    });
    onCerrar();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h4 className="text-base font-bold text-gray-900">
            Agregar Transportista
          </h4>
          <button
            type="button"
            onClick={onCerrar}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* RUC */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelClass}>Número de RUC</label>
              <input
                type="text"
                placeholder="11 dígitos"
                value={ruc}
                maxLength={11}
                onChange={(e) => handleRuc(e.target.value.replace(/\D/g, ""))}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Razón social</label>
              <input
                type="text"
                placeholder={
                  loadingRuc ? "Consultando..." : "Se completa automáticamente"
                }
                value={razonSocial}
                onChange={(e) => setRazonSocial(e.target.value)}
                className={`${inputClass} ${razonSocial ? "bg-green-50 border-green-200" : ""}`}
              />
            </div>
          </div>

          {/* Registro MTC — opcional, input manual */}
          <div className="space-y-1.5">
            <label className={labelClass}>
              Número de registro MTC{" "}
              <span className="text-gray-400 normal-case font-normal">
                (opcional)
              </span>
            </label>
            <input
              type="text"
              placeholder="Número de registro MTC del transportista"
              value={registroMTC}
              onChange={(e) => setRegistroMTC(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Autorización especial — opcional */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase">
              Autorización especial para el traslado{" "}
              <span className="text-gray-400 normal-case font-normal">
                (opcional)
              </span>
            </p>
            <div className="space-y-1.5">
              <label className={labelClass}>Entidad emisora</label>
              <select
                className={selectClass}
                value={entidadAutorizacion}
                onChange={(e) => setEntidadAutorizacion(e.target.value)}
              >
                <option value="">Seleccione...</option>
                {ENTIDADES_AUTORIZACION.map((e) => (
                  <option key={e.codigo} value={e.codigo}>
                    {e.label}
                  </option>
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

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <Button variant="outline" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={!puedeAgregar}
            onClick={handleAgregar}
          >
            Agregar
          </Button>
        </div>
      </div>
    </div>
  );
}
