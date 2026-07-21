"use client";
import { useRouter } from "next/navigation";
import {
  Search, Printer, ShieldCheck, ChevronLeft, Download,
  ExternalLink, UserRound, ClipboardList, Trash2, Plus, X, Info,
} from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useMemo, Suspense } from "react";
import axios from "axios";
import { useToast } from "@/app/components/ui/Toast";
import { useSucursal } from "../boleta/gestionBoletas/useSucursal";
import { useSucursalRuc } from "../boleta/gestionBoletas/useSucursalRuc";
import { useEmpresaEmisor } from "../boleta/gestionBoletas/useEmpresaEmisor";
import { Sucursal } from "../boleta/gestionBoletas/Boleta";
import { formatoFechaActual } from "@/app/components/ui/formatoFecha";
import { numeroAlertas } from "@/app/components/ui/numeroAlertas";
import { NotaCredito } from "../nota-credito/gestionNotaCredito/NotacreditoDebito";
import { useComprobanteRucSerieCorrelativo } from "../nota-credito/gestionNotaCredito/Usecomprobanterucseriecorrelativo";
import { useSearchParams } from 'next/navigation'
import { useRef } from "react";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { useProductosSucursal } from "../../productos/gestioProductos/useProductosSucursal";
import { avisarStockBajoWhatsapp } from "../../productos/gestioProductos/stockAlerta";
import { actualizarStock } from "../../productos/gestioProductos/actualizarStock";

// ── Catálogo de motivos SUNAT Nota Débito ────────────────────
const MOTIVOS_ND = [
  { code: "01", label: "Intereses por mora" },
  { code: "02", label: "Aumento en el valor" },
  { code: "03", label: "Penalidades / otros conceptos" },
];

// ── Helper: obtener fecha local ──────────────────────────────
const obtenerFechaLocal = (offsetDias = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  const offsetMinutos = d.getTimezoneOffset();
  const fechaLocal = new Date(d.getTime() - offsetMinutos * 60000);
  return fechaLocal.toISOString().slice(0, 10);
};

// ── Interface local para detalles editables ──────────────────
interface DetalleEditable {
  productoId: number;
  codProducto: string | null;
  unidad: string;
  descripcion: string;
  cantidad: number | string;
  mtoValorUnitario: number;
  mtoBaseIgv: number;
  porcentajeIgv: number;
  igv: number;
  tipAfeIgv: number;
  mtoPrecioUnitario: number;
  mtoValorVenta: number;
  totalVentaItem: number;
  icbper: number;
  factorIcbper: number;
  _montoConIgv?: number | string;
  _precioVentaOriginal?: number; // precio unitario con IGV original (referencia motivo 02)
  _cantidadOriginal?: number; // cantidad del comprobante original (referencia motivo 03 sin penalidad)
}

// ── Helper: recalcular desde monto CON IGV ───────────────────
const recalcularDesdeMontoConIgv = (d: DetalleEditable, montoConIgvRaw: number | string): DetalleEditable => {
  const montoConIgv = Number(montoConIgvRaw) || 0;
  const es10 = d.tipAfeIgv === 10;
  const pct = d.porcentajeIgv || 18;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const numCant = Number(d.cantidad) || 0;
  
  const mtoValorUnitario = es10
    ? parseFloat((montoConIgv / (1 + pct / 100)).toFixed(6))
    : montoConIgv;
  const mtoBaseIgv = round2(mtoValorUnitario * numCant);
  const igv = es10 ? round2(montoConIgv * numCant - mtoBaseIgv) : 0;
  const totalVentaItem = round2(montoConIgv * numCant);

  return {
    ...d,
    _montoConIgv: montoConIgvRaw,
    mtoValorUnitario,
    mtoBaseIgv,
    igv,
    mtoValorVenta: mtoBaseIgv,
    mtoPrecioUnitario: round2(mtoValorUnitario * (1 + pct / 100)),
    totalVentaItem,
  };
};

// ── Helper: recalcular fila normal ───────────────────────────
const recalcularDetalle = (d: DetalleEditable): DetalleEditable => {
  const es10 = d.tipAfeIgv === 10;
  const numCant = Number(d.cantidad) || 0;
  const baseIgv = parseFloat((d.mtoValorUnitario * numCant).toFixed(2));
  const igv = es10 ? parseFloat(((baseIgv * d.porcentajeIgv) / 100).toFixed(2)) : 0;
  const precioConIGV = es10
    ? parseFloat((d.mtoValorUnitario * (1 + d.porcentajeIgv / 100)).toFixed(2))
    : d.mtoValorUnitario;
  return {
    ...d,
    mtoBaseIgv: baseIgv,
    igv,
    mtoValorVenta: baseIgv,
    mtoPrecioUnitario: precioConIGV,
    totalVentaItem: parseFloat((precioConIGV * numCant).toFixed(2)),
  };
};

// ── Helper: item vacío ───────────────────────────────────────
const itemVacio = (descripcion: string = "", porcentajeIgv: number = 18): DetalleEditable => ({
  productoId: 0, codProducto: null, unidad: "NIU", descripcion,
  cantidad: 1, mtoValorUnitario: 0, mtoBaseIgv: 0, porcentajeIgv,
  igv: 0, tipAfeIgv: 10, mtoPrecioUnitario: 0, mtoValorVenta: 0,
  totalVentaItem: 0, icbper: 0, factorIcbper: 0, _montoConIgv: 0,
});

// ── Helper: construir detalles según motivo ──────────────────
const construirDetallesPorMotivo = (
  codMotivo: string,
  originales: DetalleEditable[],
  incluyePenalidad: boolean = false,
): DetalleEditable[] => {
  const pct = originales[0]?.porcentajeIgv ?? 18;
  switch (codMotivo) {
    case "01":
      return [itemVacio("INTERESES POR MORA", pct)];

    case "02":
      // Un ítem por producto, cantidad fija, monto adicional editable
      return originales.map((d) => ({
        ...itemVacio(`AUMENTO EN EL VALOR: ${d.descripcion}`, d.porcentajeIgv),
        productoId: d.productoId,
        codProducto: d.codProducto,
        unidad: d.unidad,
        tipAfeIgv: d.tipAfeIgv,
        cantidad: d.cantidad,
        _precioVentaOriginal: d.mtoPrecioUnitario, // precio unitario c/IGV original
      }));

    case "03":
      // Si penalidad activa: un solo ítem POR PENALIDAD
      // Si no: ítems originales como referencia — la cantidad editable
      // representa las unidades ADICIONALES a debitar (no el total).
      // Ej: original trae 7, si quieres añadir 3 más, el campo debe quedar en 3.
      if (incluyePenalidad) {
        return [itemVacio("POR PENALIDAD", pct)];
      }
      return originales.map((d) =>
        recalcularDetalle({
          ...d,
          cantidad: 1,
          _cantidadOriginal: Number(d.cantidad) || 0,
          _montoConIgv: d.mtoPrecioUnitario,
        }),
      );

    default:
      return [itemVacio("", pct)];
  }
};

