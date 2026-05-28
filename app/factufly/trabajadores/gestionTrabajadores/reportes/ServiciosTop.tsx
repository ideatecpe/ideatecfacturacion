"use client";
import React, { useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { Card } from "@/app/components/ui/Card";
import { FiltroFechas } from "./FiltroFechas";
import { ServicioTopDTO } from "./typesReportes";
import { ChevronDown, ChevronUp } from "lucide-react";

interface DetalleServicio {
  trabajadorId: number;
  nombres: string;
  apellidos: string;
  dni: string;
  comprobanteId: number;
  numeroCompleto: string;
  fechaEmision: string;
  tipoMoneda: string;
  estadoSunat: string;
  clienteNumDoc: string;
  clienteRazonSocial: string;
  detalleId: number;
  cantidad: number;
  precioUnitario: number;
  totalVentaItem: number;
}

interface Props {
  sucursalId: number;
}

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

export const ServiciosTop: React.FC<Props> = ({ sucursalId }) => {
  const { accessToken } = useAuth();
  const { showToast } = useToast();

  const today = new Date().toISOString().split("T")[0];
  const [fechaDesde, setFechaDesde] = useState(today);
  const [fechaHasta, setFechaHasta] = useState(today);
  const [servicios, setServicios] = useState<ServicioTopDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [buscado, setBuscado] = useState(false);

  // Acordeón: descripcion → { abierto, cargando, datos }
  const [detalles, setDetalles] = useState<
    Record<
      string,
      {
        abierto: boolean;
        cargando: boolean;
        datos: DetalleServicio[];
      }
    >
  >({});

  const handleBuscar = async () => {
    setLoading(true);
    setBuscado(false);
    setDetalles({});
    try {
      const params = new URLSearchParams();
      if (fechaDesde) params.append("fechaDesde", fechaDesde);
      if (fechaHasta) params.append("fechaHasta", fechaHasta);

      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Trabajador/servicios-top/${sucursalId}?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      setServicios(res.data ?? []);
      setBuscado(true);
    } catch {
      showToast("Error al obtener los servicios.", "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleDetalle = async (descripcion: string) => {
    const estado = detalles[descripcion];

    // Si ya está abierto, solo cerrar
    if (estado?.abierto) {
      setDetalles((prev) => ({
        ...prev,
        [descripcion]: { ...prev[descripcion], abierto: false },
      }));
      return;
    }

    // Si ya tiene datos cargados, solo abrir
    if (estado?.datos?.length > 0) {
      setDetalles((prev) => ({
        ...prev,
        [descripcion]: { ...prev[descripcion], abierto: true },
      }));
      return;
    }

    // Cargar datos del API
    setDetalles((prev) => ({
      ...prev,
      [descripcion]: { abierto: true, cargando: true, datos: [] },
    }));

    try {
      const params = new URLSearchParams({ descripcion });
      if (fechaDesde) params.append("fechaDesde", fechaDesde);
      if (fechaHasta) params.append("fechaHasta", fechaHasta);

      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Trabajador/detalle-servicio/${sucursalId}?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      setDetalles((prev) => ({
        ...prev,
        [descripcion]: {
          abierto: true,
          cargando: false,
          datos: res.data ?? [],
        },
      }));
    } catch {
      showToast("Error al cargar el detalle.", "error");
      setDetalles((prev) => ({
        ...prev,
        [descripcion]: { abierto: false, cargando: false, datos: [] },
      }));
    }
  };

  const maxVeces = servicios.length > 0 ? servicios[0].totalVeces : 1;

  return (
    <div className="space-y-4">
      <FiltroFechas
        fechaDesde={fechaDesde}
        fechaHasta={fechaHasta}
        onFechaDesde={setFechaDesde}
        onFechaHasta={setFechaHasta}
        onBuscar={handleBuscar}
        loading={loading}
      />

      {loading && (
        <div className="py-16 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-brand-blue rounded-full animate-spin" />
            Cargando servicios...
          </div>
        </div>
      )}

      {!loading && buscado && servicios.length === 0 && (
        <div className="py-16 text-center text-sm text-gray-400">
          No hay datos para el rango de fechas indicado.
        </div>
      )}

      {!loading && servicios.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">
              Servicios más realizados —{" "}
              <span className="text-gray-400 font-normal">
                {servicios.length} servicios distintos
              </span>
            </p>
          </div>

          <div className="divide-y divide-gray-100">
            {servicios.map((s, index) => {
              const estado = detalles[s.descripcion];
              const abierto = estado?.abierto ?? false;
              const cargando = estado?.cargando ?? false;
              const datos = estado?.datos ?? [];

              return (
                <div key={index}>
                  {/* Fila principal — clickeable */}
                  <button
                    onClick={() => toggleDetalle(s.descripcion)}
                    className="w-full text-left hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="px-5 py-3 flex items-center gap-4">
                      {/* Posición */}
                      <span className="text-sm text-gray-400 w-6 shrink-0">
                        {index + 1}
                      </span>

                      {/* Descripción + barra */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {s.descripcion}
                        </p>
                        {s.codigo && (
                          <p className="text-[10px] text-gray-400 font-mono">
                            {s.codigo}
                          </p>
                        )}
                        <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden w-full max-w-50">
                          <div
                            className="h-full bg-brand-blue/60 rounded-full"
                            style={{
                              width: `${(s.totalVeces / maxVeces) * 100}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-8 shrink-0">
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400">Veces</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {s.totalVeces}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400">
                            Cant. Total
                          </p>
                          <p className="text-sm text-gray-600">
                            {s.totalCantidad.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400">
                            P. Promedio
                          </p>
                          <p className="text-sm text-gray-600">
                            S/ {s.precioPromedio.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right w-24">
                          <p className="text-[10px] text-gray-400">Total</p>
                          <p className="text-sm font-bold text-gray-900">
                            S/ {s.totalMonto.toFixed(2)}
                          </p>
                        </div>
                        <div className="w-5">
                          {abierto ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Detalle expandido */}
                  {abierto && (
                    <div className="border-t border-gray-100 bg-gray-50/50">
                      {cargando ? (
                        <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-400">
                          <div className="w-4 h-4 border-2 border-gray-300 border-t-brand-blue rounded-full animate-spin" />
                          Cargando detalle...
                        </div>
                      ) : datos.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-4">
                          Sin datos.
                        </p>
                      ) : (
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
                                  Trabajador
                                </th>
                                <th className="px-4 py-2 text-left text-gray-500 font-semibold">
                                  Cliente
                                </th>
                                <th className="px-4 py-2 text-right text-gray-500 font-semibold w-16">
                                  Cant.
                                </th>
                                <th className="px-4 py-2 text-right text-gray-500 font-semibold w-24">
                                  Total
                                </th>
                                <th className="px-4 py-2 text-left text-gray-500 font-semibold w-24">
                                  Estado
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {datos.map((d) => (
                                <tr
                                  key={d.detalleId}
                                  className="hover:bg-white transition-colors"
                                >
                                  <td className="px-4 py-2 text-gray-600">
                                    {formatFecha(d.fechaEmision)}
                                  </td>
                                  <td className="px-4 py-2 font-mono text-gray-700">
                                    {d.numeroCompleto}
                                  </td>
                                  <td className="px-4 py-2">
                                    <p className="font-medium text-gray-800">
                                      {d.nombres} {d.apellidos}
                                    </p>
                                    <p className="text-[10px] text-gray-400">
                                      DNI: {d.dni}
                                    </p>
                                  </td>
                                  <td className="px-4 py-2">
                                    <p className="text-gray-700 truncate max-w-40">
                                      {d.clienteRazonSocial}
                                    </p>
                                    <p className="text-[10px] text-gray-400">
                                      {d.clienteNumDoc}
                                    </p>
                                  </td>
                                  <td className="px-4 py-2 text-right text-gray-600">
                                    {d.cantidad}
                                  </td>
                                  <td className="px-4 py-2 text-right font-semibold text-gray-900">
                                    S/ {d.totalVentaItem.toFixed(2)}
                                  </td>
                                  <td className="px-4 py-2">
                                    <span
                                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                        d.estadoSunat === "ACEPTADO"
                                          ? "bg-green-100 text-green-700"
                                          : d.estadoSunat === "PENDIENTE"
                                            ? "bg-yellow-100 text-yellow-700"
                                            : "bg-red-100 text-red-700"
                                      }`}
                                    >
                                      {d.estadoSunat}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {!loading && !buscado && (
        <div className="py-16 text-center text-sm text-gray-400">
          Selecciona un rango de fechas para ver los servicios más realizados.
        </div>
      )}
    </div>
  );
};
