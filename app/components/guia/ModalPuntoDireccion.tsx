"use client";
import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { consultaRuc } from "@/app/components/apiConsultasJsonPe/consultaRuc";

// — JSON estático de ubigeos
import departamentosData from "@/app/components/data/ubigeo/ubigeo_departamentos.json";
import provinciasData from "@/app/components/data/ubigeo/ubigeo_provincias.json";
import distritosData from "@/app/components/data/ubigeo/ubigeo_distritos.json";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoOpcion = "remitente" | "tercero" | "otra";

interface Departamento {
  id: number;
  departamento: string;
  ubigeo: string;
}
interface Provincia {
  id: number;
  provincia: string;
  ubigeo: string;
  departamento_id: number;
}
interface Distrito {
  id: number;
  distrito: string;
  ubigeo: string;
  provincia_id: number;
  departamento_id: number;
}

export interface DireccionSeleccionada {
  tipo: TipoOpcion;
  ubigeo: string;
  direccionLineal: string;
  departamento: string;
  provincia: string;
  distrito: string;
  tipoDireccion: string;
  // Para mostrar en el formulario
  resumen: string;
}

interface Props {
  titulo: string;
  mostrarRemitente: boolean; // false en "Punto de llegada"
  onAgregar: (direccion: DireccionSeleccionada) => void;
  onCerrar: () => void;
}

// ─── Datos ubigeo ─────────────────────────────────────────────────────────────
const departamentos: Departamento[] = (departamentosData as any)
  .ubigeo_departamentos;
const provincias: Provincia[] = (provinciasData as any).ubigeo_provincias;
const distritos: Distrito[] = (distritosData as any).ubigeo_distritos;

const inputClass =
  "w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue/50 outline-none transition-all text-sm";
const selectClass =
  "w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-blue/50 text-sm";
const labelClass = "text-xs font-bold text-gray-500 uppercase";

