"use client";
import React, { useState } from "react";
import axios from "axios";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { Card } from "@/app/components/ui/Card";
import { ReporteClienteDTO } from "./typesReportes";

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
  sucursalId: number;
}

export const ReporteCliente: React.FC<Props> = ({ sucursalId }) => {
  const { accessToken } = useAuth();
  const { showToast } = useToast();

  const [busqueda, setBusqueda] = useState("");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
  const [fechaDesde, setFechaDesde] = useState(today);
  const [fechaHasta, setFechaHasta] = useState(today);
  const [resultados, setResultados] = useState<ReporteClienteDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});

  const toggleExpandido = (numDoc: string) =>
    setExpandidos((prev) => ({ ...prev, [numDoc]: !prev[numDoc] }));

  const handleBuscar = async () => {
    if (!busqueda.trim()) {
      showToast("Ingresa un nombre o documento para buscar.", "info");
      return;
    }
    setLoading(true);
    setBuscado(false);
    try {
      const params = new URLSearchParams({ q: busqueda });
      if (fechaDesde) params.append("fechaDesde", fechaDesde);
      if (fechaHasta) params.append("fechaHasta", fechaHasta);

      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Trabajador/reporte-cliente/${sucursalId}?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      setResultados(res.data ?? []);
      setBuscado(true);

      // Expandir el primero por defecto si hay uno solo
      if (res.data?.length === 1) {
        setExpandidos({ [res.data[0].clienteNumDoc]: true });
      } else {
        setExpandidos({});
      }
    } catch {
      showToast("Error al buscar.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 flex-1 min-w-50">
          <label className="text-xs font-semibold text-gray-500 ">
            Cliente (nombre, RUC o DNI)
          </label>
          <div className="relative">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
              placeholder="Ej: Juan Pérez o 20123456789"
              className="w-full pl-4 pr-10 py-2 bg-white border border-gray-200 rounded-md text-sm outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/20 shadow-sm"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 ">
            Desde
          </label>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/20 shadow-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 ">
            Hasta
          </label>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/20 shadow-sm"
          />
        </div>
        <button
          onClick={handleBuscar}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white text-xs font-semibold rounded-md hover:bg-blue-900 transition-colors disabled:opacity-50"
        >
          <Search className="w-4 h-5" />
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="py-16 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-brand-blue rounded-full animate-spin" />
            Buscando...
          </div>
        </div>
      )}

      {/* ── Sin resultados ── */}
      {!loading && buscado && resultados.length === 0 && (
        <div className="py-16 text-center text-sm text-gray-400">
          No se encontraron servicios para "{busqueda}".
        </div>
      )}

      {/* ── Resultados ── */}
      {!loading && resultados.length > 0 && (
        <div className="space-y-3">
          {/* Cards resumen global */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Card className="p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase">
                Total Monto
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                S/{" "}
                {resultados
                  .reduce((acc, r) => acc + r.totalMonto, 0)
                  .toFixed(2)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase">
                Clientes
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {resultados.length}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase">
                Servicios
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {resultados.reduce((acc, r) => acc + r.totalServicios, 0)}
              </p>
            </Card>
          </div>

          {/* Lista de clientes con acordeón */}
          {resultados.map((cliente) => (
            <Card key={cliente.clienteNumDoc} className="p-0 overflow-hidden">
              {/* Cabecera cliente */}
              <button
                onClick={() => toggleExpandido(cliente.clienteNumDoc ?? "")}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-xs text-gray-400">
                      {cliente.clienteNumDoc}
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {cliente.clienteRazonSocial}
                    </p>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>
                      <span className="font-semibold text-gray-700">
                        {cliente.totalServicios}
                      </span>{" "}
                      servicios
                    </span>
                    <span>
                      <span className="font-semibold text-gray-700">
                        {cliente.totalComprobantes}
                      </span>{" "}
                      comprobantes
                    </span>
                    <span className="font-bold text-gray-900">
                      S/ {cliente.totalMonto.toFixed(2)}
                    </span>
                  </div>
                </div>
                {expandidos[cliente.clienteNumDoc ?? ""] ? (
                  <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                )}
              </button>

              {/* Detalle por trabajador */}
              {expandidos[cliente.clienteNumDoc ?? ""] && (
                <div className="border-t border-gray-100">
                  {cliente.trabajadores.map((trabajador) => (
                    <div
                      key={trabajador.trabajadorId}
                      className="border-b border-gray-50 last:border-0"
                    >
                      {/* Subencabezado trabajador */}
                      <div className="px-5 py-2 bg-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-600">
                            {trabajador.nombreCompleto}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            DNI: {trabajador.dni}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-gray-700">
                          S/ {trabajador.totalMonto.toFixed(2)}
                        </span>
                      </div>

                      {/* Tabla servicios */}
                      <div className="overflow-x-auto">
                        <table
                          className="w-full text-xs"
                          style={{ minWidth: 700 }}
                        >
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="px-4 py-2 text-left text-gray-500 font-semibold w-24">
                                Fecha
                              </th>
                              <th className="px-4 py-2 text-left text-gray-500 font-semibold w-28">
                                Comprobante
                              </th>
                              <th className="px-4 py-2 text-left text-gray-500 font-semibold">
                                Servicio
                              </th>
                              <th className="px-4 py-2 text-right text-gray-500 font-semibold w-16">
                                Cant.
                              </th>
                              <th className="px-4 py-2 text-right text-gray-500 font-semibold w-24">
                                P. Unit.
                              </th>
                              <th className="px-4 py-2 text-right text-gray-500 font-semibold w-24">
                                Total
                              </th>
                              <th className="px-4 py-2 text-left text-gray-500 font-semibold w-24">
                                Estado
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {trabajador.servicios
                              .slice()
                              .sort((a, b) =>
                                b.numeroCompleto.localeCompare(
                                  a.numeroCompleto,
                                ),
                              )
                              .map((s) => (
                                <tr
                                  key={s.detalleId}
                                  className="hover:bg-gray-50/50"
                                >
                                  <td className="px-4 py-2 text-gray-600">
                                    {formatFecha(s.fechaEmision)}
                                  </td>
                                  <td className="px-4 py-2 font-mono text-gray-700">
                                    {s.numeroCompleto}
                                  </td>
                                  <td className="px-4 py-2 text-gray-700">
                                    {s.descripcion}
                                  </td>
                                  <td className="px-4 py-2 text-right text-gray-600">
                                    {s.cantidad}
                                  </td>
                                  <td className="px-4 py-2 text-right text-gray-600">
                                    {formatMonto(
                                      s.precioUnitario,
                                      s.tipoMoneda,
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-right font-semibold text-gray-900">
                                    {formatMonto(
                                      s.totalVentaItem,
                                      s.tipoMoneda,
                                    )}
                                  </td>
                                  <td className="px-4 py-2">
                                    <span
                                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
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
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {!loading && !buscado && (
        <div className="py-16 text-center text-sm text-gray-400">
          Ingresa un nombre, RUC o DNI del cliente para ver sus servicios.
        </div>
      )}
    </div>
  );
};
