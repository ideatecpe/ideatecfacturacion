"use client";
import { useState, useEffect } from "react";
import { X, Search } from "lucide-react";
import { Button } from "@/app/components/ui/Button";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface BienGuia {
  productoId: number; // 0 si es manual
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidadMedida: string;
  pesoKg: number;
}

interface ProductoCatalogo {
  productoId: number;
  codigo: string;
  nomProducto: string;
  unidadMedida: string;
  tipoProducto: string;
}

interface Props {
  sucursalID: string | number;
  accessToken: string;
  onAgregar: (bien: BienGuia) => void;
  onCerrar: () => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const UNIDADES_MEDIDA = [
  { codigo: "NIU", label: "NIU - Unidad" },
  { codigo: "KGM", label: "KGM - Kilogramo" },
  { codigo: "LTR", label: "LTR - Litro" },
  { codigo: "MTR", label: "MTR - Metro" },
  { codigo: "MTQ", label: "MTQ - Metro cúbico" },
  { codigo: "MTK", label: "MTK - Metro cuadrado" },
  { codigo: "BX", label: "BX  - Caja" },
  { codigo: "BG", label: "BG  - Bolsa" },
  { codigo: "CT", label: "CT  - Cartón" },
  { codigo: "DZN", label: "DZN - Docena" },
  { codigo: "GLL", label: "GLL - Galón" },
  { codigo: "TNE", label: "TNE - Tonelada" },
  { codigo: "ZZ", label: "ZZ  - Servicios (otros)" },
];

const inputClass =
  "w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue/50 outline-none transition-all text-sm";
const selectClass =
  "w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-blue/50 text-sm";
const labelClass = "text-xs font-bold text-gray-500 uppercase";

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ModalBienGuia({
  sucursalID,
  accessToken,
  onAgregar,
  onCerrar,
}: Props) {
  const [modo, setModo] = useState<"catalogo" | "manual">("catalogo");

  // — Búsqueda catálogo
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ProductoCatalogo[]>([]);
  const [loadingBusqueda, setLoadingBusqueda] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] =
    useState<ProductoCatalogo | null>(null);

  // — Campos comunes
  const [cantidad, setCantidad] = useState<number | "">(1);
  const [pesoKg, setPesoKg] = useState<number | "">("");

  // — Campos solo manual
  const [codigoManual, setCodigoManual] = useState("");
  const [descripcionManual, setDescripcionManual] = useState("");
  const [unidadManual, setUnidadManual] = useState("NIU");

