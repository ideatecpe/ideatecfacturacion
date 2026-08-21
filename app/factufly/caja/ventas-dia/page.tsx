"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  Banknote, Lock, ChevronLeft, ChevronRight, Calendar, RefreshCw, FileText, Ban, Receipt,
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
import { tipoLabel, formatFecha, formatFechaHora, COLORS } from "@/app/factufly/comprobantes/gestionComprobantes/helpers";
import type { ComprobanteListado } from "@/app/factufly/comprobantes/gestionComprobantes/Comprobante";

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
  const texto = fecha.toLocaleDateString("es-PE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

const soles = (n: number, moneda = "PEN") => `${moneda === "USD" ? "$" : "S/"} ${fmtMonto(n)}`;

export default function VentasDelDiaPage() {
  const { user, accessToken } = useAuth();
  const { config, loading: loadingConfig } = useConfiguracion();
  const { showToast } = useToast();
  const router = useRouter();

  const sucursalId = user?.sucursalID ? Number(user.sucursalID) : null;

  const [fecha, setFecha] = useState(hoyISO());
  const [usuarioId, setUsuarioId] = useState<number | null>(null);
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null);

  const { comprobantes, loading, fetchComprobantes } = useComprobantesSucursalListado();
  const { detalles, loading: loadingDetalle, fetchDetalles, reset: resetDetalles } = useComprobanteDetalles();
  const { usuarios, fetchUsuarios } = useUsuariosReporte();

  useEffect(() => { fetchUsuarios(); }, [fetchUsuarios]);

  const cargar = useCallback(() => {
    if (!sucursalId) return;
    fetchComprobantes({
      sucursalId,
      fechaDesde: `${fecha}T00:00:00`,
      fechaHasta: `${fecha}T23:59:59`,
      usuarioId,
      limit: 200,
    });
  }, [sucursalId, fecha, usuarioId, fetchComprobantes]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    setSeleccionadoId(null);
    resetDetalles();
  }, [fecha, usuarioId, resetDetalles]);

  const seleccionar = (doc: ComprobanteListado) => {
    setSeleccionadoId(doc.comprobanteId);
    fetchDetalles(doc.comprobanteId);
  };

  const seleccionado = comprobantes.find((c) => c.comprobanteId === seleccionadoId) ?? null;

  const nombreCajero = useMemo(() => {
    if (!seleccionado?.usuarioCreacion) return "—";
    const u = usuarios.find((x) => x.usuarioID === seleccionado.usuarioCreacion);
    return u?.username ?? `Usuario ${seleccionado.usuarioCreacion}`;
  }, [seleccionado, usuarios]);

  const generarNotaCredito = (c: ComprobanteListado) => {
    router.push(
      `/factufly/operaciones/nota-credito?serie=${c.serie}&correlativo=${c.correlativo}&ruc=${c.company.numeroDocumento}&establecimiento=${c.company.establecimientoAnexo}`,
    );
  };

  const [confirmAnularNV, setConfirmAnularNV] = useState<ComprobanteListado | null>(null);
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

  if (loadingConfig) return null;

  if (!config?.administraCaja) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="max-w-sm text-center space-y-2">
          <Lock className="w-8 h-8 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-gray-800">Módulo no habilitado</h3>
          <p className="text-xs text-gray-500">
            Activa &quot;Administrar apertura/cierres de caja&quot; en Empresa → Configuración.
          </p>
        </div>
      </div>
    );
  }

  const esFacturaOBoleta = seleccionado?.tipoComprobante === "01" || seleccionado?.tipoComprobante === "03";
  const esNotaVenta = seleccionado?.tipoComprobante === "NV";
  const estaAnulada = seleccionado?.estadoSunat === "ANULADO";

  return (
    <div className="space-y-3 h-full flex flex-col">
      {/* Cabecera */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
             style={{ background: "rgba(15,46,100,0.08)" }}>
          <Banknote className="w-4.5 h-4.5" style={{ color: "#0f2e64" }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold" style={{ color: "#0f2e64" }}>Caja</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Ventas del día por cajero</p>
        </div>
        <Button variant="outline" onClick={cargar} className="!px-3 !py-1.5 !text-xs">
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-gray-500 uppercase">Día</span>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setFecha((f) => sumarDias(f, -1))}
                    className="h-10 w-10 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <label className="flex items-center gap-2 h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg focus-within:border-brand-blue/50">
              <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
              <input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)}
                     className="text-sm font-semibold text-gray-700 bg-transparent outline-none cursor-pointer" />
            </label>
            <button type="button" onClick={() => setFecha((f) => sumarDias(f, 1))}
                    className="h-10 w-10 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-gray-500 uppercase">Cajero</span>
          <select
            value={usuarioId ?? ""}
            onChange={(e) => setUsuarioId(e.target.value ? Number(e.target.value) : null)}
            className="h-10 px-3 text-sm font-medium bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-blue/50 min-w-[200px]"
          >
            <option value="">Todos los cajeros</option>
            {usuarios.map((u) => (
              <option key={u.usuarioID} value={u.usuarioID}>{u.username}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-sm font-medium text-gray-500 px-1">{fechaLarga(fecha)}</p>

      {/* Maestro-detalle */}
      <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-[1fr_340px] gap-3 items-start">
        {/* Lista */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div>
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="text-gray-500 uppercase text-[10px]">
                  <th className="text-left font-bold px-4 py-2.5">Folio</th>
                  <th className="text-center font-bold px-4 py-2.5">Arts</th>
                  <th className="text-left font-bold px-4 py-2.5">Hora</th>
                  <th className="text-right font-bold px-4 py-2.5">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && (
                  <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">Cargando…</td></tr>
                )}
                {!loading && comprobantes.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">Sin ventas con estos filtros</td></tr>
                )}
                {!loading && comprobantes.map((doc) => {
                  const activo = doc.comprobanteId === seleccionadoId;
                  return (
                    <tr key={doc.comprobanteId}
                        onClick={() => seleccionar(doc)}
                        className={`cursor-pointer transition-colors ${activo ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-gray-800 uppercase">{doc.numeroCompleto}</p>
                        <p className="text-[10px] text-gray-400">{tipoLabel(doc.tipoComprobante)}</p>
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{doc.cantidadItems ?? "—"}</td>
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                        {formatFechaHora(doc.horaEmision).split(" ")[1]}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <p className="font-semibold text-gray-800 tabular-nums">{soles(doc.importeTotal, doc.tipoMoneda)}</p>
                        {(doc.totalComisionPagoTarjeta ?? 0) > 0 && (
                          <p className="text-[10px] text-cyan-600 tabular-nums">
                            + {soles(doc.totalComisionPagoTarjeta!, doc.tipoMoneda)}
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

        {/* Detalle: fijo mientras se hace scroll en la lista, con su propio scroll interno si no cabe.
            key=seleccionadoId fuerza a React a remontar el panel al cambiar de venta, para que
            no arrastre la posición de scroll interna de la venta anterior. */}
        <div key={seleccionado?.comprobanteId ?? "vacio"}
             className="rounded-lg border border-gray-200 bg-white overflow-y-auto sticky top-3 max-h-[calc(100vh-6rem)]">
          {!seleccionado && (
            <div className="h-full flex items-center justify-center py-16 px-4">
              <div className="text-center space-y-2">
                <Receipt className="w-7 h-7 text-gray-300 mx-auto" />
                <p className="text-xs text-gray-400">Selecciona un comprobante para ver el detalle</p>
              </div>
            </div>
          )}

          {seleccionado && (
            <div className="p-4 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-gray-800 uppercase">{seleccionado.numeroCompleto}</p>
                  <p className="text-[11px] text-gray-400">{tipoLabel(seleccionado.tipoComprobante)} · {formatFecha(seleccionado.fechaEmision)}</p>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${(COLORS.sunat as Record<string, { badge: string }>)[seleccionado.estadoSunat]?.badge ?? "bg-gray-50 text-gray-500 border-gray-200"}`}>
                  {seleccionado.estadoSunat}
                </span>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-gray-400">Cajero</span><span className="text-gray-700 font-medium">{nombreCajero}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Cliente</span><span className="text-gray-700 font-medium text-right">{seleccionado.cliente?.razonSocial || "Cliente varios"}</span></div>
              </div>

              {loadingDetalle && <p className="text-xs text-gray-400 py-4 text-center">Cargando detalle…</p>}

              {!loadingDetalle && detalles && detalles.comprobanteId === seleccionado.comprobanteId && (
                <>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Artículos</p>
                    <div className="rounded-lg border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                      {detalles.details.map((item, i) => (
                        <div key={`${item.detalleId}-${i}`} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                          <div className="min-w-0">
                            <p className="text-gray-700 truncate">{item.descripcion}</p>
                            <p className="text-[10px] text-gray-400">x{item.cantidad}</p>
                          </div>
                          <span className="font-medium text-gray-800 tabular-nums shrink-0">{soles(item.totalVentaItem, seleccionado.tipoMoneda)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Medio de pago</p>
                    <div className="space-y-1">
                      {detalles.pagos.map((p, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-gray-500">{p.medioPago}</span>
                          <span className="text-gray-700 font-medium tabular-nums">{soles(p.monto, seleccionado.tipoMoneda)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-sm font-bold text-gray-800">Total</span>
                <span className="text-base font-bold tabular-nums" style={{ color: "#0f2e64" }}>
                  {soles(seleccionado.importeTotal, seleccionado.tipoMoneda)}
                </span>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                {esFacturaOBoleta && (
                  <Button variant="outline" onClick={() => generarNotaCredito(seleccionado)} className="!text-xs">
                    <FileText className="w-3.5 h-3.5" />
                    Generar Nota de Crédito
                  </Button>
                )}
                {esNotaVenta && !estaAnulada && (
                  <Button variant="danger" onClick={() => setConfirmAnularNV(seleccionado)} className="!text-xs">
                    <Ban className="w-3.5 h-3.5" />
                    Anular venta
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={!!confirmAnularNV} onClose={() => setConfirmAnularNV(null)} title="Anular nota de venta" className="max-w-sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            ¿Confirmas anular la nota de venta <b>{confirmAnularNV?.numeroCompleto}</b>? Esta acción devuelve el stock vendido.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmAnularNV(null)} disabled={anulandoNV}>Cancelar</Button>
            <Button variant="danger" onClick={anularNotaVenta} disabled={anulandoNV}>
              {anulandoNV ? "Anulando…" : "Anular venta"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