function NotaDebitoContent() {
  const searchParams = useSearchParams()
  const { showToast } = useToast();
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const isSuperAdmin = user?.rol === "superadmin";

  const { empresa } = useEmpresaEmisor();
  const { sucursal: sucursalDelHook, loadingSucursal } = useSucursal();
  const [sucursal, setSucursal] = useState<Sucursal | null>(null);
  const { sucursales, loadingSucursales } = useSucursalRuc(isSuperAdmin);
  const [correlativoNDFactura, setCorrelativoNDFactura] = useState<number | null>(null);
  const [correlativoNDBoleta, setCorrelativoNDBoleta] = useState<number | null>(null);

  const sinSucursal = isSuperAdmin && !sucursal;
  const { fechaHora } = formatoFechaActual();

  const { comprobante, loadingComprobante, errorComprobante, buscarComprobante, limpiarComprobante } =
    useComprobanteRucSerieCorrelativo();

  const { config } = useConfiguracion();
  const { productosSucursal, fetchProductosSucursal } = useProductosSucursal(
    isSuperAdmin ? sucursal?.sucursalId : undefined,
  );

  const [serieInput, setSerieInput] = useState("");
  const [correlativoInput, setCorrelativoInput] = useState("");
  const [emitido, setEmitido] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);
  const [errorEmision, setErrorEmision] = useState<string | null>(null);
  const [codMotivo, setCodMotivo] = useState("");
  const [desMotivo, setDesMotivo] = useState("");
  const [fechaEmision, setFechaEmision] = useState(fechaHora.slice(0, 10));
  const [detalles, setDetalles] = useState<DetalleEditable[]>([]);
  const [detallesOriginales, setDetallesOriginales] = useState<DetalleEditable[]>([]);
  const [incluyePenalidad, setIncluyePenalidad] = useState(false);
  const [comprobanteIdEmitido, setComprobanteIdEmitido] = useState<number | null>(null);
  const [tamanoPdf, setTamanoPdf] = useState("A4");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [cargandoPdf, setCargandoPdf] = useState(false);
  const [correoCliente, setCorreoCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [enviarCorreo, setEnviarCorreo] = useState(false);
  const [enviarWhatsapp, setEnviarWhatsapp] = useState(false);
  const [vieneDesdeLista, setVieneDesdeLista] = useState(!!(searchParams.get('serie') && searchParams.get('correlativo') && searchParams.get('ruc')))

  // ── Effects ──────────────────────────────────────────────────
  useEffect(() => {
    if (!sucursalDelHook || isSuperAdmin) return;
    setSucursal(sucursalDelHook);
  }, [sucursalDelHook, isSuperAdmin]);

  useEffect(() => {
    if (!sucursal) return;
    setCorrelativoNDFactura(sucursal.correlativoNotaDebitoFactura ?? null);
    setCorrelativoNDBoleta(sucursal.correlativoNotaDebitoBoleta ?? null);
  }, [sucursal]);

  useEffect(() => {
    if (!comprobante) { setDetalles([]); setDetallesOriginales([]); return; }
    const originales = comprobante.details.map((d) => ({
      productoId: d.productoId ?? 0,
      codProducto: d.codigo,
      unidad: d.unidadMedida,
      descripcion: d.descripcion,
      cantidad: d.cantidad,
      mtoValorUnitario: d.precioUnitario,
      mtoBaseIgv: d.baseIgv,
      porcentajeIgv: d.porcentajeIGV,
      igv: d.montoIGV,
      tipAfeIgv: Number(d.tipoAfectacionIGV),
      mtoPrecioUnitario: d.precioVenta,
      mtoValorVenta: d.valorVenta,
      totalVentaItem: d.totalVentaItem,
      icbper: d.icbper ?? 0,
      factorIcbper: d.factorIcbper ?? 0,
      _montoConIgv: d.precioVenta,
      _precioVentaOriginal: d.precioVenta,
    }));
    setDetallesOriginales(originales);
    if (codMotivo) {
      if (codMotivo === "01" && comprobante?.tipoPago === "Contado") {
        setDetalles(originales.map((d) => ({ ...d })));
      } else {
        setDetalles(construirDetallesPorMotivo(codMotivo, originales, incluyePenalidad));
        }
      }
  }, [comprobante]);

  useEffect(() => {
    if (!codMotivo || !detallesOriginales.length) return;
    // Motivo 01 con contado: no generar ítems
    if (codMotivo === "01" && comprobante?.tipoPago === "Contado") {
      setDetalles(detallesOriginales.map((d) => ({ ...d })));
      return;
    }
    setDetalles(construirDetallesPorMotivo(codMotivo, detallesOriginales, incluyePenalidad));
  }, [codMotivo, comprobante]);

  // ── Toggle penalidad (motivo 03) ─────────────────────────────
  useEffect(() => {
    if (codMotivo !== "03" || !detallesOriginales.length) return;
    if (incluyePenalidad) {
      setDetalles([itemVacio("POR PENALIDAD", detallesOriginales[0]?.porcentajeIgv ?? 18)]);
    } else {
      setDetalles(
        detallesOriginales.map((d) =>
          recalcularDetalle({
            ...d,
            cantidad: 1,
            _cantidadOriginal: Number(d.cantidad) || 0,
            _montoConIgv: d.mtoPrecioUnitario,
          }),
        ),
      );
    }
  }, [incluyePenalidad]);

    // ── Series disponibles ───────────────────────────────────────
  const seriesDisponibles = useMemo((): { serie: string; nombre: string }[] => {
    if (!sucursal) return [];
    const nombre = sucursal.nombre ?? sucursal.codEstablecimiento;
    return [
      ...(sucursal.serieFactura ? [{ serie: sucursal.serieFactura, nombre }] : []),
      ...(sucursal.serieBoleta ? [{ serie: sucursal.serieBoleta, nombre }] : []),
    ];
  }, [sucursal]);

  useEffect(() => {
    const serie = searchParams.get('serie')
    const correlativo = searchParams.get('correlativo')
    const ruc = searchParams.get('ruc')
    const establecimiento = searchParams.get('establecimiento')

    if (!serie || !correlativo || !ruc) return

    if (isSuperAdmin) {
        if (!loadingSucursales && sucursales.length > 0 && establecimiento) {
            const sucursalEncontrada = sucursales.find(
                (s: Sucursal) => s.codEstablecimiento === establecimiento && s.empresaRuc === ruc
            )
            if (sucursalEncontrada) {
                setSucursal(sucursalEncontrada)
                setSerieInput(serie)
                setCorrelativoInput(correlativo)
            } else {
                showToast('No se encontró la sucursal correspondiente', 'error')
            }
        }
        return
    }

    if (!sucursal || loadingSucursal) return

    const serieValida = seriesDisponibles.some(s => s.serie === serie)
    if (!serieValida) {
        showToast(`La serie ${serie} no corresponde a tu sucursal`, 'error')
        return
    }

    setSerieInput(serie)
    setCorrelativoInput(correlativo)
    buscarComprobante(serie, correlativo)

  }, [sucursal, loadingSucursal, sucursales, loadingSucursales, seriesDisponibles])
  useEffect(() => {
    if (!isSuperAdmin) return
    if (!sucursal) return

    const serie = searchParams.get('serie')
    const correlativo = searchParams.get('correlativo')
    if (!serie || !correlativo) return

    if (!loadingComprobante && !comprobante) {
      setSerieInput(serie);
      setCorrelativoInput(correlativo);
      buscarComprobante(serie, correlativo);
    }
  }, [sucursal])

  // ── Serie / correlativo ND dinámico ──────────────────────────
  const afectaFactura = serieInput.toUpperCase().startsWith("F");
  const serieND = afectaFactura
    ? (sucursal?.serieNotaDebitoFactura ?? "")
    : (sucursal?.serieNotaDebitoBoleta ?? "");
  const correlativoND = afectaFactura
    ? (correlativoNDFactura ?? sucursal?.correlativoNotaDebitoFactura ?? 0)
    : (correlativoNDBoleta ?? sucursal?.correlativoNotaDebitoBoleta ?? 0);
  const correlativoDisplay = String(correlativoND).padStart(8, "0");

  const totalOriginal = comprobante?.importeTotal ?? 0;
  const simbolo = comprobante?.tipoMoneda === "USD" ? "$" : "S/";
  const tipoComprobanteLabel = comprobante?.tipoComprobante === "01" ? "Factura" : "Boleta";

  // ── Totales ──────────────────────────────────────────────────
  const totales = useMemo(() => {
    const mtoOperGravadas = parseFloat(detalles.filter((d) => d.tipAfeIgv === 10).reduce((acc, d) => acc + d.mtoBaseIgv, 0).toFixed(2));
    const mtoOperExoneradas = parseFloat(detalles.filter((d) => d.tipAfeIgv === 20).reduce((acc, d) => acc + d.mtoBaseIgv, 0).toFixed(2));
    const mtoOperInafectas = parseFloat(detalles.filter((d) => d.tipAfeIgv === 30).reduce((acc, d) => acc + d.mtoBaseIgv, 0).toFixed(2));
    const mtoIGV = parseFloat(detalles.reduce((acc, d) => acc + d.igv, 0).toFixed(2));
    const totalIcbper = parseFloat(detalles.reduce((acc, d) => acc + (d.icbper ?? 0), 0).toFixed(2));
    const valorVenta = parseFloat((mtoOperGravadas + mtoOperExoneradas + mtoOperInafectas).toFixed(2));
    const subTotal = parseFloat((valorVenta + mtoIGV).toFixed(2));
    const mtoImpVenta = parseFloat((subTotal + totalIcbper).toFixed(2));
    return { mtoOperGravadas, mtoOperExoneradas, mtoOperInafectas, mtoIGV, totalIcbper, valorVenta, subTotal, mtoImpVenta };
  }, [detalles]);

  // ── Helpers edición ──────────────────────────────────────────
  const puedeEliminarFila = ["02", "03"].includes(codMotivo) && !(codMotivo === "03" && incluyePenalidad);
  const puedeAgregarFila = codMotivo === "03" && !incluyePenalidad;

  const actualizarDescripcion = (i: number, descripcion: string) =>
    setDetalles((prev) => { const n = [...prev]; n[i] = { ...n[i], descripcion }; return n; });

  const actualizarMontoConIgv = (i: number, montoConIgv: number | string) =>
    setDetalles((prev) => { const n = [...prev]; n[i] = recalcularDesdeMontoConIgv(n[i], montoConIgv); return n; });

  const actualizarCantidad = (i: number, cantidad: number | string) =>
    setDetalles((prev) => { const n = [...prev]; n[i] = recalcularDetalle({ ...n[i], cantidad }); return n; });

  const eliminarDetalle = (i: number) => setDetalles((prev) => prev.filter((_, idx) => idx !== i));
  const agregarDetalle = () => setDetalles((prev) => [...prev, itemVacio("", detallesOriginales[0]?.porcentajeIgv ?? 18)]);

  // ── Validación mora ──────────────────────────────────────────
  const validarMora = (): boolean => {
    if (codMotivo !== "01") return true;
    if (!comprobante) return true;
    if (comprobante.tipoPago === "Contado") {
      showToast("Intereses por mora solo aplica para comprobantes a crédito", "error");
      return false;
    }
    const hoy = new Date();
    const tieneVencida = comprobante.cuotas?.some((c) => {
      const vence = new Date(c.fechaVencimiento);
      return vence < hoy && c.estado !== "PAGADO";
    });
    if (!tieneVencida) {
      showToast("No hay cuotas vencidas en este comprobante", "error");
      return false;
    }
    return true;
  };

  // ── PDF helpers ──────────────────────────────────────────────
  const cargarPdf = async (comprobanteId: number, tamano: string) => {
    setCargandoPdf(true);
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteId}/pdf?tamano=${tamano}`,
        { headers: { Authorization: `Bearer ${accessToken}` }, responseType: "blob" },
      );
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      setPdfUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
    } catch { showToast("Error al cargar el PDF", "error"); }
    finally { setCargandoPdf(false); }
  };

  useEffect(() => { if (!comprobanteIdEmitido) return; cargarPdf(comprobanteIdEmitido, tamanoPdf); }, [tamanoPdf]);

  const imprimirPdf = async () => {
    if (!comprobanteIdEmitido) return;
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteIdEmitido}/pdf?tamano=Ticket58mm`,
        { headers: { Authorization: `Bearer ${accessToken}` }, responseType: "blob" },
      );
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const iframe = document.createElement("iframe");
      iframe.style.display = "none"; iframe.src = url;
      document.body.appendChild(iframe);
      iframe.onload = () => { iframe.contentWindow?.print(); setTimeout(() => { document.body.removeChild(iframe); URL.revokeObjectURL(url); }, 1000); };
    } catch { showToast("Error al imprimir", "error"); }
  };

  // ── Preparar JSON ────────────────────────────────────────────
  const prepararNotaDebito = (): NotaCredito | null => {
    if (!comprobante || !sucursal) return null;
    const moneda = comprobante.tipoMoneda === "USD" ? "DÓLARES" : "SOLES";
    const clienteDireccion = comprobante.cliente.direccionLineal ? {
      direccion: comprobante.cliente.direccionLineal,
      provincia: comprobante.cliente.provincia,
      departamento: comprobante.cliente.departamento,
      distrito: comprobante.cliente.distrito,
      ubigueo: comprobante.cliente.ubigeo,
    } : null;
    return {
      ublVersion: "2.1", tipoDoc: "08",
      serie: serieND,
      correlativo: String(correlativoND).padStart(8, "0"),
      fechaEmision: `${fechaEmision}T00:00:00`,
      tipoMoneda: comprobante.tipoMoneda, tipoOperacion: "1",
      tipDocAfectado: comprobante.tipoComprobante,
      numDocAfectado: comprobante.numeroCompleto,
      comprobanteAfectadoId: comprobante.details[0]?.comprobanteId ?? 0,
      codMotivo, desMotivo: desMotivo.toUpperCase(),
      company: {
        ruc: comprobante.company.numeroDocumento,
        codEstablecimiento: sucursal.codEstablecimiento ?? "0000",
        razonSocial: comprobante.company.razonSocial,
        nombreComercial: comprobante.company.nombreComercial,
        address: {
          direccion: comprobante.company.direccionLineal,
          provincia: comprobante.company.provincia,
          departamento: comprobante.company.departamento,
          distrito: comprobante.company.distrito,
          ubigueo: comprobante.company.ubigeo,
        },
      },
      client: {
        tipoDoc: comprobante.cliente.tipoDocumento,
        numDoc: comprobante.cliente.numeroDocumento,
        rznSocial: comprobante.cliente.razonSocial,
        address: clienteDireccion,
        clienteCorreo: correoCliente || undefined,
        enviadoPorCorreo: enviarCorreo,
        clienteWhatsApp: telefonoCliente || undefined,
        enviadoPorWhatsApp: enviarWhatsapp,
      },
      formaPago: { moneda: comprobante.tipoMoneda, tipo: comprobante.tipoPago === "Credito" ? "Credito" : "Contado" },
      mtoOperGravadas: totales.mtoOperGravadas,
      mtoOperExoneradas: totales.mtoOperExoneradas,
      mtoOperInafectas: totales.mtoOperInafectas,
      mtoOperGratuitas: 0,
      mtoIGV: totales.mtoIGV,
      totalIcbper: totales.totalIcbper,
      valorVenta: totales.valorVenta,
      subTotal: totales.subTotal,
      mtoImpVenta: totales.mtoImpVenta,
      details: detalles.map((d) => ({
        productoId: d.productoId, codProducto: d.codProducto, unidad: d.unidad,
        descripcion: d.descripcion, cantidad: Number(d.cantidad) || 0,
        mtoValorUnitario: d.mtoValorUnitario, mtoValorVenta: d.mtoValorVenta,
        mtoBaseIgv: d.mtoBaseIgv, porcentajeIgv: d.porcentajeIgv, igv: d.igv,
        tipAfeIgv: d.tipAfeIgv, mtoPrecioUnitario: d.mtoPrecioUnitario,
        totalVentaItem: d.totalVentaItem, icbper: d.icbper, factorIcbper: d.factorIcbper,
      })),
      legends: [{ code: "1000", value: numeroAlertas(totales.mtoImpVenta, moneda) }],
      usuarioCreacion: Number(user?.id ?? 0),
    };
  };

  // ── Validaciones ─────────────────────────────────────────────
  const validar = (): boolean => {
    if (!comprobante) { showToast("Debe buscar y seleccionar un comprobante", "error"); return false; }
    if (sinSucursal) { showToast("Debe seleccionar una sucursal", "error"); return false; }
    if (!codMotivo) { showToast("Debe seleccionar un motivo", "error"); return false; }
    if (!desMotivo.trim()) { showToast("Debe ingresar la descripción del motivo", "error"); return false; }
    if (!validarMora()) return false;
    if (!detalles.length) { showToast("Debe tener al menos un ítem", "error"); return false; }
    const sinDesc = detalles.findIndex((d) => !d.descripcion.trim());
    if (sinDesc !== -1) { showToast(`El ítem ${sinDesc + 1} no tiene descripción`, "error"); return false; }
    const sinMonto = detalles.findIndex((d) => d.totalVentaItem <= 0);
    if (sinMonto !== -1) { showToast(`El ítem ${sinMonto + 1} debe tener un monto mayor a 0`, "error"); return false; }
    if (totales.mtoImpVenta <= 0) { showToast("El monto total debe ser mayor a 0", "error"); return false; }
    if (enviarCorreo && !correoCliente.trim()) { showToast("Ingrese el correo del cliente para enviar", "error"); return false; }
    return true;
  };

  // ── Descontar stock (solo motivo 03 sin penalidad, según config.isStock) ──
  // El campo "cantidad" en este flujo ya representa las unidades ADICIONALES
  // a debitar (no el total): si el original trae 7 y se añaden 3, el campo
  // queda en 3 y eso es exactamente lo que se descuenta del stock.
  const stockDescontadoRef = useRef(false);
  const descontarStockSiAplica = async (comprobanteId?: number) => {
    if (!config?.isStock) return;
    if (codMotivo !== "03" || incluyePenalidad) return;
    if (stockDescontadoRef.current) return;
    stockDescontadoRef.current = true;

    const acumulado = new Map<number, number>();
    detalles.forEach((d) => {
      if (!d.productoId) return;
      const cantidadAdicional = Number(d.cantidad) || 0;
      if (cantidadAdicional <= 0) return;

      const producto = productosSucursal.find((p) => p.productoId === d.productoId);
      if (!producto || producto.tipoProducto !== "BIEN") return;

      const sucursalProductoId = producto.sucursalProducto.sucursalProductoId;
      acumulado.set(
        sucursalProductoId,
        (acumulado.get(sucursalProductoId) ?? 0) + cantidadAdicional,
      );
    });

    const items = Array.from(acumulado.entries()).map(
      ([sucursalProductoId, cantidad]) => ({
        sucursalProductoId,
        cantidad,
        referenciaTipo: "NOTA",
        referenciaId: comprobanteId,
      }),
    );
    if (!items.length) return;

    try {
      await actualizarStock(items, accessToken);
      const productosActualizados = await fetchProductosSucursal();
      if (config?.numeroStockBajo) {
        const umbral = config.umbralStockBajo ?? 10;
        const bajos = (productosActualizados ?? [])
          .filter((p) => {
            const cantidadVendida = acumulado.get(p.sucursalProducto.sucursalProductoId);
            if (cantidadVendida === undefined) return false;
            const stockDespues = p.sucursalProducto.stock ?? 0;
            const stockAntes = stockDespues + cantidadVendida;
            return stockDespues <= umbral && stockAntes > umbral;
          })
          .map((p) => ({ nomProducto: p.nomProducto, stock: p.sucursalProducto.stock ?? 0 }));
        if (bajos.length) avisarStockBajoWhatsapp(bajos, config.numeroStockBajo);
      }
    } catch {
      showToast("No se pudo actualizar el stock de los productos.", "error");
    }
  };

  // ── Emitir ───────────────────────────────────────────────────
  const emitirNotaDebito = async () => {
    if (!validar()) return;
    const payload = prepararNotaDebito();
    if (!payload) return;
    setEmitiendo(true); setErrorEmision(null);
    stockDescontadoRef.current = false;

    try {
      // ── 1. Guardar en BD ──────────────────────────────────────
      const resND = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/notes`,
        payload,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const comprobanteId = resND.data.comprobanteId;
      setComprobanteIdEmitido(comprobanteId); // ← guardar ANTES de SUNAT

      // ── 2. Enviar a SUNAT ─────────────────────────────────────
      await enviarASunat(comprobanteId, payload);

    } catch (err: any) {
      // Solo errores del paso 1 (guardar en BD)
      const data = err?.response?.data;
      const mensaje = data?.mensaje ?? data?.message ?? data?.title ?? "Error al emitir la nota de débito";
      const detalle = data?.detalle ?? (data?.errors ? JSON.stringify(data?.errors) : null);
      setErrorEmision(detalle ? `${mensaje}: ${detalle}` : mensaje);
      showToast("Error al emitir nota de débito.", "error");
    } finally {
      setEmitiendo(false);
    }
  };

  const enviarASunat = async (comprobanteId: number, payload: NotaCredito) => {
    try {
      const resSunat = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/notes/${comprobanteId}/send`,
        null,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (resSunat.data.estadoSunat === "ACEPTADO" || resSunat.data.codigoRespuestaSunat === "0") {
        // ✅ SUNAT aceptó — lógica original intacta
        showToast(resSunat.data.mensajeRespuestaSunat ?? "Nota de débito emitida correctamente.", "success");
        await cargarPdf(comprobanteId, tamanoPdf);

        if ((enviarCorreo && correoCliente) || (enviarWhatsapp && telefonoCliente)) {
          const serieNum = `${payload.serie}-${payload.correlativo}`;
          try {
            const resPdf = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteId}/pdf?tamano=A4`, { headers: { Authorization: `Bearer ${accessToken}` } });
            if (!resPdf.ok) throw new Error("No se pudo obtener el PDF");
            const pdfFile = new File([await resPdf.blob()], `${empresa?.numeroDocumento}-NotaDebito-${serieNum}.pdf`, { type: "application/pdf" });

            if (enviarCorreo && correoCliente) {
              try {
                const formData = new FormData();
                formData.append("toEmail", correoCliente);
                formData.append("toName", comprobante?.cliente.razonSocial ?? "Cliente");
                formData.append("subject", `Nota de Débito Electrónica ${serieNum}`);
                formData.append("body", "Se emitió la nota de débito electrónica.");
                formData.append("tipo", "8");
                formData.append("comprobanteJson", JSON.stringify({ serieNumero: serieNum, estadoSunat: "ACEPTADO", items: detalles.map((d) => ({ descripcion: d.descripcion, cantidad: d.cantidad, precioUnitario: d.mtoPrecioUnitario })), igv: totales.mtoIGV, total: totales.mtoImpVenta }));
                formData.append("adjunto", pdfFile);
                const resCorreo = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/email/send`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: formData });
                if (!resCorreo.ok) throw new Error("Error correo");
                showToast("Nota de débito enviada por correo", "success");
              } catch { showToast("Error al enviar por correo", "error"); }
            }

            if (enviarWhatsapp && telefonoCliente) {
              try {
                const whatsappApiKey = process.env.NEXT_PUBLIC_WHATSAPP_API_KEY!;
                const whatsappBase = "https://do.velsat.pe:8443/whatsapp";
                const uploadForm = new FormData(); uploadForm.append("file", pdfFile);
                const resUpload = await fetch(`${whatsappBase}/api/upload`, { method: "POST", headers: { "x-api-key": whatsappApiKey }, body: uploadForm });
                if (!resUpload.ok) throw new Error("No se pudo subir el PDF");
                const fileUrl = (await resUpload.json()).datos.url;
                const numeroFormateado = `51${telefonoCliente}`;
                const resWsp = await fetch(`${whatsappBase}/api/send/single`, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": whatsappApiKey }, body: JSON.stringify({ phone: numeroFormateado, type: "documento", file_url: fileUrl, filename: `${empresa?.numeroDocumento}-NotaDebito-${serieNum}.pdf`, mime_type: "application/pdf", text: `Estimado(a) ${comprobante?.cliente.razonSocial ?? ""}, adjuntamos su nota de débito electrónica ${serieNum}.` }) });
                if (!resWsp.ok) throw new Error("Error WhatsApp");
                showToast("Nota de débito enviada por WhatsApp", "success");
              } catch { showToast("Error al enviar por WhatsApp", "error"); }
            }
          } catch { showToast("Error al procesar envíos", "error"); }
        }
        setEmitido(true);
        descontarStockSiAplica(comprobanteId);

      } else if (resSunat.data.estadoSunat === "PENDIENTE") {
        // ⏳ SUNAT caída / sin conexión — no es un rechazo real, queda PENDIENTE y se reintenta
        const serieCorrelativo = `${payload.serie}-${payload.correlativo}`;
        setErrorEmision(
          resSunat.data.mensajeRespuestaSunat ?? "SUNAT no disponible. La nota quedó pendiente para reenvío.",
        );
        showToast(`SUNAT no disponible. La nota ${serieCorrelativo} quedó PENDIENTE y se reintentará el envío.`, "error");
        setEmitido(true);
        await cargarPdf(comprobanteId, tamanoPdf);
        reintentarEnSegundoPlano(comprobanteId); // ← sin await
        descontarStockSiAplica(comprobanteId);
      } else {
        //  SUNAT rechazó con respuesta (error de validación real)
        const serieCorrelativo = `${payload.serie}-${payload.correlativo}`;
        setErrorEmision(resSunat.data.mensajeRespuestaSunat ?? "Nota de débito rechazada por SUNAT");
        showToast(`La nota ${serieCorrelativo} fue rechazada por SUNAT.`, "error");
        setEmitido(true);
        await cargarPdf(comprobanteId, tamanoPdf);
      }
    } catch (err: any) {
      const tieneRespuesta = !!err?.response;
      const serieCorrelativo = `${payload.serie}-${payload.correlativo}`;
      const estadoSunat = err?.response?.data?.estadoSunat;

      if (tieneRespuesta && estadoSunat !== "PENDIENTE") {
        //  SUNAT respondió con error HTTP (rechazo real) — sin reintento
        const mensaje = err?.response?.data?.mensaje ?? err?.response?.data?.message ?? "";
        setErrorEmision(mensaje || "Nota de débito rechazada por SUNAT");
        showToast(`La nota ${serieCorrelativo} fue rechazada por SUNAT.`, "error");
        setEmitido(true);
        await cargarPdf(comprobanteId, tamanoPdf);
      } else {
        //  SUNAT no responde / timeout / PENDIENTE — reintento silencioso
        setErrorEmision("No se pudo conectar con SUNAT.");
        showToast(`La nota ${serieCorrelativo} fue generada. Verificar estado en sección Comprobantes.`, "error");
        setEmitido(true);
        await cargarPdf(comprobanteId, tamanoPdf);
        reintentarEnSegundoPlano(comprobanteId); // ← sin await
        descontarStockSiAplica(comprobanteId);
      }
    }

    // Actualizar correlativos siempre
    const sucursalId = isSuperAdmin ? sucursal?.sucursalId : user?.sucursalID;
    const resSucursal = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL}/api/Sucursal/${sucursalId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    setCorrelativoNDFactura(resSucursal.data.correlativoNotaDebitoFactura ?? null);
    setCorrelativoNDBoleta(resSucursal.data.correlativoNotaDebitoBoleta ?? null);
  };

  // Reintento en segundo plano, 100% silencioso (sin toasts en éxito ni en fallo).
  // El backend ya garantiza que solo llega a RECHAZADO si SUNAT devolvió un CDR
  // real; este delay solo reduce la chance de chocar con un documento que SUNAT
  // aún tiene "en proceso" y reparte los reintentos si hay varias notas
  // pendientes a la vez (evita una ráfaga si SUNAT tuvo una caída sostenida).
  const reintentarEnSegundoPlano = async (comprobanteId: number) => {
    const delayConJitter = 30000 + Math.random() * 20000; // 30-50s
    await new Promise(res => setTimeout(res, delayConJitter));
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/notes/${comprobanteId}/send`,
        null,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
    } catch {
      // silencioso
    }
  };


  // ── Limpiar / reset ──────────────────────────────────────────
  const limpiarBuscador = () => {
    setSerieInput(""); setCorrelativoInput("");
    limpiarComprobante(); setDetalles([]); setDetallesOriginales([]);
    setCorreoCliente(""); setTelefonoCliente("");
    setEnviarCorreo(false); setEnviarWhatsapp(false);
    setIncluyePenalidad(false);
  };

  const nuevaNotaDebito = () => {
    setEmitido(false); setPdfUrl(null); setComprobanteIdEmitido(null); setErrorEmision(null);
    limpiarBuscador(); setCodMotivo(""); setDesMotivo("");
    setFechaEmision(formatoFechaActual().fechaHora.slice(0, 10));
    if (isSuperAdmin) { setSucursal(null); setCorrelativoNDFactura(null); setCorrelativoNDBoleta(null); }
  };

  // ── Info por motivo ──────────────────────────────────────────
  const infoBadgeMotivo: Record<string, string> = {
    "01": "Un ítem de intereses — solo para comprobantes a crédito con cuotas vencidas",
    "02": "Un ítem por producto con el monto adicional a cobrar (con IGV)",
    "03": "Ítems editables — activa 'Penalidad' para agregar un ítem específico",
  };

  const esContado = comprobante?.tipoPago === "Contado";
  const avisoMora = codMotivo === "01" && !!comprobante && esContado;

  //validar si el total es diferencte por algun descuento en la factura original
  const totalDiferente = Math.abs(totales.mtoImpVenta - totalOriginal) > 0.01;

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="space-y-2 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 space-y-3">

          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/factufly/operaciones")}
              className="h-8 w-8 flex items-center justify-center rounded-lg shrink-0 transition-colors"
              style={{ background: "rgba(15,46,100,0.08)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(15,46,100,0.15)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(15,46,100,0.08)")}
            >
              <ChevronLeft className="w-4 h-4" style={{ color: "#0f2e64" }} />
            </button>
            <div>
              <h3 className="text-sm font-bold leading-tight" style={{ color: "#0f2e64" }}>Nueva Nota de Débito</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Emisión de comprobante electrónico</p>
            </div>
          </div>

          <Card >
            <form className="space-y-3">

              {/* ── Sucursal (superadmin) ── */}
              {isSuperAdmin && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-600 uppercase">Sucursal</label>
                    <select
                      value={sucursal?.sucursalId ?? ""}
                      disabled={loadingSucursales || vieneDesdeLista}
                      onChange={async (e) => {
                        if (!e.target.value) { setSucursal(null); setCorrelativoNDFactura(null); setCorrelativoNDBoleta(null); setSerieInput(""); return; }
                        const sel = sucursales.find((s: Sucursal) => s.sucursalId === Number(e.target.value));
                        if (!sel) return;
                        setSucursal(sel); setSerieInput(""); setCorrelativoInput("");
                        const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/Sucursal/${sel.sucursalId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
                        setCorrelativoNDFactura(res.data.correlativoNotaDebitoFactura ?? null);
                        setCorrelativoNDBoleta(res.data.correlativoNotaDebitoBoleta ?? null);
                      }}
                      className="w-full py-1.5 px-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50 text-sm"
                    >
                      <option value="">Seleccionar sucursal</option>
                      {sucursales.map((s: Sucursal) => (
                        <option key={s.sucursalId} value={s.sucursalId}>
                          {s.serieNotaDebitoFactura ?? s.serieNotaDebitoBoleta} — {s.nombre ?? s.codEstablecimiento}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-600 uppercase">
                      Serie y Correlativo ND
                    </label>
                    <div
                      className={`flex items-center gap-2 px-2.5 py-2.5 rounded-xl border w-full text-sm ${
                        !sucursal
                          ? "bg-gray-50 border-gray-200"
                          : serieInput
                          ? "bg-green-50 border-green-300"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      {!sucursal ? (
      <span className="text-[12px] text-gray-400">Selecciona una sucursal</span>
                      ) : !serieInput ? (
                        <span className="text-[12px] text-gray-400">Selecciona serie del comprobante</span>
                      ) : (
                        <>
                          <p className="text-[12px] font-bold uppercase text-gray-500 tracking-wide">
                            ND
                          </p>
                          <span className="text-[12px] font-mono font-semibold text-gray-800">
                            {serieND}-{correlativoDisplay}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Admin normal */}
              {!isSuperAdmin && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-600 uppercase">Serie y Correlativo ND</label>
                  <div
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border w-full text-sm ${
                      loadingSucursal
                        ? "bg-gray-50 border-gray-200"
                        : serieInput
                        ? "bg-green-50 border-green-300"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    {loadingSucursal ? (
                      <span className="text-xs text-gray-400">Cargando...</span>
                    ) : !serieInput ? (
                      <span className="text-xs text-gray-400">Selecciona serie del comprobante</span>
                    ) : (
                      <>
                        <p className="text-[12px] font-bold uppercase text-gray-500 tracking-wide">
                          ND
                        </p>
                        <span className="text-[12px] font-mono font-semibold text-gray-800">
                          {serieND}-{correlativoDisplay}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ── Buscador ── */}
              <div className="bg-gray-50/80 border border-gray-100 rounded-xl p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-blue-50 flex items-center justify-center">
                    <Search className="w-3 h-3 text-brand-blue" />
                  </div>
                  <h3 className="text-xs font-semibold text-gray-800">Comprobante de Referencia</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Serie</label>
                    <select
                      value={serieInput}
                      onChange={(e) => { setSerieInput(e.target.value); if (comprobante) limpiarBuscador(); }}
                      disabled={isSuperAdmin && sinSucursal || vieneDesdeLista}
                      className="w-full py-1.5 px-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue/50 outline-none transition-all text-sm disabled:opacity-50"
                    >
                      <option value="">Seleccionar serie</option>
                      {seriesDisponibles.map((s) => (
                        <option key={s.serie} value={s.serie}>{s.serie}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Correlativo</label>
                    <div className="relative">
                      <input
                        type="text" value={correlativoInput}
                        onChange={(e) => setCorrelativoInput(e.target.value.replace(/\D/g, ""))}
                        placeholder="127" maxLength={10} disabled={vieneDesdeLista}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscarComprobante(serieInput, correlativoInput); } }}
                        className="w-full py-1.5 pl-3 pr-9 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue/50 outline-none transition-all text-sm font-mono"
                      />
                      {(correlativoInput || comprobante) && (
                        <button type="button" 
                          onClick={() => { limpiarBuscador(); setCodMotivo(""); setDesMotivo(""); 
                            if (vieneDesdeLista) {
                                router.replace('/factufly/operaciones/nota-debito')
                                setVieneDesdeLista(false)
                            } }} title="Limpiar"
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-end">
                    <Button type="button" className="w-full py-2 text-xs"
                      onClick={() => buscarComprobante(serieInput, correlativoInput)}
                      disabled={loadingComprobante || !serieInput || !correlativoInput}>
                      {loadingComprobante ? (
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{vieneDesdeLista ? 'Cargando comprobante...' : 'Buscando...'}
                        </span>
                      ) : <span className="flex items-center gap-2"><Search className="w-4 h-4" /> Buscar</span>}
                    </Button>
                  </div>
                </div>

                {errorComprobante && <p className="text-xs text-red-500">{errorComprobante}</p>}

                {/* Comprobante encontrado — una sola línea con total, tipo pago y emisión */}
                {comprobante && (
                  <div className="mt-3 p-3 bg-white border border-green-100 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-green-700">✓ {tipoComprobanteLabel}: {comprobante.numeroCompleto}</span>
                      <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{comprobante.estadoSunat}</span>
                    </div>
                    <p className="text-xs text-gray-600"><span className="font-medium">Cliente:</span> {comprobante.cliente.razonSocial}</p>
                    {comprobante.cliente.direccionLineal && (
                      <p className="text-[10px] text-gray-400">{comprobante.cliente.direccionLineal}</p>
                    )}
                    {/* Una sola línea: Total | Tipo pago | Emisión */}
                    <div className="flex items-center justify-between pt-1 border-t border-gray-50">
                      <span className="text-xs text-gray-700">
                        <span className="text-gray-400">Total:</span>{" "}
                        <span className="font-bold">{simbolo} {totalOriginal.toFixed(2)}</span>
                      </span>
                      <span className="text-xs text-gray-700">
                        <span className="text-gray-400">Pago:</span>{" "}
                        <span className={`font-medium ${esContado ? "text-gray-700" : "text-amber-600"}`}>{comprobante.tipoPago}</span>
                        {comprobante.cuotas?.length > 0 && (
                          <span className="ml-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                            {comprobante.cuotas.length} cuota(s)
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-gray-500">
                        <span className="text-gray-400">Emisión:</span>{" "}
                        {new Date(comprobante.fechaEmision).toLocaleDateString("es-PE")}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Datos del cliente ── */}
              {comprobante && (
                <div className="bg-gray-50/80 border border-gray-100 rounded-xl p-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-blue-50 flex items-center justify-center">
                      <UserRound className="w-3 h-3 text-brand-blue" />
                    </div>
                    <h3 className="text-xs font-semibold text-gray-800">Datos del Cliente</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">{comprobante.cliente.tipoDocumento === "6" ? "RUC" : "DNI / Doc"}</label>
                      <input disabled value={comprobante.cliente.numeroDocumento} className="w-full py-1.5 px-3 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-600 font-mono" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Razón Social</label>
                      <input disabled value={comprobante.cliente.razonSocial} className="w-full py-1.5 px-3 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-600" />
                    </div>
                    {comprobante.cliente.direccionLineal && (
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Dirección</label>
                        <input disabled value={comprobante.cliente.direccionLineal} className="w-full py-1.5 px-3 bg-gray-100 border border-gray-200 rounded-xl text-xs text-gray-500" />
                      </div>
                    )}
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <div className={`flex items-center gap-1.5 bg-white border rounded-xl px-3 py-1.5 ${enviarCorreo && !correoCliente ? "border-red-300 bg-red-50" : "border-gray-200"}`}>
                          <input type="email" value={correoCliente} placeholder="Correo del cliente"
                            onChange={(e) => { setCorreoCliente(e.target.value); if (!e.target.value) setEnviarCorreo(false); }}
                            className="flex-1 bg-transparent text-sm outline-none min-w-0 placeholder:text-gray-400" />
                          <label className="flex items-center gap-1 shrink-0 cursor-pointer">
                            <input type="checkbox" checked={enviarCorreo} disabled={!correoCliente} onChange={(e) => setEnviarCorreo(e.target.checked)} className="w-3.5 h-3.5 accent-brand-blue" />
                            <span className="text-xs text-gray-500">Enviar</span>
                          </label>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className={`flex items-center gap-1.5 bg-white border rounded-xl px-3 py-1.5 ${(telefonoCliente && (telefonoCliente.length < 9 || !telefonoCliente.startsWith("9"))) ? "border-red-300 bg-red-50" : "border-gray-200"}`}>
                          <input type="tel" value={telefonoCliente} maxLength={9} placeholder="Teléfono / WhatsApp"
                            onChange={(e) => { 
                              const s = e.target.value.replace(/\D/g, ""); 
                              setTelefonoCliente(s); 
                              if (!s || s.length < 9 || !s.startsWith("9")) setEnviarWhatsapp(false); 
                            }}
                            className="flex-1 bg-transparent text-sm outline-none min-w-0 placeholder:text-gray-400" />
                          <label className="flex items-center gap-1 shrink-0 cursor-pointer">
                            <input type="checkbox" checked={enviarWhatsapp} disabled={!telefonoCliente || telefonoCliente.length < 9 || !telefonoCliente.startsWith("9")} onChange={(e) => setEnviarWhatsapp(e.target.checked)} className="w-3.5 h-3.5 accent-brand-blue" />
                            <span className="text-xs text-gray-500">Enviar</span>
                          </label>
                        </div>
                        {telefonoCliente && !telefonoCliente.startsWith("9") && (
                          <p className="text-[10px] text-red-500 pl-1 mt-0.5">Debe empezar con 9</p>
                        )}
                        {telefonoCliente && telefonoCliente.startsWith("9") && telefonoCliente.length < 9 && (
                          <p className="text-[10px] text-red-500 pl-1 mt-0.5">Debe tener 9 dígitos</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Motivo y fecha ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-600 uppercase">Motivo</label>
                  <select
                    value={codMotivo}
                    onChange={(e) => {
                      const cod = e.target.value;
                      setCodMotivo(cod);
                      const motivo = MOTIVOS_ND.find((m) => m.code === cod);
                      setDesMotivo(motivo?.label ?? "");
                      setIncluyePenalidad(false);
                    }}
                    className="w-full py-1.5 px-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50 text-sm"
                  >
                    <option value="">Seleccionar motivo</option>
                    {MOTIVOS_ND.map((m) => (
                      <option key={m.code} value={m.code}>{m.code} - {m.label}</option>
                    ))}
                  </select>

                  {codMotivo && (
                    <div className="space-y-1 pt-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Descripción del motivo</label>
                      <input type="text" value={desMotivo} onChange={(e) => setDesMotivo(e.target.value)}
                        placeholder="Descripción del motivo..." maxLength={250}
                        className="w-full py-1.5 px-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue/50 outline-none transition-all text-sm" />
                    </div>
                  )}

                  {avisoMora && (
                    <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg mt-1">
                      <Info className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-red-700">
                        Comprobante de pago <strong>Contado</strong>. Intereses por mora solo aplica para comprobantes a crédito con cuotas vencidas.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-600 uppercase">Fecha de Emisión</label>
                  <input type="date" value={fechaEmision}
                    max={obtenerFechaLocal()}
                    min={obtenerFechaLocal(-2)}
                    onChange={(e) => setFechaEmision(e.target.value)}
                    className="w-full py-1.5 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue/50 outline-none transition-all text-sm" />
                </div>
              </div>

              {/* ── Tabla de ítems ── */}
              {comprobante && codMotivo && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="w-5 h-5 rounded-md bg-blue-50 flex items-center justify-center">
                        <ClipboardList className="w-3 h-3 text-brand-blue" />
                      </div>
                      <label className="text-xs font-semibold text-gray-800">Ítems a debitar</label>
                      <span className="text-[10px] bg-brand-blue/10 text-brand-blue px-2 py-0.5 rounded-full font-medium">Motivo {codMotivo}</span>
                      {infoBadgeMotivo[codMotivo] && (
                        <span className="flex items-center gap-1 text-[10px] text-blue-600">
                          <Info className="w-3 h-3 shrink-0" />{infoBadgeMotivo[codMotivo]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {codMotivo === "03" && (
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input type="checkbox" checked={incluyePenalidad}
                            onChange={(e) => setIncluyePenalidad(e.target.checked)}
                            className="w-3.5 h-3.5 accent-brand-blue" />
                          <span className="text-xs text-gray-600 font-medium">Penalidad</span>
                        </label>
                      )}
                      {puedeAgregarFila && (
                        <Button type="button" variant="ghost" className="h-8 text-xs text-brand-blue" onClick={agregarDetalle}>
                          <Plus className="w-3 h-3 mr-1" /> Agregar ítem
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="border border-gray-100 rounded-xl overflow-x-auto">
                    <table className="w-full text-xs" style={{ minWidth: "680px" }}>
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 py-2 text-left text-gray-500 w-6">#</th>
                          <th className="px-2 py-2 text-left text-gray-500" style={{ minWidth: "200px" }}>Descripción</th>
                          <th className="px-2 py-2 text-center text-gray-500 w-14">U.M.</th>
                          <th className="px-2 py-2 text-center text-gray-500 w-20">Cant.</th>
                          <th className="px-2 py-2 text-center text-gray-500 w-32">Monto (c/IGV)</th>
                          <th className="px-2 py-2 text-center text-gray-500 w-16">%IGV</th>
                          <th className="px-2 py-2 text-right text-gray-500 w-18">IGV</th>
                          <th className="px-2 py-2 text-right text-gray-500 w-20">Total</th>
                          {puedeEliminarFila && <th className="px-2 py-2 w-6"></th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {detalles.length === 0 ? (
                          <tr><td colSpan={9} className="px-4 py-8 text-center text-xs text-gray-400">Sin ítems.</td></tr>
                        ) : (
                          detalles.map((d, i) => (
                            <tr key={i} className="hover:bg-gray-50/50">
                              <td className="px-2 py-1.5 text-gray-400">{i + 1}</td>

                              {/* Descripción */}
                              <td className="px-2 py-1.5">
                                <input type="text" value={d.descripcion}
                                  onChange={(e) => actualizarDescripcion(i, e.target.value)}
                                  disabled={codMotivo === "01" && comprobante?.tipoPago === "Contado"}
                                  className="w-full py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-brand-blue/50 disabled:opacity-50 disabled:cursor-not-allowed" />
                              </td>

                              {/* U.M. */}
                              <td className="px-2 py-1.5 text-center text-gray-500 text-xs">{d.unidad}</td>

                              {/* Cantidad */}
                              <td className="px-2 py-1.5">
                                {codMotivo === "03" && !incluyePenalidad ? (
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1">
                                      <button type="button" onClick={() => actualizarCantidad(i, Math.max(1, (Number(d.cantidad) || 0) - 1))}
                                        className="w-6 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-md text-gray-600 font-bold">−</button>
                                      <input type="number" min={1} step="1" value={d.cantidad}
                                        onChange={(e) => actualizarCantidad(i, e.target.value === "" ? "" : Number(e.target.value))}
                                        onWheel={(e) => e.currentTarget.blur()}
                                        onFocus={(e) => { if (Number(e.currentTarget.value) === 0) e.currentTarget.select(); }}
                                        className="w-12 py-1 pl-2 pr-3 border border-gray-200 bg-gray-50 rounded-lg text-xs text-center outline-none focus:border-brand-blue/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                      <button type="button" onClick={() => actualizarCantidad(i, (Number(d.cantidad) || 0) + 1)}
                                        className="w-6 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-md text-gray-600 font-bold">+</button>
                                    </div>
                                    {d._cantidadOriginal !== undefined && (
                                      <p className="text-[9px] text-center text-gray-400">
                                        Original: {d._cantidadOriginal} · Adicional
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-700 text-center block">{d.cantidad}</span>
                                )}
                              </td>

                              {/* Monto con IGV + precio original debajo (motivo 02) */}
                              <td className="px-2 py-1.5">
                                <div className="space-y-0.5">
                                  <input type="number" min={0} step="0.10" value={d._montoConIgv ?? ""}
                                    onChange={(e) => actualizarMontoConIgv(i, e.target.value === "" ? "" : Number(e.target.value))}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    onFocus={(e) => { if (Number(e.currentTarget.value) === 0) e.currentTarget.select(); }}
                                    disabled={codMotivo === "01" && comprobante?.tipoPago === "Contado"}
                                    className="w-full py-1 pl-2 pr-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-right outline-none focus:border-brand-blue/50 font-mono disabled:opacity-50 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                  {/* Precio venta original — solo motivo 02 */}
                                  {codMotivo === "02" && d._precioVentaOriginal !== undefined && (
                                    <p className="text-[9px] text-right text-gray-400">
                                      Orig: {simbolo} {d._precioVentaOriginal.toFixed(2)}
                                    </p>
                                  )}
                                </div>
                              </td>

                              {/* %IGV */}
                              <td className="px-2 py-1.5 text-center">
                                <span className="text-xs text-gray-500">{d.tipAfeIgv === 10 ? `${d.porcentajeIgv}%` : "N/A"}</span>
                              </td>

                              {/* IGV */}
                              <td className="px-2 py-1.5 text-right font-mono text-gray-700 text-xs">{d.igv.toFixed(2)}</td>

                              {/* Total */}
                              <td className="px-2 py-1.5 text-right font-mono font-semibold text-gray-800 text-xs">
                                {simbolo} {d.totalVentaItem.toFixed(2)}
                              </td>

                              {/* Eliminar */}
                              {puedeEliminarFila && (
                                <td className="px-2 py-1.5">
                                  <button type="button" onClick={() => eliminarDetalle(i)} className="text-red-400 hover:text-red-600">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* ── Panel info debajo de tabla ── */}
                  <div className="space-y-2 pt-1">
                    {/* Total original — motivos 01 y 02 */}
                    {(codMotivo === "01" || codMotivo === "02") && (
                      <div className="flex items-start gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-lg">
                        <Info size={13} className="text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-blue-700">
                          Total original del comprobante:{" "}
                          <span className="font-bold">{simbolo} {totalOriginal.toFixed(2)}</span>
                        </p>
                      </div>
                    )}

                    {/* Cuotas — motivo 01 crédito */}
                    {codMotivo === "01" && comprobante && !esContado && comprobante.cuotas?.length > 0 && (
                      <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-lg">
                        <Info size={13} className="text-amber-700 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-amber-700 font-medium">Cuotas del comprobante:</p>
                          {comprobante.cuotas.map((c, idx) => {
                            const vence = new Date(c.fechaVencimiento);
                            const vencida = vence < new Date() && c.estado !== "PAGADO";
                            return (
                              <p key={idx} className={`text-[10px] ${vencida ? "text-red-600 font-medium" : "text-amber-600"}`}>
                                {c.numeroCuota}: {vence.toLocaleDateString("es-PE")} — {simbolo} {c.monto.toFixed(2)}
                                {vencida ? " ⚠ VENCIDA" : ""}
                              </p>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {comprobante && !codMotivo && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-700">Selecciona un motivo para ver y editar los ítems.</p>
                </div>
              )}

              {/* ── Totales ── */}
              {comprobante && codMotivo && (
                <div className="flex items-end pt-4 border-t border-gray-100 gap-4">
                  {/* Panel info izquierda — siempre ocupa espacio */}
                  <div className="w-1/2 self-end">
                    {totalDiferente && (
                      <div className="flex items-start gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-lg">
                        <Info size={13} className="text-blue-500 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-blue-700 font-medium">Precio referencial</p>
                          <p className="text-[10px] text-blue-600">
                            El documento original puede contener descuentos u otros ajustes.
                          </p>
                          <p className="text-[10px] text-blue-700">
                            Total original: <span className="font-bold">{simbolo} {totalOriginal.toFixed(2)}</span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Totales derecha */}
                  <div className="shrink-0 space-y-1.5 text-right ml-auto">
                    {totales.mtoOperGravadas > 0 && (
                      <div className="flex justify-end gap-8 text-sm text-gray-500">
                        <span>Op. Gravadas:</span>
                        <span className="font-medium text-gray-900 w-24">{simbolo} {totales.mtoOperGravadas.toFixed(2)}</span>
                      </div>
                    )}
                    {totales.mtoOperExoneradas > 0 && (
                      <div className="flex justify-end gap-8 text-sm text-gray-500">
                        <span>Op. Exoneradas:</span>
                        <span className="font-medium text-gray-900 w-24">{simbolo} {totales.mtoOperExoneradas.toFixed(2)}</span>
                      </div>
                    )}
                    {totales.mtoOperInafectas > 0 && (
                      <div className="flex justify-end gap-8 text-sm text-gray-500">
                        <span>Op. Inafectas:</span>
                        <span className="font-medium text-gray-900 w-24">{simbolo} {totales.mtoOperInafectas.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-end gap-8 text-sm text-gray-500">
                      <span>IGV:</span>
                      <span className="font-medium text-gray-900 w-24">{simbolo} {totales.mtoIGV.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-end gap-8 text-lg font-bold text-brand-blue pt-1 border-t border-gray-100">
                      <span>Total a debitar:</span>
                      <span className="w-24">{simbolo} {totales.mtoImpVenta.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

            </form>
          </Card>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-6">
          <Card title="Vista Previa" subtitle="Representación gráfica del comprobante">
            <div className="mb-3">
              <select value={tamanoPdf} onChange={(e) => setTamanoPdf(e.target.value)}
                className="w-full py-1.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-brand-blue/50">
                <option value="A4">A4</option>
                <option value="Carta">Carta</option>
                <option value="Ticket80mm">Ticket 80mm</option>
                <option value="Ticket58mm">Ticket 58mm</option>
                <option value="MediaCarta">Media Carta</option>
              </select>
            </div>

            {pdfUrl ? (
              <div className="space-y-3">
                {cargandoPdf ? (
                  <div className="w-full h-96 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200">
                    <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <iframe src={pdfUrl} className="w-full rounded-lg border border-gray-200" style={{ height: "400px" }} />
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => window.open(pdfUrl, "_blank")}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-brand-blue hover:bg-blue-600 active:scale-95 shadow-sm py-2 rounded-lg transition-all duration-200">
                    <ExternalLink className="w-3.5 h-3.5" /> Abrir
                  </button>
                  <button type="button"
                    onClick={() => { const a = document.createElement("a"); a.href = pdfUrl; a.download = `${empresa?.numeroDocumento}-08-${serieND}-${correlativoDisplay}.pdf`; a.click(); }}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-500 active:scale-95 border border-green-500 hover:border-emerald-200 py-2 rounded-lg transition-all duration-200 shadow-sm">
                    <Download className="w-3.5 h-3.5" /> Descargar
                  </button>
                  <button type="button" onClick={imprimirPdf}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-amber-500 hover:bg-amber-400 active:scale-95 border border-amber-400 hover:border-amber-200 py-2 rounded-lg transition-all duration-200 shadow-sm">
                    <Printer className="w-3.5 h-3.5" /> Imprimir
                  </button>
                </div>
              </div>
            ) : (
           <div className="h-48 bg-gray-50 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center p-4 text-center space-y-2">
                <div className="p-4 rounded-full bg-white shadow-sm"><Printer className="w-8 h-8 text-gray-400" /></div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Previsualización del PDF</p>
                  <p className="text-xs text-gray-400 mt-1">Se generará automáticamente al emitir</p>
                </div>
              </div>
            )}

            <div className="mt-3 space-y-2">
              <Button
                className="w-full py-2 text-sm" type="button"
                onClick={emitido ? nuevaNotaDebito : emitirNotaDebito}
                disabled={emitiendo || (!emitido && (sinSucursal || !comprobante || !codMotivo || avisoMora))}
              >
                {emitiendo ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Emitiendo...
                  </span>
                ) : emitido ? "Nueva Nota de Débito" : "Emitir Nota de Débito"}
              </Button>
              {sinSucursal && <p className="text-xs text-amber-600 text-center">Selecciona una sucursal para emitir</p>}
              {!comprobante && !sinSucursal && <p className="text-xs text-gray-400 text-center">Busca un comprobante para continuar</p>}
              {comprobante && !codMotivo && <p className="text-xs text-amber-600 text-center">Selecciona un motivo para emitir</p>}
              {avisoMora && <p className="text-xs text-red-500 text-center">Comprobante Contado — no aplica mora</p>}
              {errorEmision && <p className="text-xs text-red-500 text-center">{errorEmision}</p>}
            </div>
          </Card>

          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-brand-blue shrink-0" />
            <p className="text-xs text-blue-800 leading-relaxed">
              Este comprobante será enviado automáticamente a la <strong>SUNAT</strong> y validado en tiempo real.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NotaDebitoPage() {
  return (
    <Suspense fallback={null}>
      <NotaDebitoContent />
    </Suspense>
  );
}

