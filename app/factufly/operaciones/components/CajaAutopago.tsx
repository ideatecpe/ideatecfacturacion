"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ScanBarcode,
  ShoppingCart,
  Wallet,
  ArrowLeft,
  ArrowRight,
  Store,
  Search,
  Trash2,
  Plus,
  Minus,
  PackageSearch,
  Delete,
  UserRound,
  Loader2,
  AlertTriangle,
  Receipt,
  FileText,
  Users,
} from "lucide-react";

import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { useProductosSucursal } from "@/app/factufly/productos/gestioProductos/useProductosSucursal";
import { ProductoSucursal } from "@/app/factufly/productos/gestioProductos/Producto";
import ImagenProductoCuadrada from "@/app/factufly/operaciones/components/ImagenProductoCuadrada";
import { ModalEliminar } from "@/app/components/ui/ModalEliminar";
import { Modal } from "@/app/components/ui/Modal";
import { useClienteBoleta } from "@/app/factufly/operaciones/boleta/gestionBoletas/useClienteBoleta";
import { useEmpresaEmisor } from "@/app/factufly/operaciones/boleta/gestionBoletas/useEmpresaEmisor";
import { useSucursal } from "@/app/factufly/operaciones/boleta/gestionBoletas/useSucursal";
import { formatoFechaActual } from "@/app/components/ui/formatoFecha";
import { numeroAlertas } from "@/app/components/ui/numeroAlertas";
import { avisarStockBajoWhatsapp } from "@/app/factufly/productos/gestioProductos/stockAlerta";
import { useToast } from "@/app/components/ui/Toast";
import {
  Banknote,
  CreditCard,
  Smartphone,
  Landmark,
  CheckCircle2,
  Printer,
} from "lucide-react";

interface MedioPagoOpcion {
  nombre: string;
  icon: typeof Banknote;
  activo: string;
}

const MEDIOS_PAGO: MedioPagoOpcion[] = [
  { nombre: "Efectivo", icon: Banknote, activo: "border-emerald-500 bg-emerald-50 text-emerald-700" },
  { nombre: "Tarjeta", icon: CreditCard, activo: "border-brand-blue bg-brand-blue/5 text-brand-blue" },
  { nombre: "Yape", icon: Smartphone, activo: "border-violet-500 bg-violet-50 text-violet-700" },
  { nombre: "Plin", icon: Smartphone, activo: "border-sky-500 bg-sky-50 text-sky-700" },
  { nombre: "Transferencia", icon: Landmark, activo: "border-amber-500 bg-amber-50 text-amber-700" },
];

// Pasos del flujo de Caja Autopago. Se irán construyendo vista a vista.
type Paso = "bienvenida" | "escaneo" | "documento" | "pago";

interface ItemCarrito {
  key: string;
  productoId: number;
  sucursalProductoId: number;
  codigo: string | null;
  descripcion: string;
  cantidad: number;
  precio: number; // precio de venta (con IGV incluido)
  tipoAfectacionIGV: string;
  urlImagen: string | null;
  unidadMedida: string;
  tipoProducto: string | null;
}

const PASOS_INFO = [
  {
    n: 1,
    icon: ScanBarcode,
    titulo: "Escanea los productos",
    desc: "Pasa el código de barras de cada producto",
  },
  {
    n: 2,
    icon: ShoppingCart,
    titulo: "Revisa el carrito",
    desc: "Confirma cantidades y precios",
  },
  {
    n: 3,
    icon: Wallet,
    titulo: "Cobra la venta",
    desc: "Elige el medio de pago y emite el comprobante",
  },
];

