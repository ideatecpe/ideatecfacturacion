"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/app/components/ui/Button";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface DocumentoRelacionado {
  tipoDocumento: string;
  tipoDocumentoLabel: string;
  serie?: string;
  numero: string;
  numeroCompleto: string;
  // Bienes precargados del comprobante (solo Factura/Boleta/Notas)
  detalles?: DetalleComprobante[];
}

export interface DetalleComprobante {
  productoId: number;
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidadMedida: string;
}

interface Props {
  ruc: string;
  accessToken: string;
  userRol: string;
  sucursalID: number;
  onAgregar: (documento: DocumentoRelacionado) => void;
  onCerrar: () => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPOS_DOCUMENTO = [
  { codigo: "01", label: "Factura", requiereSerie: true, consultaApi: true },
  {
    codigo: "03",
    label: "Boleta de Venta",
    requiereSerie: true,
    consultaApi: true,
  },
  {
    codigo: "09",
    label: "Guía de Remisión Remitente",
    requiereSerie: true,
    consultaApi: true,
  },
  {
    codigo: "40",
    label: "Constancia de Depósito - Detracción",
    requiereSerie: false,
    consultaApi: false,
  },
  {
    codigo: "99",
    label: "Constancia de Depósito - IVAP (Ley 28211)",
    requiereSerie: false,
    consultaApi: false,
  },
];

const inputClass =
  "w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue/50 outline-none transition-all text-sm";
const selectClass =
  "w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-blue/50 text-sm";
const labelClass = "text-xs font-bold text-gray-500 uppercase";

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ModalDocumentoRelacionado({
  ruc,
  accessToken,
  userRol,
  sucursalID,
  onAgregar,
  onCerrar,
}: Props) {
  const [tipoCodigo, setTipoCodigo] = useState("");
  const [serie, setSerie] = useState("");
  const [numero, setNumero] = useState("");
  const [comprobante, setComprobante] = useState<any>(null);
  const [hint, setHint] = useState<{ text: string; color: string } | null>(
    null,
  );
  const [loadingComprobante, setLoadingComprobante] = useState(false);

  const tipoSeleccionado = TIPOS_DOCUMENTO.find((t) => t.codigo === tipoCodigo);

  const isSuperAdmin = userRol === "superadmin";

  // Series dinámicas
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [sucursalSeleccionadaId, setSucursalSeleccionadaId] =
    useState<string>("");
  const [loadingSeries, setLoadingSeries] = useState(false);

  function getSerieParaTipo(tipoCodigo: string, sucursal: any): string {
    if (tipoCodigo === "01") return sucursal.serieFactura ?? "";
    if (tipoCodigo === "03") return sucursal.serieBoleta ?? "";
    if (tipoCodigo === "09") return sucursal.serieGuia ?? "";
    return "";
  }

  useEffect(() => {
    if (!tipoCodigo || !ruc || !accessToken) return;

    const fetchSucursales = async () => {
      setLoadingSeries(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Sucursal?ruc=${ruc}${!isSuperAdmin ? `&sucursalID=${sucursalID}` : ""}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!res.ok) throw new Error();
        const raw = await res.json();
        const data = raw.map((s: any) => ({
          id: s.sucursalId.toString(),
          nombre: s.nombre ?? s.codEstablecimiento,
          serieFactura: s.serieFactura,
          serieBoleta: s.serieBoleta,
          serieGuia: s.serieGuiaRemision,
        }));
        setSucursales(data);

        // Preseleccionar la sucursal del usuario (o la primera si superadmin)
        const preselect = isSuperAdmin
          ? (data[0]?.id ?? "")
          : sucursalID.toString();
        setSucursalSeleccionadaId(preselect);

        // Precargar la serie correspondiente al tipo
        const found = data.find((s: any) => s.id === preselect);
        if (found) setSerie(getSerieParaTipo(tipoCodigo, found));
      } catch {
        // silencioso, el usuario puede tipear la serie manualmente
      } finally {
        setLoadingSeries(false);
      }
    };

    fetchSucursales();
  }, [tipoCodigo]);

  // — Reset al cambiar tipo
  const handleTipo = (codigo: string) => {
    setTipoCodigo(codigo);
    setSerie("");
    setNumero("");
    setComprobante(null);
    setHint(null);
  };

