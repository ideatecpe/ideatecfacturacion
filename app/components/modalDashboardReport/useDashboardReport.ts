"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";

export type FormatoDashboard = "pdf" | "excel";

interface UseDashboardReportReturn {
  abierto: boolean;
  abrir: () => void;
  cerrar: () => void;
  loadingFormato: FormatoDashboard | null;
  descargar: (params: {
    ruc: string;
    codEstablecimiento?: string | null;
    desde?: string;
    hasta?: string;
    usuarioId?: number | null;
    topLimit?: number;
    nombreArchivo?: string;
    formato: FormatoDashboard;
  }) => Promise<void>;
}

export function useDashboardReport(): UseDashboardReportReturn {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const [abierto, setAbierto] = useState(false);
  const [loadingFormato, setLoadingFormato] = useState<FormatoDashboard | null>(null);

  const abrir = useCallback(() => setAbierto(true), []);
  const cerrar = useCallback(() => setAbierto(false), []);

  const descargar = useCallback(
    async (params: {
      ruc: string;
      codEstablecimiento?: string | null;
      desde?: string;
      hasta?: string;
      usuarioId?: number | null;
      topLimit?: number;
      nombreArchivo?: string;
      formato: FormatoDashboard;
    }) => {
      if (!accessToken) return;
      setLoadingFormato(params.formato);
      try {
        const endpoint =
          params.formato === "pdf"
            ? "/api/Reportes/dashboard-report/pdf"
            : "/api/Reportes/dashboard-report/excel";

        const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`);
        url.searchParams.append("ruc", params.ruc);
        if (params.codEstablecimiento)
          url.searchParams.append(
            "codEstablecimiento",
            params.codEstablecimiento
          );
        if (params.desde) url.searchParams.append("desde", params.desde);
        if (params.hasta) url.searchParams.append("hasta", params.hasta);
        if (params.usuarioId != null)
          url.searchParams.append("usuarioId", String(params.usuarioId));
        if (params.topLimit)
          url.searchParams.append("topLimit", String(params.topLimit));

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!res.ok) {
          const errorBody = await res.text().catch(() => "");
          throw new Error(`Error ${res.status}: ${errorBody}`);
        }

        const blob = await res.blob();
        const ext = params.formato === "pdf" ? "pdf" : "xlsx";
        const nombre =
          params.nombreArchivo?.trim() ||
          `Dashboard_${params.ruc}_${new Date().toISOString().slice(0, 10)}`;

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${nombre}.${ext}`;
        link.click();
        URL.revokeObjectURL(link.href);

        showToast("Reporte descargado correctamente", "success");
      } catch (err) {
        // console.warn (no console.error): esto ya está manejado con el toast de abajo,
        // y Next.js en dev muestra cualquier console.error como overlay de pantalla completa
        // aunque esté dentro de un try/catch — eso hacía parecer un error no controlado.
        const msg = err instanceof Error ? err.message : "Error desconocido";
        console.warn("Dashboard report error:", msg);
        showToast("Error al generar el reporte", "error");
      } finally {
        setLoadingFormato(null);
      }
    },
    [accessToken, showToast]
  );

  return { abierto, abrir, cerrar, loadingFormato, descargar };
}
