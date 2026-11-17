"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, Banknote, Camera, CalendarClock, ChevronDown, FileCheck, Loader2, Paperclip, Repeat, Search, Trash2, Wallet,
} from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { cn } from "@/app/utils/cn";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { consultaRuc } from "@/app/components/apiConsultasJsonPe/consultaRuc";
import { consultaDni } from "@/app/components/apiConsultasJsonPe/consultaDni";
import {
  DIAS_SEMANA, FRECUENCIAS, MEDIOS_PAGO, MONTO_BOLETA_CON_DNI, TIPOS_COMPROBANTE, fechaLocal,
  fechasRegla, formatFechaDia, nombreComprobante, siguienteFecha,
  type CategoriaGasto, type ComprobanteProgramado, type Frecuencia, type Gasto, type GuardarGasto, type GuardarProgramado,
  type Programado,
  type TipoMovimiento,
} from "@/app/factufly/gastos/gestionGastos/tipos";
import {
  iniciarEmisionIngreso, type ComprobanteIngreso,
} from "@/app/factufly/gastos/gestionGastos/ingresoPorEmitir";
import { IconoGasto } from "@/app/factufly/gastos/gestionGastos/iconosGasto";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** "G" gasto o "I" ingreso. */
  tipo: TipoMovimiento;
  categorias: CategoriaGasto[];
  /** Movimiento a editar; null = nuevo. */
  gasto: Gasto | null;
  esAdmin: boolean;
  /** Solo el superadmin elige la sucursal (o toda la empresa); el resto registra en la suya. */
  esSuperAdmin: boolean;
  /** Turno de caja abierto del usuario (habilita "Salió del efectivo de la caja"). */
  cajaTurnoAbiertoId: number | null;
  sucursales: { sucursalId: number; nombre: string }[];
  onGuardar: (datos: GuardarGasto, id: number | null) => Promise<void>;
  /** Ingreso con "Emitir comprobante": abre la emisión dentro de Movimientos. */
  onEmitir?: () => void;
  /** Regla programada a editar (pantalla Programados). */
  programado?: Programado | null;
  /** Abrir con "Repetir automáticamente" ya activado (botón "Nuevo programado"). */
  iniciarRepitiendo?: boolean;
  /** Guarda una regla programada (crear o editar). */
  onProgramar?: (datos: GuardarProgramado, id: number | null) => Promise<void>;
}

const claseInput =
  "w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-blue/50 focus:bg-white";
const claseLabel = "text-[11px] font-bold text-gray-500 uppercase";
/** Botón "Otro" entre los conceptos: vuelve a la descripción escrita a mano. */
const OTRO = "__otro__";

async function eliminarImagen(imageId: string) {
  try {
    await fetch("/api/upload-imagen", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId }),
    });
  } catch { /* si falla el borrado en Cloudflare no se bloquea al usuario */ }
}

/** Reduce la foto del celular (a veces 6–10 MB) a un JPG de 1600 px antes de subirla. */
async function comprimirImagen(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    return blob ?? file;
  } catch {
    return file;
  }
}

const OPCIONES_EMISION: { codigo: ComprobanteIngreso; nombre: string }[] = [
  { codigo: "03", nombre: "Boleta" },
  { codigo: "01", nombre: "Factura" },
  { codigo: "NV", nombre: "Nota de venta" },
];

