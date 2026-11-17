"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, FileCheck, Loader2, X, Zap } from "lucide-react";
import { cn } from "@/app/utils/cn";
import { useToast } from "@/app/components/ui/Toast";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { useApiGastos } from "./useGastos";
import { IconoCategoria } from "./iconosGasto";
import { iniciarEmisionIngreso, type ClienteEmision } from "./ingresoPorEmitir";
import { publicarPorEmitir } from "./avisoPorEmitir";
import { fechaLocal, formatFechaCorta, formatSoles, nombreComprobante, type PorEmitir } from "./tipos";

/** Cliente de la regla en los códigos del formulario de emisión ("01" DNI, "06" RUC, "0" sin documento). */
function clienteDelPendiente(p: PorEmitir): ClienteEmision {
  const doc = p.clienteNumDoc && p.clienteNumDoc !== "0" ? p.clienteNumDoc : "";
  if (!doc) return { tipoDocumento: "0", numeroDocumento: "0", razonSocial: p.clienteRazonSocial || "Clientes Varios" };
  return {
    tipoDocumento: doc.length === 11 ? "06" : "01",
    numeroDocumento: doc,
    razonSocial: p.clienteRazonSocial ?? "",
    direccionLineal: p.clienteDireccion,
  };
}

/**
 * Ingresos programados con comprobante cuya fecha ya llegó: se emiten con un clic (el formulario
 * se abre lleno: cliente, monto y concepto) o se descartan. También muestra los que la emisión
 * automática no pudo emitir, con el motivo.
 */
export function PorEmitirPanel({
  cantidad,
  onEmitir,
  onCambio,
}: {
  /** Cuántos hay (del inicio); el panel no se muestra si es 0. */
  cantidad: number;
  /** Abre el formulario de emisión dentro de Movimientos. */
  onEmitir: () => void;
  onCambio: () => void;
}) {
  const api = useApiGastos();
  const { showToast } = useToast();
  const { config } = useConfiguracion();
  const [abierto, setAbierto] = useState(true);
  const [lista, setLista] = useState<PorEmitir[] | null>(null);
  const [descartando, setDescartando] = useState<number | null>(null);
  const { listo, listarPorEmitir } = api;

  const cargar = useCallback(async () => {
    if (!listo || cantidad === 0) return;
    try {
      const l = await listarPorEmitir();
      setLista(l);
      publicarPorEmitir(l.length);
    } catch {
      setLista([]);
    }
    // listarPorEmitir se recrea en cada render; basta con la cantidad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, cantidad]);

  useEffect(() => { cargar(); }, [cargar]);

  if (cantidad === 0) return null;

  const emitir = (p: PorEmitir) => {
    const tasa = Number(config?.igv ?? 18) || 18;
    iniciarEmisionIngreso(
      {
        tipo: "I",
        categoriaId: p.categoriaId,
        fecha: fechaLocal(),
        descripcion: p.descripcion,
        monto: p.monto,
        medioPago: p.medioPago,
        tipoComprobante: "00",
        serie: null,
        numero: null,
        igv: null,
        proveedorId: null,
        proveedorDocumento: p.clienteNumDoc && p.clienteNumDoc !== "0" ? p.clienteNumDoc : null,
        proveedorNombre: p.clienteRazonSocial,
        sucursalId: p.sucursalId,
        adjuntoUrl: null,
        adjuntoImageId: null,
        observacion: p.observacion,
        pagadoConCaja: false,
        porEmitirId: p.porEmitirId,
      },
      p.tipoComprobante ?? "03",
      p.categoriaNombre ?? "Ingreso",
      tasa,
      clienteDelPendiente(p),
    );
    onEmitir();
  };

  const descartar = async (p: PorEmitir) => {
    setDescartando(p.porEmitirId);
    try {
      await api.descartarPorEmitir(p.porEmitirId);
      showToast("Descartado: esa fecha no se emitirá", "success");
      onCambio();
      await cargar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo descartar", "error");
    } finally {
      setDescartando(null);
    }
  };

  const errores = lista?.filter((p) => p.estado === "ERROR").length ?? 0;

  return (
    <div className={cn("rounded-xl border bg-white shadow-xs", errores > 0 ? "border-rose-200" : "border-sky-200")}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <FileCheck className={cn("w-4 h-4", errores > 0 ? "text-rose-600" : "text-sky-600")} />
          {cantidad} ingreso{cantidad === 1 ? "" : "s"} programado{cantidad === 1 ? "" : "s"} por emitir
          {errores > 0 && (
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
              {errores} con problema
            </span>
          )}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", abierto && "rotate-180")} />
      </button>
      {abierto && (
        <ul className="divide-y divide-gray-100 border-t border-gray-100">
          {lista === null ? (
            <li className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-gray-300" /></li>
          ) : (
            lista.map((p) => (
              <li key={p.porEmitirId} className="px-3.5 py-2.5 flex flex-wrap items-center gap-3">
                <IconoCategoria icono={p.categoriaIcono} color={p.categoriaColor} />
                <div className="flex-1 min-w-48">
                  <p className="text-sm font-semibold text-gray-800 truncate">{p.descripcion}</p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {nombreComprobante(p.tipoComprobante ?? "03")} a {p.clienteRazonSocial || "Clientes Varios"}
                    {p.clienteNumDoc && p.clienteNumDoc !== "0" ? ` (${p.clienteNumDoc})` : ""} · tocaba el {formatFechaCorta(p.fecha)}
                  </p>
                  {p.estado === "ERROR" && p.mensaje && (
                    <p className="mt-0.5 flex items-start gap-1 text-[11px] text-rose-600">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {p.mensaje}
                    </p>
                  )}
                  {p.estado === "EMITIENDO" && (
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-sky-700">
                      <Zap className="w-3 h-3" /> Emitiéndose automáticamente…
                    </p>
                  )}
                </div>
                <span className="text-sm font-black tabular-nums text-emerald-700">+ {formatSoles(p.monto)}</span>
                {p.estado !== "EMITIENDO" && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => emitir(p)}
                      className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                    >
                      Emitir
                    </button>
                    <button
                      type="button"
                      onClick={() => descartar(p)}
                      disabled={descartando === p.porEmitirId}
                      title="No emitir esta fecha"
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                    >
                      {descartando === p.porEmitirId ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
