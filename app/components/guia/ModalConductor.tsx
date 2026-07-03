"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { consultaDni } from "@/app/components/apiConsultasJsonPe/consultaDni";

export interface ConductorData {
  licencia: string;
  tipoDocumento: string;
  numeroDocumento: string;
  apellidos: string;
  nombres: string;
}

interface Props {
  onAgregar: (conductor: ConductorData) => void;
  onCerrar: () => void;
}

const TIPOS_DOCUMENTO = [
  { id: "01", label: "DOCUMENTO NACIONAL DE IDENTIDAD" },
  { id: "07", label: "PASAPORTE" },
  { id: "04", label: "CARNET DE EXTRANJERIA" },
];

const inputClass =
  "w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue/50 outline-none transition-all text-sm";
const selectClass =
  "w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-blue/50 text-sm";
const labelClass = "text-xs font-bold text-gray-500 uppercase";

export default function ModalConductor({ onAgregar, onCerrar }: Props) {
  const [licencia, setLicencia] = useState("");
  const [tipoDoc, setTipoDoc] = useState("01");
  const [numeroDoc, setNumeroDoc] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [nombres, setNombres] = useState("");
  const [hint, setHint] = useState<{ text: string; color: string } | null>(
    null,
  );
  const [loadingDni, setLoadingDni] = useState(false);

  // handleNumeroDoc actualizado
  const handleNumeroDoc = async (val: string) => {
    setNumeroDoc(val);
    setNombres("");
    setApellidos("");
    setHint(null);

    if (tipoDoc === "01" && val.length === 8) {
      setLoadingDni(true);
      setHint({ text: "Consultando DNI...", color: "#185FA5" });
      try {
        const data = await consultaDni(val);
        if (data) {
          const partes = data.nombreCompleto.split(" ");
          const apellidosStr = partes.slice(-2).join(" ");
          const nombresStr = partes.slice(0, -2).join(" ");
          setApellidos(apellidosStr);
          setNombres(nombresStr);
          setHint({ text: `✓ ${data.nombreCompleto}`, color: "#15803d" });
        } else {
          setHint({ text: "DNI no encontrado", color: "#DC2626" });
        }
      } catch {
        setHint({ text: "Error al consultar DNI", color: "#DC2626" });
      } finally {
        setLoadingDni(false);
      }
    } else if (tipoDoc === "01" && val.length > 0) {
      setHint({ text: `${val.length}/8 dígitos`, color: "#B45309" });
    }
  };

  const puedeAgregar =
    licencia.trim().length > 0 &&
    numeroDoc.trim().length > 0 &&
    apellidos.trim().length > 0 &&
    nombres.trim().length > 0;

  const handleAgregar = () => {
    onAgregar({
      licencia: licencia.trim(),
      tipoDocumento: tipoDoc,
      numeroDocumento: numeroDoc.trim(),
      apellidos: apellidos.trim(),
      nombres: nombres.trim(),
    });
    onCerrar();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h4 className="text-base font-bold text-gray-900">
            Agregar Conductor
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
        <div className="px-6 py-5 space-y-4">
          {/* Licencia */}
          <div className="space-y-1.5">
            <label className={labelClass}>Número de licencia de conducir</label>
            <input
              type="text"
              placeholder="Ej. Q43408176"
              value={licencia}
              onChange={(e) => setLicencia(e.target.value.toUpperCase())}
              className={inputClass}
            />
          </div>

          {/* Tipo documento + Número */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelClass}>Tipo de documento</label>
              <select
                className={selectClass}
                value={tipoDoc}
                onChange={(e) => {
                  setTipoDoc(e.target.value);
                  setNumeroDoc("");
                  setNombres("");
                  setHint(null);
                }}
              >
                {TIPOS_DOCUMENTO.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Número de documento</label>
              <input
                type="text"
                placeholder={tipoDoc === "01" ? "8 dígitos" : "Número"}
                value={numeroDoc}
                maxLength={tipoDoc === "01" ? 8 : 20}
                onChange={(e) =>
                  handleNumeroDoc(e.target.value.replace(/\D/g, ""))
                }
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelClass}>Apellidos</label>
              <input
                type="text"
                placeholder="Apellidos del conductor"
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Nombres</label>
              <input
                type="text"
                placeholder="Nombres del conductor"
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                className={inputClass}
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