// ─── Componente ───────────────────────────────────────────────────────────────
export default function ModalPuntoDireccion({
  titulo,
  mostrarRemitente,
  onAgregar,
  onCerrar,
}: Props) {
  const { accessToken, user } = useAuth();

  const [opcion, setOpcion] = useState<TipoOpcion>(
    mostrarRemitente ? "remitente" : "tercero",
  );

  // — Opción 1: Establecimiento del remitente
  const [empresa, setEmpresa] = useState<any>(null);
  const [loadingEmpresa, setLoadingEmpresa] = useState(false);

  // — Opción 2: Tercero por RUC (apisperu)
  const [terceroRuc, setTerceroRuc] = useState("");
  const [terceroData, setTerceroData] = useState<any>(null);
  const [terceroHint, setTerceroHint] = useState<{
    text: string;
    color: string;
  } | null>(null);
  const [loadingTercero, setLoadingTercero] = useState(false);
  const [terceroBuscar, setTerceroBuscar] = useState("");

  // — Opción 3: Otra dirección (ubigeo en cascada)
  const [deptoId, setDeptoId] = useState<number | null>(null);
  const [provId, setProvId] = useState<number | null>(null);
  const [distId, setDistId] = useState<number | null>(null);
  const [direccionLineal, setDireccionLineal] = useState("");
  const [terceroDireccionEditable, setTerceroDireccionEditable] = useState("");

  // Derivados cascada
  const provinciasFiltradas = deptoId
    ? provincias.filter((p) => p.departamento_id === deptoId)
    : [];
  const distritosFiltrados = provId
    ? distritos.filter((d) => d.provincia_id === provId)
    : [];

  const deptoSel = departamentos.find((d) => d.id === deptoId);
  const provSel = provinciasFiltradas.find((p) => p.id === provId);
  const distSel = distritosFiltrados.find((d) => d.id === distId);

  // ── Opción 1: Cargar empresa ───────────────────────────────────────────────
  useEffect(() => {
    if (opcion !== "remitente" || !user?.ruc || !accessToken) return;
    const fetchEmpresa = async () => {
      setLoadingEmpresa(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/companies/${user.ruc}`,
          {
            headers: { accept: "*/*", Authorization: `Bearer ${accessToken}` },
          },
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        setEmpresa(data);
      } catch {
        setEmpresa(null);
      } finally {
        setLoadingEmpresa(false);
      }
    };
    fetchEmpresa();
  }, [opcion, user?.ruc, accessToken]);

  // handleTerceroRuc actualizado
  const handleTerceroRuc = async (val: string) => {
    setTerceroRuc(val);
    setTerceroData(null);
    setTerceroDireccionEditable("");
    setTerceroHint(null);

    if (val.length === 11) {
      setLoadingTercero(true);
      setTerceroHint({ text: "Consultando RUC...", color: "#185FA5" });
      try {
        const data = await consultaRuc(val);
        if (data) {
          setTerceroData(data);
          setTerceroDireccionEditable(data.direccionLineal ?? "");
          setTerceroHint({ text: `✓ ${data.razonSocial}`, color: "#15803d" });
        } else {
          setTerceroHint({ text: "RUC no encontrado", color: "#DC2626" });
        }
      } catch {
        setTerceroHint({ text: "Error al consultar", color: "#DC2626" });
      } finally {
        setLoadingTercero(false);
      }
    } else if (val.length > 0) {
      setTerceroHint({ text: `${val.length}/11 dígitos`, color: "#B45309" });
    }
  };

  // Filtrar establecimientos del tercero por búsqueda
  const establecimientosTercero = terceroData
    ? [
        {
          tipo: "DOMICILIO FISCAL",
          ubigeo: terceroData.ubigeo,
          domicilio: terceroData.direccion,
        },
      ]
    : [];

  const establecimientosFiltrados = terceroBuscar
    ? establecimientosTercero.filter(
        (e) =>
          e.domicilio?.toLowerCase().includes(terceroBuscar.toLowerCase()) ||
          e.tipo?.toLowerCase().includes(terceroBuscar.toLowerCase()),
      )
    : establecimientosTercero;

  // ── Validación y submit ───────────────────────────────────────────────────
  const puedeAgregar = (() => {
    if (opcion === "remitente") return !!empresa;
    if (opcion === "tercero")
      return !!terceroData && !!terceroDireccionEditable.trim();
    if (opcion === "otra")
      return !!deptoSel && !!provSel && !!distSel && !!direccionLineal.trim();
    return false;
  })();

  const handleAgregar = () => {
    let resultado: DireccionSeleccionada;

    if (opcion === "remitente" && empresa) {
      resultado = {
        tipo: "remitente",
        ubigeo: empresa.ubigeo ?? "",
        direccionLineal: empresa.direccion ?? "",
        departamento: empresa.departamento ?? "",
        provincia: empresa.provincia ?? "",
        distrito: empresa.distrito ?? "",
        tipoDireccion: "DOMICILIO FISCAL",
        resumen: empresa.direccion ?? "",
      };
    } else if (opcion === "tercero" && terceroData) {
      resultado = {
        tipo: "tercero",
        ubigeo: terceroData.ubigeo ?? "",
        direccionLineal: terceroDireccionEditable.trim(),
        departamento: terceroData.departamento ?? "",
        provincia: terceroData.provincia ?? "",
        distrito: terceroData.distrito ?? "",
        tipoDireccion: "DOMICILIO FISCAL",
        resumen: `${terceroData.razonSocial} — ${terceroDireccionEditable.trim()}`,
      };
    } else {
      // Otra dirección
      resultado = {
        tipo: "otra",
        ubigeo: distSel?.ubigeo ?? "",
        direccionLineal: direccionLineal.trim(),
        departamento: deptoSel?.departamento ?? "",
        provincia: provSel?.provincia ?? "",
        distrito: distSel?.distrito ?? "",
        tipoDireccion: "OTRA DIRECCIÓN",
        resumen: `${direccionLineal} - ${deptoSel?.departamento} - ${provSel?.provincia} - ${distSel?.distrito}`,
      };
    }

    onAgregar(resultado);
    onCerrar();
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h4 className="text-base font-bold text-gray-900">{titulo}</h4>
          <button
            type="button"
            onClick={onCerrar}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Opciones radio */}
          <div className="space-y-2">
            {mostrarRemitente && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="opcion"
                  checked={opcion === "remitente"}
                  onChange={() => setOpcion("remitente")}
                  className="accent-brand-blue"
                />
                <span className="text-sm text-gray-700">
                  Establecimiento del Remitente
                </span>
              </label>
            )}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="opcion"
                checked={opcion === "tercero"}
                onChange={() => setOpcion("tercero")}
                className="accent-brand-blue"
              />
              <span className="text-sm text-gray-700">
                Establecimiento de un tercero inscrito en el RUC
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="opcion"
                checked={opcion === "otra"}
                onChange={() => setOpcion("otra")}
                className="accent-brand-blue"
              />
              <span className="text-sm text-gray-700">Otra dirección</span>
            </label>
          </div>

          {/* ── Opción 1: Establecimiento del Remitente ─────────────────── */}
          {opcion === "remitente" && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase">
                Seleccione un establecimiento
              </p>
              {loadingEmpresa ? (
                <div className="py-6 text-center text-sm text-gray-400">
                  Cargando...
                </div>
              ) : empresa ? (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">
                          Tipo
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">
                          Ubigeo
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">
                          Domicilio
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="hover:bg-gray-50">
                        <td className="px-3 py-3 text-gray-700 font-medium">
                          DOMICILIO FISCAL
                        </td>
                        <td className="px-3 py-3 text-gray-500 font-mono text-xs">
                          {empresa.ubigeo}
                        </td>
                        <td className="px-3 py-3 text-gray-700 text-xs leading-relaxed">
                          {empresa.direccion}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-red-400">
                  No se pudo cargar la información de la empresa.
                </div>
              )}
            </div>
          )}

          {/* ── Opción 2: Tercero por RUC ───────────────────────────────── */}
          {opcion === "tercero" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className={labelClass}>Número de RUC</label>
                <input
                  type="text"
                  placeholder="Ingresa RUC de 11 dígitos..."
                  value={terceroRuc}
                  maxLength={11}
                  onChange={(e) =>
                    handleTerceroRuc(e.target.value.replace(/\D/g, ""))
                  }
                  className={inputClass}
                />
              </div>

              {/* Dirección encontrada — tarjeta simple */}
              {terceroData && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase">
                    Domicilio fiscal
                  </p>
                  <p className="text-sm font-medium text-gray-800">
                    {terceroData.razonSocial}
                  </p>
                  <p className="text-xs text-gray-500 font-mono">
                    {terceroData.ubigeo}
                  </p>
                  <input
                    type="text"
                    placeholder="Escribe la dirección manualmente..."
                    value={terceroDireccionEditable}
                    onChange={(e) =>
                      setTerceroDireccionEditable(e.target.value)
                    }
                    className={inputClass}
                  />
                  {!terceroDireccionEditable && (
                    <p className="text-xs text-amber-600">
                      Sin dirección registrada — ingrésala manualmente.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Opción 3: Otra dirección ─────────────────────────────────── */}
          {opcion === "otra" && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-700">
                Ingrese una dirección
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Departamento */}
                <div className="space-y-1.5">
                  <label className={labelClass}>Departamento</label>
                  <select
                    className={selectClass}
                    value={deptoId ?? ""}
                    onChange={(e) => {
                      setDeptoId(Number(e.target.value) || null);
                      setProvId(null);
                      setDistId(null);
                    }}
                  >
                    <option value="">Seleccionar...</option>
                    {departamentos.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.departamento}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Provincia */}
                <div className="space-y-1.5">
                  <label className={labelClass}>Provincia</label>
                  <select
                    className={selectClass}
                    value={provId ?? ""}
                    disabled={!deptoId}
                    onChange={(e) => {
                      setProvId(Number(e.target.value) || null);
                      setDistId(null);
                    }}
                  >
                    <option value="">Seleccionar...</option>
                    {provinciasFiltradas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.provincia}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Distrito */}
                <div className="space-y-1.5 col-span-2">
                  <label className={labelClass}>Distrito</label>
                  <select
                    className={selectClass}
                    value={distId ?? ""}
                    disabled={!provId}
                    onChange={(e) => setDistId(Number(e.target.value) || null)}
                  >
                    <option value="">Seleccionar...</option>
                    {distritosFiltrados.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.distrito}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dirección detallada */}
                <div className="space-y-1.5 col-span-2">
                  <label className={labelClass}>Dirección detallada</label>
                  <input
                    type="text"
                    placeholder="Av., Calle, Manzana, Lote..."
                    value={direccionLineal}
                    onChange={(e) => setDireccionLineal(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Ubigeo generado */}
              {distSel && (
                <p className="text-xs text-gray-400 pl-1">
                  Ubigeo:{" "}
                  <span className="font-mono text-gray-600">
                    {distSel.ubigeo}
                  </span>
                </p>
              )}
            </div>
          )}
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
