"use client";
import React, { useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { Card } from "@/app/components/ui/Card";
import { FiltroFechas } from "./FiltroFechas";
import { RankingTrabajadorDTO } from "./typesReportes";

interface Props {
  sucursalId: number;
}

export const RankingTrabajadores: React.FC<Props> = ({ sucursalId }) => {
  const { accessToken } = useAuth();
  const { showToast } = useToast();

  const today = new Date().toISOString().split("T")[0];
  const [fechaDesde, setFechaDesde] = useState(today);
  const [fechaHasta, setFechaHasta] = useState(today);
  const [ranking, setRanking] = useState<RankingTrabajadorDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [buscado, setBuscado] = useState(false);

  const handleBuscar = async () => {
    setLoading(true);
    setBuscado(false);
    try {
      const params = new URLSearchParams();
      if (fechaDesde) params.append("fechaDesde", fechaDesde);
      if (fechaHasta) params.append("fechaHasta", fechaHasta);

      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Trabajador/ranking/${sucursalId}?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setRanking(res.data ?? []);
      setBuscado(true);
    } catch {
      showToast("Error al obtener el ranking.", "error");
    } finally {
      setLoading(false);
    }
  };

  const maxMonto = ranking.length > 0 ? ranking[0].totalMonto : 1;

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
            Cargando ranking...
          </div>
        </div>
      )}

      {!loading && buscado && ranking.length === 0 && (
        <div className="py-16 text-center text-sm text-gray-400">
          No hay datos para el rango de fechas indicado.
        </div>
      )}

      {!loading && ranking.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">
              Ranking por monto vendido
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {ranking.map((t, index) => (
              <div key={t.trabajadorId} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                {/* Posición */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  index === 0 ? "bg-yellow-100 text-yellow-700" :
                  index === 1 ? "bg-gray-100 text-gray-600" :
                  index === 2 ? "bg-orange-100 text-orange-600" :
                  "bg-gray-50 text-gray-400"
                }`}>
                  {index + 1}
                </div>

                {/* Info trabajador */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{t.nombreCompleto}</p>
                  <p className="text-xs text-gray-400">{t.dni}</p>

                  {/* Barra de progreso */}
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-blue rounded-full transition-all duration-500"
                      style={{ width: `${(t.totalMonto / maxMonto) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="flex gap-6 shrink-0 text-right">
                  <div>
                    <p className="text-xs text-gray-400">Servicios</p>
                    <p className="text-sm font-semibold text-gray-700">{t.totalServicios}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Comprobantes</p>
                    <p className="text-sm font-semibold text-gray-700">{t.totalComprobantes}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Total</p>
                    <p className="text-sm font-bold text-gray-900">S/ {t.totalMonto.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!loading && !buscado && (
        <div className="py-16 text-center text-sm text-gray-400">
          Selecciona un rango de fechas para ver el ranking.
        </div>
      )}
    </div>
  );
};