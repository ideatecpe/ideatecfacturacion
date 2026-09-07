"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  Lock,
  ChevronLeft,
  ChevronRight,
  Calendar,
  FileText,
  Ban,
  Receipt,
  TrendingUp,
  Hash,
  RotateCcw,
  Minus,
  Plus,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { useToast } from "@/app/components/ui/Toast";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { fmtMonto } from "@/app/components/ui/formatoFecha";
import { useComprobantesSucursalListado } from "@/app/factufly/comprobantes/gestionComprobantes/gestionComprobantesLista/UseComprobantesSucursalListado";
import { useComprobanteDetalles } from "@/app/factufly/comprobantes/gestionComprobantes/gestionComprobantesLista/UseComprobanteDetalles";
import { useUsuariosReporte } from "@/app/factufly/reportes/gestionReportes/UseUsuariosReporte";
import {
  tipoLabel,
  formatFecha,
  COLORS,
} from "@/app/factufly/comprobantes/gestionComprobantes/helpers";
import type {
  ComprobanteListado,
  ComprobanteDetalleItem,
} from "@/app/factufly/comprobantes/gestionComprobantes/Comprobante";

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const sumarDias = (fechaISO: string, dias: number) => {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const fecha = new Date(y, m - 1, d);
  fecha.setDate(fecha.getDate() + dias);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
};