  // ── Búsqueda con debounce ─────────────────────────────────────────────────
  useEffect(() => {
    if (!query || query.length < 2) {
      setResultados([]);
      return;
    }
    const delay = setTimeout(async () => {
      setLoadingBusqueda(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/productos/buscar/${sucursalID}?palabra=${encodeURIComponent(query)}`,
          {
            headers: { accept: "*/*", Authorization: `Bearer ${accessToken}` },
          },
        );
        if (!res.ok) throw new Error();
        const data: ProductoCatalogo[] = await res.json();
        setResultados(data);
      } catch {
        setResultados([]);
      } finally {
        setLoadingBusqueda(false);
      }
    }, 350);
    return () => clearTimeout(delay);
  }, [query, sucursalID, accessToken]);

  // ── Validación ────────────────────────────────────────────────────────────
  const puedeAgregar = (() => {
    if (!cantidad || Number(cantidad) <= 0) return false;
    if (!pesoKg || Number(pesoKg) <= 0) return false;
    if (modo === "catalogo") return !!productoSeleccionado;
    if (modo === "manual") return !!descripcionManual.trim();
    return false;
  })();

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleAgregar = () => {
    if (modo === "catalogo" && productoSeleccionado) {
      onAgregar({
        productoId: productoSeleccionado.productoId,
        codigo: productoSeleccionado.codigo,
        descripcion: productoSeleccionado.nomProducto,
        cantidad: Number(cantidad),
        unidadMedida: productoSeleccionado.unidadMedida,
        pesoKg: Number(pesoKg),
      });
    } else {
      onAgregar({
        productoId: 0,
        codigo: codigoManual.trim(),
        descripcion: descripcionManual.trim(),
        cantidad: Number(cantidad),
        unidadMedida: unidadManual,
        pesoKg: Number(pesoKg),
      });
    }
    onCerrar();
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h4 className="text-base font-bold text-gray-900">Agregar Bien</h4>
          <button
            type="button"
            onClick={onCerrar}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            type="button"
            onClick={() => {
              setModo("catalogo");
              setProductoSeleccionado(null);
              setQuery("");
            }}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              modo === "catalogo"
                ? "text-brand-blue border-b-2 border-brand-blue"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Buscar en catálogo
          </button>
          <button
            type="button"
            onClick={() => {
              setModo("manual");
              setProductoSeleccionado(null);
            }}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              modo === "manual"
                ? "text-brand-blue border-b-2 border-brand-blue"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Ingresar manualmente
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* ── Modo catálogo ─────────────────────────────────────────────── */}
          {modo === "catalogo" && (
            <div className="space-y-3">
              {productoSeleccionado ? (
                /* Producto seleccionado */
                <div className="flex items-center justify-between px-3 py-3 bg-green-50 border border-green-200 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {productoSeleccionado.nomProducto}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Código: {productoSeleccionado.codigo} ·{" "}
                      {productoSeleccionado.unidadMedida}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProductoSeleccionado(null);
                      setQuery("");
                    }}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors ml-4 shrink-0"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                /* Búsqueda */
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar por nombre o código..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue/50 outline-none transition-all text-sm"
                    />
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>

                  {/* Resultados */}
                  {(resultados.length > 0 || loadingBusqueda) && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      {loadingBusqueda ? (
                        <div className="px-4 py-3 text-sm text-gray-400">
                          Buscando...
                        </div>
                      ) : (
                        resultados.map((p) => (
                          <button
                            key={p.productoId}
                            type="button"
                            onClick={() => {
                              setProductoSeleccionado(p);
                              setQuery("");
                              setResultados([]);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
                          >
                            <p className="text-sm font-medium text-gray-800">
                              {p.nomProducto}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {p.codigo} · {p.unidadMedida} · {p.tipoProducto}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {/* No encontrado — sugerencia de modo manual */}
                  {query.length >= 2 &&
                    !loadingBusqueda &&
                    resultados.length === 0 && (
                      <button
                        type="button"
                        onClick={() => setModo("manual")}
                        className="w-full py-2.5 px-4 text-sm text-brand-blue border border-dashed border-brand-blue/40 rounded-xl hover:bg-brand-blue/5 transition-colors"
                      >
                        No encontrado — Ingresar manualmente
                      </button>
                    )}
                </div>
              )}
            </div>
          )}

          {/* ── Modo manual ───────────────────────────────────────────────── */}
          {modo === "manual" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={labelClass}>
                    Código{" "}
                    <span className="text-gray-400 normal-case font-normal">
                      (opcional)
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. P001"
                    value={codigoManual}
                    onChange={(e) =>
                      setCodigoManual(e.target.value.toUpperCase())
                    }
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Unidad de medida</label>
                  <select
                    className={selectClass}
                    value={unidadManual}
                    onChange={(e) => setUnidadManual(e.target.value)}
                  >
                    {UNIDADES_MEDIDA.map((u) => (
                      <option key={u.codigo} value={u.codigo}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Descripción</label>
                <input
                  type="text"
                  placeholder="Descripción del bien..."
                  value={descripcionManual}
                  onChange={(e) => setDescripcionManual(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* ── Cantidad y peso — campos comunes ─────────────────────────── */}
          {(productoSeleccionado || modo === "manual") && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
              <div className="space-y-1.5">
                <label className={labelClass}>Cantidad</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={cantidad}
                  onChange={(e) =>
                    setCantidad(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>
                  Peso (kg){" "}
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={pesoKg}
                  onChange={(e) =>
                    setPesoKg(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  className={inputClass}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <Button variant="outline" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={!puedeAgregar}
            onClick={handleAgregar}
          >
            Agregar bien
          </Button>
        </div>
      </div>
    </div>
  );
}