export default function CajaAutopago() {
  const { user, accessToken } = useAuth();
  const { config } = useConfiguracion();
  const { showToast } = useToast();

  const sucursalId = user?.sucursalID ? parseInt(user.sucursalID) : null;
  const { productosSucursal, fetchProductosSucursal } = useProductosSucursal(sucursalId, !!sucursalId);
  const { empresa } = useEmpresaEmisor();
  const { sucursal, fetchSucursal } = useSucursal();

  const [paso, setPaso] = useState<Paso>("bienvenida");
  const [items, setItems] = useState<ItemCarrito[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [itemAEliminar, setItemAEliminar] = useState<ItemCarrito | null>(null);
  const [documento, setDocumento] = useState("");
  const [sinDocumento, setSinDocumento] = useState(false);
  const [tipoSinDocumento, setTipoSinDocumento] = useState<"Boleta" | "Nota de Venta">("Boleta");
  // Con DNI/CE (no RUC), el cajero puede pasar de Boleta a Nota de Venta; por defecto Boleta.
  const [tipoConDocumento, setTipoConDocumento] = useState<"Boleta" | "Nota de Venta">("Boleta");
  const inputRef = useRef<HTMLInputElement>(null);
  const tipoSinDocInitRef = useRef(false);
  const { cliente, loadingCliente, errorCliente, buscarCliente } = useClienteBoleta();

  const igvPct = config?.igv ? parseFloat(config.igv) : 18;

  // Default de "Continuar sin documento" según la configuración "Tipo por defecto":
  // si el predeterminado es Nota de Venta y está habilitada, arranca en Nota de Venta.
  useEffect(() => {
    if (!config || tipoSinDocInitRef.current) return;
    tipoSinDocInitRef.current = true;
    if (config.useNotaVenta && config.isBoletaOrFactura === "n") {
      setTipoSinDocumento("Nota de Venta");
    }
  }, [config]);

  // Tipo de comprobante resultante: sin documento → elección manual (Boleta/NV);
  // RUC (11 díg.) → siempre Factura; DNI/CE (8 o 9) → Boleta o Nota de Venta (elección manual).
  const esRuc = documento.trim().length === 11;
  const tipoComprobante = sinDocumento
    ? tipoSinDocumento
    : esRuc
      ? "Factura"
      : tipoConDocumento;

  // Válido únicamente como DNI (8), CE (9) o RUC (11) dígitos exactos.
  const documentoValido = [8, 9, 11].includes(documento.trim().length);

  // ── Búsqueda de productos ────────────────────────────────────
  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return [];
    return productosSucursal
      .filter(
        (p) =>
          p.nomProducto?.toLowerCase().includes(q) ||
          p.codigo?.toLowerCase().includes(q) ||
          p.codigoBarras?.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [busqueda, productosSucursal]);

  // ── Agregar / quitar / cantidad ──────────────────────────────
  const agregarProducto = (p: ProductoSucursal) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.productoId === p.productoId);
      if (idx !== -1) {
        const copia = [...prev];
        copia[idx] = { ...copia[idx], cantidad: copia[idx].cantidad + 1 };
        return copia;
      }
      return [
        ...prev,
        {
          key: crypto.randomUUID(),
          productoId: p.productoId,
          sucursalProductoId: p.sucursalProducto.sucursalProductoId,
          codigo: p.codigo,
          descripcion: p.nomProducto,
          cantidad: 1,
          precio: p.sucursalProducto.precioUnitario ?? 0,
          tipoAfectacionIGV: p.tipoAfectacionIGV,
          urlImagen: p.urlImagenProducto ?? null,
          unidadMedida: p.unidadMedida ?? "NIU",
          tipoProducto: p.tipoProducto,
        },
      ];
    });
    setBusqueda("");
    inputRef.current?.focus();
  };

  const cambiarCantidad = (key: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((i) =>
          i.key === key ? { ...i, cantidad: Math.max(0, i.cantidad + delta) } : i,
        )
        .filter((i) => i.cantidad > 0),
    );
  };

  const confirmarEliminar = () => {
    if (!itemAEliminar) return;
    setItems((prev) => prev.filter((i) => i.key !== itemAEliminar.key));
    setItemAEliminar(null);
  };

  // ── Teclado numérico del documento ───────────────────────────
  const pulsarTecla = (t: string) => {
    if (t === "back") {
      setDocumento((prev) => prev.slice(0, -1));
      return;
    }
    setDocumento((prev) => (prev + t).slice(0, 11)); // máx. 11 (RUC)
  };

  const continuarConDocumento = () => {
    if (!documentoValido) return;
    const len = documento.trim().length;
    if (len === 8) buscarCliente("01", documento);
    else if (len === 9) buscarCliente("04", documento);
    else if (len === 11) buscarCliente("06", documento);
    setTipoConDocumento("Boleta");
    setSinDocumento(false);
    setPaso("pago");
  };

  const continuarSinDocumento = () => {
    setDocumento("");
    setSinDocumento(true);
    setPaso("pago");
  };

  // Enter en el buscador: si hay una coincidencia exacta de código de barras
  // (lector físico) o un único resultado, lo agrega directo.
  const onEnterBusqueda = () => {
    const q = busqueda.trim();
    if (!q) return;
    const exacto = productosSucursal.find(
      (p) => p.codigoBarras === q || p.codigo === q,
    );
    if (exacto) {
      agregarProducto(exacto);
      return;
    }
    if (resultados.length === 1) agregarProducto(resultados[0]);
  };

  // ── Totales (con desglose por afectación de IGV, para el payload real) ──
  const totales = useMemo(() => {
    let gravadas = 0,
      exoneradas = 0,
      inafectas = 0,
      igv = 0;
    items.forEach((i) => {
      const importe = i.precio * i.cantidad;
      if (i.tipoAfectacionIGV === "10") {
        const base = importe / (1 + igvPct / 100);
        gravadas += base;
        igv += importe - base;
      } else if (i.tipoAfectacionIGV === "20") {
        exoneradas += importe;
      } else {
        inafectas += importe;
      }
    });
    gravadas = parseFloat(gravadas.toFixed(2));
    exoneradas = parseFloat(exoneradas.toFixed(2));
    inafectas = parseFloat(inafectas.toFixed(2));
    igv = parseFloat(igv.toFixed(2));
    const valorVenta = parseFloat((gravadas + exoneradas + inafectas).toFixed(2));
    const total = parseFloat((valorVenta + igv).toFixed(2));
    const unidades = items.reduce((a, i) => a + i.cantidad, 0);
    return {
      gravadas,
      exoneradas,
      inafectas,
      igv,
      valorVenta,
      subtotal: valorVenta,
      total,
      unidades,
    };
  }, [items, igvPct]);

  // ── Pago (un solo medio, por el total de la venta) ────────────
  const [medioPago, setMedioPago] = useState("Efectivo");
  const [codigoOperacion, setCodigoOperacion] = useState("");
  const [mostrarResumen, setMostrarResumen] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);
  const [emitido, setEmitido] = useState(false);
  const [comprobanteIdEmitido, setComprobanteIdEmitido] = useState<number | null>(null);
  const [imprimiendo, setImprimiendo] = useState(false);

  const requiereCodigoOperacion = medioPago !== "Efectivo";

  // Réplica de calcularDetalle() de boleta/factura/nota-venta, sin descuentos
  // (Caja Autopago no los maneja): precio ya trae el IGV incluido.
  // SUNAT valida "valorVenta = precioUnitario × cantidad", así que precioUnitario
  // debe ser el precio SIN IGV (precioBase), no el precio de venta con IGV —
  // de ahí el error 3271/4288 "El valor de venta por ítem difiere...".
  const calcularDetalleItem = (precio: number, cantidad: number, tipoAfectacion: string) => {
    const precioVenta = parseFloat(precio.toFixed(2));
    if (tipoAfectacion === "10") {
      const precioBase = parseFloat((precio / (1 + igvPct / 100)).toFixed(6));
      const totalVentaItem = parseFloat((precioVenta * cantidad).toFixed(2));
      const montoIGV = parseFloat((totalVentaItem - totalVentaItem / (1 + igvPct / 100)).toFixed(2));
      const baseIgv = parseFloat((totalVentaItem - montoIGV).toFixed(2));
      return { precioUnitario: precioBase, precioVenta, baseIgv, montoIGV, totalVentaItem, valorVenta: baseIgv };
    }
    const precioBase = parseFloat(precio.toFixed(6));
    const baseIgv = parseFloat((precioVenta * cantidad).toFixed(2));
    return { precioUnitario: precioBase, precioVenta, baseIgv, montoIGV: 0, totalVentaItem: baseIgv, valorVenta: baseIgv };
  };

  // Cliente para el payload: "Clientes Varios" (sin documento) o el documento + datos
  // ya traídos por useClienteBoleta (buscarCliente, disparado al confirmar en Vista 3).
  const construirCliente = () => {
    if (sinDocumento) {
      return {
        clienteId: null,
        tipoDocumento: "0",
        numeroDocumento: "0",
        razonSocial: "Clientes Varios",
        ubigeo: "",
        direccionLineal: "",
        departamento: "",
        provincia: "",
        distrito: "",
      };
    }
    const len = documento.trim().length;
    const tipoDocumento = len === 11 ? "06" : len === 9 ? "04" : "01";
    return {
      clienteId: cliente?.clienteId ?? null,
      tipoDocumento,
      numeroDocumento: documento,
      razonSocial: cliente?.razonSocial ?? "",
      ubigeo: cliente?.ubigeo || "",
      direccionLineal: cliente?.direccionLineal || "",
      departamento: cliente?.departamento || "",
      provincia: cliente?.provincia || "",
      distrito: cliente?.distrito || "",
    };
  };

  // Payload para POST /api/Comprobantes/GenerarXml (Boleta "03" / Factura "01").
  const prepararComprobante = (tipoComprobanteCod: "03" | "01") => {
    const { fechaHora, fecha } = formatoFechaActual();
    const clienteBase = construirCliente();
    const clienteFinal =
      tipoComprobanteCod === "01" && clienteBase.tipoDocumento === "06"
        ? { ...clienteBase, tipoDocumento: "6" }
        : clienteBase;
    const detalles = items.map((it, idx) => {
      const calc = calcularDetalleItem(it.precio, it.cantidad, it.tipoAfectacionIGV);
      return {
        item: idx + 1,
        productoId: it.productoId,
        codigo: it.codigo,
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        unidadMedida: it.unidadMedida || "NIU",
        precioUnitario: calc.precioUnitario,
        tipoAfectacionIGV: it.tipoAfectacionIGV,
        porcentajeIGV: it.tipoAfectacionIGV === "10" ? igvPct : 0,
        montoIGV: calc.montoIGV,
        baseIgv: calc.baseIgv,
        codigoTipoDescuento: "00",
        descuentoUnitario: 0,
        descuentoTotal: 0,
        valorVenta: calc.valorVenta,
        precioVenta: calc.precioVenta,
        totalVentaItem: calc.totalVentaItem,
        icbper: 0,
        factorIcbper: 0,
      };
    });
    return {
      ublVersion: "2.1",
      tipoOperacion: "0101",
      tipoComprobante: tipoComprobanteCod,
      serie: tipoComprobanteCod === "01" ? (sucursal?.serieFactura ?? "") : (sucursal?.serieBoleta ?? ""),
      correlativo: String(
        (tipoComprobanteCod === "01" ? sucursal?.correlativoFactura : sucursal?.correlativoBoleta) ?? 1,
      ).padStart(8, "0"),
      fechaEmision: fechaHora,
      horaEmision: fechaHora,
      fechaVencimiento: fecha,
      tipoMoneda: "PEN",
      tipoPago: "Contado",
      cliente: clienteFinal,
      company: empresa
        ? { ...empresa, establecimientoAnexo: sucursal?.codEstablecimiento ?? empresa.establecimientoAnexo ?? "0000" }
        : null,
      codigoTipoDescGlobal: "02",
      descuentoGlobal: 0,
      totalOperacionesGravadas: totales.gravadas,
      totalOperacionesExoneradas: totales.exoneradas,
      totalOperacionesInafectas: totales.inafectas,
      totalOperacionesGratuitas: 0,
      totalIgvGratuitas: 0,
      totalIGV: totales.igv,
      totalImpuestos: totales.igv,
      totalDescuentos: 0,
      totalOtrosCargos: 0,
      totalIcbper: 0,
      valorVenta: totales.valorVenta,
      subTotal: totales.total,
      importeTotal: totales.total,
      montoCredito: 0,
      details: detalles,
      pagos: [
        {
          medioPago,
          monto: totales.total,
          fechaPago: fechaHora,
          numeroOperacion: medioPago === "Efectivo" ? "" : codigoOperacion,
          entidadFinanciera: "",
          observaciones: "",
        },
      ],
      cuotas: [],
      legends: [{ code: "1000", value: numeroAlertas(totales.total, "SOLES") }],
      guias: [],
      detracciones: [],
      usuarioCreacion: user?.id ?? 0,
      enviadoEnResumen: false,
    };
  };

  // Payload para POST /api/NotaVenta — sin IGV discriminado (documento de control interno).
  const prepararNotaVenta = () => {
    const { fechaHora, fecha } = formatoFechaActual();
    const clienteBase = construirCliente();
    const clienteNV = sinDocumento
      ? { ...clienteBase, tipoDocumento: "1", numeroDocumento: "99999999" }
      : clienteBase;
    return {
      sucursalId: parseInt(user?.sucursalID ?? "0"),
      fechaEmision: fechaHora,
      fechaVencimiento: fecha,
      tipoMoneda: "PEN",
      tipoCambio: null,
      tipoPago: "Contado",
      observaciones: null,
      usuarioCreacion: user?.id ?? 0,
      cliente: clienteNV,
      company: empresa
        ? { ...empresa, establecimientoAnexo: sucursal?.codEstablecimiento ?? empresa.establecimientoAnexo ?? "0000" }
        : null,
      descuentoGlobal: 0,
      totalDescuentos: 0,
      totalIGV: 0,
      valorVenta: totales.total,
      subTotal: totales.total,
      importeTotal: totales.total,
      montoCredito: 0,
      detalles: items.map((it, idx) => ({
        trabajadorId: null,
        item: idx + 1,
        productoId: it.productoId,
        codigo: it.codigo,
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        unidadMedida: it.unidadMedida || "NIU",
        precioUnitario: it.precio,
        descuentoUnitario: 0,
        descuentoTotal: 0,
        baseIgv: 0,
        montoIGV: 0,
        precioVenta: it.precio,
        totalVentaItem: parseFloat((it.precio * it.cantidad).toFixed(2)),
      })),
      pagos: [
        {
          medioPago,
          monto: totales.total,
          fechaPago: fechaHora,
          numeroOperacion: medioPago === "Efectivo" ? "" : codigoOperacion,
          entidadFinanciera: "",
          observaciones: "",
        },
      ],
      cuotas: [],
    };
  };

  // ── Descontar stock (solo si config.isStock) ───────────────────
  const descontarStockSiAplica = async (comprobanteId: number) => {
    if (!config?.isStock) return;
    const acumulado = new Map<number, number>();
    items.forEach((it) => {
      if (it.tipoProducto !== "BIEN" || !it.sucursalProductoId) return;
      acumulado.set(it.sucursalProductoId, (acumulado.get(it.sucursalProductoId) ?? 0) + it.cantidad);
    });
    const payloadItems = Array.from(acumulado.entries()).map(([sucursalProductoId, cantidad]) => ({
      sucursalProductoId,
      cantidad,
    }));
    if (!payloadItems.length) return;
    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteId}/descontar-stock`,
        payloadItems,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const productosActualizados = await fetchProductosSucursal();
      if (config?.numeroStockBajo) {
        const umbral = config.umbralStockBajo ?? 10;
        const bajos = (productosActualizados ?? [])
          .filter((p) => {
            const vendida = acumulado.get(p.sucursalProducto.sucursalProductoId);
            if (vendida === undefined) return false;
            const stockDespues = p.sucursalProducto.stock ?? 0;
            const stockAntes = stockDespues + vendida;
            return stockDespues <= umbral && stockAntes > umbral;
          })
          .map((p) => ({ nomProducto: p.nomProducto, stock: p.sucursalProducto.stock ?? 0 }));
        if (bajos.length) avisarStockBajoWhatsapp(bajos, config.numeroStockBajo);
      }
    } catch {
      showToast("No se pudo actualizar el stock de los productos.", "error");
    }
  };

  // ── Impresión automática (según config.isImprime) ──────────────
  const imprimirSiAplica = async (comprobanteId: number) => {
    if (!config?.isImprime) return;
    setImprimiendo(true);
    const tamanoMap: Record<string, string> = { "58": "Ticket58mm", "80": "Ticket80mm", "A4": "A4" };
    const tamano = config?.tamañoImpresion ? (tamanoMap[config.tamañoImpresion] ?? "A4") : "A4";
    const esTicket = tamano === "Ticket58mm" || tamano === "Ticket80mm";
    try {
      let blobUrl: string | null = null;
      if (esTicket) {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteId}/html?tamano=${tamano}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (res.ok) {
          const html = await res.text();
          blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
        }
      } else {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteId}/pdf?tamano=${tamano}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (res.ok) {
          const blob = await res.blob();
          blobUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
        }
      }
      if (blobUrl) {
        const iframe = document.createElement("iframe");
        iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;";
        iframe.src = blobUrl;
        document.body.appendChild(iframe);
        iframe.onload = () => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => document.body.removeChild(iframe), 2000);
        };
      }
    } catch {
      // Impresión best-effort: no debe bloquear el flujo de caja.
    } finally {
      setImprimiendo(false);
    }
  };

  const emitirVenta = async () => {
    if (!empresa) {
      showToast("No se pudo cargar la empresa emisora. Intenta de nuevo.", "error");
      return;
    }
    if (tipoComprobante !== "Nota de Venta" && !sucursal) {
      showToast("No se pudo cargar la sucursal (serie/correlativo). Intenta de nuevo.", "error");
      return;
    }
    setMostrarResumen(false);
    setEmitiendo(true);
    try {
      let comprobanteId: number;

      if (tipoComprobante === "Nota de Venta") {
        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/api/NotaVenta`,
          prepararNotaVenta(),
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        comprobanteId = res.data.comprobanteId ?? res.data.ComprobanteId;
      } else {
        const cod = tipoComprobante === "Factura" ? "01" : "03";
        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/GenerarXml`,
          prepararComprobante(cod),
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        comprobanteId = res.data.comprobanteId;

        // Envío a SUNAT: si SUNAT rechaza o no responde, el comprobante ya quedó
        // registrado en el sistema (igual que en Boleta/Factura), así que no
        // detenemos el flujo de caja — solo avisamos el resultado.
        try {
          const resSunat = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteId}/enviar-sunat`,
            null,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );
          showToast(
            resSunat.data.exitoso
              ? (resSunat.data.mensaje ?? `${tipoComprobante} emitida correctamente.`)
              : (resSunat.data.mensaje ?? `${tipoComprobante} quedó pendiente/rechazada por SUNAT.`),
            resSunat.data.exitoso ? "success" : "error",
          );
        } catch (errSunat: any) {
          showToast(
            errSunat?.response?.data?.mensaje ?? "No se pudo conectar con SUNAT. Verifica el estado en Comprobantes.",
            "error",
          );
        }
      }

      setComprobanteIdEmitido(comprobanteId);
      await descontarStockSiAplica(comprobanteId);
      await imprimirSiAplica(comprobanteId);
      fetchSucursal();
      setEmitido(true);
    } catch (err: any) {
      const data = err?.response?.data;
      const mensaje = data?.mensaje ?? data?.message ?? "Error al generar el comprobante";
      const detalle = data?.detalle;
      showToast(detalle ? `${mensaje}: ${detalle}` : mensaje, "error");
    } finally {
      setEmitiendo(false);
    }
  };

  const nuevaVenta = () => {
    setItems([]);
    setDocumento("");
    setSinDocumento(false);
    setTipoSinDocumento("Boleta");
    setTipoConDocumento("Boleta");
    tipoSinDocInitRef.current = false;
    setMedioPago("Efectivo");
    setCodigoOperacion("");
    setMostrarResumen(false);
    setComprobanteIdEmitido(null);
    setEmitido(false);
    setPaso("bienvenida");
  };

  // ── Vista 1: Bienvenida ──────────────────────────────────────
  if (paso === "bienvenida") {
    return (
      <div className="h-[calc(100vh-140px)] w-full rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col animate-in fade-in duration-500">
        {/* Cabecera */}
        <div className="bg-linear-to-br from-brand-blue to-blue-700 px-8 py-10 text-center text-white shrink-0">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/15 mb-5">
            <Store className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Caja Autopago</h1>
          <p className="text-blue-100 text-base mt-2">
            {user?.nombreEmpresa ?? "Bienvenido"}
            {user?.nombreSucursal ? ` · ${user.nombreSucursal}` : ""}
          </p>
        </div>

        {/* Pasos */}
        <div className="flex-1 flex flex-col justify-center px-8 md:px-16 py-8 max-w-6xl w-full mx-auto">
          <p className="text-center text-sm font-semibold text-gray-400 uppercase tracking-widest mb-8">
            Vender en 3 pasos
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {PASOS_INFO.map((p) => (
              <div
                key={p.n}
                className="relative flex flex-col items-center text-center rounded-3xl border border-gray-100 bg-gray-50/60 px-6 py-10"
              >
                <span className="absolute top-4 left-4 flex items-center justify-center w-8 h-8 rounded-full bg-brand-blue text-white text-sm font-bold">
                  {p.n}
                </span>
                <div className="flex items-center justify-center w-20 h-20 rounded-3xl bg-brand-blue/10 text-brand-blue mb-4">
                  <p.icon className="w-10 h-10" />
                </div>
                <p className="text-lg font-semibold text-gray-800">{p.titulo}</p>
                <p className="text-sm text-gray-400 mt-1.5">{p.desc}</p>
              </div>
            ))}
          </div>

          {/* Comenzar */}
          <button
            onClick={() => setPaso("escaneo")}
            className="mt-10 w-full flex items-center justify-center gap-3 rounded-3xl bg-brand-blue py-6 text-white text-2xl font-bold shadow-sm hover:bg-blue-700 active:scale-[0.99] transition-all"
          >
            Comenzar venta
            <ArrowRight className="w-7 h-7" />
          </button>
          <p className="text-center text-sm text-gray-400 mt-4">
            También puedes escanear un producto para comenzar
          </p>
        </div>
      </div>
    );
  }

  // ── Vista 2: Escaneo / Carrito ───────────────────────────────
  if (paso === "escaneo") {
    return (
      <>
      <div className="h-[calc(100vh-140px)] w-full rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col animate-in fade-in duration-500">
        {/* Cabecera con buscador */}
        <div className="shrink-0 border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPaso("bienvenida")}
              className="h-10 w-10 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors shrink-0"
              title="Volver"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={inputRef}
                autoFocus
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onEnterBusqueda();
                  }
                }}
                placeholder="Escanea el código de barras o escribe el nombre / código del producto"
                className="w-full h-12 pl-12 pr-4 rounded-2xl border border-gray-200 text-base outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all"
              />
              {/* Dropdown de resultados */}
              {resultados.length > 0 && (
                <div className="absolute z-20 mt-2 w-full rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden max-h-80 overflow-y-auto">
                  {resultados.map((p) => (
                    <button
                      key={p.productoId}
                      onClick={() => agregarProducto(p)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-blue-50/60 transition-colors border-b border-gray-50 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {p.nomProducto}
                        </p>
                        <p className="text-xs text-gray-400">{p.codigo ?? "—"}</p>
                      </div>
                      <span className="text-sm font-bold text-brand-blue whitespace-nowrap tabular-nums">
                        S/ {(p.sucursalProducto.precioUnitario ?? 0).toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lista de productos agregados */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="bg-gray-100 rounded-full p-5 mb-4">
                <PackageSearch className="w-10 h-10 text-gray-300" />
              </div>
              <p className="text-gray-500 font-semibold">Aún no hay productos</p>
              <p className="text-gray-400 text-sm mt-1">
                Escanea o busca un producto para agregarlo a la venta
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-w-4xl mx-auto">
              {items.map((i) => (
                <div
                  key={i.key}
                  className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white px-4 py-3 hover:border-gray-200 transition-colors"
                >
                  <ImagenProductoCuadrada url={i.urlImagen} alt={i.descripcion} size="md" />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {i.descripcion}
                    </p>
                    <p className="text-xs text-gray-400">
                      {i.codigo ?? "—"} · S/ {i.precio.toFixed(2)} c/u
                    </p>
                  </div>

                  {/* Control de cantidad */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => cambiarCantidad(i.key, -1)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-10 text-center text-base font-bold text-gray-800 tabular-nums">
                      {i.cantidad}
                    </span>
                    <button
                      onClick={() => cambiarCantidad(i.key, 1)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Total de línea */}
                  <span className="w-24 text-right text-base font-bold text-gray-900 tabular-nums shrink-0">
                    S/ {(i.precio * i.cantidad).toFixed(2)}
                  </span>

                  {/* Eliminar */}
                  <button
                    onClick={() => setItemAEliminar(i)}
                    className="h-9 w-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
                    title="Eliminar producto"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer con totales y continuar */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-gray-400">Subtotal</span>
                <p className="font-semibold text-gray-700 tabular-nums">
                  S/ {totales.subtotal.toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-gray-400">IGV ({igvPct}%)</span>
                <p className="font-semibold text-gray-700 tabular-nums">
                  S/ {totales.igv.toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-gray-400">
                  Total ({totales.unidades} und.)
                </span>
                <p className="text-xl font-bold text-brand-blue tabular-nums">
                  S/ {totales.total.toFixed(2)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setPaso("documento")}
              disabled={items.length === 0}
              className="flex items-center justify-center gap-2 rounded-2xl bg-brand-blue px-8 py-4 text-white text-lg font-bold shadow-sm hover:bg-blue-700 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              Continuar
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <ModalEliminar
        isOpen={!!itemAEliminar}
        mensaje="Quitarás de la venta"
        nombre={itemAEliminar?.descripcion ?? ""}
        documento={itemAEliminar?.codigo ?? undefined}
        onClose={() => setItemAEliminar(null)}
        onConfirm={confirmarEliminar}
      />
      </>
    );
  }

  // ── Vista 3: Identificación del cliente / tipo de comprobante ─
  if (paso === "documento") {
    return (
      <div className="h-[calc(100vh-140px)] w-full rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col animate-in fade-in duration-500">
        {/* Cabecera */}
        <div className="shrink-0 border-b border-gray-100 px-6 py-4 flex items-center justify-between gap-3">
          <button
            onClick={() => setPaso("escaneo")}
            className="h-10 px-3 inline-flex items-center gap-1.5 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" /> Atrás
          </button>
          <div className="text-right">
            <p className="text-xs text-gray-400">Total a cobrar</p>
            <p className="text-xl font-bold text-brand-blue tabular-nums">
              S/ {totales.total.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto flex items-center justify-center px-6 py-6">
          <div className="w-full max-w-md">
            <div className="text-center mb-5">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-blue/10 text-brand-blue mb-3">
                <UserRound className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Identifica al cliente</h2>
              <p className="text-sm text-gray-400 mt-1">
                RUC → Factura · DNI / CE → Boleta
              </p>
            </div>

            {/* Input del documento */}
            <input
              value={documento}
              onChange={(e) =>
                setDocumento(e.target.value.replace(/\D/g, "").slice(0, 11))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  continuarConDocumento();
                }
              }}
              autoFocus
              inputMode="numeric"
              placeholder="Ej: 12345678"
              className="w-full h-14 text-center text-2xl font-bold tracking-wider tabular-nums rounded-2xl border border-gray-200 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all"
            />

            {/* Teclado numérico */}
            <div className="grid grid-cols-3 gap-2.5 mt-4">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((t) => (
                <button
                  key={t}
                  onClick={() => pulsarTecla(t)}
                  className="h-14 rounded-2xl bg-gray-50 border border-gray-100 text-xl font-bold text-gray-700 hover:bg-gray-100 active:scale-95 transition-all"
                >
                  {t}
                </button>
              ))}
              <div />
              <button
                onClick={() => pulsarTecla("0")}
                className="h-14 rounded-2xl bg-gray-50 border border-gray-100 text-xl font-bold text-gray-700 hover:bg-gray-100 active:scale-95 transition-all"
              >
                0
              </button>
              <button
                onClick={() => pulsarTecla("back")}
                className="h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-100 active:scale-95 transition-all"
              >
                <Delete className="w-6 h-6" />
              </button>
            </div>

            {/* Continuar */}
            <button
              onClick={continuarConDocumento}
              disabled={!documentoValido}
              className="mt-5 w-full flex items-center justify-center gap-2 rounded-2xl bg-brand-blue py-4 text-white text-lg font-bold shadow-sm hover:bg-blue-700 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              Continuar
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={continuarSinDocumento}
              className="mt-2 w-full py-2.5 text-sm font-semibold text-gray-400 hover:text-brand-blue transition-colors"
            >
              Continuar sin documento (Clientes varios)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Vista 4: Medio de pago y emisión ──────────────────────────
  if (paso === "pago") {
    // ── Confirmación tras emitir ──
    if (emitido) {
      const serieCorrelativo =
        tipoComprobante !== "Nota de Venta" && sucursal
          ? `${tipoComprobante === "Factura" ? sucursal.serieFactura : sucursal.serieBoleta}`
          : null;
      return (
        <div className="h-[calc(100vh-140px)] w-full rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col items-center justify-center px-6 py-8 animate-in fade-in duration-500 overflow-y-auto">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50 mb-4 shrink-0">
            <CheckCircle2 className="w-11 h-11 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 shrink-0">¡Venta registrada!</h1>

          {imprimiendo && (
            <p className="text-brand-blue text-sm font-semibold flex items-center gap-1.5 mt-2 shrink-0">
              <Printer className="w-4 h-4 animate-pulse" /> Enviando a imprimir...
            </p>
          )}

          {/* Comprobante final */}
          <div className="w-full max-w-sm mt-5 rounded-2xl border-2 border-gray-100 overflow-hidden shrink-0">
            <div
              className={`px-5 py-4 text-center ${
                tipoComprobante === "Factura"
                  ? "bg-brand-blue/5"
                  : tipoComprobante === "Nota de Venta"
                    ? "bg-amber-50"
                    : "bg-emerald-50"
              }`}
            >
              <p
                className={`text-xl font-extrabold uppercase tracking-wide ${
                  tipoComprobante === "Factura"
                    ? "text-brand-blue"
                    : tipoComprobante === "Nota de Venta"
                      ? "text-amber-700"
                      : "text-emerald-700"
                }`}
              >
                {tipoComprobante}
              </p>
              {comprobanteIdEmitido && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {serieCorrelativo ? `${serieCorrelativo} · ` : ""}N° {comprobanteIdEmitido}
                </p>
              )}
            </div>

            <div className="max-h-40 overflow-y-auto divide-y divide-gray-100">
              {items.map((i) => (
                <div key={i.key} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                  <span className="text-gray-600 truncate">
                    {i.cantidad} × {i.descripcion}
                  </span>
                  <span className="font-semibold text-gray-800 tabular-nums shrink-0">
                    S/ {(i.precio * i.cantidad).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 bg-gray-50 space-y-1">
              <div className="flex justify-between text-xs text-gray-400">
                <span>{sinDocumento ? "Clientes varios" : (cliente?.razonSocial ?? documento)}</span>
                <span>{medioPago}</span>
              </div>
              <div className="flex justify-between text-2xl font-extrabold text-gray-900 pt-1">
                <span>Total</span>
                <span className="tabular-nums">S/ {totales.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <button
            onClick={nuevaVenta}
            className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-brand-blue px-10 py-5 text-white text-xl font-bold shadow-sm hover:bg-blue-700 active:scale-[0.99] transition-all shrink-0"
          >
            Nueva venta
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>
      );
    }

    return (
      <>
      <div className="h-[calc(100vh-140px)] w-full rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col animate-in fade-in duration-500">
        {/* Cabecera */}
        <div className="shrink-0 border-b border-gray-100 px-6 py-4 flex items-center justify-between gap-3">
          <button
            onClick={() => setPaso("documento")}
            className="h-10 px-3 inline-flex items-center gap-1.5 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" /> Atrás
          </button>
          <div className="text-right">
            <p className="text-xs text-gray-400">Total a cobrar</p>
            <p className="text-xl font-bold text-brand-blue tabular-nums">
              S/ {totales.total.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto flex items-center justify-center px-6 py-6">
          <div className="w-full max-w-lg">
            {/* Tipo de comprobante + cliente */}
            {sinDocumento ? (
              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-600 mb-2 text-center">
                  Tipo de comprobante
                </p>
                <div className={`grid gap-2.5 ${config?.useNotaVenta ? "grid-cols-2" : "grid-cols-1"}`}>
                  <button
                    onClick={() => setTipoSinDocumento("Boleta")}
                    className={`flex items-center justify-center gap-2 rounded-2xl border-2 py-4 text-sm font-semibold transition-colors ${
                      tipoSinDocumento === "Boleta"
                        ? "border-brand-blue bg-brand-blue/5 text-brand-blue"
                        : "border-gray-100 bg-gray-50/60 text-gray-500 hover:border-gray-200"
                    }`}
                  >
                    <FileText className="w-4 h-4" /> Boleta
                  </button>
                  {config?.useNotaVenta && (
                    <button
                      onClick={() => setTipoSinDocumento("Nota de Venta")}
                      className={`flex items-center justify-center gap-2 rounded-2xl border-2 py-4 text-sm font-semibold transition-colors ${
                        tipoSinDocumento === "Nota de Venta"
                          ? "border-amber-500 bg-amber-50 text-amber-700"
                          : "border-gray-100 bg-gray-50/60 text-gray-500 hover:border-gray-200"
                      }`}
                    >
                      <Receipt className="w-4 h-4" /> Nota de Venta
                    </button>
                  )}
                </div>
                <p className="text-center text-xs text-gray-400 mt-2 flex items-center justify-center gap-1">
                  <Users className="w-3.5 h-3.5" /> Clientes varios
                </p>
              </div>
            ) : (
              <div className="mb-6">
                <div
                  className={`rounded-2xl border-2 px-5 py-4 flex items-start gap-4 ${
                    tipoComprobante === "Factura"
                      ? "border-brand-blue/30 bg-brand-blue/5"
                      : tipoComprobante === "Nota de Venta"
                        ? "border-amber-300 bg-amber-50"
                        : "border-emerald-300 bg-emerald-50"
                  }`}
                >
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                      tipoComprobante === "Factura"
                        ? "bg-brand-blue/10 text-brand-blue"
                        : tipoComprobante === "Nota de Venta"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {tipoComprobante === "Factura" ? <FileText className="w-7 h-7" /> : <Receipt className="w-7 h-7" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-2xl font-extrabold uppercase tracking-wide leading-tight ${
                        tipoComprobante === "Factura"
                          ? "text-brand-blue"
                          : tipoComprobante === "Nota de Venta"
                            ? "text-amber-700"
                            : "text-emerald-700"
                      }`}
                    >
                      {tipoComprobante}
                    </p>
                    <p className="text-sm text-gray-500 font-medium mt-0.5">{documento}</p>
                    {loadingCliente ? (
                      <p className="text-sm text-gray-400 flex items-center gap-1.5 mt-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando cliente...
                      </p>
                    ) : errorCliente ? (
                      <p className="text-sm text-rose-500 flex items-center gap-1.5 mt-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> {errorCliente}
                      </p>
                    ) : (
                      <>
                        <p className="text-base font-semibold text-gray-800 mt-1.5">
                          {cliente?.razonSocial ?? "—"}
                        </p>
                        {tipoComprobante === "Factura" && cliente?.direccionLineal && (
                          <p className="text-xs text-gray-400 mt-0.5">{cliente.direccionLineal}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Con DNI/CE se puede pasar a Nota de Venta (por defecto Boleta) */}
                {!esRuc && config?.useNotaVenta && (
                  <div className="grid grid-cols-2 gap-2 mt-2.5">
                    <button
                      onClick={() => setTipoConDocumento("Boleta")}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border-2 py-2.5 text-xs font-semibold transition-colors ${
                        tipoConDocumento === "Boleta"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-gray-100 bg-gray-50/60 text-gray-500 hover:border-gray-200"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" /> Boleta
                    </button>
                    <button
                      onClick={() => setTipoConDocumento("Nota de Venta")}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border-2 py-2.5 text-xs font-semibold transition-colors ${
                        tipoConDocumento === "Nota de Venta"
                          ? "border-amber-500 bg-amber-50 text-amber-700"
                          : "border-gray-100 bg-gray-50/60 text-gray-500 hover:border-gray-200"
                      }`}
                    >
                      <Receipt className="w-3.5 h-3.5" /> Nota de Venta
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-brand-blue/10 text-brand-blue mb-2">
                <Wallet className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-gray-800">Selecciona el medio de pago</h2>
            </div>

            {/* Medios de pago */}
            <div className="grid grid-cols-3 gap-2">
              {MEDIOS_PAGO.map((m) => {
                const activo = medioPago === m.nombre;
                return (
                  <button
                    key={m.nombre}
                    onClick={() => setMedioPago(m.nombre)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 transition-colors ${
                      activo ? m.activo : "border-gray-100 bg-gray-50/60 text-gray-500 hover:border-gray-200"
                    }`}
                  >
                    <m.icon className="w-5 h-5" />
                    <span className="text-xs font-semibold">{m.nombre}</span>
                  </button>
                );
              })}
            </div>

            {/* Código de operación (opcional, todo menos Efectivo) */}
            {requiereCodigoOperacion && (
              <div className="mt-5">
                <label className="text-sm font-semibold text-gray-600">
                  Código de operación <span className="font-normal text-gray-400">(opcional)</span>
                </label>
                <input
                  value={codigoOperacion}
                  onChange={(e) => setCodigoOperacion(e.target.value)}
                  placeholder="Ej: 000123456"
                  autoFocus
                  className="mt-1.5 w-full h-14 px-4 text-lg rounded-2xl border border-gray-200 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all"
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  Queda como registro interno de la venta
                </p>
              </div>
            )}

            {/* Emitir */}
            <button
              onClick={() => setMostrarResumen(true)}
              disabled={emitiendo}
              className="mt-6 w-full flex items-center justify-center gap-2 rounded-2xl bg-brand-blue py-5 text-white text-xl font-bold shadow-sm hover:bg-blue-700 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {emitiendo ? "Emitiendo..." : `Cobrar y emitir ${tipoComprobante}`}
              {!emitiendo && <ArrowRight className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal: Resumen antes de emitir ── */}
      <Modal
        isOpen={mostrarResumen}
        onClose={() => setMostrarResumen(false)}
        title="Resumen de la venta"
      >
        <div className="space-y-4">
          {/* Tipo de comprobante + cliente */}
          <div
            className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
              tipoComprobante === "Factura"
                ? "border-brand-blue/20 bg-brand-blue/5"
                : tipoComprobante === "Nota de Venta"
                  ? "border-amber-200 bg-amber-50"
                  : "border-emerald-200 bg-emerald-50"
            }`}
          >
            {tipoComprobante === "Factura" ? (
              <FileText className="w-5 h-5 text-brand-blue shrink-0" />
            ) : (
              <Receipt
                className={`w-5 h-5 shrink-0 ${tipoComprobante === "Nota de Venta" ? "text-amber-600" : "text-emerald-600"}`}
              />
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-800">{tipoComprobante}</p>
              <p className="text-xs text-gray-500 truncate">
                {sinDocumento
                  ? "Clientes varios"
                  : `${cliente?.razonSocial ?? "—"} · ${documento}`}
              </p>
            </div>
          </div>

          {/* Lista de productos */}
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
              {items.map((i) => (
                <div key={i.key} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{i.descripcion}</p>
                    <p className="text-xs text-gray-400">
                      {i.cantidad} × S/ {i.precio.toFixed(2)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-gray-800 tabular-nums shrink-0">
                    S/ {(i.precio * i.cantidad).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Totales */}
          <div className="rounded-xl bg-gray-50 px-4 py-3 space-y-1 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span className="tabular-nums">S/ {totales.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>IGV ({igvPct}%)</span>
              <span className="tabular-nums">S/ {totales.igv.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-200">
              <span>Total</span>
              <span className="tabular-nums">S/ {totales.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Medio de pago */}
          <div className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3">
            <span className="text-sm text-gray-500">Medio de pago</span>
            <span className="text-sm font-semibold text-gray-800">
              {medioPago}
              {codigoOperacion && ` · Op. ${codigoOperacion}`}
            </span>
          </div>

          {/* Acciones */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={() => setMostrarResumen(false)}
              className="px-4 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={emitirVenta}
              className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold text-white bg-brand-blue hover:bg-blue-700 rounded-xl transition-colors"
            >
              Confirmar y emitir
            </button>
          </div>
        </div>
      </Modal>
      </>
    );
  }

  return null;
}
