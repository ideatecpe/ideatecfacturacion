"use client";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  ChevronDown,
  RefreshCw,
  Mail,
  MessageCircle,
  CheckCircle2,
  X,
  Eye,
  Filter,
  Search,
  MoreHorizontal,
  RotateCcw,
  Ban,
  FileText,
  Plus,
  Calendar,
  Hash,
  UserRound,
  UserCog,
  Upload,
} from "lucide-react";
import { useToast } from "@/app/components/ui/Toast";
import { cn } from "@/app/utils/cn";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { Comprobante } from "./gestionComprobantes/Comprobante";
import { useSucursalRuc } from "../operaciones/boleta/gestionBoletas/useSucursalRuc";
import axios from "axios";

import { useComprobantesEmpresaListado } from "./gestionComprobantes/gestionComprobantesLista/UseComprobantesEmpresaListado";
import { useComprobantesEmpresaClienteListado } from "./gestionComprobantes/gestionComprobantesLista/UseComprobantesEmpresaClienteListado";
import { useComprobantesEmpresaUsuarioListado } from "./gestionComprobantes/gestionComprobantesLista/UseComprobantesEmpresaUsuarioListado";
import { useComprobantesSucursalListado } from "./gestionComprobantes/gestionComprobantesLista/UseComprobantesSucursalListado";
import { useComprobanteDetalles } from "./gestionComprobantes/gestionComprobantesLista/UseComprobanteDetalles";
import {
  ComprobanteListado,
  ComprobanteDetalles,
} from "./gestionComprobantes/Comprobante";

import { useComprobanteUnico } from "./gestionComprobantes/UseComprobanteUnico";
import { useComprobantesClienteSucursalListado } from "./gestionComprobantes/gestionComprobantesLista/UseComprobantesClienteSucursalListado";

import { ModalDetalle } from "@/app/components/modalVerComprobantes/ModalDetalle";
import { ModalEnvioCorreoWhatsapp } from "@/app/components/modalVerComprobantes/ModalEnvioCorreoWhatsapp";
import {
  tipoLabel,
  formatFecha,
  formatFechaHora,
  COLORS,
} from "./gestionComprobantes/helpers";
import { fmtMonto } from "@/app/components/ui/formatoFecha";
import { useRouter } from "next/navigation";
import { Card } from "@/app/components/ui/Card";
import { createPortal } from "react-dom";
import { Button } from "@/app/components/ui/Button";
import { DropdownFiltro } from "@/app/components/ui/DropdownFiltro";
import { ModalResumen } from "@/app/components/modalGenerarResumen/ModalResumen";
import { useSucursal } from "../operaciones/boleta/gestionBoletas/useSucursal";
import { ModalEnvioMasivo } from "@/app/components/modalVerComprobantes/Modalenviomasivo";
import { ModalCargaMasivaComprobantes } from "@/app/components/modalCargaMasiva/Modalcargamasivacomprobantes";
import { useEmpresaEmisor } from "../operaciones/boleta/gestionBoletas/useEmpresaEmisor";
import {
  CargaComprobantePendiente,
  leerComprobantesCarga,
  marcarComprobanteCargaEnviado,
} from "@/app/utils/cargaComprobantesStore";
import { CardTable } from "@/app/components/ui/CardTable";

// ─── Constantes filtros ───────────────────────────────────────────────────────
const TIPOS_OPTS = ["Todos", "Factura", "Boleta", "N.Crédito", "N.Débito"];
const ESTADOS_OPTS = ["Todos", "Aceptado", "Pendiente", "Rechazado", "Anulado"];
const ESTADO_COLORS_MAP: Record<string, string> = {
  Aceptado: "bg-emerald-500",
  Pendiente: "bg-amber-400",
  Rechazado: "bg-red-500",
  Anulado: "bg-gray-400",
};