const fechaLarga = (fechaISO: string) => {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const fecha = new Date(y, m - 1, d);
  const texto = fecha.toLocaleDateString("es-PE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

const soles = (n: number, moneda = "PEN") =>
  `${moneda === "USD" ? "$" : "S/"} ${fmtMonto(n)}`;

// Muestra la hora tal cual viene de la BD (sin conversión de zona horaria), en formato 24h.
const horaCruda = (fechaISO: string) => {
  const match = fechaISO.match(/T?(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : fechaISO;
};

export default function VentasDelDiaPage() {
  const { user, accessToken } = useAuth();
  const { config, loading: loadingConfig } = useConfiguracion();
  const { showToast } = useToast();
  const router = useRouter();

  const sucursalId = user?.sucursalID ? Number(user.sucursalID) : null;
  // El facturador solo ve sus propias ventas, no las de otros cajeros.
  const esFacturador = user?.rol === "facturador";

  const [fecha, setFecha] = useState(hoyISO());
  const [usuarioId, setUsuarioId] = useState<number | null>(null);
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null);

  const { comprobantes, loading, fetchComprobantes } =
    useComprobantesSucursalListado();
  const {
    detalles,
    loading: loadingDetalle,
    fetchDetalles,
    reset: resetDetalles,
  } = useComprobanteDetalles();
  const { usuarios, fetchUsuarios } = useUsuariosReporte();

  useEffect(() => {
    fetchUsuarios();
  }, [fetchUsuarios]);

  const filtroUsuarioId = esFacturador
    ? user?.id
      ? Number(user.id)
      : null
    : usuarioId;

  const cargar = useCallback(() => {
    if (!sucursalId) return;
    fetchComprobantes({
      sucursalId,
      fechaDesde: `${fecha}T00:00:00`,
      fechaHasta: `${fecha}T23:59:59`,
      usuarioId: filtroUsuarioId,
      limit: 200,
    });
  }, [sucursalId, fecha, filtroUsuarioId, fetchComprobantes]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    setSeleccionadoId(null);
    resetDetalles();
  }, [fecha, filtroUsuarioId, resetDetalles]);

  const seleccionar = (doc: ComprobanteListado) => {
    setSeleccionadoId(doc.comprobanteId);
    fetchDetalles(doc.comprobanteId);
  };

  const seleccionado =
    comprobantes.find((c) => c.comprobanteId === seleccionadoId) ?? null;

  const resumen = useMemo(() => {
    // Una nota de crédito/débito (07/08) no es una venta nueva: es un ajuste sobre un
    // comprobante ya emitido (a menudo ya ANULADO), y nunca tiene un pago propio. Sumarla aquí
    // infla el TOTAL muy por encima de lo que realmente se cobró ese día (efectivo+tarjeta+yape).
    const vigentes = comprobantes.filter(
      (c) => c.estadoSunat !== "ANULADO" && c.tipoComprobante !== "07" && c.tipoComprobante !== "08",
    );
    const totalesPorMoneda = new Map<string, number>();
    for (const c of vigentes) {
      const moneda = c.tipoMoneda ?? "PEN";
      totalesPorMoneda.set(moneda, (totalesPorMoneda.get(moneda) ?? 0) + c.importeTotal);
    }
    return {
      cantidad: vigentes.length,
      totales: Array.from(totalesPorMoneda.entries()),
    };
  }, [comprobantes]);

  const nombreCajero = useMemo(() => {
    if (!seleccionado?.usuarioCreacion) return "—";
    const u = usuarios.find(
      (x) => x.usuarioID === seleccionado.usuarioCreacion,
    );
    return u?.username ?? `Usuario ${seleccionado.usuarioCreacion}`;
  }, [seleccionado, usuarios]);

  const generarNotaCredito = (c: ComprobanteListado) => {
    router.push(
      `/factufly/operaciones/nota-credito?serie=${c.serie}&correlativo=${c.correlativo}&ruc=${c.company.numeroDocumento}&establecimiento=${c.company.establecimientoAnexo}`,
    );
  };

  const [confirmAnularNV, setConfirmAnularNV] =
    useState<ComprobanteListado | null>(null);
  const [anulandoNV, setAnulandoNV] = useState(false);

  const anularNotaVenta = async () => {
    if (!confirmAnularNV) return;
    setAnulandoNV(true);
    try {
      const uid = user?.id ? Number(user.id) : undefined;
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/NotaVenta/${confirmAnularNV.comprobanteId}/anular`,
        { usuarioId: Number.isFinite(uid) ? uid : null },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      showToast("Nota de venta anulada correctamente", "success");
      setConfirmAnularNV(null);
      cargar();
    } catch (err) {
      const mensaje =
        axios.isAxiosError(err) && err.response?.data?.mensaje
          ? err.response.data.mensaje
          : "Error al anular la nota de venta";
      showToast(mensaje, "error");
    } finally {
      setAnulandoNV(false);
    }
  };

  const [itemADevolver, setItemADevolver] =
    useState<ComprobanteDetalleItem | null>(null);
  const [cantidadADevolver, setCantidadADevolver] = useState(1);
  const [devolviendoItem, setDevolviendoItem] = useState(false);

  const abrirDevolverItem = (item: ComprobanteDetalleItem) => {
    setItemADevolver(item);
    setCantidadADevolver(1);
  };

  const devolverItem = async () => {
    if (!itemADevolver || !seleccionado) return;
    setDevolviendoItem(true);
    try {
      const uid = user?.id ? Number(user.id) : undefined;
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/NotaVenta/${seleccionado.comprobanteId}/detalle/${itemADevolver.detalleId}/devolver`,
        {
          cantidad: cantidadADevolver,
          usuarioId: Number.isFinite(uid) ? uid : null,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      showToast("Artículo devuelto correctamente", "success");
      setItemADevolver(null);
      await fetchDetalles(seleccionado.comprobanteId);
      cargar();
    } catch (err) {
      const mensaje =
        axios.isAxiosError(err) && err.response?.data?.mensaje
          ? err.response.data.mensaje
          : "Error al devolver el artículo";
      showToast(mensaje, "error");
    } finally {
      setDevolviendoItem(false);
    }
  };

  if (loadingConfig) return null;

  if (!config?.administraCaja) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="max-w-sm text-center space-y-2">
          <Lock className="w-8 h-8 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-gray-800">
            Módulo no habilitado
          </h3>
          <p className="text-xs text-gray-500">
            Activa &quot;Administrar apertura/cierres de caja&quot; en Empresa →
            Configuración.
          </p>
        </div>
      </div>
    );
  }

  const esFacturaOBoleta =
    seleccionado?.tipoComprobante === "01" ||
    seleccionado?.tipoComprobante === "03";
  const esNotaVenta = seleccionado?.tipoComprobante === "NV";
  const estaAnulada = seleccionado?.estadoSunat === "ANULADO";

  return (
    <div className="space-y-2.5 h-full flex flex-col">
      {/* Filtros + resumen */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Día:
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFecha((f) => sumarDias(f, -1))}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
                title="Día anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <label className="flex items-center gap-1.5 h-8 px-2.5 bg-gray-50 border border-gray-200 rounded-lg focus-within:border-brand-blue/50 focus-within:ring-2 focus-within:ring-brand-blue/10 transition-colors cursor-pointer">
                <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => e.target.value && setFecha(e.target.value)}
                  className="text-xs font-semibold text-gray-700 bg-transparent outline-none cursor-pointer"
                />
              </label>
              <button
                type="button"
                onClick={() => setFecha((f) => sumarDias(f, 1))}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
                title="Día siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!esFacturador && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Cajero:
              </span>
              <select
                value={usuarioId ?? ""}
                onChange={(e) =>
                  setUsuarioId(e.target.value ? Number(e.target.value) : null)
                }
                className="h-8 px-2.5 text-xs font-medium bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/10 transition-colors min-w-[170px]"
              >
                <option value="">Todos los cajeros</option>
                {usuarios.map((u) => (
                  <option key={u.usuarioID} value={u.usuarioID}>
                    {u.username}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Resumen: cantidad y total de ventas filtradas */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-2 h-9 pl-2.5 pr-3 rounded-lg border border-gray-100 bg-gray-50">
            <div className="h-6 w-6 rounded-md flex items-center justify-center shrink-0 bg-white border border-gray-200">
              <Hash className="w-3 h-3 text-gray-400" />
            </div>
            <div className="leading-tight">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">
                Ventas
              </p>
              <p className="text-xs font-bold text-gray-800 tabular-nums">
                {loading ? "—" : resumen.cantidad}
              </p>
            </div>
          </div>

          <div
            className="flex items-center gap-2 h-9 pl-2.5 pr-3 rounded-lg"
            style={{ background: "rgba(15,46,100,0.06)" }}
          >
            <div
              className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
              style={{ background: "rgba(15,46,100,0.12)" }}
            >
              <TrendingUp
                className="w-3 h-3"
                style={{ color: "#0f2e64" }}
              />
            </div>
            <div className="leading-tight">
              <p
                className="text-[9px] font-bold uppercase tracking-wide"
                style={{ color: "#0f2e64", opacity: 0.7 }}
              >
                Total
              </p>
              {loading ? (
                <p className="text-xs font-bold" style={{ color: "#0f2e64" }}>
                  —
                </p>
              ) : resumen.totales.length === 0 ? (
                <p
                  className="text-xs font-bold tabular-nums"
                  style={{ color: "#0f2e64" }}
                >
                  {soles(0)}
                </p>
              ) : (
                resumen.totales.map(([moneda, total]) => (
                  <p
                    key={moneda}
                    className="text-xs font-bold tabular-nums"
                    style={{ color: "#0f2e64" }}
                  >
                    {soles(total, moneda)}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-medium text-gray-500">
          {fechaLarga(fecha)}
        </p>
      </div>

      {/* Maestro-detalle */}
      <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-[1fr_320px] gap-2.5 items-start">
        {/* Lista */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-xs">
          <div>
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 z-10 border-b border-gray-100">
                <tr className="text-gray-500 uppercase text-[10px]">
                  <th className="text-left font-bold px-3 py-2">Folio</th>
                  <th className="text-center font-bold px-3 py-2">Arts</th>
                  <th className="text-left font-bold px-3 py-2">Hora</th>
                  <th className="text-right font-bold px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-10 text-center text-gray-400 text-xs"
                    >
                      Cargando…
                    </td>
                  </tr>
                )}
                {!loading && comprobantes.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-10 text-center text-gray-400 text-xs"
                    >
                      <Receipt className="w-5 h-5 text-gray-300 mx-auto mb-1.5" />
                      Sin ventas con estos filtros
                    </td>
                  </tr>
                )}
                {!loading &&
                  comprobantes.map((doc) => {
                    const activo = doc.comprobanteId === seleccionadoId;
                    const anulado = doc.estadoSunat === "ANULADO";
                    return (
                      <tr
                        key={doc.comprobanteId}
                        onClick={() => seleccionar(doc)}
                        className={`cursor-pointer transition-colors ${activo ? "bg-blue-50" : "hover:bg-gray-50"} ${anulado ? "opacity-50" : ""}`}
                      >
                        <td className="px-3 py-2">
                          <p className="font-semibold text-gray-800 uppercase text-xs">
                            {doc.numeroCompleto}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {tipoLabel(doc.tipoComprobante)}
                            {anulado ? " · Anulado" : ""}
                          </p>
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600 tabular-nums text-xs">
                          {doc.cantidadItems ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap tabular-nums text-xs">
                          {horaCruda(doc.horaEmision)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <p
                            className={`font-semibold tabular-nums text-xs ${anulado ? "text-gray-400 line-through" : "text-gray-800"}`}
                          >
                            {soles(doc.importeTotal, doc.tipoMoneda)}
                          </p>
                          {(doc.totalComisionPagoTarjeta ?? 0) > 0 && (
                            <p className="text-[10px] text-cyan-600 tabular-nums">
                              +{" "}
                              {soles(
                                doc.totalComisionPagoTarjeta!,
                                doc.tipoMoneda,
                              )}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detalle: fijo mientras se hace scroll en la lista */}
        <div
          key={seleccionado?.comprobanteId ?? "vacio"}
          className="rounded-xl border border-gray-200 bg-white overflow-y-auto sticky top-3 max-h-[calc(100vh-6rem)] shadow-xs"
        >
          {!seleccionado && (
            <div className="h-full flex items-center justify-center py-12 px-3">
              <div className="text-center space-y-1.5">
                <Receipt className="w-6 h-6 text-gray-300 mx-auto" />
                <p className="text-xs text-gray-400">
                  Selecciona un comprobante para ver el detalle
                </p>
              </div>
            </div>
          )}

          {seleccionado && (
            <div className="p-3.5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs sm:text-sm font-bold text-gray-800 uppercase">
                    {seleccionado.numeroCompleto}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {tipoLabel(seleccionado.tipoComprobante)} ·{" "}
                    {formatFecha(seleccionado.fechaEmision)}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${(COLORS.sunat as Record<string, { badge: string }>)[seleccionado.estadoSunat]?.badge ?? "bg-gray-50 text-gray-500 border-gray-200"}`}
                >
                  {seleccionado.estadoSunat}
                </span>
              </div>

              <div className="space-y-0.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400 text-[11px]">Cajero</span>
                  <span className="text-gray-700 font-medium text-xs">
                    {nombreCajero}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-[11px]">Cliente</span>
                  <span className="text-gray-700 font-medium text-right text-xs">
                    {seleccionado.cliente?.razonSocial || "Cliente varios"}
                  </span>
                </div>
              </div>

              {loadingDetalle && (
                <p className="text-xs text-gray-400 py-3 text-center">
                  Cargando detalle…
                </p>
              )}

              {!loadingDetalle &&
                detalles &&
                detalles.comprobanteId === seleccionado.comprobanteId && (
                  <>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                        Artículos
                      </p>
                      <div className="rounded-lg border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                        {detalles.details
                          .filter((item) => item.cantidad > 0)
                          .map((item, i) => (
                            <div
                              key={`${item.detalleId}-${i}`}
                              className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                {esNotaVenta && !estaAnulada && (
                                  <button
                                    type="button"
                                    onClick={() => abrirDevolverItem(item)}
                                    className="h-5 w-5 flex items-center justify-center rounded shrink-0 text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="Devolver artículo"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                  </button>
                                )}
                                <div className="min-w-0">
                                  <p className="text-gray-700 truncate text-[11px]">
                                    {item.descripcion}
                                  </p>
                                  <p className="text-[10px] text-gray-400">
                                    x{item.cantidad}
                                  </p>
                                </div>
                              </div>
                              <span className="font-medium text-gray-800 tabular-nums shrink-0 text-xs">
                                {soles(
                                  item.totalVentaItem,
                                  seleccionado.tipoMoneda,
                                )}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                        Medio de pago
                      </p>
                      <div className="space-y-0.5">
                        {detalles.pagos.map((p, i) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="text-gray-500 text-[11px]">{p.medioPago}</span>
                            <span className="text-gray-700 font-medium tabular-nums text-xs">
                              {soles(p.monto, seleccionado.tipoMoneda)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

              <div
                className="flex items-center justify-between px-2.5 py-2 rounded-lg"
                style={{ background: "rgba(15,46,100,0.06)" }}
              >
                <span
                  className="text-xs font-bold"
                  style={{ color: "#0f2e64" }}
                >
                  Total
                </span>
                <span
                  className="text-sm font-bold tabular-nums"
                  style={{ color: "#0f2e64" }}
                >
                  {soles(seleccionado.importeTotal, seleccionado.tipoMoneda)}
                </span>
              </div>

              <div className="flex flex-col gap-1.5 pt-0.5">
                {esFacturaOBoleta && (
                  <Button
                    variant="outline"
                    onClick={() => generarNotaCredito(seleccionado)}
                    className="text-xs! py-1.5!"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Generar Nota de Crédito
                  </Button>
                )}
                {esNotaVenta && !estaAnulada && (
                  <Button
                    variant="danger"
                    onClick={() => setConfirmAnularNV(seleccionado)}
                    className="text-xs! py-1.5!"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Anular venta
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={!!confirmAnularNV}
        onClose={() => setConfirmAnularNV(null)}
        title="Anular nota de venta"
        className="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            ¿Confirmas anular la nota de venta{" "}
            <b>{confirmAnularNV?.numeroCompleto}</b>? Esta acción devuelve el
            stock vendido.
          </p>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setConfirmAnularNV(null)}
              disabled={anulandoNV}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={anularNotaVenta}
              disabled={anulandoNV}
            >
              {anulandoNV ? "Anulando…" : "Anular venta"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!itemADevolver}
        onClose={() => setItemADevolver(null)}
        title="Devolver artículo"
        className="max-w-sm"
      >
        {itemADevolver && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                {itemADevolver.descripcion}
              </p>
              <p className="text-xs text-gray-400">
                Cantidad vendida: {itemADevolver.cantidad}
              </p>
            </div>

            {itemADevolver.cantidad > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Cantidad a devolver
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCantidadADevolver((c) => Math.max(1, c - 1))
                    }
                    disabled={cantidadADevolver <= 1}
                    className="h-7 w-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums">
                    {cantidadADevolver}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCantidadADevolver((c) =>
                        Math.min(itemADevolver.cantidad, c + 1),
                      )
                    }
                    disabled={cantidadADevolver >= itemADevolver.cantidad}
                    className="h-7 w-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            <p className="text-sm text-gray-600">
              ¿Confirmas devolver{" "}
              <b>
                {cantidadADevolver} unidad
                {cantidadADevolver > 1 ? "es" : ""}
              </b>{" "}
              de <b>{itemADevolver.descripcion}</b>? Esta acción devuelve el
              stock y actualiza el total de la nota de venta.
            </p>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setItemADevolver(null)}
                disabled={devolviendoItem}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={devolverItem}
                disabled={devolviendoItem}
              >
                {devolviendoItem ? "Devolviendo…" : "Devolver"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
