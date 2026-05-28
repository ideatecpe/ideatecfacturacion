"use client";
import React, { useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { Card } from "@/app/components/ui/Card";
import { FiltroFechas } from "./FiltroFechas";
import { ReporteTrabajadorDTO } from "./typesReportes";
import { Trabajador } from "../typesTrabajador";

const formatFecha = (fecha: string) => {
  try {
    return new Date(fecha).toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "-";
  }
};

const formatMonto = (monto: number, moneda: string) =>
  `${moneda === "USD" ? "$" : "S/"} ${monto.toFixed(2)}`;

interface Props {
  trabajadores: Trabajador[];
  sucursalId: number;
}

export const ReporteIndividual: React.FC<Props> = ({
  trabajadores,
  sucursalId,
}) => {
  const { accessToken } = useAuth();
  const { showToast } = useToast();

  const [trabajadorId, setTrabajadorId] = useState<number>(0);
  const today = new Date().toISOString().split("T")[0];
  const [fechaDesde, setFechaDesde] = useState(today);
  const [fechaHasta, setFechaHasta] = useState(today);
  const [reporte, setReporte] = useState<ReporteTrabajadorDTO | null>(null);
  const [loading, setLoading] = useState(false);

  const handleBuscar = async () => {
    if (!trabajadorId) {
      showToast("Selecciona un trabajador.", "info");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fechaDesde) params.append("fechaDesde", fechaDesde);
      if (fechaHasta) params.append("fechaHasta", fechaHasta);

      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Trabajador/${trabajadorId}/reporte?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      setReporte(res.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        setReporte(null);
        showToast(
          "No se encontraron servicios para este trabajador en el rango indicado.",
          "info",
        );
      } else {
        showToast("Error al obtener el reporte.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Filtros ── */}
      <FiltroFechas
        fechaDesde={fechaDesde}
        fechaHasta={fechaHasta}
        onFechaDesde={setFechaDesde}
        onFechaHasta={setFechaHasta}
        onBuscar={handleBuscar}
        loading={loading}
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase">
            Trabajador
          </label>
          <select
            value={trabajadorId}
            onChange={(e) => setTrabajadorId(Number(e.target.value))}
            className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 shadow-sm min-w-50"
          >
            <option value={0}>Seleccionar trabajador</option>
            {trabajadores.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombreCompleto}
              </option>
            ))}
          </select>
        </div>
      </FiltroFechas>

      {/* ── Cards totales ── */}
      {reporte && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase">
                Total Monto
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                S/ {reporte.totalMonto.toFixed(2)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase">
                Comprobantes
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {reporte.totalComprobantes}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase">
                Servicios
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {reporte.totalServicios}
              </p>
            </Card>
          </div>

          {/* ── Tabla servicios ── */}
          <style>{`
            .reporte-table tbody {
              display: block; overflow-y: auto;
              max-height: calc(100vh - 460px);
              scrollbar-width: thin; scrollbar-color: #CBD5E1 transparent;
            }
            .reporte-table thead tr, .reporte-table tbody tr {
              display: table; width: 100%; table-layout: fixed;
            }
            .reporte-table thead { width: 100%; }
          `}</style>

          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700">
                Servicios de{" "}
                <span className="text-brand-blue">
                  {reporte.nombreCompleto}
                </span>
              </p>
            </div>
            <div className="overflow-x-auto">
              <table
                className="w-full text-left border-collapse reporte-table"
                style={{ minWidth: 900 }}
              >
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-24">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-28">
                      Comprobante
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-40">
                      Cliente
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-48">
                      Servicio
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-16 text-right">
                      Cant.
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-24 text-right">
                      P. Unit.
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-24 text-right">
                      Total
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-24">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reporte.servicios
                    .slice()
                    .sort((a, b) =>
                      b.numeroCompleto.localeCompare(a.numeroCompleto),
                    )
                    .map((s) => (
                      <tr
                        key={s.detalleId}
                        className="hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-gray-600 w-24">
                          {formatFecha(s.fechaEmision)}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-700 w-28">
                          {s.numeroCompleto}
                        </td>
                        <td className="px-4 py-3 w-40">
                          <p className="text-xs text-gray-400">
                            {s.clienteNumDoc}
                          </p>
                          <p className="text-sm text-gray-700 truncate">
                            {s.clienteRazonSocial}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 w-48">
                          {s.descripcion}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 w-16 text-right">
                          {s.cantidad}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 w-24 text-right">
                          {formatMonto(s.precioUnitario, s.tipoMoneda)}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 w-24 text-right">
                          {formatMonto(s.totalVentaItem, s.tipoMoneda)}
                        </td>
                        <td className="px-4 py-3 w-24">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              s.estadoSunat === "ACEPTADO"
                                ? "bg-green-100 text-green-700"
                                : s.estadoSunat === "PENDIENTE"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {s.estadoSunat}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {!reporte && !loading && (
        <div className="py-16 text-center text-sm text-gray-400">
          Selecciona un trabajador y un rango de fechas para ver el reporte.
        </div>
      )}
    </div>
  );
};