// ─── Page Principal ───────────────────────────────────────────────────────────
export default function VerComprobantesPage() {
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const { config } = useConfiguracion();
  const { showToast } = useToast();
  const isSuperAdmin = user?.rol === "superadmin";
  const esUsuarioVelsat =
    user?.username?.toLowerCase() === "velsat" || user?.ruc === "10073587382";
  const isBeta = user?.environment === "beta";
  const rucEmpresa: string = user?.ruc ?? "";
  const sucursalId: number = Number(user?.sucursalID ?? 0);

  // ── Hooks de datos ──
  const hookEmpresa = useComprobantesEmpresaListado();
  const hookSucursal = useComprobantesSucursalListado();
  const { sucursal: sucursalUsuario, loadingSucursal } = useSucursal();
  const hookCliente = useComprobantesEmpresaClienteListado();
  const hookClienteSucursal = useComprobantesClienteSucursalListado();
  const hookUsuario = useComprobantesEmpresaUsuarioListado();
  const hookDetalles = useComprobanteDetalles();
  const hookUnico = useComprobanteUnico();

  const { sucursales, loadingSucursales } = useSucursalRuc(isSuperAdmin);

  const [showModalResumen, setShowModalResumen] = useState(false);
  const [loadingSunatMap, setLoadingSunatMap] = useState<
    Record<string, boolean>
  >({});
  const [showModalEnvioMasivo, setShowModalEnvioMasivo] = useState(false);

  // ── Estado local ──
  const [comprobantes, setComprobantes] = useState<ComprobanteListado[]>([]);
  const [detalle, setDetalle] = useState<ComprobanteListado | null>(null);
  const [detalleCompleto, setDetalleCompleto] =
    useState<ComprobanteDetalles | null>(null);
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [offset, setOffset] = useState(0);
  const limit = 100;

  const [modalEnvio, setModalEnvio] = useState<{
    comprobante: ComprobanteListado;
    tipo: "email" | "whatsapp";
  } | null>(null);

  const [loadingPdfMap, setLoadingPdfMap] = useState<Record<string, boolean>>( {}, );
  const [loadingXmlMap, setLoadingXmlMap] = useState<Record<string, boolean>>( {}, );
  const [loadingCdrMap, setLoadingCdrMap] = useState<Record<string, boolean>>( {}, );
  const [pdfSizeMap, setPdfSizeMap] = useState<Record<number, string>>({});
  const getPdfSize = (id: number) => pdfSizeMap[id] ?? "A4";

  const tableBodyRef = useRef<HTMLTableSectionElement>(null);

  // ── Filtros cabecera ──
  const [showAvanzado, setShowAvanzado] = useState(false);
  const [sucursalFiltro, setSucursalFiltro] = useState<number | null>(null);

  const [modoAvanzado, setModoAvanzado] = useState< "fechas" | "unico" | "cliente" | "usuario" >("fechas");
  const [avSerie, setAvSerie] = useState("");
  const [avNumero, setAvNumero] = useState("");
  const [avClienteDoc, setAvClienteDoc] = useState("");
  const [avUsuarioId, setAvUsuarioId] = useState("");
  const [avFechaDesde, setAvFechaDesde] = useState("");
  const [avFechaHasta, setAvFechaHasta] = useState("");

  //CARGA MASIVA
  const [showModalCargaMasiva, setShowModalCargaMasiva] = useState(false);
  const { empresa } = useEmpresaEmisor();

  const hoy = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
  }).format(new Date());

  const loading =
    hookSucursal.loading ||
    hookEmpresa.loading ||
    hookUnico.loading ||
    hookCliente.loading ||
    hookUsuario.loading ||
    hookClienteSucursal.loading;

  const hasMore = useMemo(() => {
    if (modoAvanzado === "unico") return false;
    if (showAvanzado) {
      if (modoAvanzado === "fechas") {
        return isSuperAdmin
          ? sucursalFiltro
            ? hookSucursal.hasMore
            : hookEmpresa.hasMore
          : hookSucursal.hasMore;
      }
      if (modoAvanzado === "cliente") {
        return isSuperAdmin ? hookCliente.hasMore : hookClienteSucursal.hasMore;
      }
      if (modoAvanzado === "usuario") return hookUsuario.hasMore;
    }
    return isSuperAdmin
      ? sucursalFiltro
        ? hookSucursal.hasMore
        : hookEmpresa.hasMore
      : hookSucursal.hasMore;
  }, [
    showAvanzado,
    modoAvanzado,
    isSuperAdmin,
    sucursalFiltro,
    hookSucursal.hasMore,
    hookEmpresa.hasMore,
    hookCliente.hasMore,
    hookClienteSucursal.hasMore,
    hookUsuario.hasMore,
  ]);

  const pendientes = useMemo(
    () => comprobantes.filter((c) => c.estadoSunat === "PENDIENTE"),
    [comprobantes],
  );

  const fetchEmpresa = hookEmpresa.fetchComprobantes;
  const fetchSucursal = hookSucursal.fetchComprobantes;

  const cargarComprobantes = useCallback(
    async (offset: number = 0) => {
      let data: ComprobanteListado[] = [];
      const params = { fechaDesde: null, fechaHasta: null, offset, limit };
      if (isSuperAdmin && sucursalFiltro) {
        data = await fetchSucursal({ ...params, sucursalId: sucursalFiltro });
      } else if (isSuperAdmin) {
        data = await fetchEmpresa({ ...params, ruc: rucEmpresa });
      } else {
        data = await fetchSucursal({ ...params, sucursalId });
      }
      if (esUsuarioVelsat && offset === 0 && !showAvanzado) {
        data = [...leerComprobantesCarga(), ...data];
      }
      setComprobantes(data);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isSuperAdmin,
      sucursalFiltro,
      rucEmpresa,
      sucursalId,
      limit,
      esUsuarioVelsat,
      showAvanzado,
    ],
  );

  useEffect(() => {
    if (!user || !accessToken) return;
    setOffset(0);
    cargarComprobantes(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.ruc, user?.sucursalID, accessToken, cargarComprobantes]);

  const obtenerPdf = useCallback(
    async (c: ComprobanteListado, tamano?: string) => {
      const size = tamano ?? getPdfSize(c.comprobanteId);
      const esTicket = size === "Ticket58mm" || size === "Ticket80mm";
      setLoadingPdfMap((prev) => ({ ...prev, [c.comprobanteId]: true }));
      let ventana: Window | null = null;
      try {
        ventana = window.open("", "_blank");
        if (ventana) {
          ventana.document.write(`
            <html><head><title>Cargando...</title></head>
            <body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#f8fafc;font-family:sans-serif;flex-direction:column;gap:16px;">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              <style>@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>
              <p style="color:#64748b;font-size:14px;margin:0">Cargando, por favor espere...</p>
            </body></html>
          `);
        }

        if (esTicket) {
          // ── Tickets 58mm / 80mm: iframe oculto con HTML vectorial ──
          // Sin abrir nueva pestaña, sin bloquear la página.
          if (ventana) ventana.close(); // cerrar la ventana de carga que se abrió
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${c.comprobanteId}/html?tamano=${size}`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );
          if (!res.ok) throw new Error("Error al generar ticket HTML");
          const html = await res.text();
          const blob = new Blob([html], { type: "text/html" });
          const htmlUrl = URL.createObjectURL(blob);
          const iframe = document.createElement("iframe");
          iframe.style.cssText =
            "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;";
          iframe.src = htmlUrl;
          document.body.appendChild(iframe);
          iframe.onload = () => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => {
              document.body.removeChild(iframe);
              URL.revokeObjectURL(htmlUrl);
            }, 2000);
          };
        } else {
          // ── A4: flujo original con PDF blob ──
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${c.comprobanteId}/pdf?tamano=${size}`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );
          if (!res.ok) throw new Error("Error al generar PDF");
          const blob = await res.blob();
          const url = URL.createObjectURL(
            new Blob([blob], { type: "application/pdf" }),
          );
          if (ventana) ventana.location.href = url;
        }
      } catch {
        if (ventana) ventana.close();
        showToast("Error al obtener el documento", "error");
      } finally {
        setLoadingPdfMap((prev) => ({ ...prev, [c.comprobanteId]: false }));
      }
    },
    [accessToken, showToast],
  );

  const abrirDetalle = useCallback(
    async (c: ComprobanteListado) => {
      setDetalle(c);
      setDetalleCompleto(null);
      const carga = c as CargaComprobantePendiente;
      if (carga._cargaEstatica) {
        setDetalleCompleto({
          comprobanteId: c.comprobanteId,
          details: (carga._itemsCarga ?? []).map((item, index) => ({
            detalleId: c.comprobanteId + index,
            comprobanteId: c.comprobanteId,
            item: index + 1,
            productoId: 0,
            codigo: item.placa,
            descripcion: item.concepto,
            cantidad: 1,
            unidadMedida: "ZZ",
            precioUnitario: item.importe,
            tipoAfectacionIGV: "30",
            porcentajeIGV: 0,
            montoIGV: 0,
            baseIgv: item.importe,
            codigoTipoDescuento: "01",
            descuentoUnitario: 0,
            descuentoTotal: 0,
            valorVenta: item.importe,
            precioVenta: item.importe,
            totalVentaItem: item.importe,
            icbper: 0,
            factorIcbper: 0,
          })),
          pagos: [],
          cuotas: [],
          legends: [],
          guias: [],
          detracciones: [],
          vales: [],
        });
        return;
      }
      const data = await hookDetalles.fetchDetalles(c.comprobanteId);
      if (data) setDetalleCompleto(data);
    },
    [hookDetalles],
  );

  const buscarAvanzado = async (offset: number = 0) => {
    let data: ComprobanteListado[] = [];
    const commonParams = {
      fechaDesde: avFechaDesde || null,
      fechaHasta: avFechaHasta || null,
      offset,
      limit,
    };

    if (modoAvanzado === "fechas") {
      if (isSuperAdmin && sucursalFiltro) {
        data = await hookSucursal.fetchComprobantes({
          ...commonParams,
          sucursalId: sucursalFiltro,
        });
      } else if (isSuperAdmin) {
        data = await hookEmpresa.fetchComprobantes({
          ...commonParams,
          ruc: rucEmpresa,
        });
      } else {
        data = await hookSucursal.fetchComprobantes({
          ...commonParams,
          sucursalId,
        });
      }
      setComprobantes(data);
    } else if (modoAvanzado === "unico") {
      if (!avSerie || !avNumero) {
        showToast("Ingrese serie y número", "error");
        return;
      }
      const resultado = await hookUnico.fetchComprobante({
        ruc: rucEmpresa,
        serie: avSerie,
        numero: Number(avNumero),
      });
      if (resultado) {
        setComprobantes([resultado as unknown as ComprobanteListado]);
      } else {
        setComprobantes([]);
        showToast("No se encontró el comprobante", "error");
      }
    } else if (modoAvanzado === "cliente") {
      if (!avClienteDoc) {
        showToast("Ingrese el número de documento del cliente", "error");
        return;
      }
      if (isSuperAdmin) {
        data = await hookCliente.fetchComprobantes({
          ...commonParams,
          rucEmpresa,
          clienteNumDoc: avClienteDoc,
        });
      } else {
        data = await hookClienteSucursal.fetchComprobantes({
          ...commonParams,
          sucursalId,
          clienteNumDoc: avClienteDoc,
        });
      }
      setComprobantes(data);
    } else if (modoAvanzado === "usuario") {
      if (!avUsuarioId) {
        showToast("Ingrese el ID de usuario", "error");
        return;
      }
      data = await hookUsuario.fetchComprobantes({
        ...commonParams,
        rucEmpresa,
        usuarioId: Number(avUsuarioId),
      });
      setComprobantes(data);
    }
  };

  const filtered = useMemo(() => {
    return comprobantes
      .filter((c) => {
        const tipo = tipoLabel(c.tipoComprobante);
        const matchSearch =
          (c.cliente?.razonSocial ?? "")
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          (c.cliente?.numeroDocumento ?? "").includes(search) ||
          (c.numeroCompleto ?? "").toLowerCase().includes(search.toLowerCase());
        const matchTipo = filtroTipo === "Todos" || tipo === filtroTipo;
        const estadoLabel =
          c.estadoSunat === "ACEPTADO"
            ? "Aceptado"
            : c.estadoSunat === "RECHAZADO"
              ? "Rechazado"
              : c.estadoSunat === "ANULADO"
                ? "Anulado"
                : "Pendiente";
        const matchEstado =
          filtroEstado === "Todos" || estadoLabel === filtroEstado;
        return matchSearch && matchTipo && matchEstado;
      })
      .sort((a, b) => {
        // 1° criterio: fechaEmision DESC  ("YYYY-MM-DD" → comparación lexicográfica exacta)
        const cmpFecha = b.fechaEmision.localeCompare(a.fechaEmision);
        if (cmpFecha !== 0) return cmpFecha;
        // 2° criterio: comprobanteId DESC (ID autoincremental en BD → orden real de emisión
        //  independiente del tipo de comprobante: B001, F001, notas de crédito, etc.)
        return b.comprobanteId - a.comprobanteId;
      });
  }, [comprobantes, search, filtroTipo, filtroEstado]);

  const paginated = filtered;

  // refetch=true → recarga la lista al terminar (para ver XML/CDR)
  // refetch=false → usado en envío masivo para recargar solo una vez al final
  const enviarSunat = async (c: ComprobanteListado, refetch = true) => {
    if ((c as CargaComprobantePendiente)._cargaEstatica) {
      setLoadingSunatMap((prev) => ({ ...prev, [c.comprobanteId]: true }));
      const actualizado = marcarComprobanteCargaEnviado(c.comprobanteId);
      setComprobantes((prev) =>
        prev.map((comp) =>
          comp.comprobanteId === c.comprobanteId && actualizado
            ? actualizado
            : comp,
        ),
      );
      setLoadingSunatMap((prev) => ({ ...prev, [c.comprobanteId]: false }));
      showToast("Comprobante estático marcado como enviado a SUNAT", "success");
      return;
    }
    setLoadingSunatMap((prev) => ({ ...prev, [c.comprobanteId]: true }));
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${c.comprobanteId}/enviar-sunat`,
        null,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const tipoDoc = tipoLabel(c.tipoComprobante);
      // Actualizar estado inmediatamente (optimista)
      setComprobantes((prev) =>
        prev.map((comp) => {
          if (comp.comprobanteId !== c.comprobanteId) return comp;
          return {
            ...comp,
            estadoSunat:           res.data.estadoSunat      ?? comp.estadoSunat,
            codigoRespuestaSunat:  res.data.codigoRespuesta  ?? comp.codigoRespuestaSunat,
            mensajeRespuestaSunat: res.data.mensajeRespuesta ?? comp.mensajeRespuestaSunat,
          };
        }),
      );
      if (res.data.exitoso) {
        showToast(res.data.mensaje ?? `${tipoDoc} enviada correctamente a SUNAT`, "success");
      } else {
        showToast(`${tipoDoc} ${c.numeroCompleto} rechazada por SUNAT`, "error");
      }
      // Recargar lista para traer xmlGenerado y xmlRespuestaSunat del servidor
      if (refetch) cargarComprobantes(offset);
    } catch {
      showToast("Error al enviar a SUNAT", "error");
    } finally {
      setLoadingSunatMap((prev) => ({ ...prev, [c.comprobanteId]: false }));
    }
  };

  const enviarTodosEnBackground = useCallback(
    async (lista: ComprobanteListado[]) => {
      // SUNAT serializa por RUC emisor → uno tras otro, sin refetch intermedio
      for (const c of lista) {
        await enviarSunat(c, false);
      }
      // Una sola recarga al final para traer XML/CDR de todos
      cargarComprobantes(offset);
    },
    [enviarSunat], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const editarenviarSunat = (c: ComprobanteListado) => {
    switch (c.tipoComprobante) {
      case "01":
        router.push(
          `/factufly/operaciones/factura?comprobanteId=${c.comprobanteId}&serie=${c.serie}&correlativo=${c.correlativo}&ruc=${c.company.numeroDocumento}&establecimiento=${c.company.establecimientoAnexo}`,
        );
        break;
      case "03":
        router.push(
          `/factufly/operaciones/boleta?comprobanteId=${c.comprobanteId}&serie=${c.serie}&correlativo=${c.correlativo}&ruc=${c.company.numeroDocumento}&establecimiento=${c.company.establecimientoAnexo}`,
        );
        break;
      case "07":
        router.push(`/factufly/operaciones/nota-credito?serie=${c.serie}`);
        break;
      case "08":
        router.push(`/factufly/operaciones/nota-debito?serie=${c.serie}`);
        break;
      default:
        break;
    }
  };

  const generarNotaCredito = (c: ComprobanteListado) => {
    router.push(
      `/factufly/operaciones/nota-credito?serie=${c.serie}&correlativo=${c.correlativo}&ruc=${c.company.numeroDocumento}&establecimiento=${c.company.establecimientoAnexo}`,
    );
  };

  const generarNotaDebito = (c: ComprobanteListado) => {
    router.push(
      `/factufly/operaciones/nota-debito?serie=${c.serie}&correlativo=${c.correlativo}&ruc=${c.company.numeroDocumento}&establecimiento=${c.company.establecimientoAnexo}`,
    );
  };

  const anularComprobante = async (_c: ComprobanteListado) => {};
  const agregarResumen = async (_c: ComprobanteListado) => {};

  // ── Detalles Adicionales (RUC 20512134832, solo factura) ──
  const RUC_DETALLES_ADICIONALES = "20512134832";
  const esRucDetallesAdicionales = rucEmpresa === RUC_DETALLES_ADICIONALES;
  const [modalDetallesAdicionales, setModalDetallesAdicionales] = useState<{
    comprobanteId: number;
    serie: string;
    correlativo: string;
    ordenServicio: string;
    spot: boolean;
  } | null>(null);
  const [guardandoDetalles, setGuardandoDetalles] = useState(false);

  const abrirDetallesAdicionales = (c: ComprobanteListado) => {
    setModalDetallesAdicionales({
      comprobanteId: c.comprobanteId,
      serie: c.serie,
      correlativo: c.correlativo,
      ordenServicio: "",
      spot: false,
    });
  };

  const guardarDetallesAdicionales = async () => {
    if (!modalDetallesAdicionales) return;
    setGuardandoDetalles(true);
    try {
      const body: Record<string, string | boolean> = {};
      if (modalDetallesAdicionales.ordenServicio)
        body.ordenServicio = modalDetallesAdicionales.ordenServicio;
      if (modalDetallesAdicionales.spot)
        body.spot = modalDetallesAdicionales.spot;

      if (Object.keys(body).length === 0) {
        showToast("Selecciona al menos una opción", "error");
        return;
      }

      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/comprobantes/${rucEmpresa}/${modalDetallesAdicionales.serie}/${modalDetallesAdicionales.correlativo}/orden-spot`,
        body,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      showToast("Detalles guardados correctamente", "success");
      setModalDetallesAdicionales(null);
    } catch {
      showToast("Error al guardar los detalles", "error");
    } finally {
      setGuardandoDetalles(false);
    }
  };

  const descargarArchivo = async (
    ruta: string | null,
    nombre: string,
    comprobanteId: number,
    tipo: "xml" | "cdr",
  ) => {
    if (!ruta) return;
    const setLoading = tipo === "xml" ? setLoadingXmlMap : setLoadingCdrMap;
    setLoading((prev) => ({ ...prev, [comprobanteId]: true }));
    try {
      const url = `${process.env.NEXT_PUBLIC_STORAGE_URL}/files${ruta}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Error al descargar");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = nombre;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      showToast(`Error al descargar ${tipo.toUpperCase()}`, "error");
    } finally {
      setLoading((prev) => ({ ...prev, [comprobanteId]: false }));
    }
  };

  return (
    <div className="space-y-1 animate-in fade-in duration-500">
      {/* ── Modal Detalles Adicionales ── */}
      {modalDetallesAdicionales && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-800">
                Detalles Adicionales
              </h2>
              <button
                onClick={() => setModalDetallesAdicionales(null)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={16} className="text-gray-500" />
              </button>
            </div>

            {/* Recuadro adicional */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  id="chk-os"
                  type="checkbox"
                  checked={modalDetallesAdicionales.ordenServicio !== ""}
                  onChange={(e) => {
                    if (!e.target.checked)
                      setModalDetallesAdicionales((prev) =>
                        prev ? { ...prev, ordenServicio: "" } : prev,
                      );
                  }}
                  className="w-4 h-4 accent-brand-blue cursor-pointer"
                />
                <label
                  htmlFor="chk-os"
                  className="text-xs font-semibold text-gray-700 cursor-pointer"
                >
                  Adicional
                </label>
              </div>
              <input
                type="text"
                value={modalDetallesAdicionales.ordenServicio}
                onChange={(e) =>
                  setModalDetallesAdicionales((prev) =>
                    prev ? { ...prev, ordenServicio: e.target.value } : prev,
                  )
                }
                placeholder="Información adicional"
                className="w-full py-2 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-blue"
              />
            </div>

            {/* Operación sujeta al SPOT */}
            <div className="flex items-center gap-2">
              <input
                id="chk-spot"
                type="checkbox"
                checked={modalDetallesAdicionales.spot}
                onChange={(e) =>
                  setModalDetallesAdicionales((prev) =>
                    prev ? { ...prev, spot: e.target.checked } : prev,
                  )
                }
                className="w-4 h-4 accent-brand-blue cursor-pointer"
              />
              <label
                htmlFor="chk-spot"
                className="text-xs font-semibold text-gray-700 cursor-pointer"
              >
                Operación sujeta al SPOT
              </label>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setModalDetallesAdicionales(null)}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={guardarDetallesAdicionales}
                disabled={guardandoDetalles}
                className="flex-1 py-2 rounded-xl bg-brand-blue text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {guardandoDetalles ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModalEnvioMasivo && (
        <ModalEnvioMasivo
          pendientes={pendientes}
          onClose={() => setShowModalEnvioMasivo(false)}
          onEnviarTodos={enviarTodosEnBackground}
        />
      )}

      {showModalCargaMasiva && (
        <ModalCargaMasivaComprobantes
          onClose={() => setShowModalCargaMasiva(false)}
          onCargaExitosa={() => cargarComprobantes(0)}
          isSuperAdmin={isSuperAdmin}
          sucursales={isSuperAdmin ? sucursales : undefined}
          sucursalUsuario={!isSuperAdmin ? sucursalUsuario : undefined}
          empresa={empresa}
          accessToken={accessToken ?? ""}
          user={user}
        />
      )}

      {showModalResumen && (
        <ModalResumen
          comprobantes={comprobantes}
          onClose={() => setShowModalResumen(false)}
          isSuperAdmin={isSuperAdmin}
          sucursales={isSuperAdmin ? sucursales : undefined}
          sucursalActual={
            !isSuperAdmin ? (sucursalUsuario ?? undefined) : undefined
          }
          onEmitido={(resumenId, estadoSunat) => {
            setShowModalResumen(false);
            if (
              estadoSunat === "ACEPTADO" ||
              estadoSunat === "ACEPTADO_CON_OBSERVACIONES"
            ) {
              cargarComprobantes(offset);
            }
          }}
        />
      )}
      {detalle && (
        <ModalDetalle
          comprobante={
            {
              ...detalle,
              details: detalleCompleto?.details ?? [],
              pagos: detalleCompleto?.pagos ?? [],
              cuotas: detalleCompleto?.cuotas ?? [],
              legends: detalleCompleto?.legends ?? [],
              guias: detalleCompleto?.guias ?? [],
              detracciones: detalleCompleto?.detracciones ?? [],
              vales: detalleCompleto?.vales ?? [],
            } as unknown as Comprobante
          }
          ruc={rucEmpresa}
          accessToken={accessToken ?? ""}
          loadingDetalles={hookDetalles.loading}
          sucursalId={
            isSuperAdmin
              ? (sucursales.find(
                  (s: any) =>
                    s.codEstablecimiento ===
                    detalle.company.establecimientoAnexo,
                )?.sucursalId ?? sucursalId)
              : sucursalId
          }
          nombreSucursal={
            isSuperAdmin
              ? sucursales.find(
                  (s: any) =>
                    s.codEstablecimiento ===
                    detalle.company.establecimientoAnexo,
                )?.nombre
              : undefined
          }
          onClose={() => {
            setDetalle(null);
            setDetalleCompleto(null);
            hookDetalles.reset();
          }}
        />
      )}
      {modalEnvio && (
        <ModalEnvioCorreoWhatsapp
          comprobante={modalEnvio.comprobante}
          tipo={modalEnvio.tipo}
          ruc={rucEmpresa}
          accessToken={accessToken ?? ""}
          onClose={() => setModalEnvio(null)}
          onEnviado={(tipo, destinoUsado) => {
            setComprobantes((prev) =>
              prev.map((c) => {
                if (c.comprobanteId !== modalEnvio!.comprobante.comprobanteId)
                  return c;
                return {
                  ...c,
                  cliente: {
                    ...c.cliente,
                    ...(tipo === "email"
                      ? { correo: destinoUsado, enviadoPorCorreo: true }
                      : { whatsApp: destinoUsado, enviadoPorWhatsApp: true }),
                  },
                };
              }),
            );
            setModalEnvio(null);
          }}
        />
      )}

      <div className="sticky top-0 z-20">
        <div className="space-y-2">
          {/* ── Fila 1: Búsqueda + Nuevo Comprobante ── */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente, RUC/DNI o N° comprobante..."
                className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-sm text-xs"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <Button
              className="shrink-0 py-2.5 px-3 text-xs rounded-md h-auto"
              onClick={() => router.push("/factufly/operaciones")}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nuevo Comprobante</span>
            </Button>
          </div>

          {/* ── Fila 2: Filtros + acciones secundarias ── */}
          <div className="flex flex-wrap items-center gap-2">
            <DropdownFiltro
              label="Tipo"
              value={filtroTipo}
              options={TIPOS_OPTS}
              onChange={setFiltroTipo}
            />
            <DropdownFiltro
              label="Estado SUNAT"
              value={filtroEstado}
              options={ESTADOS_OPTS}
              onChange={setFiltroEstado}
              colorMap={ESTADO_COLORS_MAP}
            />
            <button
              onClick={() => setShowAvanzado((o) => !o)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-2.5 text-xs font-medium border rounded-md transition-all shadow-sm",
                showAvanzado
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
              )}
            >
              <Filter size={14} />
              <span className="hidden sm:inline">Opciones avanzadas</span>
              <span className="sm:hidden">Filtros</span>
              <ChevronDown
                size={13}
                className={cn("transition-transform", showAvanzado && "rotate-180")}
              />
            </button>
            {isSuperAdmin && (
              <DropdownFiltro
                label="Sucursales"
                value={
                  sucursalFiltro
                    ? (sucursales.find((s: any) => s.sucursalId === sucursalFiltro)?.nombre ??
                       sucursales.find((s: any) => s.sucursalId === sucursalFiltro)?.codEstablecimiento ??
                       "Todos")
                    : "Todos"
                }
                options={[
                  "Todos",
                  ...sucursales.map((s: any) => s.nombre ?? s.codEstablecimiento),
                ]}
                onChange={(v) => {
                  if (v === "Todos") { setSucursalFiltro(null); return; }
                  const found = sucursales.find((s: any) => (s.nombre ?? s.codEstablecimiento) === v);
                  setSucursalFiltro(found ? found.sucursalId : null);
                }}
              />
            )}
            {pendientes.length >= 2 && (
              <Button
                className="py-2.5 px-3 text-xs rounded-md h-auto bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 shadow-sm"
                onClick={() => setShowModalEnvioMasivo(true)}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Enviar pendientes ({pendientes.length})</span>
                <span className="sm:hidden">Pendientes ({pendientes.length})</span>
              </Button>
            )}
            {config?.cargaComprobantes && (
              <Button
                className="py-2.5 px-3 text-xs rounded-md h-auto"
                onClick={() => setShowModalCargaMasiva(true)}
              >
                <Upload className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Carga Masiva</span>
              </Button>
            )}
          </div>

          {showAvanzado && (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden animate-in slide-in-from-top-2 duration-200">
              <div className="flex border-b border-gray-100 overflow-x-auto">
                {(
                  [
                    {
                      key: "fechas",
                      label: "Por fechas",
                      icon: <Calendar size={14} />,
                    },
                    {
                      key: "unico",
                      label: "Comprobante único",
                      icon: <Hash size={14} />,
                    },
                    {
                      key: "cliente",
                      label: "Por cliente",
                      icon: <UserRound size={14} />,
                    },
                    ...(isSuperAdmin
                      ? [
                          {
                            key: "usuario",
                            label: "Por usuario",
                            icon: <UserCog size={14} />,
                          },
                        ]
                      : []),
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setModoAvanzado(tab.key as any);
                      setAvSerie("");
                      setAvNumero("");
                      setAvClienteDoc("");
                      setAvUsuarioId("");
                      setAvFechaDesde("");
                      setAvFechaHasta("");
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all whitespace-nowrap",
                      modoAvanzado === tab.key
                        ? "border-blue-600 text-blue-600 bg-blue-50/50"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50",
                    )}
                  >
                    <span className="shrink-0">{tab.icon}</span> {tab.label}
                  </button>
                ))}
              </div>
              <div className="p-3">
                <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-end gap-2 sm:gap-3">
                  {(modoAvanzado === "fechas" ||
                    modoAvanzado === "cliente" ||
                    modoAvanzado === "usuario") && (
                    <>
                      {modoAvanzado === "cliente" && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-gray-500 uppercase">
                            Nº Doc. Cliente
                          </label>
                          <input
                            value={avClienteDoc}
                            onChange={(e) => setAvClienteDoc(e.target.value)}
                            placeholder="20601234567"
                            className="py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-md text-xs outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-50 transition-all w-full sm:w-40"
                          />
                        </div>
                      )}
                      {modoAvanzado === "usuario" && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-gray-500 uppercase">
                            ID Usuario
                          </label>
                          <input
                            type="number"
                            value={avUsuarioId}
                            onChange={(e) => setAvUsuarioId(e.target.value)}
                            placeholder="1"
                            className="py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-md text-xs outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-50 transition-all w-full sm:w-20"
                          />
                        </div>
                      )}
                      <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-end gap-2 sm:gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-gray-500 uppercase">
                            Fecha desde
                          </label>
                          <input
                            type="date"
                            value={avFechaDesde}
                            max={hoy}
                            onChange={(e) => {
                              setAvFechaDesde(e.target.value);
                              if (!avFechaHasta && e.target.value) {
                                setAvFechaHasta(e.target.value);
                              } else if (avFechaHasta && e.target.value > avFechaHasta) {
                                setAvFechaHasta(e.target.value);
                              }
                            }}
                            className="w-full py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-md text-xs outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-50 transition-all"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-gray-500 uppercase">
                            Fecha hasta
                          </label>
                          <input
                            type="date"
                            value={avFechaHasta}
                            min={avFechaDesde || undefined}
                            max={hoy}
                            onChange={(e) => setAvFechaHasta(e.target.value)}
                            className="w-full py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-md text-xs outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-50 transition-all"
                          />
                        </div>
                      </div>
                    </>
                  )}
                  {modoAvanzado === "unico" && (
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-end gap-2 sm:gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-gray-500 uppercase">
                          Serie
                        </label>
                        <input
                          value={avSerie}
                          onChange={(e) => setAvSerie(e.target.value)}
                          placeholder="F001"
                          className="w-full py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-md text-xs outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-50 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-gray-500 uppercase">
                          Número
                        </label>
                        <input
                          type="number"
                          value={avNumero}
                          onChange={(e) => setAvNumero(e.target.value)}
                          placeholder="135"
                          className="w-full py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-md text-xs outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-50 transition-all"
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 self-end">
                    <button
                      onClick={() => buscarAvanzado(0)}
                      disabled={loading}
                      className={cn(
                        "flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white rounded-md transition-all shadow-sm",
                        COLORS.btnPrimary,
                        loading && COLORS.btnDisabled,
                      )}
                    >
                      <Search size={13} /> Buscar
                    </button>
                    <button
                      onClick={() => {
                        setAvSerie("");
                        setAvNumero("");
                        setAvClienteDoc("");
                        setAvUsuarioId("");
                        setAvFechaDesde("");
                        setAvFechaHasta("");
                        setSucursalFiltro(null);
                        setOffset(0);
                        cargarComprobantes(0);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 rounded-md transition-all"
                    >
                      <X size={12} /> Limpiar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between py-1">
        <p className="text-[12px] text-gray-500">
          Total{" "}
          <span className="font-semibold text-gray-900">
            {paginated.length}
          </span>{" "}
          comprobantes
        </p>
        {(!!search || filtroTipo !== "Todos" || filtroEstado !== "Todos") &&
          filtered.length === 0 && (
            <p className="text-sm text-amber-600 font-medium">
              Sin resultados para esta búsqueda
            </p>
          )}
      </div>

      <style>{`
        .comp-table thead, .comp-table tbody {
          display: block;
          overflow-y: scroll;
          scrollbar-width: thin;
        }
        .comp-table thead {
          scrollbar-color: transparent transparent;
        }
        .comp-table tbody {
          max-height: calc(100vh - ${offset > 0 || hasMore ? (isBeta ? 292 : 262) : isBeta ? 230 : 200}px);
          scrollbar-color: #CBD5E1 transparent;
        }
        .comp-table thead tr,
        .comp-table tbody tr {
          display: table;
          width: 100%;
          table-layout: fixed;
        }
      `}</style>

      <CardTable className="overflow-hidden">
        
        <div className="overflow-x-auto">
          <table className={cn("w-full text-left border-collapse comp-table")}>
            <thead>
              <tr
                className="bg-gray-100"
                style={{
                  borderTopLeftRadius: "12px",
                  borderTopRightRadius: "12px",
                  overflow: "hidden",
                }}
              >
                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-24">
                  FECHA
                </th>
                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-32">
                  COMPROBANTE
                </th>
                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-72">
                  CLIENTE
                </th>
                <th className="px-2 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-center w-16">
                  TAMAÑO
                </th>
                <th className="px-2 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-center w-14">
                  PDF
                </th>
                <th className="px-2 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-center w-12">
                  XML
                </th>
                <th className="px-2 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-center w-12">
                  CDR
                </th>
                <th className="px-2 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-center w-20">
                  SUNAT
                </th>
                <th className="px-2 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-center w-14">
                  CORREO
                </th>
                <th className="px-2 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-center w-16">
                  WHATSAPP
                </th>
                <th className="px-2 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-center w-16">
                  VER
                </th>
                <th className="px-2 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-center w-20">
                  OPCIONES
                </th>
              </tr>
            </thead>
            <tbody ref={tableBodyRef} className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCw
                        size={24}
                        className="animate-spin text-blue-400"
                      />
                      <span className="text-sm text-gray-400">
                        Cargando comprobantes...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-6 py-16 text-center text-sm text-gray-400"
                  >
                    No se encontraron comprobantes con ese criterio.
                  </td>
                </tr>
              ) : (
                paginated.map((doc) => (
                  <tr
                    key={doc.comprobanteId}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-3 py-1 w-24">
                      <p className="text-xs text-gray-900 font-medium whitespace-nowrap">{formatFecha(doc.fechaEmision)}</p>
                      <p className="text-[11px] text-gray-400 whitespace-nowrap">{formatFechaHora(doc.horaEmision).split(" ")[1]}</p>
                    </td>
                    <td className="px-3 py-1 whitespace-nowrap w-32">
                      <p className="text-[12px] font-medium text-gray-900 uppercase">
                        {doc.numeroCompleto}
                      </p>
                      <p className="text-[12px] text-gray-400">

                        <span className="text-gray-700">{tipoLabel(doc.tipoComprobante)}</span>
                        
                        <span className="mx-1 text-gray-400">-</span>
                        <span className="font-semibold text-gray-700">
                          {doc.tipoMoneda === "USD" ? "$" : "S/"}{" "}
                          {fmtMonto(Number(doc.importeTotal ?? 0))}
                        </span>
                      </p>
                    </td>
                    <td className="px-3 py-1 w-72">
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-gray-900">
                          {doc.cliente.numeroDocumento}
                        </span>
                        <span className="text-[12px] text-gray-600">
                          {doc.cliente.razonSocial}
                        </span>
                      </div>
                    </td>
                    <td className="px-1 py-1 text-center w-16">
                      <select
                        value={getPdfSize(doc.comprobanteId)}
                        onChange={(e) =>
                          setPdfSizeMap((prev) => ({
                            ...prev,
                            [doc.comprobanteId]: e.target.value,
                          }))
                        }
                        className="w-full py-1 px-0.5 text-[11px] bg-gray-50 border border-gray-200 rounded-md outline-none focus:border-blue-400 cursor-pointer"
                      >
                        <option value="A4">A4</option>
                        <option value="Ticket58mm">58 mm</option>
                        <option value="Ticket80mm">80 mm</option>
                      </select>
                    </td>
                    <td className="px-2 py-1 text-center w-14">
                      <div className="flex justify-center">
                        <StatusIcon
                          type="pdf"
                          status={
                            (doc as CargaComprobantePendiente)._cargaEstatica
                              ? "pending"
                              : "available"
                          }
                          loading={loadingPdfMap[doc.comprobanteId]}
                          onClick={() => {
                            if (
                              (doc as CargaComprobantePendiente)._cargaEstatica
                            )
                              return;
                            obtenerPdf(doc, getPdfSize(doc.comprobanteId));
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1 text-center w-12">
                      <div className="flex justify-center">
                        <StatusIcon
                          type="xml"
                          status={doc.xmlGenerado ? "available" : "pending"}
                          loading={loadingXmlMap[doc.comprobanteId]}
                          onClick={() =>
                            descargarArchivo(
                              doc.xmlGenerado,
                              `${doc.numeroCompleto}.zip`,
                              doc.comprobanteId,
                              "xml",
                            )
                          }
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1 text-center w-12">
                      <div className="flex justify-center">
                        <StatusIcon
                          type="cdr"
                          status={
                            doc.xmlRespuestaSunat ? "available" : "pending"
                          }
                          loading={loadingCdrMap[doc.comprobanteId]}
                          onClick={() =>
                            descargarArchivo(
                              doc.xmlRespuestaSunat,
                              `R-${doc.numeroCompleto}.zip`,
                              doc.comprobanteId,
                              "cdr",
                            )
                          }
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1 text-center w-20">
                      <div className="flex justify-center">
                        <BadgeSunat
                          estado={doc.estadoSunat}
                          loading={loadingSunatMap[doc.comprobanteId]}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1 text-center w-14">
                      <div className="flex justify-center">
                        <BtnEnvio
                          tipo="email"
                          enviado={doc.cliente.enviadoPorCorreo}
                          fecha={formatFechaHora(doc.fechaCreacion)}
                          onClick={() =>
                            setModalEnvio({ comprobante: doc, tipo: "email" })
                          }
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1 text-center w-16">
                      <div className="flex justify-center">
                        <BtnEnvio
                          tipo="whatsapp"
                          enviado={doc.cliente.enviadoPorWhatsApp}
                          fecha={formatFechaHora(doc.fechaCreacion)}
                          onClick={() =>
                            setModalEnvio({
                              comprobante: doc,
                              tipo: "whatsapp",
                            })
                          }
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1 text-center w-16">
                      <button
                        onClick={() => abrirDetalle(doc)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        <Eye size={13} /> Ver
                      </button>
                    </td>
                    <td className="px-2 py-1 text-center w-20">
                      <div className="flex justify-center">
                        <DropdownOpciones
                          comprobante={doc}
                          onEnviarSunat={() => enviarSunat(doc)}
                          onEditarEnviarSunat={() => editarenviarSunat(doc)}
                          onResumen={() => agregarResumen(doc)}
                          onAnular={() => anularComprobante(doc)}
                          onGenerarNotaCredito={() => generarNotaCredito(doc)}
                          onGenerarNotaDebito={() => generarNotaDebito(doc)}
                          mostrarDetallesAdicionales={esRucDetallesAdicionales}
                          onDetallesAdicionales={() =>
                            abrirDetallesAdicionales(doc)
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {(offset > 0 || hasMore) && (
          <div className="px-2 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const o = Math.max(0, offset - limit);
                  setOffset(o);
                  if (tableBodyRef.current) tableBodyRef.current.scrollTop = 0;
                  showAvanzado ? buscarAvanzado(o) : cargarComprobantes(o);
                }}
                disabled={offset === 0 || loading}
                className={cn(
                  "px-4 py-2 text-sm font-medium border rounded-lg transition-colors",
                  offset === 0 || loading
                    ? "bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
                )}
              >
                Anterior
              </button>
              <button
                onClick={() => {
                  const o = offset + limit;
                  setOffset(o);
                  if (tableBodyRef.current) tableBodyRef.current.scrollTop = 0;
                  showAvanzado ? buscarAvanzado(o) : cargarComprobantes(o);
                }}
                disabled={!hasMore || loading}
                className={cn(
                  "px-4 py-2 text-sm font-medium border rounded-lg transition-colors",
                  !hasMore || loading
                    ? "bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
                )}
              >
                Siguiente
              </button>
            </div>
            <span className="text-sm text-gray-500">
              Registros del{" "}
              <span className="font-semibold text-gray-900">{offset + 1}</span>{" "}
              al{" "}
              <span className="font-semibold text-gray-900">
                {offset + comprobantes.length}
              </span>
            </span>
          </div>
        )}
      </CardTable>
    </div>
  );
}

// ─── BadgeSunat ───────────────────────────────────────────────────────────────
const BadgeSunat = ({
  estado,
  loading,
}: {
  estado: string;
  loading?: boolean;
}) => {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold whitespace-nowrap bg-blue-50 text-blue-600 border-blue-200">
        <RefreshCw size={11} className="animate-spin" /> Enviando...
      </span>
    );
  }
  const cfg =
    COLORS.sunat[estado as keyof typeof COLORS.sunat] ?? COLORS.sunat.PENDIENTE;
  const icon =
    estado === "ACEPTADO" ? (
      <CheckCircle2 size={11} />
    ) : estado === "RECHAZADO" ? (
      <X size={11} />
    ) : estado === "ANULADO" ? (
      <Ban size={11} />
    ) : (
      <RefreshCw size={11} />
    );
  const label =
    estado === "ACEPTADO"
      ? "Aceptado"
      : estado === "RECHAZADO"
        ? "Rechazado"
        : estado === "ANULADO"
          ? "Anulado"
          : "Pendiente";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold whitespace-nowrap",
        cfg.badge,
      )}
    >
      {icon} {label}
    </span>
  );
};

// ─── BtnEnvio ─────────────────────────────────────────────────────────────────
const BtnEnvio = ({
  tipo,
  enviado,
  fecha,
  onClick,
}: {
  tipo: "email" | "whatsapp";
  enviado: boolean;
  fecha?: string;
  onClick: () => void;
}) => {
  const esEmail = tipo === "email";
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={onClick}
        title={
          enviado
            ? `Enviado el ${fecha}. Click para reenviar`
            : `Enviar por ${esEmail ? "correo" : "WhatsApp"}`
        }
        className={cn(
          "relative p-2 rounded-xl transition-all",
          enviado
            ? esEmail
              ? COLORS.email.active
              : COLORS.whatsapp.active
            : esEmail
              ? COLORS.email.inactive
              : COLORS.whatsapp.inactive,
        )}
      >
        {esEmail ? <Mail size={17} /> : <MessageCircle size={17} />}
        {enviado && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
            <CheckCircle2 size={10} className="text-white" strokeWidth={2.5} />
          </span>
        )}
      </button>
      {enviado && (
        <span
          className={cn(
            "text-[10px] font-medium leading-none",
            esEmail ? "text-blue-500" : "text-green-500",
          )}
        >
          Enviado
        </span>
      )}
    </div>
  );
};

// ─── StatusIcon ───────────────────────────────────────────────────────────────
const StatusIcon = ({
  type,
  status,
  loading,
  onClick,
}: {
  type: "pdf" | "xml" | "cdr";
  status: "available" | "pending";
  loading?: boolean;
  onClick?: () => void;
}) => {
  if (type === "pdf") {
    return (
      <button
        onClick={onClick}
        className={cn(COLORS.pdf.btn, loading && "animate-pulse opacity-50")}
        title="Ver PDF"
        disabled={loading}
      >
        {loading ? (
          <RefreshCw size={18} className="animate-spin text-blue-500" />
        ) : (
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg"
            className="w-5 h-5 opacity-90"
            alt="PDF"
          />
        )}
      </button>
    );
  }

  const disponible = status === "available";
  return (
    <button
      onClick={onClick}
      disabled={!disponible || loading}
      title={
        loading
          ? "Descargando..."
          : disponible
            ? `Descargar ${type.toUpperCase()}`
            : `${type.toUpperCase()} no disponible`
      }
      className={cn(
        COLORS.pdf.btn,
        !disponible && "opacity-30 cursor-not-allowed",
      )}
    >
      <RefreshCw
        size={18}
        className={cn(
          "transition-colors",
          loading
            ? "animate-spin text-blue-400"
            : disponible
              ? "text-emerald-500"
              : "text-gray-300",
        )}
      />
    </button>
  );
};

// ─── Dropdown Opciones (...) ──────────────────────────────────────────────────
interface DropdownOpcionesProps {
  comprobante: ComprobanteListado;
  onEnviarSunat: () => void;
  onEditarEnviarSunat: () => void;
  onResumen: () => void;
  onAnular: () => void;
  onGenerarNotaCredito: () => void;
  onGenerarNotaDebito: () => void;
  mostrarDetallesAdicionales?: boolean;
  onDetallesAdicionales?: () => void;
}

const DropdownOpciones = ({
  comprobante,
  onEnviarSunat,
  onEditarEnviarSunat,
  onResumen,
  onAnular,
  onGenerarNotaCredito,
  onGenerarNotaDebito,
  mostrarDetallesAdicionales = false,
  onDetallesAdicionales,
}: DropdownOpcionesProps) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const esAceptado = comprobante.estadoSunat === "ACEPTADO";
  const esPendiente = comprobante.estadoSunat === "PENDIENTE";
  const esRechazado = comprobante.estadoSunat === "RECHAZADO";
  const esFacturaOBoleta =
    comprobante.tipoComprobante === "01" ||
    comprobante.tipoComprobante === "03";

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + window.scrollY,
        left: rect.right + window.scrollX - 200,
      });
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current &&
        !btnRef.current.contains(e.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
      >
        <MoreHorizontal size={16} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "absolute",
              top: pos.top,
              left: pos.left,
              zIndex: 9999,
            }}
            className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-50"
          >
            {esPendiente && (
              <button
                onClick={() => {
                  onEnviarSunat();
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-50"
              >
                <RotateCcw size={14} className="text-blue-500" /> Enviar a SUNAT
              </button>
            )}
            {esRechazado && (
              <button
                onClick={() => {
                  onEditarEnviarSunat();
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-50"
              >
                <RotateCcw size={14} className="text-amber-500" /> Editar y
                reenviar
              </button>
            )}
            {esFacturaOBoleta && esAceptado && (
              <>
                <div className="border-t border-gray-100" />
                <button
                  onClick={() => {
                    onGenerarNotaCredito();
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-50"
                >
                  <FileText size={14} className="text-purple-500" /> Generar
                  Nota de Crédito
                </button>
                <button
                  onClick={() => {
                    onGenerarNotaDebito();
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-50"
                >
                  <FileText size={14} className="text-orange-500" /> Generar
                  Nota de Débito
                </button>
                {mostrarDetallesAdicionales &&
                  comprobante.tipoComprobante === "01" && (
                    <button
                      onClick={() => {
                        onDetallesAdicionales?.();
                        setOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-50"
                    >
                      <FileText size={14} className="text-blue-500" /> Detalles
                      Adicionales
                    </button>
                  )}
                <div className="border-t border-gray-100" />
                <button
                  onClick={() => {
                    onAnular();
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left text-red-600 hover:bg-red-50"
                >
                  <Ban size={14} className="text-red-500" /> Anular
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  );
};
