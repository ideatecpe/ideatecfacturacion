// gestioProductos/useReporteProductosExcel.ts

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";

export interface ReporteProductosFiltro {
  sucursalId?: number;
  categoriaId?: number;
  igvTipo?: string;        // "10" | "20" | "30"
  tipoProducto?: string;   // "BIEN" | "SERVICIO"
  stockFiltro?: string;    // "todos" | "con_stock" | "sin_stock" | "menor_a"
  stockValor?: number;
  tituloReporte?: string;
}

export function useReporteProductosExcel() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const [descargando, setDescargando] = useState(false);

  const descargarReporte = async (filtro: ReporteProductosFiltro) => {
    if (!user?.ruc) return;

    setDescargando(true);
    try {
      // Construir query params
      const params = new URLSearchParams();
      params.set("empresaRuc", user.ruc);

      if (filtro.sucursalId)   params.set("sucursalId",   String(filtro.sucursalId));
      if (filtro.categoriaId)  params.set("categoriaId",  String(filtro.categoriaId));
      if (filtro.igvTipo)      params.set("igvTipo",      filtro.igvTipo);
      if (filtro.tipoProducto) params.set("tipoProducto", filtro.tipoProducto);
      if (filtro.stockFiltro)  params.set("stockFiltro",  filtro.stockFiltro);
      if (filtro.stockValor)   params.set("stockValor",   String(filtro.stockValor));
      if (filtro.tituloReporte?.trim()) params.set("tituloReporte", filtro.tituloReporte.trim());

      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/productos/reporte-excel?${params.toString()}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.mensaje ?? "Error al generar el reporte");
      }

      // Generar nombre del archivo si no se envió uno
      const nombreArchivo = generarNombreArchivo(filtro, user.ruc);

      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = nombreArchivo;
      link.click();
      URL.revokeObjectURL(link.href);

      showToast("Reporte descargado correctamente.", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al descargar el reporte.";
      showToast(msg, "error");
    } finally {
      setDescargando(false);
    }
  };

  return { descargarReporte, descargando };
}

// Genera nombre de archivo basado en los filtros activos
function generarNombreArchivo(filtro: ReporteProductosFiltro, ruc: string): string {
  if (filtro.tituloReporte?.trim()) {
    return `${filtro.tituloReporte.trim().replace(/\s+/g, "_")}.xlsx`;
  }

  const partes = [`reporte-productos`, ruc];

  if (filtro.sucursalId)   partes.push(`suc${filtro.sucursalId}`);
  if (filtro.categoriaId)  partes.push(`cat${filtro.categoriaId}`);
  if (filtro.igvTipo) {
    const igv = { "10": "gravado", "20": "exonerado", "30": "inafecto" }[filtro.igvTipo] ?? filtro.igvTipo;
    partes.push(igv);
  }
  if (filtro.tipoProducto) partes.push(filtro.tipoProducto.toLowerCase());
  if (filtro.stockFiltro && filtro.stockFiltro !== "todos") {
    partes.push(filtro.stockFiltro === "menor_a" ? `stock-menor-${filtro.stockValor}` : filtro.stockFiltro);
  }

  const fecha = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
  partes.push(fecha);

  return `${partes.join("_")}.xlsx`;
}