  // — Consultar comprobante al completar número (solo si consultaApi = true)
  const handleNumero = async (val: string) => {
    setNumero(val);
    setComprobante(null);
    setHint(null);

    if (!tipoSeleccionado?.consultaApi) return;
    if (!serie.trim()) {
      setHint({ text: "Ingresa la serie primero", color: "#B45309" });
      return;
    }
    if (val.length < 1) return;

    setLoadingComprobante(true);
    setHint({ text: "Consultando...", color: "#185FA5" });
    try {
      // — Guía de remisión remitente → API de guías
      if (tipoCodigo === "09") {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/guias/${ruc}/${serie.trim()}/${val.trim()}`,
          {
            headers: { accept: "*/*", Authorization: `Bearer ${accessToken}` },
          },
        );
        if (res.status === 404) {
          setHint({ text: "Guía no encontrada", color: "#DC2626" });
          return;
        }
        if (!res.ok) throw new Error();
        const data = await res.json();
        setComprobante(data);
        setHint({ text: `✓ ${data.numeroCompleto}`, color: "#15803d" });
        return;
      }

      // — Factura, Boleta, Notas → API de comprobantes
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${ruc}/${serie.trim()}/${val.trim()}`,
        { headers: { accept: "*/*", Authorization: `Bearer ${accessToken}` } },
      );
      if (res.status === 404) {
        setHint({ text: "Comprobante no encontrado", color: "#DC2626" });
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setComprobante(data);
      setHint({
        text: `✓ ${data.numeroCompleto} — ${data.cliente?.razonSocial ?? ""}`,
        color: "#15803d",
      });
    } catch {
      setHint({ text: "Error al consultar", color: "#DC2626" });
    } finally {
      setLoadingComprobante(false);
    }
  };

  // — Validación
  const puedeAgregar = (() => {
    if (!tipoCodigo) return false;
    if (!tipoSeleccionado) return false;
    if (tipoSeleccionado.requiereSerie && !serie.trim()) return false;
    if (!numero.trim()) return false;
    // Si consultaApi, debe haber encontrado el comprobante
    if (tipoSeleccionado.consultaApi && !comprobante) return false;
    return true;
  })();

  const handleAgregar = () => {
    if (!tipoSeleccionado) return;

    const numeroCompleto = tipoSeleccionado.requiereSerie
      ? `${serie.trim()}-${numero.trim().padStart(8, "0")}`
      : numero.trim();

    const detalles: DetalleComprobante[] =
      tipoCodigo === "09"
        ? (comprobante?.details?.map((d: any) => ({
            productoId: 0,
            codigo: d.codigo ?? "",
            descripcion: d.descripcion,
            cantidad: d.cantidad,
            unidadMedida: d.unidad,
          })) ?? [])
        : (comprobante?.details?.map((d: any) => ({
            productoId: d.productoId,
            codigo: d.codigo,
            descripcion: d.descripcion,
            cantidad: d.cantidad,
            unidadMedida: d.unidadMedida,
          })) ?? []);

    onAgregar({
      tipoDocumento: tipoCodigo,
      tipoDocumentoLabel: tipoSeleccionado.label,
      serie: tipoSeleccionado.requiereSerie ? serie.trim() : undefined,
      numero: numero.trim(),
      numeroCompleto,
      detalles: detalles.length > 0 ? detalles : undefined,
    });
    onCerrar();
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h4 className="text-base font-bold text-gray-900">
            Agregar Documento
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
          {/* Tipo de documento */}
          <div className="space-y-1.5">
            <label className={labelClass}>Tipo de documento relacionado</label>
            <select
              className={selectClass}
              value={tipoCodigo}
              onChange={(e) => handleTipo(e.target.value)}
            >
              <option value="">Seleccione...</option>
              {TIPOS_DOCUMENTO.map((t) => (
                <option key={t.codigo} value={t.codigo}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Serie + Número */}
          {tipoCodigo && (
            <div
              className={`grid gap-3 ${tipoSeleccionado?.requiereSerie ? "grid-cols-2" : "grid-cols-1"}`}
            >
              {tipoSeleccionado?.requiereSerie && (
                <div className="space-y-1.5">
                  <label className={labelClass}>Serie</label>
                  {loadingSeries ? (
                    <div
                      className={`${inputClass} animate-pulse text-gray-400`}
                    >
                      Cargando...
                    </div>
                  ) : isSuperAdmin && sucursales.length > 1 ? (
                    <select
                      className={selectClass}
                      value={sucursalSeleccionadaId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSucursalSeleccionadaId(id);
                        const found = sucursales.find((s) => s.id === id);
                        if (found) {
                          setSerie(getSerieParaTipo(tipoCodigo, found));
                          setComprobante(null);
                          setHint(null);
                        }
                      }}
                    >
                      {sucursales.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre} — {getSerieParaTipo(tipoCodigo, s)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Ej. F001"
                      value={serie}
                      maxLength={4}
                      onChange={(e) => {
                        setSerie(e.target.value.toUpperCase());
                        setComprobante(null);
                        setHint(null);
                      }}
                      className={inputClass}
                    />
                  )}
                </div>
              )}
              <div className="space-y-1.5">
                <label className={labelClass}>Número</label>
                <input
                  type="text"
                  placeholder={
                    tipoSeleccionado?.requiereSerie
                      ? "Ej. 01"
                      : "Número de constancia"
                  }
                  value={numero}
                  onChange={(e) =>
                    handleNumero(e.target.value.replace(/\D/g, ""))
                  }
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* Hint de estado */}
          {hint && (
            <p className="text-xs pl-1" style={{ color: hint.color }}>
              {loadingComprobante ? "Consultando..." : hint.text}
            </p>
          )}

          {/* Comprobante encontrado */}
          {comprobante && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-800">
                  {comprobante.numeroCompleto}
                </p>
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                  {comprobante.estadoSunat}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {comprobante.cliente?.razonSocial}
              </p>
              {comprobante.details?.length > 0 && (
                <p className="text-xs text-brand-blue mt-1">
                  {comprobante.details.length} bien(es) se precargarán en la
                  tabla de productos
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
            type="button"
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