export function ModalGasto({
  isOpen, onClose, tipo, categorias, gasto, esAdmin, esSuperAdmin, cajaTurnoAbiertoId, sucursales, onGuardar, onEmitir,
  programado = null, iniciarRepitiendo = false, onProgramar,
}: Props) {
  const { user } = useAuth();
  const { config } = useConfiguracion();
  const esIngreso = tipo === "I";
  const sucursalUsuario = user?.sucursalID ? Number(user.sucursalID) : null;
  const tasaIgv = Number(config?.igv ?? 18) || 18;

  const [monto, setMonto] = useState("");
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [concepto, setConcepto] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(fechaLocal());
  const [medioPago, setMedioPago] = useState<string>("Efectivo");
  const [deCaja, setDeCaja] = useState(false);
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [masDatos, setMasDatos] = useState(false);
  const [tipoComprobante, setTipoComprobante] = useState("00");
  const [serie, setSerie] = useState("");
  const [numero, setNumero] = useState("");
  const [igv, setIgv] = useState("");
  const [igvManual, setIgvManual] = useState(false);
  const [provDoc, setProvDoc] = useState("");
  const [provNombre, setProvNombre] = useState("");
  const [buscandoRuc, setBuscandoRuc] = useState(false);
  const [observacion, setObservacion] = useState("");
  const [adjuntoUrl, setAdjuntoUrl] = useState<string | null>(null);
  const [adjuntoImageId, setAdjuntoImageId] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [intento, setIntento] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ingreso con comprobante: al continuar se abre la emisión con el ítem ya cargado.
  const [emitir, setEmitir] = useState(false);
  const [comprobanteEmitir, setComprobanteEmitir] = useState<ComprobanteIngreso>("03");
  // Repetir automáticamente: en vez de registrar un movimiento, se guarda la regla.
  const [repetir, setRepetir] = useState(false);
  const [frecuencia, setFrecuencia] = useState<Frecuencia>("MENSUAL");
  const [diaMes, setDiaMes] = useState("");
  const [diaSemana, setDiaSemana] = useState(1);
  const [fechaFin, setFechaFin] = useState("");
  // Ingreso programado con comprobante (fases 2 y 3).
  const [compProg, setCompProg] = useState<ComprobanteProgramado | null>(null);
  const [cliDoc, setCliDoc] = useState("");
  const [cliNombre, setCliNombre] = useState("");
  const [cliDireccion, setCliDireccion] = useState("");
  const [emisionAuto, setEmisionAuto] = useState(false);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  // Fotos subidas en esta edición que no llegaron a guardarse: se borran al cancelar.
  const subidasSinGuardar = useRef<string[]>([]);
  const archivoRef = useRef<HTMLInputElement>(null);

  const editando = !!gasto;
  const activas = useMemo(
    () => categorias.filter((c) => c.tipo === tipo && (c.activa || c.categoriaId === (gasto?.categoriaId ?? programado?.categoriaId))),
    [categorias, gasto?.categoriaId, programado?.categoriaId, tipo],
  );

  // Conceptos de la categoría elegida (Servicios → Luz, Agua, Internet…): se eligen con
  // un clic y el texto queda como detalle opcional. "Otro" (o una categoría sin
  // conceptos) vuelve a la descripción escrita a mano.
  const conceptos = activas.find((c) => c.categoriaId === categoriaId)?.conceptos ?? [];
  const textoLibre = conceptos.length === 0 || concepto === OTRO;
  const descripcionFinal = textoLibre
    ? descripcion.trim()
    : concepto
      ? (descripcion.trim() ? `${concepto} - ${descripcion.trim()}` : concepto)
      : "";

  useEffect(() => {
    if (!isOpen) return;
    setIntento(false);
    setError(null);
    setEmitir(false);
    setComprobanteEmitir(config?.isBoletaOrFactura === "f" ? "01" : "03");
    subidasSinGuardar.current = [];
    const hoy = new Date();
    setRepetir(!!programado || iniciarRepitiendo);
    setFrecuencia(programado?.frecuencia ?? "MENSUAL");
    setDiaMes(String(programado?.frecuencia === "MENSUAL" && programado.dia ? programado.dia : hoy.getDate()));
    setDiaSemana(programado?.frecuencia === "SEMANAL" && programado.dia ? programado.dia : ((hoy.getDay() + 6) % 7) + 1);
    setFechaFin(programado?.fechaFin ?? "");
    setCompProg(programado?.tipoComprobante ?? null);
    setCliDoc(programado?.clienteNumDoc && programado.clienteNumDoc !== "0" ? programado.clienteNumDoc : "");
    setCliNombre(programado?.clienteRazonSocial && programado.clienteRazonSocial !== "Clientes Varios" ? programado.clienteRazonSocial : "");
    setCliDireccion(programado?.clienteDireccion ?? "");
    setEmisionAuto(programado?.emisionAutomatica ?? false);
    if (programado) {
      setMonto(String(programado.monto));
      setCategoriaId(programado.categoriaId);
      const lista = categorias.find((c) => c.categoriaId === programado.categoriaId)?.conceptos ?? [];
      const elegido = lista.find((c) => programado.descripcion === c || programado.descripcion.startsWith(`${c} - `));
      setConcepto(elegido ?? (lista.length > 0 ? OTRO : null));
      setDescripcion(elegido ? programado.descripcion.slice(elegido.length + 3) : programado.descripcion);
      setFecha(programado.fechaInicio.slice(0, 10));
      setMedioPago(programado.medioPago);
      setDeCaja(false);
      setSucursalId(programado.sucursalId);
      setTipoComprobante("00");
      setObservacion(programado.observacion ?? "");
      setAdjuntoUrl(null);
      setAdjuntoImageId(null);
      setMasDatos(false);
    } else if (gasto) {
      setMonto(String(gasto.monto));
      setCategoriaId(gasto.categoriaId);
      // Si la descripción empieza con uno de los conceptos, se marca y el resto es el detalle.
      const lista = categorias.find((c) => c.categoriaId === gasto.categoriaId)?.conceptos ?? [];
      const elegido = lista.find((c) => gasto.descripcion === c || gasto.descripcion.startsWith(`${c} - `));
      setConcepto(elegido ?? (lista.length > 0 ? OTRO : null));
      setDescripcion(elegido ? gasto.descripcion.slice(elegido.length + 3) : gasto.descripcion);
      setFecha(gasto.fecha.slice(0, 10));
      setMedioPago(gasto.medioPago);
      setDeCaja(gasto.pagadoConCaja);
      setSucursalId(gasto.sucursalId);
      setTipoComprobante(gasto.tipoComprobante || "00");
      setSerie(gasto.serie ?? "");
      setNumero(gasto.numero ?? "");
      setIgv(gasto.igv != null ? String(gasto.igv) : "");
      setIgvManual(gasto.igv != null);
      setProvDoc(gasto.proveedorDocumento ?? "");
      setProvNombre(gasto.proveedorNombre ?? "");
      setObservacion(gasto.observacion ?? "");
      setAdjuntoUrl(gasto.adjuntoUrl);
      setAdjuntoImageId(gasto.adjuntoImageId);
      setMasDatos(
        gasto.tipoComprobante !== "00" || !!gasto.proveedorNombre || !!gasto.adjuntoUrl || !!gasto.observacion,
      );
    } else {
      setMonto("");
      setCategoriaId(null);
      setConcepto(null);
      setDescripcion("");
      setFecha(fechaLocal());
      setMedioPago("Efectivo");
      setDeCaja(false);
      setSucursalId(esSuperAdmin ? null : sucursalUsuario);
      setTipoComprobante("00");
      setSerie("");
      setNumero("");
      setIgv("");
      setIgvManual(false);
      setProvDoc("");
      setProvNombre("");
      setObservacion("");
      setAdjuntoUrl(null);
      setAdjuntoImageId(null);
      setMasDatos(false);
    }
    // categorias solo se usa para leer los conceptos al abrir: si se recargan con el
    // modal abierto no hay que reiniciar el formulario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, gasto, programado, iniciarRepitiendo, sucursalUsuario, esSuperAdmin]);

  const montoNumero = parseFloat(monto);
  const montoValido = Number.isFinite(montoNumero) && montoNumero > 0;
  // En un ingreso, el comprobante es el propio (se emite); los campos de proveedor no aplican.
  const esFactura = !esIngreso && tipoComprobante === "01";
  const sinComprobante = esIngreso || tipoComprobante === "00";
  const facturado = esIngreso && !!gasto?.comprobanteId;
  // Programar: regla nueva (switch "Repetir") o edición de una regla existente.
  const editandoProgramado = !!programado;
  const programando = editandoProgramado || (!editando && repetir);
  const vaAEmitir = esIngreso && !editando && emitir && !programando;
  const diaRegla = frecuencia === "MENSUAL" ? Math.min(31, Math.max(1, parseInt(diaMes, 10) || 1)) : frecuencia === "SEMANAL" ? diaSemana : null;
  // Primera vez que se registrará (para editar no se recuperan días pasados: sigue desde hoy).
  const desdeRegla = editandoProgramado && fecha < fechaLocal() ? fechaLocal() : fecha;
  const proximaRegla = programando ? siguienteFecha(frecuencia, diaRegla, desdeRegla, fechaFin || null) : null;
  // Cliente del comprobante programado: factura con RUC; boleta con DNI o clientes varios (< S/ 700).
  const comprobanteProgramado = programando && esIngreso ? compProg : null;
  const errorCliente = (() => {
    if (!comprobanteProgramado) return null;
    const doc = cliDoc.replace(/\D/g, "");
    if (comprobanteProgramado === "01") {
      if (doc.length !== 11) return "La factura necesita el RUC del cliente (11 dígitos).";
      if (!cliNombre.trim()) return "Escribe la razón social del cliente.";
      return null;
    }
    if (!doc) {
      return comprobanteProgramado === "03" && montoValido && montoNumero >= MONTO_BOLETA_CON_DNI
        ? `Desde S/ ${MONTO_BOLETA_CON_DNI} la boleta tiene que llevar el DNI del cliente.`
        : null;
    }
    if (doc.length !== 8 && doc.length !== 11) return "El documento debe ser un DNI (8 dígitos) o un RUC (11).";
    if (!cliNombre.trim()) return "Escribe el nombre del cliente.";
    return null;
  })();

  const buscarCliente = async (doc: string) => {
    if (doc.length !== 8 && doc.length !== 11) return;
    setBuscandoCliente(true);
    try {
      if (doc.length === 11) {
        const r = await consultaRuc(doc);
        if (r?.razonSocial) setCliNombre(r.razonSocial);
        if (r?.direccionLineal) setCliDireccion(r.direccionLineal);
      } else {
        const r = await consultaDni(doc);
        if (r?.nombreCompleto) setCliNombre(r.nombreCompleto.trim());
      }
    } catch { /* el usuario puede escribir el nombre */ }
    finally { setBuscandoCliente(false); }
  };

  // IGV sugerido para facturas (incluido en el monto), con la tasa de la empresa.
  const igvSugerido = esFactura && montoValido ? Math.round((montoNumero * tasaIgv / (100 + tasaIgv)) * 100) / 100 : null;
  const igvMostrado = igvManual ? igv : igvSugerido != null ? igvSugerido.toFixed(2) : "";

  const cerrar = () => {
    if (guardando) return;
    // Fotos subidas y no guardadas: no dejar basura en Cloudflare.
    subidasSinGuardar.current.forEach(eliminarImagen);
    subidasSinGuardar.current = [];
    onClose();
  };

  const buscarRuc = async (doc: string) => {
    if (doc.length !== 11) return;
    setBuscandoRuc(true);
    try {
      const r = await consultaRuc(doc);
      if (r?.razonSocial) setProvNombre(r.razonSocial);
    } catch { /* el usuario puede escribir el nombre */ }
    finally { setBuscandoRuc(false); }
  };

  const subirFoto = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Solo se pueden adjuntar imágenes (foto del comprobante).");
      return;
    }
    setSubiendo(true);
    setError(null);
    try {
      const blob = await comprimirImagen(file);
      if (blob.size > 8 * 1024 * 1024) throw new Error("La imagen es demasiado grande.");
      const fd = new FormData();
      fd.append("file", blob, "comprobante.jpg");
      const res = await fetch("/api/upload-imagen", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.ok) throw new Error("No se pudo subir la foto.");
      // La foto anterior solo se borra si se subió en esta misma edición.
      if (adjuntoImageId && subidasSinGuardar.current.includes(adjuntoImageId)) {
        eliminarImagen(adjuntoImageId);
        subidasSinGuardar.current = subidasSinGuardar.current.filter((i) => i !== adjuntoImageId);
      }
      setAdjuntoUrl(data.url);
      setAdjuntoImageId(data.imageId ?? null);
      if (data.imageId) subidasSinGuardar.current.push(data.imageId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la foto.");
    } finally {
      setSubiendo(false);
    }
  };

  const quitarFoto = () => {
    if (adjuntoImageId && subidasSinGuardar.current.includes(adjuntoImageId)) {
      eliminarImagen(adjuntoImageId);
      subidasSinGuardar.current = subidasSinGuardar.current.filter((i) => i !== adjuntoImageId);
    }
    setAdjuntoUrl(null);
    setAdjuntoImageId(null);
  };

  const guardar = async () => {
    setIntento(true);
    if (!montoValido || !categoriaId || !descripcionFinal || guardando || subiendo) return;
    if (programando && (!proximaRegla || (frecuencia === "MENSUAL" && !diaMes.trim()) || errorCliente)) return;
    setGuardando(true);
    setError(null);

    // Repetir automáticamente: se guarda la regla; el proceso del servidor registra cada fecha.
    if (programando) {
      try {
        await onProgramar?.({
          tipo,
          categoriaId,
          descripcion: descripcionFinal.slice(0, 200),
          monto: Math.round(montoNumero * 100) / 100,
          medioPago,
          sucursalId: esSuperAdmin ? sucursalId : sucursalUsuario,
          tipoComprobante: comprobanteProgramado,
          clienteNumDoc: comprobanteProgramado ? cliDoc.replace(/\D/g, "") || null : null,
          clienteRazonSocial: comprobanteProgramado ? cliNombre.trim() || null : null,
          clienteDireccion: comprobanteProgramado ? cliDireccion.trim() || null : null,
          emisionAutomatica: !!comprobanteProgramado && emisionAuto,
          frecuencia,
          dia: diaRegla,
          fechaInicio: fecha,
          fechaFin: fechaFin || null,
          observacion: observacion.trim() || null,
        }, programado?.programadoId ?? null);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar la programación");
      } finally {
        setGuardando(false);
      }
      return;
    }

    const igvNumero = parseFloat(igvMostrado);
    const datos: GuardarGasto = {
      tipo,
      categoriaId,
      fecha: (deCaja && !editando) || vaAEmitir ? fechaLocal() : fecha,
      descripcion: descripcionFinal.slice(0, 200),
      monto: Math.round(montoNumero * 100) / 100,
      medioPago: deCaja && !vaAEmitir ? "Efectivo" : medioPago,
      tipoComprobante: facturado ? gasto!.tipoComprobante : sinComprobante ? "00" : tipoComprobante,
      serie: facturado ? gasto!.serie : sinComprobante ? null : serie.trim() || null,
      numero: facturado ? gasto!.numero : sinComprobante ? null : numero.trim() || null,
      igv: esFactura && Number.isFinite(igvNumero) && igvNumero > 0 ? igvNumero : null,
      proveedorId: gasto?.proveedorId ?? null,
      proveedorDocumento: provDoc.trim() || null,
      proveedorNombre: provNombre.trim() || null,
      sucursalId: esSuperAdmin ? sucursalId : sucursalUsuario,
      adjuntoUrl,
      adjuntoImageId,
      observacion: observacion.trim() || null,
      pagadoConCaja: !editando && deCaja && !vaAEmitir,
    };

    // Ingreso facturado: se abre la emisión dentro de Movimientos con el ítem cargado. El
    // ingreso se registra recién cuando el comprobante se guarda (si se vuelve sin emitir, nada).
    if (vaAEmitir) {
      const categoria = activas.find((c) => c.categoriaId === categoriaId);
      iniciarEmisionIngreso(datos, comprobanteEmitir, categoria?.nombre ?? "Ingreso", tasaIgv);
      subidasSinGuardar.current = [];
      setGuardando(false);
      onClose();
      onEmitir?.();
      return;
    }

    try {
      await onGuardar(datos, gasto?.gastoId ?? null);
      // La foto vieja que se reemplazó o quitó ya no se usa.
      if (gasto?.adjuntoImageId && gasto.adjuntoImageId !== adjuntoImageId) eliminarImagen(gasto.adjuntoImageId);
      subidasSinGuardar.current = [];
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : esIngreso ? "No se pudo guardar el ingreso" : "No se pudo guardar el gasto");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={cerrar}
      title={
        editandoProgramado
          ? esIngreso ? "Editar ingreso programado" : "Editar gasto programado"
          : esIngreso ? (editando ? "Editar ingreso" : "Nuevo ingreso") : (editando ? "Editar gasto" : "Nuevo gasto")
      }
      className="max-w-xl"
    >
      <div className="space-y-4">
        {/* Monto */}
        <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 focus-within:border-brand-blue/50 focus-within:bg-white">
          <span className="text-lg font-bold text-gray-400">S/</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0.00"
            autoFocus
            disabled={facturado}
            className="w-full bg-transparent text-2xl font-black text-gray-900 outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
        {intento && !montoValido && (
          <p className="-mt-2 text-xs text-rose-600">{esIngreso ? "Escribe cuánto ingresó" : "Escribe el monto del gasto"}</p>
        )}
        {facturado && (
          <div className="-mt-1 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
            <FileCheck className="w-4 h-4 shrink-0" />
            Tiene {nombreComprobante(gasto!.tipoComprobante).toLowerCase()} {[gasto!.serie, gasto!.numero].filter(Boolean).join("-")}:
            el monto no se cambia. Para corregirlo emite una nota de crédito.
          </div>
        )}

        {/* Categoría */}
        <div className="space-y-1.5">
          <p className={claseLabel}>Categoría <span className="text-rose-500">*</span></p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {activas.map((c) => {
              const sel = c.categoriaId === categoriaId;
              return (
                <button
                  key={c.categoriaId}
                  type="button"
                  onClick={() => {
                    if (c.categoriaId !== categoriaId) setConcepto(null);
                    setCategoriaId(c.categoriaId);
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs font-semibold transition-colors",
                    sel ? "border-transparent text-white" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                  )}
                  style={sel ? { backgroundColor: c.color } : undefined}
                >
                  <IconoGasto nombre={c.icono} className="w-4 h-4 shrink-0" style={sel ? undefined : { color: c.color }} />
                  <span className="truncate">{c.nombre}</span>
                </button>
              );
            })}
          </div>
          {activas.length === 0 && (
            <p className="text-xs text-gray-500">No hay categorías activas. Créalas en Gastos e ingresos → Categorías.</p>
          )}
          {intento && !categoriaId && <p className="text-xs text-rose-600">Elige una categoría</p>}
        </div>

        {/* ¿En qué se gastó? / ¿De qué es el ingreso? */}
        <div className="space-y-1.5">
          <p className={claseLabel}>{esIngreso ? "¿De qué es el ingreso?" : "¿En qué se gastó?"} <span className="text-rose-500">*</span></p>
          {conceptos.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[...conceptos, OTRO].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setConcepto(c)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    concepto === c ? "border-brand-blue bg-brand-blue text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                  )}
                >
                  {c === OTRO ? "Otro" : c}
                </button>
              ))}
            </div>
          )}
          {(textoLibre || concepto) && (
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={textoLibre ? 200 : 150}
              placeholder={
                textoLibre
                  ? esIngreso ? "Ej. Pollada del sábado" : "Ej. Compra de focos para el local"
                  : esIngreso ? "Detalle (opcional). Ej. sábado 15" : "Detalle (opcional). Ej. recibo de noviembre"
              }
              className={claseInput}
            />
          )}
          {intento && !descripcionFinal && (
            <p className="text-xs text-rose-600">
              {esIngreso
                ? conceptos.length > 0 && !concepto ? "Elige de qué es el ingreso" : "Escribe de qué es el ingreso"
                : conceptos.length > 0 && !concepto ? "Elige en qué se gastó" : "Escribe en qué se gastó"}
            </p>
          )}
        </div>

        {/* Repetir automáticamente: se registra solo cada mes, quincena o semana */}
        {!editando && (
          <div className={cn(
            "rounded-xl border px-3 py-2.5 transition-colors",
            programando ? "border-brand-blue/40 bg-brand-blue/5" : "border-gray-200 bg-white",
          )}>
            <label className={cn("flex items-center justify-between gap-3", !editandoProgramado && "cursor-pointer")}>
              <span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                  <Repeat className="w-4 h-4 text-brand-blue" /> Repetir automáticamente
                </span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  {esIngreso
                    ? "Para ingresos fijos: se registra solo en cada fecha."
                    : "Para gastos fijos (internet, alquiler, sueldos…): se registra solo en cada fecha."}
                </span>
              </span>
              {!editandoProgramado && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={repetir}
                  onClick={() => setRepetir((v) => !v)}
                  className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", repetir ? "bg-brand-blue" : "bg-gray-300")}
                >
                  <span className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                    repetir ? "left-5.5" : "left-0.5",
                  )} />
                </button>
              )}
            </label>
            {programando && (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {FRECUENCIAS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFrecuencia(f.id)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                        frecuencia === f.id ? "border-brand-blue bg-brand-blue text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                      )}
                    >
                      {f.nombre}
                    </button>
                  ))}
                </div>
                {frecuencia === "MENSUAL" && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <span>El día</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={31}
                      value={diaMes}
                      onChange={(e) => setDiaMes(e.target.value.replace(/\D/g, "").slice(0, 2))}
                      className="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1 text-center text-sm font-semibold outline-none focus:border-brand-blue/50"
                    />
                    <span>de cada mes</span>
                  </div>
                )}
                {frecuencia === "SEMANAL" && (
                  <div className="flex flex-wrap gap-1">
                    {DIAS_SEMANA.map((d, i) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDiaSemana(i + 1)}
                        title={d}
                        className={cn(
                          "h-8 w-9 rounded-lg border text-xs font-semibold transition-colors",
                          diaSemana === i + 1 ? "border-brand-blue bg-brand-blue text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                        )}
                      >
                        {d.slice(0, 2)}
                      </button>
                    ))}
                  </div>
                )}
                {frecuencia === "SEMANAL" && (
                  <p className="text-xs text-gray-600">Todos los {(() => { const d = (DIAS_SEMANA[diaSemana - 1] ?? "").toLowerCase(); return d.endsWith("s") ? d : `${d}s`; })()}.</p>
                )}
                {frecuencia === "QUINCENAL" && (
                  <p className="text-xs text-gray-600">El 15 y el último día de cada mes.</p>
                )}
                {frecuencia === "FIN_MES" && (
                  <p className="text-xs text-gray-600">El último día de cada mes (28, 30 o 31).</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <p className={claseLabel}>Empieza</p>
                    <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={claseInput} />
                  </div>
                  <div className="space-y-1">
                    <p className={claseLabel}>Termina <span className="font-normal normal-case text-gray-400">(opcional)</span></p>
                    <input type="date" value={fechaFin} min={fecha} onChange={(e) => setFechaFin(e.target.value)} className={claseInput} />
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-white/70 px-2.5 py-2 text-xs text-gray-600">
                  <CalendarClock className="w-4 h-4 text-brand-blue shrink-0" />
                  {proximaRegla ? (() => {
                    const hoy = fechaLocal();
                    const { fechas, total } = fechasRegla(frecuencia, diaRegla, desdeRegla, fechaFin || null);
                    const accion = !comprobanteProgramado ? "Se registra" : emisionAuto ? "Se emite" : "Te avisa para emitir";
                    const quedan = total === null ? null : total - fechas.length;
                    return (
                      <div className="min-w-0 space-y-1.5">
                        <p>
                          <b className="text-gray-800">{accion}</b>{" "}
                          {total === null ? "en estas fechas, sin fin:" : total === 1 ? "una sola vez:" : `${total} veces:`}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {fechas.map((f) => (
                            <span
                              key={f}
                              className={cn(
                                "rounded-md border px-1.5 py-0.5 font-semibold tabular-nums",
                                f === hoy ? "border-brand-blue bg-brand-blue text-white"
                                  : f < hoy ? "border-amber-200 bg-amber-50 text-amber-800"
                                    : "border-gray-200 bg-white text-gray-700",
                              )}
                            >
                              {formatFechaDia(f)}{f === hoy ? " · hoy" : f < hoy ? " · ya pasó" : ""}
                            </span>
                          ))}
                          {(quedan === null || quedan > 0) && (
                            <span className="px-1 py-0.5 text-gray-400">
                              {quedan === null ? "… y así sigue" : `… y ${quedan} más`}
                            </span>
                          )}
                        </div>
                        <p>
                          {fechas[0] <= hoy && (
                            <>{fechas[0] < hoy ? (fechas.includes(hoy) ? "Las que ya pasaron y la de hoy" : "Las que ya pasaron") : "La de hoy"}: <b className="text-gray-800">{
                              (fechas[0] < hoy
                                ? ["se registran al guardar", "se emiten en los próximos 30 minutos", "quedan por emitir al guardar"]
                                : ["se registra al guardar", "se emite en los próximos 30 minutos", "queda por emitir al guardar"]
                              )[!comprobanteProgramado ? 0 : emisionAuto ? 1 : 2]
                            }</b>. </>
                          )}
                          {comprobanteProgramado
                            ? emisionAuto
                              ? "El comprobante se emite solo en cada fecha."
                              : "En cada fecha te aparece en «Por emitir» para emitirlo con un clic."
                            : <>No toca la caja{esIngreso ? "" : ": no descuenta del efectivo del turno"}.</>}
                        </p>
                      </div>
                    );
                  })() : (
                    <span className="text-rose-600">Entre esas fechas no cae ningún día que toque. Cambia el día o la fecha en que termina.</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ingreso con comprobante: boleta, factura o nota de venta */}
        {esIngreso && !editando && !programando && (
          <div className={cn(
            "rounded-xl border px-3 py-2.5 transition-colors",
            emitir ? "border-brand-blue/40 bg-brand-blue/5" : "border-gray-200 bg-white",
          )}>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                  <FileCheck className="w-4 h-4 text-brand-blue" /> Emitir comprobante
                </span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  Si el cliente te pide boleta o factura (por ejemplo, por alquilar tu local).
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={emitir}
                onClick={() => setEmitir((v) => !v)}
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                  emitir ? "bg-brand-blue" : "bg-gray-300",
                )}
              >
                <span className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                  emitir ? "left-5.5" : "left-0.5",
                )} />
              </button>
            </label>
            {emitir && (
              <div className="mt-2.5 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {OPCIONES_EMISION.filter((o) => o.codigo !== "NV" || config?.useNotaVenta).map((o) => (
                    <button
                      key={o.codigo}
                      type="button"
                      onClick={() => setComprobanteEmitir(o.codigo)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                        comprobanteEmitir === o.codigo ? "border-brand-blue bg-brand-blue text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                      )}
                    >
                      {o.nombre}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Al continuar se abre aquí mismo el formulario de emisión con el monto ya cargado: eliges al cliente y emites.
                  El ingreso se registra solo cuando el comprobante se emite, y cuenta como venta del mes.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Salió de / entró a la caja. Con comprobante se mantiene a la vista: el ingreso entra a
            la caja como venta en efectivo del turno (no se suma aparte, para no contarlo dos veces). */}
        {!editando && cajaTurnoAbiertoId && !programando && (
          <label className={cn(
            "flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors",
            deCaja
              ? esIngreso ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"
              : "border-gray-200 bg-white hover:bg-gray-50",
          )}>
            <input
              type="checkbox"
              checked={deCaja}
              onChange={(e) => setDeCaja(e.target.checked)}
              className={cn("mt-0.5 h-4 w-4", esIngreso ? "accent-emerald-600" : "accent-amber-600")}
            />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                <Banknote className={cn("w-4 h-4", esIngreso ? "text-emerald-600" : "text-amber-600")} />
                {esIngreso ? "Entró al efectivo de la caja" : "Salió del efectivo de la caja"}
              </span>
              <span className="block text-xs text-gray-500 mt-0.5">
                {!esIngreso
                  ? "Se registra como retiro de tu turno y se descuenta del efectivo esperado al cuadrar."
                  : !vaAEmitir
                    ? "Se suma al efectivo esperado de tu turno al cuadrar."
                    : deCaja
                      ? "Al emitir, entra a tu caja como venta en efectivo del turno. Deja «Efectivo» como medio de pago en el formulario."
                      : "Márcalo si te pagan en efectivo: al emitir entrará a tu caja como venta del turno."}
              </span>
            </span>
          </label>
        )}
        {editando && gasto?.pagadoConCaja && (
          <div className={cn(
            "flex items-start gap-2 rounded-xl border px-3 py-2 text-xs",
            esIngreso ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800",
          )}>
            <Banknote className="w-4 h-4 shrink-0" />
            {esIngreso ? "Este ingreso entró al efectivo de la caja." : "Este gasto salió del efectivo de la caja."}{" "}
            Si el turno ya se cuadró, no se puede cambiar el monto.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Fecha */}
          {esAdmin && !(deCaja && !editando) && !vaAEmitir && !facturado && !programando && (
            <div className="space-y-1.5">
              <p className={claseLabel}>Fecha</p>
              <input type="date" value={fecha} max={fechaLocal()} onChange={(e) => setFecha(e.target.value)} className={claseInput} />
            </div>
          )}
          {/* Sucursal */}
          {esSuperAdmin && sucursales.length > 0 && (
            <div className="space-y-1.5">
              <p className={claseLabel}>Sucursal</p>
              <select
                value={sucursalId ?? ""}
                onChange={(e) => setSucursalId(e.target.value ? Number(e.target.value) : null)}
                className={claseInput}
              >
                <option value="">Toda la empresa (sin sucursal)</option>
                {sucursales.map((s) => (
                  <option key={s.sucursalId} value={s.sucursalId}>{s.nombre}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Medio de pago */}
        {(!deCaja || programando) && !vaAEmitir && (
          <div className="space-y-1.5">
            <p className={claseLabel}>{esIngreso ? "¿Cómo te pagaron?" : "Medio de pago"}</p>
            <div className="flex flex-wrap gap-1.5">
              {MEDIOS_PAGO.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMedioPago(m)}
                  disabled={editando && gasto?.pagadoConCaja}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
                    medioPago === m ? "border-brand-blue bg-brand-blue text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Ingreso programado con comprobante: cada fecha queda por emitir, o se emite sola */}
        {programando && esIngreso && (
          <div className={cn(
            "rounded-xl border px-3 py-2.5 space-y-2.5",
            comprobanteProgramado ? "border-brand-blue/40 bg-brand-blue/5" : "border-gray-200 bg-white",
          )}>
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                <FileCheck className="w-4 h-4 text-brand-blue" /> Comprobante en cada fecha
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Si a este cliente le emites boleta, factura o nota de venta cada vez.</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {([null, "03", "01", "NV"] as (ComprobanteProgramado | null)[])
                .filter((c) => c !== "NV" || config?.useNotaVenta)
                .map((c) => (
                  <button
                    key={c ?? "sin"}
                    type="button"
                    onClick={() => setCompProg(c)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                      compProg === c ? "border-brand-blue bg-brand-blue text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                    )}
                  >
                    {c === null ? "Sin comprobante" : c === "03" ? "Boleta" : c === "01" ? "Factura" : "Nota de venta"}
                  </button>
                ))}
            </div>
            {comprobanteProgramado && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  <div className="space-y-1 sm:col-span-2">
                    <p className={claseLabel}>
                      {comprobanteProgramado === "01" ? "RUC del cliente" : "DNI o RUC"}
                      {comprobanteProgramado !== "01" && <span className="font-normal normal-case text-gray-400"> (opcional)</span>}
                    </p>
                    <div className="relative">
                      <input
                        value={cliDoc}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, 11);
                          setCliDoc(v);
                          if (v.length === 11 || (v.length === 8 && comprobanteProgramado !== "01")) buscarCliente(v);
                        }}
                        inputMode="numeric"
                        placeholder={comprobanteProgramado === "01" ? "20123456789" : "Vacío = clientes varios"}
                        className={cn(claseInput, "pr-8")}
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                        {buscandoCliente ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1 sm:col-span-3">
                    <p className={claseLabel}>{comprobanteProgramado === "01" ? "Razón social" : "Nombre"}</p>
                    <input
                      value={cliNombre}
                      onChange={(e) => setCliNombre(e.target.value)}
                      maxLength={200}
                      placeholder={cliDoc ? "Nombre del cliente" : "Clientes Varios"}
                      className={claseInput}
                    />
                  </div>
                </div>
                {comprobanteProgramado === "01" && (
                  <input
                    value={cliDireccion}
                    onChange={(e) => setCliDireccion(e.target.value)}
                    maxLength={255}
                    placeholder="Dirección fiscal (opcional, se llena con el RUC)"
                    className={claseInput}
                  />
                )}
                {errorCliente && intento && <p className="text-xs text-rose-600">{errorCliente}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {[
                    { auto: false, titulo: "Avisarme para emitir", texto: "El día que toca aparece en «Por emitir»: revisas y emites con un clic." },
                    { auto: true, titulo: "Emitir automáticamente", texto: "Se emite solo y se envía a SUNAT a primera hora del día que toca (12:00 a 12:30 a. m.). Si algo falla, te avisa." },
                  ].map((o) => (
                    <button
                      key={String(o.auto)}
                      type="button"
                      onClick={() => setEmisionAuto(o.auto)}
                      className={cn(
                        "rounded-lg border px-2.5 py-2 text-left transition-colors",
                        emisionAuto === o.auto ? "border-brand-blue bg-white ring-1 ring-brand-blue" : "border-gray-200 bg-white/70 hover:bg-white",
                      )}
                    >
                      <span className="block text-xs font-semibold text-gray-800">{o.titulo}</span>
                      <span className="block text-[11px] text-gray-500 leading-snug mt-0.5">{o.texto}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Nota de la regla programada (los demás datos opcionales no se repiten) */}
        {programando && (
          <div className="space-y-1">
            <p className={claseLabel}>Nota <span className="font-normal normal-case text-gray-400">(opcional)</span></p>
            <input value={observacion} onChange={(e) => setObservacion(e.target.value)} maxLength={255} placeholder="Ej. Plan de 100 Mbps" className={claseInput} />
          </div>
        )}

        {/* Más datos (en un ingreso facturado los datos del cliente salen del comprobante) */}
        {!vaAEmitir && !programando && (
        <div className="rounded-xl border border-gray-200">
          <button
            type="button"
            onClick={() => setMasDatos((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-gray-700"
          >
            <span className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-gray-400" />
              {esIngreso ? "Cliente, foto y nota" : "Comprobante, proveedor y foto"} <span className="font-normal text-gray-400">(opcional)</span>
            </span>
            <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", masDatos && "rotate-180")} />
          </button>
          {masDatos && (
            <div className="space-y-3 border-t border-gray-100 px-3 py-3">
              {!esIngreso && (
              <div className="space-y-1.5">
                <p className={claseLabel}>Comprobante del proveedor</p>
                <div className="flex flex-wrap gap-1.5">
                  {TIPOS_COMPROBANTE.map((t) => (
                    <button
                      key={t.codigo}
                      type="button"
                      onClick={() => setTipoComprobante(t.codigo)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                        tipoComprobante === t.codigo ? "border-brand-blue bg-brand-blue text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                      )}
                    >
                      {t.nombre}
                    </button>
                  ))}
                </div>
              </div>
              )}

              {!sinComprobante && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <p className={claseLabel}>Serie</p>
                    <input value={serie} onChange={(e) => setSerie(e.target.value.toUpperCase())} maxLength={4} placeholder="F001" className={claseInput} />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <p className={claseLabel}>Número</p>
                    <input value={numero} onChange={(e) => setNumero(e.target.value.replace(/[^0-9]/g, ""))} maxLength={10} placeholder="1234" className={claseInput} />
                  </div>
                </div>
              )}

              {esFactura && (
                <div className="space-y-1">
                  <p className={claseLabel}>IGV incluido ({tasaIgv}%)</p>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={igvMostrado}
                    onChange={(e) => { setIgvManual(true); setIgv(e.target.value); }}
                    className={claseInput}
                  />
                  <p className="text-[11px] text-gray-400">Solo informativo: no reemplaza tu registro de compras.</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                <div className="space-y-1 sm:col-span-2">
                  <p className={claseLabel}>{esIngreso ? "RUC o DNI del cliente" : "RUC o DNI del proveedor"}</p>
                  <div className="relative">
                    <input
                      value={provDoc}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 11);
                        setProvDoc(v);
                        if (v.length === 11) buscarRuc(v);
                      }}
                      inputMode="numeric"
                      placeholder="20123456789"
                      className={cn(claseInput, "pr-8")}
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                      {buscandoRuc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </span>
                  </div>
                </div>
                <div className="space-y-1 sm:col-span-3">
                  <p className={claseLabel}>{esIngreso ? "Cliente / quién pagó" : "Proveedor"}</p>
                  <input value={provNombre} onChange={(e) => setProvNombre(e.target.value)} maxLength={200} placeholder="Nombre o razón social" className={claseInput} />
                </div>
              </div>

              <div className="space-y-1.5">
                <p className={claseLabel}>{esIngreso ? "Foto (recibo, voucher…)" : "Foto del comprobante"}</p>
                {adjuntoUrl ? (
                  <div className="flex items-center gap-3">
                    <a href={adjuntoUrl} target="_blank" rel="noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={adjuntoUrl} alt="Comprobante" className="h-20 w-20 rounded-lg border border-gray-200 object-cover" />
                    </a>
                    <Button variant="outline" onClick={quitarFoto} className="text-xs">
                      <Trash2 className="w-3.5 h-3.5" /> Quitar
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => archivoRef.current?.click()}
                    disabled={subiendo}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-3 py-3 text-xs font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    {subiendo ? "Subiendo foto…" : "Tomar o elegir foto"}
                  </button>
                )}
                <input
                  ref={archivoRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) subirFoto(f);
                  }}
                />
              </div>

              <div className="space-y-1">
                <p className={claseLabel}>Nota</p>
                <input value={observacion} onChange={(e) => setObservacion(e.target.value)} maxLength={255} placeholder="Opcional" className={claseInput} />
              </div>
            </div>
          )}
        </div>
        )}

        {error && (
          <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="outline" onClick={cerrar} disabled={guardando}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando || subiendo}>
            {guardando
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : vaAEmitir ? <ArrowRight className="w-4 h-4" /> : programando ? <Repeat className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
            {guardando
              ? "Guardando…"
              : editando || editandoProgramado
                ? "Guardar cambios"
                : programando
                  ? esIngreso ? "Programar ingreso" : "Programar gasto"
                : vaAEmitir
                  ? `Continuar a emitir ${OPCIONES_EMISION.find((o) => o.codigo === comprobanteEmitir)?.nombre.toLowerCase()}`
                  : esIngreso ? "Registrar ingreso" : "Registrar gasto"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
