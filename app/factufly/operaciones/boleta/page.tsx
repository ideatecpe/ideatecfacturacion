"use client";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Printer,
  ShieldCheck,
  Trash2,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  UserRound,
  ClipboardList,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { useAuth } from "@/context/AuthContext";
import { useEmpresaEmisor } from "./gestionBoletas/useEmpresaEmisor";
import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  Suspense,
} from "react";
import {
  Boleta,
  BoletaCliente,
  BoletaDetalle,
  BoletaPago,
  BoletaCuota,
  BoletaGuia,
  Sucursal,
} from "./gestionBoletas/Boleta";
import { useClienteBoleta } from "./gestionBoletas/useClienteBoleta";
import { Cliente } from "../../clientes/gestionClientes/typesCliente";
import { useSucursal } from "./gestionBoletas/useSucursal";
import { formatoFechaActual, fechaLocalISO } from "@/app/components/ui/formatoFecha";
import { ProductoSucursal } from "../../productos/gestioProductos/Producto";
import { useProductosSucursal } from "../../productos/gestioProductos/useProductosSucursal";
import axios from "axios";
import { numeroAlertas } from "@/app/components/ui/numeroAlertas";
import { useToast } from "@/app/components/ui/Toast";
import { useClientesRuc } from "../../clientes/gestionClientes/useClientesRuc";
import { useSucursalRuc } from "./gestionBoletas/useSucursalRuc";
import { DatePickerLimitado } from "@/app/components/ui/DatePickerLimitado";
import { ModalGuardarClienteBoleta } from "./gestionBoletas/Modalguardarclienteboleta";
import { sharedVentaStore } from "../sharedVentaStore";
import { useComprobanteUnicoId } from "../../comprobantes/gestionComprobantes/UseComprobanteUnicoId";
import { useTrabajadoresSucursal } from "../../trabajadores/gestionTrabajadores/useTrabajadoresSucursal";
import { UserCircle, Car } from "lucide-react";
import { ModalItemsVelsat } from "@/app/components/modalEmision/Modalitemsvelsat";
import { obtenerTipoCambioVenta } from "@/app/utils/tipoCambioJsonPe";

// ── Interfaces locales ───────────────────────────────────────
interface DetalleLocal extends Partial<BoletaDetalle> {
  _id?: string;
  _incluirIGV?: boolean;
  _precioBase?: number;
  _precioBaseOriginal?: number;
  _precioVentaConIGV?: number;
  _sucursalProductoId?: number;
  _tipoProducto?: string | null;
  _stockDisponible?: number | null;
  _esIcbper?: boolean;
}

interface PagoLocal {
  medioPago: string;
  monto: string;
  numeroOperacion: string;
  entidadFinanciera: string;
  observaciones: string;
}

const PRECIOS_BOLSA = { pequeña: 0.1, mediana: 0.2, grande: 0.3 };
const ICBPER_FACTOR = 0.5;

function BoletaContent() {
  const { showToast } = useToast();
  const router = useRouter();
  const { accessToken, user } = useAuth();

  //enviar mediante resumen
  const [enviarEnResumen, setEnviarEnResumen] = useState(false);

  // ── isSuperAdmin ─────────────────────────────────────────────
  const isSuperAdmin = user?.rol === "superadmin";
  const IGV_DEFAULT = user?.igv ?? 18;

  const { empresa } = useEmpresaEmisor();
  const { cliente, loadingCliente, errorCliente, buscarCliente } =
    useClienteBoleta();
  const { clientes, loadingClientes, fetchClientes } = useClientesRuc();

  const { sucursal: sucursalDelHook, loadingSucursal } = useSucursal();
  const [sucursal, setSucursal] = useState<Sucursal | null>(null);
  const { sucursales, loadingSucursales } = useSucursalRuc(isSuperAdmin);
  const [correlativoActual, setCorrelativoActual] = useState<number | null>(
    null,
  );

  const RUC_TRABAJADORES = "10073587382";
  const esSalonBelleza = user?.ruc === RUC_TRABAJADORES;
  const sucursalIdEfectivo = isSuperAdmin
    ? (sucursal?.sucursalId ?? 0)
    : parseInt(user?.sucursalID ?? "0");

  const { trabajadores } = useTrabajadoresSucursal(
    esSalonBelleza ? sucursalIdEfectivo : undefined,
    esSalonBelleza,
  );
  const [trabajadorIdGlobal, setTrabajadorIdGlobal] = useState<number>(0);
  const [trabajadoresPorItem, setTrabajadoresPorItem] = useState<
    Record<string, number>
  >({});

  const [showModalMonitoreo, setShowModalMonitoreo] = useState(false);

  useEffect(() => {
    if (!trabajadorIdGlobal) return;
    setTrabajadoresPorItem(() => {
      const nuevo: Record<string, number> = {};
      detalles.forEach((d, i) => {
        const key = d._id ?? String(i);
        nuevo[key] = trabajadorIdGlobal;
      });
      return nuevo;
    });
  }, [trabajadorIdGlobal]);

  //Editar y renvia por parametros url
  const searchParams = useSearchParams();
  const { comprobante, fetchComprobante: fetchComprobanteById } =
    useComprobanteUnicoId();
  const cargandoComprobante =
    !!searchParams.get("comprobanteId") && !comprobante;

  useEffect(() => {
    const comprobanteId = searchParams.get("comprobanteId");
    const establecimiento = searchParams.get("establecimiento");
    if (!comprobanteId) return;
    fetchComprobanteById(Number(comprobanteId));
    if (isSuperAdmin && establecimiento && sucursales.length > 0) {
      const sucursalEncontrada = sucursales.find(
        (s: Sucursal) => s.codEstablecimiento === establecimiento,
      );
      if (sucursalEncontrada) {
        setSucursal(sucursalEncontrada);
      }
    }
  }, [sucursales]);

  useEffect(() => {
    if (!comprobante) return;

    setBoleta((prev) => ({
      ...prev,
      tipoMoneda: comprobante.tipoMoneda ?? "PEN",
      tipoPago: comprobante.tipoPago ?? "Contado",
      tipoOperacion: comprobante.tipoOperacion ?? "0101",
      fechaVencimiento: comprobante.fechaVencimiento?.slice(0, 10) ?? fecha,
      cliente: comprobante.cliente
        ? {
            clienteId: comprobante.cliente.clienteId ?? null,
            tipoDocumento: comprobante.cliente.tipoDocumento,
            numeroDocumento: comprobante.cliente.numeroDocumento,
            razonSocial: comprobante.cliente.razonSocial,
            ubigeo: comprobante.cliente.ubigeo ?? "",
            direccionLineal: comprobante.cliente.direccionLineal ?? "",
            departamento: comprobante.cliente.departamento ?? "",
            provincia: comprobante.cliente.provincia ?? "",
            distrito: comprobante.cliente.distrito ?? "",
          }
        : undefined,
    }));

    // Cliente búsqueda
    setBusqueda(comprobante.cliente?.numeroDocumento ?? "");
    setTipoDoc(comprobante.cliente?.tipoDocumento ?? "01");
    setCorreoCliente(comprobante.cliente?.correo ?? "");
    setTelefonoCliente(comprobante.cliente?.whatsApp ?? "");

    // Detalles
    if (comprobante.details && comprobante.details.length > 0) {
      const nuevosDetalles: DetalleLocal[] = comprobante.details.map(
        (d, idx) => ({
          item: idx + 1,
          productoId: d.productoId ?? null,
          codigo: d.codigo ?? null,
          descripcion: d.descripcion,
          cantidad: d.cantidad,
          unidadMedida: d.unidadMedida,
          precioUnitario: d.precioUnitario,
          tipoAfectacionIGV: d.tipoAfectacionIGV,
          porcentajeIGV: d.porcentajeIGV,
          montoIGV: d.montoIGV,
          baseIgv: d.baseIgv,
          codigoTipoDescuento: d.codigoTipoDescuento ?? "00",
          descuentoUnitario: d.descuentoUnitario ?? 0,
          descuentoTotal: d.descuentoTotal ?? 0,
          valorVenta: d.valorVenta,
          precioVenta: d.precioVenta,
          totalVentaItem: d.totalVentaItem,
          icbper: d.icbper ?? 0,
          factorIcbper: d.factorIcbper ?? 0,
          _precioBase: d.precioUnitario,
          _precioBaseOriginal: d.precioUnitario,
          _precioVentaConIGV: d.precioVenta,
          _incluirIGV: false,
        }),
      );
      setDetalles(nuevosDetalles);
      setBusquedaProducto(nuevosDetalles.map((d) => d.descripcion ?? ""));
      setShowDropdownProducto(nuevosDetalles.map(() => false));
      inputRefs.current = nuevosDetalles.map(() => null);
    }

    // Pagos
    if (comprobante.pagos && comprobante.pagos.length > 0) {
      setPagos(
        comprobante.pagos.map((p) => ({
          medioPago: p.medioPago,
          monto: String(p.monto),
          numeroOperacion: p.numeroOperacion ?? "",
          entidadFinanciera: p.entidadFinanciera ?? "",
          observaciones: p.observaciones ?? "",
        })),
      );
    }

    // Cuotas
    if (comprobante.cuotas && comprobante.cuotas.length > 0) {
      setNumeroCuotas(comprobante.cuotas.length);
      setCuotas(
        comprobante.cuotas.map((c) => ({
          numeroCuota: c.numeroCuota,
          monto: String(c.monto),
          fechaVencimiento: c.fechaVencimiento?.slice(0, 10) ?? "",
        })),
      );
    }

    // Guías
    if (comprobante.guias && comprobante.guias.length > 0) {
      setGuias(
        comprobante.guias.map((g) => {
          const partes = g.guiaNumeroCompleto?.split("-") ?? [];
          return {
            serie: partes[0] ?? "",
            numero: partes[1] ?? "",
            tipoDoc: g.guiaTipoDoc ?? "09",
          };
        }),
      );
    }

    // Descuento global
    setDescuentoGlobal(comprobante.descuentoGlobal ?? 0);
    setCodigoTipoDescGlobal(comprobante.codigoTipoDescGlobal ?? "02");
  }, [comprobante]);

  // Productos según sucursal
  const { productosSucursal, fetchProductosSucursal } = useProductosSucursal(
    isSuperAdmin ? sucursal?.sucursalId : undefined,
  );

  const sinSucursal = isSuperAdmin && !sucursal;
  const { fecha, fechaHora } = formatoFechaActual();

  // ── Estado emitido ───────────────────────────────────────────
  const [emitido, setEmitido] = useState(false);

  // ── Estado cliente ───────────────────────────────────────────
  const [tipoDoc, setTipoDoc] = useState("01");
  const [busqueda, setBusqueda] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [clienteVarios, setClienteVarios] = useState(false);

  // ── Modal guardar cliente ────────────────────────────────────
  const [showModalCliente, setShowModalCliente] = useState(false);

  const guardarCliente = async (extra: {
    nombreComercial: string;
    telefono: string;
    correo: string;
    direccionLineal: string;
  }) => {
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Cliente`,
        {
          sucursalID: isSuperAdmin ? sucursal?.sucursalId : user?.sucursalID,
          numeroDocumento: boleta.cliente?.numeroDocumento,
          razonSocialNombre: boleta.cliente?.razonSocial,
          nombreComercial: extra.nombreComercial || "",
          telefono: extra.telefono || "",
          correo: extra.correo || "",
          tipoDocumentoId: boleta.cliente?.tipoDocumento,
          direccion: {
            ubigeo: boleta.cliente?.ubigeo || "",
            direccionLineal:
              extra.direccionLineal || boleta.cliente?.direccionLineal || "",
            departamento: boleta.cliente?.departamento || "",
            provincia: boleta.cliente?.provincia || "",
            distrito: boleta.cliente?.distrito || "",
            tipoDireccion: "PRINCIPAL",
          },
        },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      showToast("Cliente guardado correctamente", "success");
      setShowModalCliente(false);
      const listaActualizada = await fetchClientes();
      const clienteGuardado = listaActualizada?.find(
        (c: any) => c.numeroDocumento === boleta.cliente?.numeroDocumento,
      );
      setBoleta((prev) => ({
        ...prev,
        cliente: prev.cliente
          ? {
              ...prev.cliente,
              clienteId: clienteGuardado?.clienteId ?? null,
              direccionLineal: extra.direccionLineal,
            }
          : prev.cliente,
      }));
      setCorreoCliente(extra.correo);
      setTelefonoCliente(extra.telefono);
    } catch {
      showToast("Error al guardar el cliente", "error");
    }
  };

  // ── Contacto ─────────────────────────────────────────────────
  const [correoCliente, setCorreoCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [enviarCorreo, setEnviarCorreo] = useState(false);
  const [enviarWhatsapp, setEnviarWhatsapp] = useState(false);

  const [horaDisplay, setHoraDisplay] = useState(fechaHora);
  const [fechaEmisionEditada, setFechaEmisionEditada] = useState(false);
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Emisión ──────────────────────────────────────────────────
  const [emitiendo, setEmitiendo] = useState(false);
  const [errorEmision, setErrorEmision] = useState<string | null>(null);

  // ── Guías de Remisión ────────────────────────────────────────
  const [showGuias, setShowGuias] = useState(false);
  const [guias, setGuias] = useState<
    { serie: string; numero: string; tipoDoc: string }[]
  >([]);
  const agregarGuia = () =>
    setGuias((prev) => [...prev, { serie: "", numero: "", tipoDoc: "09" }]);
  const eliminarGuia = (i: number) =>
    setGuias((prev) => prev.filter((_, idx) => idx !== i));
  const actualizarGuia = (i: number, campo: string, valor: string) => {
    setGuias((prev) => {
      const n = [...prev];
      n[i] = { ...n[i], [campo]: valor };
      return n;
    });
  };

  // ── Pagos ────────────────────────────────────────────────────
  const [pagos, setPagos] = useState<PagoLocal[]>([
    {
      medioPago: "Efectivo",
      monto: "",
      numeroOperacion: "",
      entidadFinanciera: "",
      observaciones: "",
    },
  ]);
  const [pagosEditados, setPagosEditados] = useState<boolean[]>([false]);
  const pagosEditadosRef = useRef<boolean[]>([false]);
  useEffect(() => {
    pagosEditadosRef.current = pagosEditados;
  }, [pagosEditados]);

  const mediosUsados = pagos.map((p) => p.medioPago);
  const todosMedios = ["Efectivo", "Tarjeta", "Yape", "Plin", "Transferencia"];
  const totalPagado = pagos.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);

  const agregarPago = () => {
    const disponibles = todosMedios.filter((m) => !mediosUsados.includes(m));
    if (!disponibles.length) return;
    const restante = Math.max(0, totales.total - totalPagado).toFixed(2);
    setPagos((prev) => [
      ...prev,
      {
        medioPago: disponibles[0],
        monto: restante,
        numeroOperacion: "",
        entidadFinanciera: "",
        observaciones: "",
      },
    ]);
    setPagosEditados((prev) => [...prev, true]);
  };
  const eliminarPago = (i: number) => {
    if (pagos.length === 1) return;
    setPagos((prev) => prev.filter((_, idx) => idx !== i));
    setPagosEditados((prev) => prev.filter((_, idx) => idx !== i));
  };
  const actualizarPago = (i: number, campo: keyof PagoLocal, valor: string) => {
    setPagos((prev) => {
      const n = [...prev];
      n[i] = { ...n[i], [campo]: valor };
      if (campo === "monto" && prev.length === 2) {
        const otroIdx = i === 0 ? 1 : 0;
        const restante = Math.max(0, totales.total - (parseFloat(valor) || 0)).toFixed(2);
        n[otroIdx] = { ...n[otroIdx], monto: restante };
      }
      return n;
    });
  };

  // ── Cuotas ───────────────────────────────────────────────────
  const [numeroCuotas, setNumeroCuotas] = useState(1);
  const [cuotas, setCuotas] = useState<
    { numeroCuota: string; monto: string; fechaVencimiento: string }[]
  >([]);

  const calcularFechasCuotas = (
    fechaBase: string,
    numCuotas: number,
  ): string[] => {
    const fechas: string[] = [];
    const [anio, mes, dia] = fechaBase.split("-").map(Number);
    for (let i = 0; i < numCuotas; i++) {
      let nuevoDia = dia,
        nuevoMes = mes + i,
        nuevoAnio = anio;
      while (nuevoMes > 12) {
        nuevoMes -= 12;
        nuevoAnio++;
      }
      const ultimoDia = new Date(nuevoAnio, nuevoMes, 0).getDate();
      if (nuevoDia > ultimoDia) nuevoDia = ultimoDia;
      const pad = (n: number) => String(n).padStart(2, "0");
      fechas.push(`${nuevoAnio}-${pad(nuevoMes)}-${pad(nuevoDia)}`);
    }
    return fechas;
  };

  useEffect(() => {
    const hoy = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const fechaBase =
      `${hoy.getFullYear()}-${pad(hoy.getMonth() + 2)}-15`.replace(
        /(\d{4})-13-/,
        (_, y) => `${Number(y) + 1}-01-`,
      );
    const fechas = calcularFechasCuotas(fechaBase, numeroCuotas);
    setCuotas(
      Array.from({ length: numeroCuotas }, (_, i) => ({
        numeroCuota: `Cuota${String(i + 1).padStart(3, "0")}`,
        monto: "",
        fechaVencimiento: fechas[i],
      })),
    );
  }, [numeroCuotas]);

  // ── Por consumo ──────────────────────────────────────────────
  const [porConsumo, setPorConsumo] = useState(false);

  // ── Detalles / ítems ─────────────────────────────────────────
  const [detalles, setDetalles] = useState<DetalleLocal[]>([]);
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);
  const focusedItemIndexRef = useRef<number | null>(null);
  const [busquedaProducto, setBusquedaProducto] = useState<string[]>([]);
  const [showDropdownProducto, setShowDropdownProducto] = useState<boolean[]>(
    [],
  );
  const inputRefs = useRef<(HTMLInputElement | HTMLTextAreaElement | null)[]>(
    [],
  );

  // ── ICBPER bolsa plástica ─────────────────────────────────────
  const [cantidadBolsa, setCantidadBolsa] = useState(0);
  const [tamañoBolsa, setTamañoBolsa] = useState<
    "pequeña" | "mediana" | "grande"
  >("mediana");
  const [aplicarIcbper, setAplicarIcbper] = useState(false);
  const [showBolsa, setShowBolsa] = useState(false);

  // guard: skip porConsumo else-branch on first render
  const porConsumoMountedRef = useRef(false);

  // ── Por consumo efecto ───────────────────────────────────────
  useEffect(() => {
    if (porConsumo) {
      porConsumoMountedRef.current = true;
      setDetalles((prev) => {
        const sinBolsa = prev.filter((d) => d._esIcbper);
        const consumoItem: DetalleLocal = {
          item: 1,
          _id: "por-consumo",
          productoId: null,
          codigo: null,
          descripcion: "Por Consumo",
          cantidad: 1,
          unidadMedida: "ZZ",
          precioUnitario: 0,
          tipoAfectacionIGV: "10",
          porcentajeIGV: IGV_DEFAULT,
          montoIGV: 0,
          baseIgv: 0,
          codigoTipoDescuento: "00",
          descuentoUnitario: 0,
          descuentoTotal: 0,
          valorVenta: 0,
          precioVenta: 0,
          totalVentaItem: 0,
          icbper: 0,
          factorIcbper: 0,
          _incluirIGV: false,
          _precioBase: 0,
          _precioVentaConIGV: 0,
        };
        return [consumoItem, ...sinBolsa];
      });
      setBusquedaProducto(["Por Consumo"]);
      setShowDropdownProducto([false]);
    } else {
      if (!porConsumoMountedRef.current) {
        porConsumoMountedRef.current = true;
        return; // skip on first mount to preserve store-loaded data
      }
      setDetalles((prev) => prev.filter((d) => d._id !== "por-consumo"));
      setBusquedaProducto([]);
      setShowDropdownProducto([]);
      inputRefs.current = [];
    }
  }, [porConsumo]);

  // guard: skip bolsa else-branch on first render
  const bolsaMountedRef = useRef(false);

  // ── Bolsa plástica efecto ─────────────────────────────────────
  useEffect(() => {
    if (productosSucursal.length === 0) return;
    // we should NOT run the logic that might clear a bolsa loaded from store.
    if (!bolsaMountedRef.current) {
      bolsaMountedRef.current = true;
      if (cantidadBolsa === 0) return;
    }

    const productoBolsa = productosSucursal.find(
      (p: ProductoSucursal) =>
        p.nomProducto.toUpperCase().includes("BOLSA PLASTICA") ||
        p.nomProducto.toUpperCase().includes("BOLSA PLÁSTICA"),
    );

    setDetalles((prev) => {
      const sinBolsa = prev.filter((d) => d._esIcbper !== true);
      if (cantidadBolsa === 0) return sinBolsa;
      const precioConIGV = PRECIOS_BOLSA[tamañoBolsa];
      const tipoAfectacion = productoBolsa?.tipoAfectacionIGV ?? "20";
      const precioBase = precioConIGV;
      const baseIgv = parseFloat((precioBase * cantidadBolsa).toFixed(2));
      const icbper = aplicarIcbper
        ? parseFloat((cantidadBolsa * ICBPER_FACTOR).toFixed(2))
        : 0;
      const bolsaItem: DetalleLocal = {
        item: sinBolsa.length + 1,
        productoId: productoBolsa?.productoId ?? null,
        codigo: productoBolsa?.codigo ?? "BOLSA",
        descripcion: `${productoBolsa?.nomProducto ?? "BOLSA PLASTICA"} (${tamañoBolsa})`,
        cantidad: cantidadBolsa,
        unidadMedida: productoBolsa?.unidadMedida ?? "NIU",
        precioUnitario: precioBase,
        tipoAfectacionIGV: tipoAfectacion,
        porcentajeIGV: 0,
        baseIgv,
        montoIGV: 0,
        codigoTipoDescuento: "01",
        descuentoUnitario: 0,
        descuentoTotal: 0,
        valorVenta: baseIgv,
        precioVenta: precioConIGV,
        totalVentaItem: parseFloat(
          (precioConIGV * cantidadBolsa + icbper).toFixed(2),
        ),
        icbper,
        factorIcbper: aplicarIcbper ? ICBPER_FACTOR : 0,
        _incluirIGV: false,
        _precioBase: precioBase,
        _precioVentaConIGV: precioConIGV,
        _precioBaseOriginal: precioBase,
        _sucursalProductoId:
          productoBolsa?.sucursalProducto?.sucursalProductoId,
        _tipoProducto: productoBolsa?.tipoProducto ?? null,
        _stockDisponible: productoBolsa?.sucursalProducto?.stock ?? null,
        _esIcbper: true,
      };
      return [...sinBolsa, bolsaItem];
    });

    setBusquedaProducto((prev) => {
      // For now, let's just assume we want to filter out anything that looks like a bolsa
      // if we are clearing or updating.
      const sinBolsa = prev.filter((s) => !s.startsWith("BOLSA PLASTICA"));
      if (cantidadBolsa === 0) return sinBolsa;
      return [...sinBolsa, `BOLSA PLASTICA (${tamañoBolsa})`];
    });
  }, [cantidadBolsa, productosSucursal, tamañoBolsa, aplicarIcbper]);

  // ── Descuento global ─────────────────────────────────────────
  const [descuentoGlobal, setDescuentoGlobal] = useState(0);
  const [codigoTipoDescGlobal, setCodigoTipoDescGlobal] = useState("02");

  // ── Tipo de cambio USD ───────────────────────────────────────
  const [tipoCambio, setTipoCambio] = useState(3.75);
  const [cargandoTipoCambio, setCargandoTipoCambio] = useState(false);

  // ── Boleta state ─────────────────────────────────────────────
  const [boleta, setBoleta] = useState<Partial<Boleta>>({
    ublVersion: "2.1",
    tipoOperacion: "0101",
    tipoComprobante: "03",
    tipoMoneda: "PEN",
    fechaEmision: fechaHora,
    horaEmision: fechaHora,
    fechaVencimiento: fecha,
    tipoPago: "Contado",
  });

  useEffect(() => {
    let cancelado = false;
    const fechaConsulta =
      (boleta.fechaEmision ?? formatoFechaActual().fechaHora).slice(0, 10) ||
      formatoFechaActual().fecha;

    const cargarTipoCambio = async () => {
      setCargandoTipoCambio(true);
      try {
        const venta = await obtenerTipoCambioVenta(fechaConsulta);
        if (!cancelado) setTipoCambio(venta);
      } catch (error) {
        console.warn("No se pudo obtener el tipo de cambio JSON.PE", error);
      } finally {
        if (!cancelado) setCargandoTipoCambio(false);
      }
    };

    cargarTipoCambio();
    return () => {
      cancelado = true;
    };
  }, [boleta.fechaEmision]);

  // ── PDF ──────────────────────────────────────────────────────
  const [comprobanteIdEmitido, setComprobanteIdEmitido] = useState<
    number | null
  >(null);
  const [tamanoPdf, setTamanoPdf] = useState<string>("A4");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [cargandoPdf, setCargandoPdf] = useState(false);
  const [pdfA4Url, setPdfA4Url] = useState<string | null>(null);
  const [pdfTicketUrl, setPdfTicketUrl] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [cargandoPreview, setCargandoPreview] = useState(false);

  // ── Effects de inicialización ────────────────────────────────
  useEffect(() => {
    const data = sharedVentaStore.get();

    // Load extra UI state first
    if (data.extra) {
      if (data.extra.porConsumo !== undefined)
        setPorConsumo(data.extra.porConsumo);
      if (data.extra.cantidadBolsa !== undefined)
        setCantidadBolsa(data.extra.cantidadBolsa);
      if (data.extra.tamañoBolsa !== undefined)
        setTamañoBolsa(data.extra.tamañoBolsa);
      if (data.extra.aplicarIcbper !== undefined)
        setAplicarIcbper(data.extra.aplicarIcbper);
      if (data.extra.descuentoGlobal !== undefined)
        setDescuentoGlobal(data.extra.descuentoGlobal);
      if (data.extra.codigoTipoDescGlobal !== undefined)
        setCodigoTipoDescGlobal(data.extra.codigoTipoDescGlobal);
      if (data.extra.trabajadorIdGlobal !== undefined)
        setTrabajadorIdGlobal(data.extra.trabajadorIdGlobal);
      if (data.extra.trabajadoresPorItem !== undefined)
        setTrabajadoresPorItem(data.extra.trabajadoresPorItem);
    }

    if (data.items && data.items.length > 0) {
      const mapped = data.items.map((i: any, idx: number) => {
        const cantidad = i.cantidad || 1;
        const porcentajeIGV = i.porcentajeIGV ?? 18;
        const precioUnitario = i.precioUnitario ?? i._precioBase ?? 0;
        // DetalleLocal uses 'precioVenta', ItemRapido uses 'precioVentaConIGV'
        const precioVenta =
          i.precioVenta ??
          i.precioVentaConIGV ??
          i._precioVentaConIGV ??
          precioUnitario;

        let baseIgv = 0;
        let montoIGV = 0;
        let totalVentaItem = 0;
        let valorVenta = 0;

        if (i._esIcbper) {
          baseIgv = parseFloat((precioUnitario * cantidad).toFixed(2));
          montoIGV = 0;
          totalVentaItem = parseFloat((precioVenta * cantidad).toFixed(2));
          valorVenta = baseIgv;
        } else {
          if (i.tipoAfectacionIGV === "10") {
            baseIgv = parseFloat((precioUnitario * cantidad).toFixed(2));
            montoIGV = parseFloat(((baseIgv * porcentajeIGV) / 100).toFixed(2));
            totalVentaItem = parseFloat((precioVenta * cantidad).toFixed(2));
            valorVenta = baseIgv;
          } else {
            baseIgv = parseFloat((precioUnitario * cantidad).toFixed(2));
            montoIGV = 0;
            totalVentaItem = baseIgv;
            valorVenta = baseIgv;
          }
        }

        return {
          item: idx + 1,
          _id: i.id || i._id || crypto.randomUUID(),
          productoId: i.productoId,
          codigo: i.codigo || null,
          descripcion: i.descripcion,
          cantidad,
          unidadMedida: i.unidadMedida || "NIU",
          precioUnitario,
          tipoAfectacionIGV: i.tipoAfectacionIGV || "10",
          porcentajeIGV,
          montoIGV,
          baseIgv,
          codigoTipoDescuento: i.codigoTipoDescuento || "00",
          descuentoUnitario: i.descuentoUnitario || 0,
          descuentoTotal: i.descuentoTotal || 0,
          valorVenta,
          precioVenta,
          totalVentaItem,
          icbper: i.icbper || 0,
          factorIcbper: i.factorIcbper || 0,
          _incluirIGV: i._incluirIGV !== undefined ? i._incluirIGV : true,
          _precioBase: precioUnitario,
          _precioVentaConIGV: precioVenta,
          _precioBaseOriginal: i._precioBaseOriginal || precioUnitario,
          _sucursalProductoId: i._sucursalProductoId,
          _tipoProducto: i._tipoProducto,
          _stockDisponible: i._stockDisponible,
          _esIcbper: i._esIcbper,
        };
      });
      setDetalles(mapped);
      if (data.extra.trabajadoresPorItem !== undefined) {
        const normalizado: Record<string, number> = {};
        mapped.forEach((d: any, i: number) => {
          const claveOriginal = d._id ?? d.id ?? String(i);
          const valor =
            data.extra.trabajadoresPorItem[claveOriginal] ??
            data.extra.trabajadoresPorItem[String(i)];
          if (valor) normalizado[d._id ?? String(i)] = valor;
        });
        setTrabajadoresPorItem(normalizado);
      }
      setBusquedaProducto(mapped.map((i: any) => i.descripcion || ""));
      setShowDropdownProducto(mapped.map(() => false));
    }
    if (data.cliente) {
      setBoleta((prev) => ({ ...prev, cliente: data.cliente }));
      if (data.cliente.numeroDocumento)
        setBusqueda(data.cliente.numeroDocumento);
    }
  }, []);

  // before the load effect reads it (both fire on mount in order)
  const isFirstSaveRef = useRef(true);
  useEffect(() => {
    if (isFirstSaveRef.current) {
      isFirstSaveRef.current = false;
      return;
    }
    if (emitido) return;
    sharedVentaStore.save(boleta.cliente ?? null, detalles, {
      porConsumo,
      cantidadBolsa,
      tamañoBolsa,
      aplicarIcbper,
      descuentoGlobal,
      codigoTipoDescGlobal,
      trabajadorIdGlobal,
      trabajadoresPorItem,
    });
  }, [
    boleta.cliente,
    detalles,
    porConsumo,
    cantidadBolsa,
    tamañoBolsa,
    aplicarIcbper,
    descuentoGlobal,
    codigoTipoDescGlobal,
  ]);

  useEffect(() => {
    if (!empresa) return;
    setBoleta((prev) => ({ ...prev, company: empresa }));
  }, [empresa]);

  useEffect(() => {
    if (!cliente) return;
    setBoleta((prev) => ({ ...prev, cliente: cliente as BoletaCliente }));
    setCorreoCliente("");
    setTelefonoCliente("");
  }, [cliente]);

  useEffect(() => {
    if (emitido) {
      sharedVentaStore.clear();
    }
  }, [emitido]);

  useEffect(() => {
    if (!sucursalDelHook) return;
    if (isSuperAdmin) return;
    setSucursal(sucursalDelHook);
  }, [sucursalDelHook, isSuperAdmin]);

  useEffect(() => {
    if (!sucursal) return;
    setCorrelativoActual(sucursal.correlativoBoleta);
    setBoleta((prev) => ({
      ...prev,
      serie: sucursal.serieBoleta,
      correlativo: String(sucursal.correlativoBoleta).padStart(8, "0"),
      company: {
        ...prev.company,
        establecimientoAnexo: sucursal.codEstablecimiento ?? "0000",
      } as Boleta["company"],
    }));
  }, [sucursal]);

  useEffect(() => {
    if (fechaEmisionEditada) {
      if (intervaloRef.current) clearInterval(intervaloRef.current);
      return;
    }
    intervaloRef.current = setInterval(() => {
      setHoraDisplay(formatoFechaActual().fechaHora);
    }, 1000);
    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current);
    };
  }, [fechaEmisionEditada]);

  // ── Clientes varios efecto ───────────────────────────────────
  useEffect(() => {
    if (clienteVarios) {
      setTipoDoc("00");
      setBoleta((prev) => ({
        ...prev,
        cliente: {
          clienteId: null,
          tipoDocumento: "0",
          numeroDocumento: "0",
          razonSocial: "Clientes Varios",
          ubigeo: "",
          direccionLineal: "",
          departamento: "",
          provincia: "",
          distrito: "",
        },
      }));
      setBusqueda("");
      setShowDropdown(false);
      setCorreoCliente("");
      setTelefonoCliente("");
      setEnviarCorreo(false);
      setEnviarWhatsapp(false);
    } else {
      setBoleta((prev) => ({ ...prev, cliente: undefined }));
      setBusqueda("");
      setTipoDoc("01");
    }
  }, [clienteVarios]);

  // ── Sincronizar pagos ────────────────────────────────────────
  useEffect(() => {
    if (boleta.tipoPago !== "Contado" && boleta.tipoPago !== "CreditoInicial")
      return;
    const pagosFormateados: BoletaPago[] = pagos.map((p) => ({
      medioPago: p.medioPago,
      monto: Number(p.monto) || 0,
      fechaPago: fechaHora,
      numeroOperacion: p.medioPago === "Efectivo" ? "" : p.numeroOperacion,
      entidadFinanciera: p.medioPago === "Efectivo" ? "" : p.entidadFinanciera,
      observaciones: p.observaciones,
    }));
    setBoleta((prev) => ({ ...prev, pagos: pagosFormateados, cuotas: [] }));
  }, [pagos, boleta.tipoPago]);

  useEffect(() => {
    if (boleta.tipoPago !== "Credito" && boleta.tipoPago !== "CreditoInicial")
      return;
    const cuotasFormateadas: BoletaCuota[] = cuotas.map((c) => ({
      numeroCuota: c.numeroCuota,
      monto: Number(c.monto) || 0,
      fechaVencimiento: c.fechaVencimiento,
    }));

    // ✅ Tomar fecha de vencimiento de la última cuota
    const ultimaCuota = cuotas[cuotas.length - 1];
    const fechaVencimientoFinal =
      ultimaCuota?.fechaVencimiento ?? boleta.fechaVencimiento;

    if (boleta.tipoPago === "Credito") {
      setBoleta((prev) => ({
        ...prev,
        cuotas: cuotasFormateadas,
        pagos: [],
        fechaVencimiento: fechaVencimientoFinal,
      }));
    } else {
      setBoleta((prev) => ({
        ...prev,
        cuotas: cuotasFormateadas,
        fechaVencimiento: fechaVencimientoFinal,
      }));
    }
  }, [cuotas, boleta.tipoPago]);

  useEffect(() => {
    const detallesLimpios = detalles.map(
      (
        {
          _id,
          _incluirIGV,
          _precioBase,
          _precioBaseOriginal,
          _precioVentaConIGV,
          _sucursalProductoId,
          _tipoProducto,
          _stockDisponible,
          _esIcbper,
          ...d
        },
        i,
      ) => ({
        ...d,
        trabajadorId: esSalonBelleza
          ? trabajadoresPorItem[_id ?? String(i)] || null
          : null,
      }),
    ) as BoletaDetalle[];
    setBoleta((prev) => ({ ...prev, details: detallesLimpios }));
  }, [detalles, trabajadoresPorItem, esSalonBelleza]);

  useEffect(() => {
    const guiasFormateadas: BoletaGuia[] = guias
      .filter((g) => g.serie && g.numero)
      .map((g) => ({
        guiaNumeroCompleto: `${g.serie}-${g.numero}`,
        guiaTipoDoc: g.tipoDoc,
      }));
    setBoleta((prev) => ({ ...prev, guias: guiasFormateadas }));
  }, [guias]);

  // ── Totales ──────────────────────────────────────────────────
  const totales = useMemo(() => {
    const gravadas_bruto = detalles
      .filter((d) => d.tipoAfectacionIGV === "10")
      .reduce((acc, d) => acc + (d.baseIgv ?? 0), 0);
    const exoneradas = detalles
      .filter((d) => d.tipoAfectacionIGV === "20")
      .reduce((acc, d) => acc + (d.baseIgv ?? 0), 0);
    const inafectas = detalles
      .filter((d) => d.tipoAfectacionIGV === "30")
      .reduce((acc, d) => acc + (d.baseIgv ?? 0), 0);
    const igv_bruto = detalles
      .filter((d) => d.tipoAfectacionIGV === "10")
      .reduce((acc, d) => acc + (d.montoIGV ?? 0), 0);
    const totalDescuentosItems = detalles
      .filter((d) => d.codigoTipoDescuento === "01")
      .reduce((acc, d) => acc + (d.descuentoTotal ?? 0), 0);

    let gravadas = gravadas_bruto,
      igv = igv_bruto,
      descGlobalEnTotales = 0;
    if (codigoTipoDescGlobal === "02" && descuentoGlobal > 0) {
      const porcentaje =
        detalles.find((d) => d.tipoAfectacionIGV === "10")?.porcentajeIGV ?? 18;
      const descuentoBaseGlobal = parseFloat((descuentoGlobal / (1 + porcentaje / 100)).toFixed(2));
      const descuentoIgvGlobal = parseFloat((descuentoGlobal - descuentoBaseGlobal).toFixed(2));
      gravadas = parseFloat(
        Math.max(0, gravadas_bruto - descuentoBaseGlobal).toFixed(2),
      );
      igv = parseFloat(
        Math.max(0, igv_bruto - descuentoIgvGlobal).toFixed(2),
      );
    }
    if (codigoTipoDescGlobal === "03" && descuentoGlobal > 0)
      descGlobalEnTotales = descuentoGlobal;

    const totalIcbper = detalles.reduce((acc, d) => acc + (d.icbper ?? 0), 0);
    const valorVenta = parseFloat(
      (gravadas + exoneradas + inafectas).toFixed(2),
    );
    const subTotal = parseFloat(
      (valorVenta + igv - totalDescuentosItems).toFixed(2),
    );
    const totalDescuentos = parseFloat(
      (totalDescuentosItems + descGlobalEnTotales).toFixed(2),
    );
    const importeTotal = parseFloat(
      Math.max(0, subTotal - descGlobalEnTotales + totalIcbper).toFixed(2),
    );

    return {
      gravadas: parseFloat(gravadas.toFixed(2)),
      exoneradas: parseFloat(exoneradas.toFixed(2)),
      inafectas: parseFloat(inafectas.toFixed(2)),
      igv: parseFloat(igv.toFixed(2)),
      totalDescuentos,
      valorVenta,
      subTotal,
      importeTotal,
      totalIcbper: parseFloat(totalIcbper.toFixed(2)),
      total: importeTotal,
    };
  }, [detalles, descuentoGlobal, codigoTipoDescGlobal]);

  // ── Auto-calcular pagos ──────────────────────────────────────
  useEffect(() => {
    if (boleta.tipoPago !== "Contado" && boleta.tipoPago !== "CreditoInicial")
      return;
    if (pagos.length === 1) {
      pagosEditadosRef.current = [false];
      setPagosEditados([false]);
      setPagos((prev) =>
        prev.map((p) => ({
          ...p,
          monto: totales.total === 0 ? "" : totales.total.toFixed(2),
        })),
      );
      return;
    }
    if (totales.total === 0) {
      setPagos((prev) => prev.map((p) => ({ ...p, monto: "" })));
      return;
    }
    setPagos((prev) =>
      prev.map((pago, i) => {
        if (pagosEditadosRef.current[i]) return pago;
        if (i > 0) return pago;
        const pagadoAntes = prev
          .slice(0, i)
          .reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
        return {
          ...pago,
          monto: Math.max(0, totales.total - pagadoAntes).toFixed(2),
        };
      }),
    );
  }, [totales.total, boleta.tipoPago, pagos.length]);

  // ── Auto-calcular cuotas ─────────────────────────────────────
  useEffect(() => {
    if (boleta.tipoPago !== "Credito" && boleta.tipoPago !== "CreditoInicial")
      return;
    if (totales.total === 0) {
      setCuotas((prev) => prev.map((c) => ({ ...c, monto: "" })));
      return;
    }
    const base =
      boleta.tipoPago === "CreditoInicial"
        ? Math.max(0, totales.total - totalPagado)
        : totales.total;
    const monto = parseFloat((base / numeroCuotas).toFixed(2));
    setCuotas((prev) => prev.map((c) => ({ ...c, monto: String(monto) })));
  }, [totales.total, numeroCuotas, boleta.tipoPago, totalPagado]);

  // ── Sincronizar totales en boleta ────────────────────────────
  useEffect(() => {
    const moneda = boleta.tipoMoneda === "USD" ? "DÓLARES" : "SOLES";
    const montoCredito =
      boleta.tipoPago === "CreditoInicial"
        ? parseFloat(Math.max(0, totales.total - totalPagado).toFixed(2))
        : 0;
    setBoleta((prev) => ({
      ...prev,
      tipoCambio: boleta.tipoMoneda === "USD" ? tipoCambio : undefined,
      totalOperacionesGravadas: totales.gravadas,
      totalOperacionesExoneradas: totales.exoneradas,
      totalOperacionesInafectas: totales.inafectas,
      totalIGV: totales.igv,
      totalIcbper: totales.totalIcbper,
      totalImpuestos: parseFloat(
        (totales.igv + totales.totalIcbper).toFixed(2),
      ),
      totalDescuentos: totales.totalDescuentos,
      codigoTipoDescGlobal,
      descuentoGlobal,
      subTotal: totales.subTotal,
      importeTotal: totales.importeTotal,
      valorVenta: totales.valorVenta,
      montoCredito,
      legends: [
        { code: "1000", value: numeroAlertas(totales.importeTotal, moneda) },
      ],
    }));
  }, [
    totales,
    descuentoGlobal,
    codigoTipoDescGlobal,
    boleta.tipoPago,
    boleta.tipoMoneda,
    tipoCambio,
    totalPagado,
  ]);

  // ── Buscar cliente automático ────────────────────────────────
  const clientesFiltrados = clientes.filter((c) => {
    if (c.tipoDocumento.tipoDocumentoId !== tipoDoc) return false;
    if (busqueda.length === 0) return true;
    return (
      c.numeroDocumento.includes(busqueda) ||
      c.razonSocialNombre.toLowerCase().includes(busqueda.toLowerCase())
    );
  });

  const seleccionarDeLista = (c: Cliente) => {
    setBusqueda(c.numeroDocumento);
    setShowDropdown(false);
    const direccion = c.direccion?.[0];
    setCorreoCliente(c.correo ?? "");
    setTelefonoCliente(c.telefono ?? "");
    setBoleta((prev) => ({
      ...prev,
      cliente: {
        clienteId: c.clienteId,
        tipoDocumento: c.tipoDocumento.tipoDocumentoId,
        numeroDocumento: c.numeroDocumento,
        razonSocial: c.razonSocialNombre,
        ubigeo: direccion?.ubigeo ?? "",
        direccionLineal: direccion?.direccionLineal ?? "",
        departamento: direccion?.departamento ?? "",
        provincia: direccion?.provincia ?? "",
        distrito: direccion?.distrito ?? "",
      },
    }));
  };

  useEffect(() => {
    if (clienteVarios) return;
    const longitud = tipoDoc === "01" ? 8 : tipoDoc === "06" ? 11 : 12;
    if (!longitud || busqueda.length !== longitud) return;
    const yaEsta = clientes.some((c) => c.numeroDocumento === busqueda);
    if (!yaEsta) buscarCliente(tipoDoc, busqueda);
  }, [busqueda, tipoDoc, clientes, clienteVarios]);

  // ── Cálculo de detalle ───────────────────────────────────────
  const calcularDetalle = useCallback(
    (
      precioBase: number,
      precioVentaConIGV: number,
      cantidad: number,
      porcentajeIGV: number,
      tipoAfectacion: string,
      codigoDescuento: string,
      descuentoUnitario: number,
    ) => {
      const precioUnitario = parseFloat(precioBase.toFixed(6));
      let baseIgv = 0,
        montoIGV = 0,
        totalVentaItem = 0,
        valorVenta = 0;
      let precioVenta = parseFloat(precioVentaConIGV.toFixed(2));
      let descuentoTotal = 0;

      if (tipoAfectacion === "10") {
        if (codigoDescuento === "00") {
          precioVenta = parseFloat(
            (precioVentaConIGV - descuentoUnitario).toFixed(2),
          );
          totalVentaItem = parseFloat((precioVenta * cantidad).toFixed(2));
          montoIGV = parseFloat(
            (
              totalVentaItem -
              totalVentaItem / (1 + porcentajeIGV / 100)
            ).toFixed(2),
          );
          baseIgv = parseFloat((totalVentaItem - montoIGV).toFixed(2));
          valorVenta = baseIgv;
          const descBase = parseFloat(
            (descuentoUnitario / (1 + porcentajeIGV / 100)).toFixed(6),
          );
          descuentoTotal = parseFloat(
            (descBase * cantidad).toFixed(2),
          );
        } else {
          totalVentaItem = parseFloat(
            (precioVentaConIGV * cantidad).toFixed(2),
          );
          montoIGV = parseFloat(
            (
              totalVentaItem -
              totalVentaItem / (1 + porcentajeIGV / 100)
            ).toFixed(2),
          );
          baseIgv = parseFloat((totalVentaItem - montoIGV).toFixed(2));
          precioVenta = parseFloat(
            (precioVentaConIGV - descuentoUnitario).toFixed(2),
          );
          valorVenta = baseIgv;
          descuentoTotal = parseFloat(
            (descuentoUnitario * cantidad).toFixed(2),
          );
        }
      } else {
        if (codigoDescuento === "00") {
          precioVenta = parseFloat(
            (precioVentaConIGV - descuentoUnitario).toFixed(2),
          );
          baseIgv = parseFloat((precioVenta * cantidad).toFixed(2));
          totalVentaItem = parseFloat(baseIgv.toFixed(2));
          descuentoTotal = parseFloat(
            (descuentoUnitario * cantidad).toFixed(2),
          );
        } else {
          baseIgv = parseFloat((precioBase * cantidad).toFixed(2));
          precioVenta = parseFloat(precioBase.toFixed(2));
          totalVentaItem = parseFloat(
            ((precioBase - descuentoUnitario) * cantidad).toFixed(2),
          );
          descuentoTotal = parseFloat(
            (descuentoUnitario * cantidad).toFixed(2),
          );
        }
        montoIGV = 0;
        valorVenta = baseIgv;
      }

      return {
        precioUnitario,
        precioVenta,
        baseIgv,
        montoIGV,
        totalVentaItem,
        valorVenta,
        descuentoTotal,
      };
    },
    [],
  );

  // ── Agregar fila ─────────────────────────────────────────────
  const agregarFila = () => {
    setDetalles((prev) => {
      const sinBolsa = prev.filter((d) => !d._esIcbper);
      const bolsaItems = prev.filter((d) => d._esIcbper);
      const nuevaFila: DetalleLocal = {
        item: sinBolsa.length + 1,
        productoId: null,
        codigo: null,
        descripcion: "",
        cantidad: 1,
        unidadMedida: "NIU",
        precioUnitario: 0,
        tipoAfectacionIGV: "10",
        porcentajeIGV: IGV_DEFAULT,
        montoIGV: 0,
        baseIgv: 0,
        codigoTipoDescuento: "00",
        descuentoUnitario: 0,
        descuentoTotal: 0,
        valorVenta: 0,
        precioVenta: 0,
        totalVentaItem: 0,
        icbper: 0,
        factorIcbper: 0,
        _incluirIGV: false,
        _precioBase: 0,
        _precioVentaConIGV: 0,
      };
      if (trabajadorIdGlobal) {
        setTrabajadoresPorItem((prev) => ({
          ...prev,
          [String(detalles.filter((d) => !d._esIcbper).length)]:
            trabajadorIdGlobal,
        }));
      }
      return [...sinBolsa, nuevaFila, ...bolsaItems];
    });
    setBusquedaProducto((prev) => {
      const sinBolsa = prev.filter((_, i) => !detalles[i]?._esIcbper);
      return [
        ...sinBolsa,
        "",
        ...prev.filter((_, i) => detalles[i]?._esIcbper),
      ];
    });
    setShowDropdownProducto((prev) => {
      const sinBolsa = prev.filter((_, i) => !detalles[i]?._esIcbper);
      return [
        ...sinBolsa,
        false,
        ...prev.filter((_, i) => detalles[i]?._esIcbper),
      ];
    });
    inputRefs.current = [
      ...inputRefs.current.filter((_, i) => !detalles[i]?._esIcbper),
      null,
      ...inputRefs.current.filter((_, i) => detalles[i]?._esIcbper),
    ];
  };

  // ── Seleccionar producto ─────────────────────────────────────
  const seleccionarProducto = (producto: ProductoSucursal, index: number) => {
    if (
      producto.nomProducto.toUpperCase().includes("BOLSA PLASTICA") ||
      producto.nomProducto.toUpperCase().includes("BOLSA PLÁSTICA")
    ) {
      setCantidadBolsa((prev) => prev + 1);
      eliminarFila(index);
      showToast("Usa el contador de bolsa plástica", "info");
      return;
    }

    const indexExistente = detalles.findIndex(
      (d, i) =>
        i !== index && d.productoId === producto.productoId && !d._esIcbper,
    );
    if (indexExistente !== -1) {
      const cantidadNueva =
        (detalles[indexExistente].cantidad ?? 1) +
        (detalles[index]?.cantidad ?? 1);
      actualizarCantidad(indexExistente, cantidadNueva);
      setDetalles((prev) => prev.filter((_, i) => i !== index));
      setBusquedaProducto((prev) => prev.filter((_, i) => i !== index));
      setShowDropdownProducto((prev) => prev.filter((_, i) => i !== index));
      inputRefs.current = inputRefs.current.filter((_, i) => i !== index);
      showToast(
        `Cantidad actualizada en ítem ${indexExistente + 1}`,
        "success",
      );
      return;
    }

    const precioSistema = producto.sucursalProducto.precioUnitario;
    const precioEnMoneda =
      boleta.tipoMoneda === "USD"
        ? parseFloat((precioSistema / tipoCambio).toFixed(6))
        : precioSistema;
    const porcentajeIGV =
      producto.tipoAfectacionIGV === "10"
        ? (detalles[index]?.porcentajeIGV ?? IGV_DEFAULT)
        : 0;
    const cantidad = detalles[index]?.cantidad ?? 1;
    const precioBase =
      producto.tipoAfectacionIGV === "10" && producto.incluirIGV
        ? parseFloat((precioEnMoneda / (1 + porcentajeIGV / 100)).toFixed(6))
        : precioEnMoneda;
    const precioVentaConIGV =
      producto.tipoAfectacionIGV === "10"
        ? producto.incluirIGV
          ? precioEnMoneda
          : parseFloat((precioEnMoneda * (1 + porcentajeIGV / 100)).toFixed(2))
        : precioEnMoneda;
    const calc = calcularDetalle(
      precioBase,
      precioVentaConIGV,
      cantidad,
      porcentajeIGV,
      producto.tipoAfectacionIGV,
      "00",
      0,
    );

    const nuevos = [...detalles];
    nuevos[index] = {
      ...nuevos[index],
      productoId: producto.productoId,
      codigo: producto.codigo,
      _sucursalProductoId: producto.sucursalProducto.sucursalProductoId,
      _tipoProducto: producto.tipoProducto,
      _stockDisponible: producto.sucursalProducto.stock,
      descripcion: producto.nomProducto,
      unidadMedida: producto.unidadMedida,
      tipoAfectacionIGV: producto.tipoAfectacionIGV,
      porcentajeIGV,
      codigoTipoDescuento: "00",
      _incluirIGV: producto.incluirIGV,
      _precioBase: precioBase,
      _precioBaseOriginal: precioBase,
      _precioVentaConIGV: precioVentaConIGV,
      ...calc,
    };
    setDetalles(nuevos);
    const nb = [...busquedaProducto];
    nb[index] = producto.nomProducto;
    setBusquedaProducto(nb);
    const nd = [...showDropdownProducto];
    nd[index] = false;
    setShowDropdownProducto(nd);

    // Auto-adjust height dynamically when product is selected
    setTimeout(() => {
      const el = inputRefs.current[index] as HTMLTextAreaElement | null;
      if (el) {
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }
    }, 50);
  };

  const actualizarPrecioVenta = (index: number, nuevoPrecioVenta: number) => {
    const d = detalles[index];
    if (!d) return;
    const ta = d.tipoAfectacionIGV ?? "10",
      pct = d.porcentajeIGV ?? 18;
    const nuevoPrecioBase =
      ta === "10"
        ? parseFloat((nuevoPrecioVenta / (1 + pct / 100)).toFixed(6))
        : nuevoPrecioVenta;
    const calc = calcularDetalle(
      nuevoPrecioBase,
      nuevoPrecioVenta,
      d.cantidad ?? 1,
      pct,
      ta,
      d.codigoTipoDescuento ?? "00",
      d.descuentoUnitario ?? 0,
    );
    const nuevos = [...detalles];
    nuevos[index] = {
      ...d,
      _precioBase: nuevoPrecioBase,
      _precioVentaConIGV: nuevoPrecioVenta,
      ...calc,
    };
    setDetalles(nuevos);
  };

  const actualizarCantidad = (index: number, cantidad: number) => {
    const d = detalles[index];
    if (!d) return;
    const calc = calcularDetalle(
      d._precioBase ?? d.precioUnitario ?? 0,
      d._precioVentaConIGV ?? d.precioVenta ?? 0,
      cantidad,
      d.porcentajeIGV ?? 18,
      d.tipoAfectacionIGV ?? "10",
      d.codigoTipoDescuento ?? "00",
      d.descuentoUnitario ?? 0,
    );
    const nuevos = [...detalles];
    nuevos[index] = { ...d, cantidad, ...calc };
    setDetalles(nuevos);
  };

  const actualizarDescuento = (index: number, descuentoUnitario: number) => {
    const d = detalles[index];
    if (!d) return;
    const calc = calcularDetalle(
      d._precioBase ?? d.precioUnitario ?? 0,
      d._precioVentaConIGV ?? d.precioVenta ?? 0,
      d.cantidad ?? 1,
      d.porcentajeIGV ?? 18,
      d.tipoAfectacionIGV ?? "10",
      d.codigoTipoDescuento ?? "00",
      descuentoUnitario,
    );
    const nuevos = [...detalles];
    nuevos[index] = { ...d, descuentoUnitario, ...calc };
    setDetalles(nuevos);
  };

  const actualizarPorcentajeIGV = (index: number, porcentaje: number) => {
    const d = detalles[index];
    if (!d) return;
    const ta = d.tipoAfectacionIGV ?? "10",
      pv = d._precioVentaConIGV ?? d.precioVenta ?? 0;
    const nuevaPrecioBase =
      ta === "10" ? parseFloat((pv / (1 + porcentaje / 100)).toFixed(6)) : pv;
    const calc = calcularDetalle(
      nuevaPrecioBase,
      pv,
      d.cantidad ?? 1,
      porcentaje,
      ta,
      d.codigoTipoDescuento ?? "00",
      d.descuentoUnitario ?? 0,
    );
    const nuevos = [...detalles];
    nuevos[index] = {
      ...d,
      porcentajeIGV: porcentaje,
      _precioBase: nuevaPrecioBase,
      ...calc,
    };
    setDetalles(nuevos);
  };

  const actualizarTipoAfectacion = (index: number, tipoAfectacion: string) => {
    setDetalles((prev) => {
      const nuevos = [...prev];
      const actual = prev[index];
      const precioBase =
        actual._precioBaseOriginal ??
        actual._precioBase ??
        actual.precioUnitario ??
        0;
      const porcentajeIGV =
        tipoAfectacion === "10"
          ? actual.porcentajeIGV && actual.porcentajeIGV > 0
            ? actual.porcentajeIGV
            : IGV_DEFAULT
          : 0;
      const precioVentaConIGV =
        tipoAfectacion === "10"
          ? parseFloat((precioBase * (1 + porcentajeIGV / 100)).toFixed(2))
          : precioBase;
      const calc = calcularDetalle(
        precioBase,
        precioVentaConIGV,
        actual.cantidad ?? 1,
        porcentajeIGV,
        tipoAfectacion,
        actual.codigoTipoDescuento ?? "00",
        actual.descuentoUnitario ?? 0,
      );
      nuevos[index] = {
        ...actual,
        tipoAfectacionIGV: tipoAfectacion,
        porcentajeIGV,
        _precioBase: precioBase,
        _precioVentaConIGV: precioVentaConIGV,
        ...calc,
      };
      return nuevos;
    });
  };

  const actualizarCodigoDescuento = (index: number, codigo: string) => {
    const d = detalles[index];
    if (!d) return;
    const calc = calcularDetalle(
      d._precioBase ?? d.precioUnitario ?? 0,
      d._precioVentaConIGV ?? d.precioVenta ?? 0,
      d.cantidad ?? 1,
      d.porcentajeIGV ?? 18,
      d.tipoAfectacionIGV ?? "10",
      codigo,
      d.descuentoUnitario ?? 0,
    );
    const nuevos = [...detalles];
    nuevos[index] = { ...d, codigoTipoDescuento: codigo, ...calc };
    setDetalles(nuevos);
  };

  const eliminarFila = (index: number) => {
    if (detalles[index]?._esIcbper) {
      setCantidadBolsa(0);
      return;
    }
    if (detalles[index]?._id === "por-consumo") {
      setPorConsumo(false);
      return;
    }
    setDetalles((prev) => prev.filter((_, i) => i !== index));
    setBusquedaProducto((prev) => prev.filter((_, i) => i !== index));
    setShowDropdownProducto((prev) => prev.filter((_, i) => i !== index));
    inputRefs.current = inputRefs.current.filter((_, i) => i !== index);
  };

  // ── PDF helpers ──────────────────────────────────────────────
  const cargarPdf = async (comprobanteId: number, tamano: string) => {
    setCargandoPdf(true);
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteId}/pdf?tamano=${tamano}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          responseType: "blob",
        },
      );
      const url = URL.createObjectURL(
        new Blob([res.data], { type: "application/pdf" }),
      );
      setPdfUrl(url);
    } catch {
      showToast("Error al cargar el PDF", "error");
    } finally {
      setCargandoPdf(false);
    }
  };

  useEffect(() => {
    if (!comprobanteIdEmitido) return;
    cargarPdf(comprobanteIdEmitido, tamanoPdf);
  }, [tamanoPdf, comprobanteIdEmitido]);

  const imprimirPdf = () => {
    if (!pdfA4Url) return;
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = pdfA4Url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    };
  };

  // ── Preparar boleta ──────────────────────────────────────────
  const prepararBoleta = () => ({
    ...boleta,
    tipoPago:
      boleta.tipoPago === "CreditoInicial" ? "Credito" : boleta.tipoPago,
    fechaEmision: fechaEmisionEditada
      ? boleta.fechaEmision
      : formatoFechaActual().fechaHora,
    horaEmision: fechaEmisionEditada
      ? boleta.horaEmision
      : formatoFechaActual().fechaHora,
    company: {
      ...boleta.company,
      establecimientoAnexo:
        sucursal?.codEstablecimiento ??
        boleta.company?.establecimientoAnexo ??
        "0000",
    },
    enviadoEnResumen: enviarEnResumen,
    cliente: {
      ...boleta.cliente,
      ubigeo: boleta.cliente?.ubigeo || null,
      direccionLineal: boleta.cliente?.direccionLineal || null,
      departamento: boleta.cliente?.departamento || null,
      provincia: boleta.cliente?.provincia || null,
      distrito: boleta.cliente?.distrito || null,
      correo: correoCliente || null,
      enviadoPorCorreo: enviarCorreo,
      whatsApp: telefonoCliente || null,
      enviadoPorWhatsApp: enviarWhatsapp,
    },
    usuarioCreacion: user?.id ?? 0,
  });

  // ── Emitir ───────────────────────────────────────────────────
  const emitirComprobante = async () => {
    if (!boleta.cliente?.razonSocial && !boleta.cliente?.numeroDocumento) {
      showToast("Debe seleccionar o ingresar un cliente", "error");
      return;
    }
    if (docInvalido) {
      showToast(
        tipoDoc === "01"
          ? "El DNI debe tener exactamente 8 dígitos"
          : "El RUC debe tener exactamente 11 dígitos",
        "error",
      );
      return;
    }

    const itemsReales = detalles.filter((d) => !d._esIcbper);
    if (!itemsReales.length) {
      showToast("Debe agregar al menos un ítem", "error");
      return;
    }
    const itemSinDesc = itemsReales.findIndex((d) => !d.descripcion?.trim());
    if (itemSinDesc !== -1) {
      showToast(`El ítem ${itemSinDesc + 1} no tiene descripción`, "error");
      return;
    }
    const itemSinPrecio = itemsReales.findIndex((d) => {
      const precioBase = d._precioBase ?? d.precioUnitario ?? 0;
      const esGratuito =
        (d.descuentoUnitario ?? 0) >= precioBase && precioBase > 0;
      return !esGratuito && (d.precioVenta ?? 0) <= 0;
    });
    if (itemSinPrecio !== -1) {
      showToast(
        `El ítem ${itemSinPrecio + 1} debe tener un precio mayor a cero`,
        "error",
      );
      return;
    }
    if (enviarCorreo && !correoCliente.trim()) {
      showToast("Ingrese el correo del cliente para enviar", "error");
      return;
    }
    if (enviarWhatsapp && !telefonoCliente.trim()) {
      showToast("Ingrese el teléfono para enviar por WhatsApp", "error");
      return;
    }

    const sumaPagos = pagos.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
    const sumaCuotas = cuotas.reduce(
      (acc, c) => acc + (Number(c.monto) || 0),
      0,
    );
    const pagoInvalido = pagos.some((p) => !p.monto || Number(p.monto) <= 0);
    const cuotaInvalida = cuotas.some((c) => !c.monto || Number(c.monto) <= 0);

    if (boleta.tipoPago !== "Credito" && pagoInvalido) {
      showToast("Todos los montos de pago deben ser mayores a cero", "error");
      return;
    }
    if (boleta.tipoPago !== "Contado" && cuotaInvalida) {
      showToast(
        "Todos los montos de las cuotas deben ser mayores a cero",
        "error",
      );
      return;
    }
    if (
      boleta.tipoPago === "Contado" &&
      Math.abs(sumaPagos - totales.total) > 0.01
    ) {
      showToast(
        `Pagos (${simbolo} ${sumaPagos.toFixed(2)}) no coincide con el total (${simbolo} ${totales.total.toFixed(2)})`,
        "error",
      );
      return;
    }
    if (
      boleta.tipoPago === "Credito" &&
      Math.abs(sumaCuotas - totales.total) > 0.01
    ) {
      showToast(
        `Cuotas (${simbolo} ${sumaCuotas.toFixed(2)}) no coincide con el total (${simbolo} ${totales.total.toFixed(2)})`,
        "error",
      );
      return;
    }
    if (
      boleta.tipoPago === "CreditoInicial" &&
      Math.abs(sumaPagos + sumaCuotas - totales.total) > 0.01
    ) {
      showToast(
        `Pago inicial (${simbolo} ${sumaPagos.toFixed(2)}) + cuotas (${simbolo} ${sumaCuotas.toFixed(2)}) no coincide con el total (${simbolo} ${totales.total.toFixed(2)})`,
        "error",
      );
      return;
    }

    setEmitiendo(true);
    setErrorEmision(null);
    try {
      const boletaFinal = prepararBoleta();

      // Primera API: solo guarda en BD
      const resBoleta = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/GenerarXml`,
        boletaFinal,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const comprobanteId = resBoleta.data.comprobanteId;

      // ✅ Guardar id ANTES de llamar a SUNAT
      setComprobanteIdEmitido(comprobanteId);

      if (!enviarEnResumen) {
        // Segunda API: enviar a SUNAT
        await enviarASunat(comprobanteId);
      } else {
        showToast("Boleta guardada como pendiente en resumen", "success");
        setEmitido(true);
        procesarSegundoPlano(comprobanteId);
      }
    } catch (err: any) {
      const data = err?.response?.data;
      const mensaje =
        data?.mensaje ?? data?.message ?? "Error al generar el comprobante";
      const detalle = data?.detalle;
      setErrorEmision(detalle ? `${mensaje}: ${detalle}` : mensaje);
      showToast("Error al generar el comprobante.", "error");
    } finally {
      setEmitiendo(false);
    }
  };

  // ── Enviar a SUNAT ───────────────────────────────────────────
  const enviarASunat = async (comprobanteId: number) => {
    try {
      const resSunat = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteId}/enviar-sunat`,
        null,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (resSunat.data.exitoso) {
        // SUNAT aceptó
        showToast(
          resSunat.data.mensaje ?? "Boleta emitida correctamente.",
          "success",
        );
        setEmitido(true);
        procesarSegundoPlano(comprobanteId);
      } else {
        // SUNAT rechazó
        const serieCorrelativo = `${boleta.serie}-${boleta.correlativo}`;
        setErrorEmision(
          resSunat.data.mensaje ?? "Comprobante rechazado por SUNAT",
        );
        showToast(`La boleta ${serieCorrelativo} fue rechazada.`, "error");
        setEmitido(true);
        procesarSegundoPlano(comprobanteId);
      }
    } catch {
      // SUNAT no responde / timeout — reintento silencioso
      const serieCorrelativo = `${boleta.serie}-${boleta.correlativo}`;
      setErrorEmision("No se pudo conectar con SUNAT.");
      showToast(
        `La boleta ${serieCorrelativo} fue generada. Verificar estado en sección Comprobantes.`,
        "error",
      );
      setEmitido(true);
      procesarSegundoPlano(comprobanteId);
      reintentarEnSegundoPlano(comprobanteId); // ← sin await
    }
  };

  // ── Reintento silencioso — solo si SUNAT no responde ────────
  const reintentarEnSegundoPlano = async (comprobanteId: number) => {
    await new Promise((res) => setTimeout(res, 3000));
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteId}/enviar-sunat`,
        null,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
    } catch {
      // silencioso
    }
  };

  const procesarSegundoPlano = async (comprobanteId: number) => {
    setCargandoPreview(true);
    try {
      const resA4 = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteId}/pdf?tamano=A4`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (resA4.ok) {
        const blob = await resA4.blob();
        setPdfA4Url(
          URL.createObjectURL(new Blob([blob], { type: "application/pdf" })),
        );
      }
    } catch {
      showToast("Error al cargar el PDF", "error");
    } finally {
      setCargandoPreview(false);
    }

    try {
      const resTicket = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteId}/pdf?tamano=Ticket58mm`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (resTicket.ok) {
        const blob = await resTicket.blob();
        const ticketUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
        setPdfTicketUrl(ticketUrl);
        // ── Imprimir automáticamente en ticket 58mm ──
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = ticketUrl;
        document.body.appendChild(iframe);
        iframe.onload = () => {
          iframe.contentWindow?.print();
          setTimeout(() => document.body.removeChild(iframe), 1000);
        };
      }
    } catch {}

    if (
      (enviarCorreo && correoCliente) ||
      (enviarWhatsapp && telefonoCliente)
    ) {
      try {
        const corrNum = String(correlativoActual ?? 1).padStart(8, "0");
        const serieNum = `${boleta.serie}-${corrNum}`;
        const resPdf = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteId}/pdf?tamano=A4`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!resPdf.ok) throw new Error("No se pudo obtener el PDF");
        const pdfBlob = await resPdf.blob();
        const pdfFile = new File(
          [pdfBlob],
          `${empresa?.numeroDocumento}-Boleta-${serieNum}.pdf`,
          { type: "application/pdf" },
        );

        if (enviarCorreo && correoCliente) {
          const correosLista = correoCliente
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          const comprobanteJson = JSON.stringify({
            serieNumero: serieNum,
            estadoSunat: "ACEPTADO",
            items: detalles.map((d) => ({
              descripcion: d.descripcion ?? "",
              cantidad: d.cantidad ?? 1,
              precioUnitario: d.precioUnitario ?? 0,
            })),
            igv: totales.igv,
            total: totales.importeTotal,
          });
          const resultadosCorreo = await Promise.allSettled(
            correosLista.map((correo) => {
              const formData = new FormData();
              formData.append("toEmail", correo);
              formData.append(
                "toName",
                boleta.cliente?.razonSocial ?? "Cliente",
              );
              formData.append("subject", `Boleta Electrónica ${serieNum}`);
              formData.append(
                "body",
                "Se emitió la boleta electrónica por los productos/servicios indicados.",
              );
              formData.append("tipo", "3");
              formData.append("comprobanteJson", comprobanteJson);
              formData.append("adjunto", pdfFile);
              return fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/email/send`,
                {
                  method: "POST",
                  headers: { Authorization: `Bearer ${accessToken}` },
                  body: formData,
                },
              ).then((res) => {
                if (!res.ok) throw new Error(`Error correo ${correo}`);
              });
            }),
          );
          const fallidosCorreo = resultadosCorreo.filter(
            (r) => r.status === "rejected",
          ).length;
          if (fallidosCorreo === correosLista.length)
            showToast("Error al enviar por correo", "error");
          else if (fallidosCorreo > 0)
            showToast(
              `Correo enviado, pero falló ${fallidosCorreo} destinatario(s)`,
              "error",
            );
          else
            showToast(
              correosLista.length > 1
                ? `Boleta enviada a ${correosLista.length} correos`
                : "Boleta enviada por correo",
              "success",
            );
        }

        if (enviarWhatsapp && telefonoCliente) {
          try {
            const whatsappApiKey = process.env.NEXT_PUBLIC_WHATSAPP_API_KEY!;
            const whatsappBase = "https://do.velsat.pe:8443/whatsapp";
            const uploadForm = new FormData();
            uploadForm.append("file", pdfFile);
            const resUpload = await fetch(`${whatsappBase}/api/upload`, {
              method: "POST",
              headers: { "x-api-key": whatsappApiKey },
              body: uploadForm,
            });
            if (!resUpload.ok) throw new Error("No se pudo subir el PDF");
            const fileUrl = (await resUpload.json()).datos.url;
            const telefonosLista = telefonoCliente
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            const resultadosWsp = await Promise.allSettled(
              telefonosLista.map((num) => {
                const numeroFormateado = num.startsWith("51")
                  ? num
                  : `51${num}`;
                return fetch(`${whatsappBase}/api/send/single`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-api-key": whatsappApiKey,
                  },
                  body: JSON.stringify({
                    phone: numeroFormateado,
                    type: "documento",
                    file_url: fileUrl,
                    filename: `${empresa?.numeroDocumento}-Boleta-${serieNum}.pdf`,
                    mime_type: "application/pdf",
                    text: `Estimado(a) ${boleta.cliente?.razonSocial ?? ""}, adjuntamos su boleta electrónica ${serieNum}.`,
                  }),
                }).then((res) => {
                  if (!res.ok) throw new Error(`Error WhatsApp ${num}`);
                });
              }),
            );
            const fallidosWsp = resultadosWsp.filter(
              (r) => r.status === "rejected",
            ).length;
            if (fallidosWsp === telefonosLista.length)
              showToast("Error al enviar por WhatsApp", "error");
            else if (fallidosWsp > 0)
              showToast(
                `WhatsApp enviado, pero falló ${fallidosWsp} número(s)`,
                "error",
              );
            else
              showToast(
                telefonosLista.length > 1
                  ? `Boleta enviada a ${telefonosLista.length} números`
                  : "Boleta enviada por WhatsApp",
                "success",
              );
          } catch {
            showToast("Error al enviar por WhatsApp", "error");
          }
        }
      } catch {
        showToast("Error al procesar envíos", "error");
      }
    }

    const sucursalId = isSuperAdmin ? sucursal?.sucursalId : user?.sucursalID;
    const resSucursal = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL}/api/Sucursal/${sucursalId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    setCorrelativoActual(resSucursal.data.correlativoBoleta);
    setBoleta((prev) => ({
      ...prev,
      serie: resSucursal.data.serieBoleta,
      correlativo: String(resSucursal.data.correlativoBoleta).padStart(8, "0"),
    }));
  };

  // ── Nueva boleta ─────────────────────────────────────────────
  const nuevaBoleta = () => {
    sharedVentaStore.clear();

    // Estado emisión
    setEmitido(false);
    setEnviarEnResumen(false);
    setPdfA4Url(null);
    setPdfTicketUrl(null);
    setComprobanteIdEmitido(null);
    setErrorEmision(null);
    setTamanoPdf("A4");

    // Ítems
    setDetalles([]);
    setBusquedaProducto([]);
    setShowDropdownProducto([]);
    inputRefs.current = [];
    setPorConsumo(false);

    // Cliente
    setBusqueda("");
    setClienteVarios(false);

    // Contacto
    setCorreoCliente("");
    setTelefonoCliente("");
    setEnviarCorreo(false);
    setEnviarWhatsapp(false);

    // Pagos y cuotas
    setPagos([
      {
        medioPago: "Efectivo",
        monto: "",
        numeroOperacion: "",
        entidadFinanciera: "",
        observaciones: "",
      },
    ]);
    setPagosEditados([false]);
    setNumeroCuotas(1);
    setCuotas([]);

    // Descuentos y guías
    setDescuentoGlobal(0);
    setCodigoTipoDescGlobal("02");
    setGuias([]);

    // Bolsa ICBPER
    setCantidadBolsa(0);
    setShowBolsa(false);
    setAplicarIcbper(false);
    setTamañoBolsa("mediana");

    // Fecha emisión
    setFechaEmisionEditada(false);

    // Boleta base
    setBoleta((prev) => ({
      ublVersion: "2.1",
      tipoOperacion: "0101",
      tipoComprobante: "03",
      tipoMoneda: "PEN",
      tipoPago: "Contado",
      fechaEmision: formatoFechaActual().fechaHora,
      horaEmision: formatoFechaActual().fechaHora,
      fechaVencimiento: formatoFechaActual().fecha,
      serie: prev.serie,
      correlativo: String(correlativoActual ?? "1").padStart(8, "0"),
      company: prev.company,
    }));

    setTrabajadorIdGlobal(0);
    setTrabajadoresPorItem({});

    // Superadmin
    if (isSuperAdmin) {
      setSucursal(null);
      setCorrelativoActual(null);
    }
  };

  const montoRestante = (index: number) => {
    const pagado = pagos.reduce(
      (acc, p, i) => (i < index ? acc + (Number(p.monto) || 0) : acc),
      0,
    );
    return Math.max(0, totales.total - pagado).toFixed(2);
  };

  const simbolo = boleta.tipoMoneda === "USD" ? "$" : "S/";
  const serieDisplay = sucursal?.serieBoleta ?? "";
  const correlativoDisplay = String(
    correlativoActual ?? sucursal?.correlativoBoleta ?? "",
  ).padStart(8, "0");

  const longEsperadaDoc = tipoDoc === "01" ? 8 : tipoDoc === "06" ? 11 : null;
  const docInvalido =
    !clienteVarios &&
    !!busqueda &&
    longEsperadaDoc !== null &&
    busqueda.length !== longEsperadaDoc;

  const puedeEmitir =
    !emitiendo &&
    !sinSucursal &&
    !docInvalido &&
    !!boleta.cliente?.razonSocial &&
    detalles.filter((d) => !d._esIcbper).length > 0;

  const agregarItemsMonitoreo = (
    itemsGenerados: { descripcion: string; precio: number; tipo: "servicio" | "bien" }[],
  ) => {
    itemsGenerados.forEach((it) => {
      const precioBase = parseFloat(
        (it.precio / (1 + IGV_DEFAULT / 100)).toFixed(6),
      );
      const calc = calcularDetalle(
        precioBase,
        it.precio,
        1,
        IGV_DEFAULT,
        "10",
        "00",
        0,
      );
      const nuevaFila: DetalleLocal = {
        item: detalles.filter((d) => !d._esIcbper).length + 1,
        _id: crypto.randomUUID(),
        productoId: null,
        codigo: null,
        descripcion: it.descripcion,
        cantidad: 1,
        unidadMedida: it.tipo === "bien" ? "NIU" : "ZZ",
        tipoAfectacionIGV: "10",
        porcentajeIGV: IGV_DEFAULT,
        codigoTipoDescuento: "00",
        descuentoUnitario: 0,
        icbper: 0,
        factorIcbper: 0,
        _incluirIGV: true,
        _precioBase: precioBase,
        _precioVentaConIGV: it.precio,
        _precioBaseOriginal: precioBase,
        ...calc, // incluye: precioUnitario, precioVenta, baseIgv, montoIGV, totalVentaItem, valorVenta, descuentoTotal
      };
      setDetalles((prev) => [
        ...prev.filter((d) => !d._esIcbper),
        nuevaFila,
        ...prev.filter((d) => d._esIcbper),
      ]);
      setBusquedaProducto((prev) => [...prev, it.descripcion]);
      setShowDropdownProducto((prev) => [...prev, false]);
      inputRefs.current = [...inputRefs.current, null];
    });
    setShowModalMonitoreo(false);
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="space-y-2 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {cargandoComprobante && (
            <div className="flex items-center pb-3 gap-2 text-xs text-brand-blue">
              <div className="w-4 h-4 shrink-0 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
              <span>Cargando datos del comprobante...</span>
            </div>
          )}

          <Card>
            <form className="space-y-3">
              {/* ── Datos del Cliente ── */}
              <div className=" rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                    <UserRound className="w-4 h-4 text-brand-blue" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-800">
                    Datos del Cliente
                  </h3>
                  {/* Clientes varios */}
                  <label className="ml-auto flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={clienteVarios}
                      onChange={(e) => setClienteVarios(e.target.checked)}
                      className="w-3.5 h-3.5 accent-brand-blue"
                    />
                    <span className="text-xs text-gray-500">
                      Clientes Varios
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">
                      Tipo y Nº Documento
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={tipoDoc}
                        disabled={clienteVarios}
                        onChange={(e) => {
                          setTipoDoc(e.target.value);
                          setBusqueda("");
                          setShowDropdown(false);
                          setBoleta((prev) => ({
                            ...prev,
                            cliente: undefined,
                          }));
                        }}
                        className="w-1/3 py-2 px-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-brand-blue text-sm disabled:opacity-50"
                      >
                        <option value="01">DNI</option>
                        <option value="04">CE</option>
                      </select>
                      <div className="relative w-2/3">
                        <input
                          type="text"
                          value={clienteVarios ? "00000000" : busqueda}
                          disabled={clienteVarios}
                          onChange={(e) => {
                            setBusqueda(e.target.value);
                            setShowDropdown(true);
                            if (
                              e.target.value.length < busqueda.length ||
                              e.target.value === ""
                            ) {
                              setBoleta((prev) => ({
                                ...prev,
                                cliente: undefined,
                              }));
                              setCorreoCliente("");
                              setTelefonoCliente("");
                            }
                          }}
                          onFocus={() => setShowDropdown(true)}
                          onBlur={() =>
                            setTimeout(() => setShowDropdown(false), 150)
                          }
                          maxLength={
                            tipoDoc === "01" ? 8 : tipoDoc === "06" ? 11 : 12
                          }
                          placeholder="Buscar por nº doc o nombre..."
                          className={`w-full pl-4 pr-10 py-2 bg-white border rounded-xl focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all text-sm disabled:opacity-50
                            ${docInvalido ? "border-red-300 bg-red-50 focus:border-red-400" : "border-gray-200 focus:border-brand-blue"}`}
                        />
                        {loadingCliente && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
                        )}
                        {showDropdown &&
                          clientesFiltrados.length > 0 &&
                          !clienteVarios && (
                            <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                              {loadingClientes ? (
                                <p className="text-xs text-gray-400 px-4 py-3">
                                  Cargando...
                                </p>
                              ) : (
                                clientesFiltrados.map((c) => (
                                  <button
                                    key={c.clienteId}
                                    type="button"
                                    onMouseDown={() => seleccionarDeLista(c)}
                                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
                                  >
                                    <span className="text-sm text-gray-800">
                                      {c.numeroDocumento} -{" "}
                                      {c.razonSocialNombre}
                                    </span>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        disabled
                        value={
                          clienteVarios
                            ? "Clientes Varios"
                            : (boleta.cliente?.razonSocial ?? "")
                        }
                        placeholder="Nombre o razón social"
                        className="w-full py-2 px-4 bg-gray-100 border border-gray-200 rounded-xl text-gray-600 text-sm"
                      />
                      {!clienteVarios &&
                        boleta.cliente?.clienteId === null &&
                        boleta.cliente?.razonSocial && (
                          <button
                            type="button"
                            onClick={() => setShowModalCliente(true)}
                            className="w-8 h-8 shrink-0 flex items-center justify-center bg-brand-blue hover:bg-blue-700 text-white rounded-full text-lg font-bold transition-colors"
                            title="Guardar cliente"
                          >
                            +
                          </button>
                        )}
                    </div>
                    {errorCliente && (
                      <p className="text-xs text-red-500">{errorCliente}</p>
                    )}
                    {docInvalido && (
                      <p className="text-[10px] text-red-500 pl-1 mt-0.5">
                        {tipoDoc === "01"
                          ? "El DNI debe tener 8 dígitos"
                          : "El RUC debe tener 11 dígitos"}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">
                      Contacto
                    </label>
                    <div
                      className={`flex items-center gap-1.5 bg-white border rounded-xl px-3 py-2 ${enviarCorreo && !correoCliente ? "border-red-300 bg-red-50" : "border-gray-200"}`}
                    >
                      <input
                        type="text"
                        value={correoCliente}
                        placeholder="correo@cliente.com, otro@email.com"
                        disabled={!boleta.cliente?.razonSocial || clienteVarios}
                        onChange={(e) => {
                          setCorreoCliente(e.target.value);
                          if (!e.target.value) setEnviarCorreo(false);
                        }}
                        className="flex-1 bg-transparent text-sm outline-none min-w-0 placeholder:text-gray-400 disabled:opacity-40"
                      />
                      <label className="flex items-center gap-1 shrink-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enviarCorreo}
                          disabled={!correoCliente}
                          onChange={(e) => setEnviarCorreo(e.target.checked)}
                          className="w-3.5 h-3.5 accent-brand-blue"
                        />
                        <span className="text-xs text-gray-500">Enviar</span>
                      </label>
                    </div>
                    <div className="space-y-1">
                      <div
                        className={`flex items-center gap-1.5 bg-white border rounded-xl px-3 py-2 ${
                          telefonoCliente &&
                          !telefonoCliente
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)
                            .every((n) => n.startsWith("9") && n.length === 9)
                            ? "border-red-300 bg-red-50"
                            : "border-gray-200"
                        }`}
                      >
                        <input
                          type="tel"
                          value={telefonoCliente}
                          placeholder="9XXXXXXXX, 9XXXXXXXX"
                          disabled={
                            !boleta.cliente?.razonSocial || clienteVarios
                          }
                          onChange={(e) => {
                            const s = e.target.value.replace(/[^\d,]/g, "");
                            setTelefonoCliente(s);
                            const nums = s
                              .split(",")
                              .map((x) => x.trim())
                              .filter(Boolean);
                            if (
                              !nums.length ||
                              !nums.every(
                                (n) => n.startsWith("9") && n.length === 9,
                              )
                            )
                              setEnviarWhatsapp(false);
                          }}
                          className="flex-1 bg-transparent text-sm outline-none min-w-0 placeholder:text-gray-400 disabled:opacity-40"
                        />
                        <label className="flex items-center gap-1 shrink-0 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enviarWhatsapp}
                            disabled={
                              !telefonoCliente ||
                              !telefonoCliente
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean)
                                .every(
                                  (n) => n.startsWith("9") && n.length === 9,
                                )
                            }
                            onChange={(e) =>
                              setEnviarWhatsapp(e.target.checked)
                            }
                            className="w-3.5 h-3.5 accent-brand-blue"
                          />
                          <span className="text-xs text-gray-500">Enviar</span>
                        </label>
                      </div>
                      {telefonoCliente &&
                        !telefonoCliente
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .every(
                            (n) => n.startsWith("9") && n.length === 9,
                          ) && (
                          <p className="text-[10px] text-red-500 pl-1 mt-0.5">
                            Cada número debe empezar con 9 y tener 9 dígitos
                          </p>
                        )}
                    </div>
                  </div>

                  {boleta.cliente?.direccionLineal && !clienteVarios && (
                    <div className="md:col-span-2">
                      <input
                        type="text"
                        disabled
                        value={boleta.cliente?.direccionLineal ?? ""}
                        placeholder="Dirección del cliente"
                        className="w-full py-2 px-4 bg-gray-100 border border-gray-200 rounded-xl text-xs text-gray-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* ── Fechas y monedas ── */}
              <div className="grid grid-cols-4 gap-4">
                {/* FECHA DE EMISIÓN — oculto temporalmente, descomentar cuando se requiera
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">
                    Fecha y Hora de Emisión
                  </label>
                  <input
                    type="datetime-local"
                    value={
                      fechaEmisionEditada
                        ? (boleta.fechaEmision?.slice(0, 16) ?? "")
                        : horaDisplay.slice(0, 16)
                    }
                    min={(() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 2);
                      return fechaLocalISO(d);
                    })()}
                    max={fechaLocalISO()}
                    onChange={(e) => {
                      setFechaEmisionEditada(true);
                      setBoleta((prev) => ({
                        ...prev,
                        fechaEmision: e.target.value + ":00",
                        horaEmision: e.target.value + ":00",
                      }));
                    }}
                    className="w-full py-2 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all text-sm"
                  />
                  {fechaEmisionEditada && (
                    <button
                      type="button"
                      onClick={() => setFechaEmisionEditada(false)}
                      className="text-[10px] text-brand-blue hover:underline"
                    >
                      ↺ Usar hora actual
                    </button>
                  )}
                </div>
                */}
                {/* FECHA DE VENCIMIENTO — oculto temporalmente, descomentar cuando se requiera
                <div className="space-y-1.5">
                  <DatePickerLimitado
                    label="Fecha de Vencimiento"
                    modo="vencimiento"
                    value={boleta.fechaVencimiento ?? ""}
                    onChange={(val) =>
                      setBoleta((prev) => ({ ...prev, fechaVencimiento: val }))
                    }
                  />
                </div>
                */}

                {/* MONEDA — oculto temporalmente, descomentar cuando se requiera
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">
                    Moneda
                  </label>
                  <select
                    value={boleta.tipoMoneda ?? "PEN"}
                    onChange={(e) => {
                      const nueva = e.target.value,
                        anterior = boleta.tipoMoneda ?? "PEN";
                      setBoleta((prev) => ({ ...prev, tipoMoneda: nueva }));
                      if (detalles.length > 0) {
                        setDetalles((prev) =>
                          prev.map((d) => {
                            const pb = d._precioBase ?? 0;
                            const npb =
                              nueva === "USD" && anterior === "PEN"
                                ? parseFloat((pb / tipoCambio).toFixed(6))
                                : nueva === "PEN" && anterior === "USD"
                                  ? parseFloat((pb * tipoCambio).toFixed(6))
                                  : pb;
                            const ta = d.tipoAfectacionIGV ?? "10",
                              pct = d.porcentajeIGV ?? 18;
                            const npv =
                              ta === "10"
                                ? parseFloat((npb * (1 + pct / 100)).toFixed(2))
                                : npb;
                            return {
                              ...d,
                              _precioBase: npb,
                              _precioVentaConIGV: npv,
                              ...calcularDetalle(
                                npb,
                                npv,
                                d.cantidad ?? 1,
                                pct,
                                ta,
                                d.codigoTipoDescuento ?? "01",
                                d.descuentoUnitario ?? 0,
                              ),
                            };
                          }),
                        );
                      }
                    }}
                    className="w-full py-2 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue text-sm"
                  >
                    <option value="PEN">PEN - Soles</option>
                    <option value="USD">
                      USD - Dólares ({cargandoTipoCambio ? "cargando" : tipoCambio.toFixed(3)})
                    </option>
                  </select>
                </div>
                */}
                {/* TIPO DE PAGO — oculto temporalmente, descomentar cuando se requiera
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">
                    Tipo de Pago
                  </label>
                  <select
                    value={boleta.tipoPago ?? "Contado"}
                    onChange={(e) => {
                      const nuevoTipo = e.target.value;
                      setBoleta((prev) => ({
                        ...prev,
                        tipoPago: nuevoTipo,
                        ...(nuevoTipo === "Contado" && {
                          fechaVencimiento: (prev.fechaEmision ?? formatoFechaActual().fechaHora).slice(0, 10),
                        }),
                      }));
                      setPagos([
                        {
                          medioPago: "Efectivo",
                          monto: "",
                          numeroOperacion: "",
                          entidadFinanciera: "",
                          observaciones: "",
                        },
                      ]);
                      setPagosEditados([false]);
                    }}
                    className="w-full py-2 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue text-sm"
                  >
                    <option value="Contado">Contado</option>
                    <option value="Credito">Crédito</option>
                    <option value="CreditoInicial">Crédito con Inicial</option>
                  </select>
                </div>
                */}
              </div>

              {esSalonBelleza && (
                <div className="rounded-xl border border-gray-100 space-y-3 p-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                      <UserCircle className="w-4 h-4 text-purple-500" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-800">
                      Datos del Trabajador
                    </h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="text-xs text-gray-500 shrink-0">
                      Trabajador general:
                    </label>
                    <select
                      value={trabajadorIdGlobal}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        setTrabajadorIdGlobal(id);
                        const nuevo: Record<string, number> = {};
                        detalles
                          .filter((d) => !d._esIcbper)
                          .forEach((d, i) => {
                            nuevo[d._id ?? String(i)] = id;
                          });
                        setTrabajadoresPorItem(nuevo);
                      }}
                      className="flex-1 py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-purple-400"
                    >
                      <option value={0}>Seleccionar trabajador...</option>
                      {trabajadores.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nombreCompleto}
                        </option>
                      ))}
                    </select>
                  </div>

                  {detalles.filter((d) => !d._esIcbper).length > 1 && (
                    <div className="space-y-2 pt-1 border-t border-gray-100">
                      <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">
                        Asignar por servicio
                      </p>
                      {detalles
                        .filter((d) => !d._esIcbper)
                        .map((d, i) => (
                          <div
                            key={d._id ?? i}
                            className="flex items-center gap-3"
                          >
                            <span className="text-xs text-gray-600 flex-1 truncate">
                              {d.descripcion || "Sin descripción"}
                            </span>
                            <select
                              value={
                                trabajadoresPorItem[d._id ?? String(i)] ??
                                trabajadorIdGlobal
                              }
                              onChange={(e) =>
                                setTrabajadoresPorItem((prev) => ({
                                  ...prev,
                                  [d._id ?? String(i)]: Number(e.target.value),
                                }))
                              }
                              className="w-44 py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-purple-400"
                            >
                              <option value={0}>Sin asignar</option>
                              {trabajadores.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.nombreCompleto}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Pagos ── */}
              {(boleta.tipoPago === "Contado" ||
                boleta.tipoPago === "CreditoInicial") && (
                <div className="border border-gray-100 rounded-xl p-2 space-y-2 bg-gray-50/50">

                  {pagos.length === 1 ? (
                    /* ── 1 solo medio: simple, sin card ── */
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-gray-700 uppercase">Medio de Pago</label>
                        {mediosUsados.length < todosMedios.length && (
                          <button type="button" onClick={agregarPago} className="text-xs text-brand-blue hover:underline flex items-center gap-1">
                            <Plus className="w-3 h-3" /> Agregar otro medio de pago
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={pagos[0].medioPago}
                          onChange={(e) => actualizarPago(0, "medioPago", e.target.value)}
                          className="flex-1 py-1.5 px-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-brand-blue text-sm"
                        >
                          {todosMedios.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        {pagos[0].medioPago === "Transferencia" && (<>
                          <input type="text" value={pagos[0].numeroOperacion} onChange={(e) => actualizarPago(0, "numeroOperacion", e.target.value)} placeholder="Nº op." className="w-20 shrink-0 py-1.5 px-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-brand-blue text-xs" />
                          <input type="text" value={pagos[0].entidadFinanciera} onChange={(e) => actualizarPago(0, "entidadFinanciera", e.target.value)} placeholder="Banco/entidad" className="flex-1 py-1.5 px-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-brand-blue text-xs" />
                        </>)}
                      </div>
                    </div>
                  ) : (
                    /* ── 2+ medios: cards en fila ── */
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-gray-700 uppercase">Datos de Pago</label>
                        {mediosUsados.length < todosMedios.length && (
                          <button type="button" onClick={agregarPago} className="text-xs text-brand-blue hover:underline flex items-center gap-1">
                            <Plus className="w-3 h-3" /> Agregar otro medio de pago
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {pagos.map((pago, i) => (
                          <div key={i} className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 flex-1 min-w-fit">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Medio #{i + 1}</span>
                            <div className="flex items-center gap-1.5">
                              <select
                                value={pago.medioPago}
                                onChange={(e) => actualizarPago(i, "medioPago", e.target.value)}
                                className="w-28 shrink-0 py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-blue text-xs"
                              >
                                {todosMedios.map((m) => (
                                  <option key={m} value={m} disabled={mediosUsados.includes(m) && pago.medioPago !== m}>{m}</option>
                                ))}
                              </select>
                              <input type="number" min={0} value={pago.monto} placeholder={`${simbolo} 0.00`}
                                onChange={(e) => { actualizarPago(i, "monto", e.target.value); setPagosEditados((prev) => { const n = [...prev]; n[i] = e.target.value !== ""; if (pagos.length === 2) n[i === 0 ? 1 : 0] = true; return n; }); }}
                                onBlur={(e) => { if (!e.target.value || e.target.value === "0") { setPagosEditados((prev) => { const n = [...prev]; n[i] = false; return n; }); actualizarPago(i, "monto", ""); } }}
                                className="w-20 shrink-0 py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-blue text-xs"
                              />
                              {pago.medioPago === "Transferencia" && (<>
                                <input type="text" value={pago.numeroOperacion} onChange={(e) => actualizarPago(i, "numeroOperacion", e.target.value)} placeholder="Nº op." className="w-16 shrink-0 py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-blue text-xs" />
                                <input type="text" value={pago.entidadFinanciera} onChange={(e) => actualizarPago(i, "entidadFinanciera", e.target.value)} placeholder="Banco" className="w-20 shrink-0 py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-blue text-xs" />
                              </>)}
                              <button type="button" onClick={() => eliminarPago(i)} className="text-red-400 hover:text-red-600 shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {totales.total > 0 && (
                        <div className="flex justify-end">
                          <span className={`text-xs font-medium flex items-center gap-1 ${Math.abs(totalPagado - totales.total) <= 0.01 ? "text-green-600" : totalPagado > totales.total ? "text-red-600" : "text-amber-600"}`}>
                            {Math.abs(totalPagado - totales.total) <= 0.01 ? <><CheckCircle className="w-3.5 h-3.5" /> Cuadra</> : totalPagado > totales.total ? <><AlertTriangle className="w-3.5 h-3.5" /> Sobra {simbolo}{(totalPagado - totales.total).toFixed(2)}</> : <><AlertTriangle className="w-3.5 h-3.5" /> Falta {simbolo}{(totales.total - totalPagado).toFixed(2)}</>}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {boleta.tipoPago === "CreditoInicial" && (
                    <div className="flex justify-between text-xs border-t border-gray-100 pt-1">
                      <p className="text-gray-500">Total pagado: <span className="font-semibold text-gray-800">{simbolo} {totalPagado.toFixed(2)}</span></p>
                      <p className="text-gray-500">A crédito: <span className="font-semibold text-brand-blue">{simbolo} {Math.max(0, totales.total - totalPagado).toFixed(2)}</span></p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Cuotas ── */}
              {(boleta.tipoPago === "Credito" ||
                boleta.tipoPago === "CreditoInicial") && (
                <div className="border border-gray-100 rounded-xl p-4 space-y-4 bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      Cuotas de Pago
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Nº cuotas:</span>
                      <input
                        type="number"
                        min={1}
                        max={24}
                        value={numeroCuotas}
                        onChange={(e) =>
                          setNumeroCuotas(Number(e.target.value))
                        }
                        className="w-16 py-1.5 px-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-blue text-center"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    {cuotas.map((cuota, i) => (
                      <div key={i} className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400">
                            Cuota
                          </label>
                          <input
                            type="text"
                            disabled
                            value={cuota.numeroCuota}
                            className="w-full py-2 px-3 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-500 font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400">
                            Monto
                          </label>
                          <input
                            type="number"
                            value={cuota.monto}
                            placeholder="0.00"
                            onChange={(e) => {
                              const n = [...cuotas];
                              n[i].monto = e.target.value;
                              setCuotas(n);
                            }}
                            className="w-full py-2 px-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-blue"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400">
                            Fecha Vencimiento
                          </label>
                          <DatePickerLimitado
                            modo="cuota"
                            fechaMinima={
                              i > 0 ? cuotas[i - 1].fechaVencimiento : undefined
                            }
                            value={cuota.fechaVencimiento}
                            onChange={(e) => {
                              const fs = calcularFechasCuotas(
                                e,
                                cuotas.length - i,
                              );
                              setCuotas((prev) =>
                                prev.map((c, idx) =>
                                  idx < i
                                    ? c
                                    : { ...c, fechaVencimiento: fs[idx - i] },
                                ),
                              );
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Guías de Remisión — oculto temporalmente, descomentar cuando se requiera
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowGuias(!showGuias)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span className="text-xs font-bold text-gray-500 uppercase">
                    Guías de Remisión (opcional)
                  </span>
                  {showGuias ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                {showGuias && (
                  <div className="p-4 space-y-3">
                    {guias.map((g, i) => (
                      <div key={i} className="grid grid-cols-3 gap-3 items-end">
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400">
                            Tipo Doc
                          </label>
                          <select
                            value={g.tipoDoc}
                            onChange={(e) =>
                              actualizarGuia(i, "tipoDoc", e.target.value)
                            }
                            className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-brand-blue"
                          >
                            <option value="09">Guía Remisión Remitente</option>
                            <option value="31">
                              Guía Remisión Transportista
                            </option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400">
                            Serie
                          </label>
                          <input
                            type="text"
                            value={g.serie}
                            onChange={(e) =>
                              actualizarGuia(i, "serie", e.target.value)
                            }
                            placeholder="T001"
                            className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-brand-blue"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400">
                            Número
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={g.numero}
                              onChange={(e) =>
                                actualizarGuia(i, "numero", e.target.value)
                              }
                              placeholder="00000001"
                              className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-brand-blue"
                            />
                            <button
                              type="button"
                              onClick={() => eliminarGuia(i)}
                              className="text-red-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={agregarGuia}
                      className="text-xs text-brand-blue hover:underline flex items-center gap-1 pt-1"
                    >
                      <Plus className="w-3 h-3" /> Agregar guía
                    </button>
                  </div>
                )}
              </div>
              */}

              {/* ── Tabla Ítems ── */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                      <ClipboardList className="w-4 h-4 text-brand-blue" />
                    </div>
                    <label className="text-sm font-bold text-gray-800">
                      Detalle de Venta
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    {user?.ruc !== "20512134832" && (
                      <label
                        className={`flex items-center gap-1.5 select-none ${sinSucursal ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <input
                          type="checkbox"
                          checked={porConsumo}
                          onChange={(e) => {
                            if (sinSucursal) return;
                            setPorConsumo(e.target.checked);
                          }}
                          disabled={sinSucursal}
                          className="w-3.5 h-3.5 accent-brand-blue"
                        />
                        <span className="text-xs text-gray-500">
                          Por Consumo
                        </span>
                      </label>
                    )}
                    {!porConsumo && (
                      <Button
                        type="button"
                        variant="ghost"
                        className={`h-8 text-xs text-brand-blue ${sinSucursal ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} `}
                        disabled={sinSucursal}
                        onClick={agregarFila}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Agregar ítem
                      </Button>
                    )}
                    {!porConsumo && user?.ruc == "20512134832" && (
                      <button
                        type="button"
                        onClick={() => setShowModalMonitoreo(true)}
                        disabled={sinSucursal}
                        className={`flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg ${sinSucursal ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <Car className="w-3.5 h-3.5" /> Ítems por defecto
                      </button>
                    )}
                  </div>
                </div>

                <div className="border border-gray-100 rounded-xl overflow-x-auto">
                  <table
                    className="w-full text-xs"
                    style={{ minWidth: "860px" }}
                  >
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-2 text-left text-gray-500 w-6">
                          #
                        </th>
                        <th
                          className="px-2 py-2 text-left text-gray-500"
                          style={{ minWidth: "180px" }}
                        >
                          Producto
                        </th>
                        <th className="px-2 py-2 text-left text-gray-500 w-14">
                          Cód.
                        </th>
                        <th className="px-2 py-2 text-center text-gray-500 w-16">
                          U.M.
                        </th>
                        <th className="px-2 py-2 text-center text-gray-500 w-16">
                          Cant.
                        </th>
                        <th className="px-2 py-2 text-center text-gray-500 w-20">
                          Afect. IGV
                        </th>
                        <th className="px-2 py-2 text-center text-gray-500 w-22">
                          P.Venta c/IGV
                        </th>
                        <th className="px-2 py-2 text-center text-gray-500 w-16">
                          %IGV
                        </th>
                        <th className="px-2 py-2 text-right text-gray-500 w-18">
                          Desc.Unit
                        </th>
                        <th className="px-2 py-2 text-right text-gray-500 w-18">
                          Sub Total
                        </th>
                        <th className="px-2 py-2 text-right text-gray-500 w-18">
                          Total
                        </th>
                        <th className="px-2 py-2 w-6"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {detalles.length === 0 ? (
                        <tr>
                          <td
                            colSpan={13}
                            className="px-4 py-8 text-center text-xs text-gray-400"
                          >
                            Sin ítems. Haz clic en "Agregar ítem" para comenzar.
                          </td>
                        </tr>
                      ) : (
                        detalles.map((d, i) => {
                          const esPorConsumo = d._id === "por-consumo";
                          return (
                            <tr key={i} className="hover:bg-gray-50/50">
                              <td className="px-2 py-1.5 text-gray-400">
                                {i + 1}
                              </td>

                              {/* Producto */}
                              <td
                                className="px-2 py-1.5"
                                style={{
                                  overflow: "visible",
                                  position: "relative",
                                  minWidth: "180px",
                                }}
                              >
                                <textarea
                                  ref={(el) => {
                                    inputRefs.current[i] = el;
                                  }}
                                  value={busquedaProducto[i] ?? ""}
                                  disabled={!!d._esIcbper || esPorConsumo}
                                  onChange={(e) => {
                                    const nb = [...busquedaProducto];
                                    nb[i] = e.target.value;
                                    setBusquedaProducto(nb);
                                    const nd = [...showDropdownProducto];
                                    nd[i] = true;
                                    setShowDropdownProducto(nd);
                                    if (!d.productoId) {
                                      const n = [...detalles];
                                      n[i] = {
                                        ...n[i],
                                        descripcion: e.target.value,
                                      };
                                      setDetalles(n);
                                    }

                                    // Auto-grow height dynamically
                                    e.target.style.height = "auto";
                                    e.target.style.height = `${e.target.scrollHeight}px`;
                                  }}
                                  onFocus={(e) => {
                                    const nd = [...showDropdownProducto];
                                    nd[i] = true;
                                    setShowDropdownProducto(nd);
                                    setFocusedItemIndex(i);
                                    focusedItemIndexRef.current = i;

                                    // Force layout update with wrap to get correct scrollHeight synchronously
                                    const target = e.target;
                                    target.style.whiteSpace = "pre-wrap";
                                    target.style.height = "auto";
                                    target.style.height = `${target.scrollHeight}px`;
                                    target.style.whiteSpace = "";

                                    // Re-verify on next tick after React DOM updates
                                    setTimeout(() => {
                                      if (target) {
                                        target.style.height = "auto";
                                        target.style.height = `${target.scrollHeight}px`;
                                      }
                                    }, 50);
                                  }}
                                  onBlur={(e) => {
                                    const target = e.target;
                                    const blurredIndex = i;
                                    // Resetear height inline para que la clase h-6 tome efecto
                                    target.style.height = "";
                                    setTimeout(() => {
                                      // Solo limpiar el foco si no se movió ya a otro ítem
                                      if (focusedItemIndexRef.current === blurredIndex) {
                                        setFocusedItemIndex(null);
                                        focusedItemIndexRef.current = null;
                                      } else if (focusedItemIndexRef.current !== null) {
                                        // Forzar resize del nuevo ítem que ya tiene foco
                                        const el = inputRefs.current[focusedItemIndexRef.current] as HTMLTextAreaElement | null;
                                        if (el) {
                                          el.style.height = "auto";
                                          el.style.height = `${el.scrollHeight}px`;
                                        }
                                      }
                                      // Cerrar dropdown del ítem que perdió foco
                                      const nd = [...showDropdownProducto];
                                      nd[blurredIndex] = false;
                                      setShowDropdownProducto(nd);
                                    }, 200);
                                    const txt = busquedaProducto[i] ?? "";
                                    if (txt && !detalles[i]?.productoId) {
                                      const n = [...detalles];
                                      n[i] = {
                                        ...n[i],
                                        descripcion: txt,
                                        productoId: null,
                                        codigo: null,
                                      };
                                      setDetalles(n);
                                    }
                                  }}
                                  placeholder="Buscar o agregar producto..."
                                  rows={1}
                                  className={`w-full py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-brand-blue disabled:opacity-50 disabled:cursor-not-allowed resize-none transition-[border-color,box-shadow] duration-200 ${
                                    focusedItemIndex === i
                                      ? "overflow-y-hidden whitespace-pre-wrap"
                                      : "h-6 overflow-hidden whitespace-nowrap text-ellipsis"
                                  }`}
                                />
                                {showDropdownProducto[i] &&
                                  !d._esIcbper &&
                                  !esPorConsumo &&
                                  (() => {
                                    const rect =
                                      inputRefs.current[
                                        i
                                      ]?.getBoundingClientRect();
                                    const filtrados = productosSucursal.filter(
                                      (p: ProductoSucursal) =>
                                        !(busquedaProducto[i] ?? "")
                                          ? true
                                          : p.nomProducto
                                              .toLowerCase()
                                              .includes(
                                                (
                                                  busquedaProducto[i] ?? ""
                                                ).toLowerCase(),
                                              ) ||
                                            p.codigo.includes(
                                              busquedaProducto[i] ?? "",
                                            ),
                                    );
                                    if (!filtrados.length) return null;
                                    return (
                                      <div
                                        style={{
                                          position: "fixed",
                                          zIndex: 9999,
                                          top:
                                            (rect?.bottom ?? 0) +
                                            window.scrollY +
                                            4,
                                          left: rect?.left ?? 0,
                                          width: "280px",
                                        }}
                                        className="bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto"
                                      >
                                        {filtrados.map(
                                          (p: ProductoSucursal) => (
                                            <button
                                              key={p.productoId}
                                              type="button"
                                              onMouseDown={() =>
                                                seleccionarProducto(p, i)
                                              }
                                              className="w-full text-left px-3 py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50"
                                            >
                                              <p className="text-xs font-medium text-gray-800">
                                                {p.nomProducto}
                                              </p>
                                              <p className="text-[10px] text-gray-400">
                                                {p.codigo} · S/{" "}
                                                {p.sucursalProducto.precioUnitario.toFixed(
                                                  2,
                                                )}
                                                {p.tipoProducto === "BIEN" && (
                                                  <span
                                                    className={
                                                      p.sucursalProducto
                                                        .stock === 0
                                                        ? " text-red-400"
                                                        : " text-green-600"
                                                    }
                                                  ></span>
                                                )}
                                              </p>
                                            </button>
                                          ),
                                        )}
                                      </div>
                                    );
                                  })()}
                              </td>

                              <td className="px-2 py-1.5 text-gray-500 font-mono text-[10px]">
                                {d.codigo || "-"}
                              </td>

                              {/* U.M. */}
                              <td className="px-2 py-1.5">
                                {!d.productoId && !esPorConsumo ? (
                                  <select
                                    value={d.unidadMedida ?? "NIU"}
                                    onChange={(e) => {
                                      const n = [...detalles];
                                      n[i] = {
                                        ...n[i],
                                        unidadMedida: e.target.value,
                                      };
                                      setDetalles(n);
                                    }}
                                    className="w-full py-1 px-1 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-brand-blue"
                                  >
                                    <option value="NIU">NIU</option>
                                    <option value="KGM">KGM</option>
                                    <option value="LTR">LTR</option>
                                    <option value="ZZ">ZZ</option>
                                  </select>
                                ) : (
                                  <span className="text-xs text-gray-500">
                                    {d.unidadMedida || "NIU"}
                                  </span>
                                )}
                              </td>

                              {/* Cantidad */}
                              <td className="px-2 py-1.5">
                                {d._esIcbper || esPorConsumo ? (
                                  <span className="text-xs text-gray-500 text-center block">
                                    {d.cantidad}
                                  </span>
                                ) : (
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          actualizarCantidad(
                                            i,
                                            Math.max(1, (d.cantidad ?? 1) - 1),
                                          )
                                        }
                                        className="w-6 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-md text-gray-600 font-bold transition-colors"
                                      >
                                        −
                                      </button>
                                      <input
                                        type="number"
                                        min={1}
                                        value={d.cantidad ?? 1}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) =>
                                          actualizarCantidad(
                                            i,
                                            Number(e.target.value),
                                          )
                                        }
                                        className="w-10 py-1 border border-gray-200 bg-gray-50 rounded-lg text-xs text-center outline-none focus:border-brand-blue"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          actualizarCantidad(
                                            i,
                                            (d.cantidad ?? 1) + 1,
                                          )
                                        }
                                        className="w-6 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-md text-gray-600 font-bold transition-colors"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </td>

                              {/* Afect. IGV */}
                              <td className="px-2 py-1.5">
                                <select
                                  value={d.tipoAfectacionIGV ?? "10"}
                                  disabled={!!d._esIcbper || esPorConsumo}
                                  onChange={(e) =>
                                    actualizarTipoAfectacion(i, e.target.value)
                                  }
                                  className="w-full py-1 px-1 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-brand-blue"
                                >
                                  <option value="10">Grav.</option>
                                  <option value="20">Exon.</option>
                                  <option value="30">Inaf.</option>
                                </select>
                              </td>

                              {/* P.Venta c/IGV */}
                              <td className="px-2 py-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={
                                    d._precioVentaConIGV ?? d.precioVenta ?? 0
                                  }
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) =>
                                    actualizarPrecioVenta(
                                      i,
                                      Number(e.target.value),
                                    )
                                  }
                                  disabled={!!d._esIcbper}
                                  className={`w-full py-1 px-1 border rounded-lg text-xs text-right outline-none focus:border-brand-blue font-mono ${d._esIcbper ? "bg-gray-100 border-gray-100 text-gray-400 cursor-not-allowed" : "bg-gray-50 border-gray-200"}`}
                                />
                              </td>

                              {/* %IGV */}
                              <td className="px-2 py-1.5">
                                {d.tipoAfectacionIGV === "10" ? (
                                  <select
                                    value={d.porcentajeIGV ?? IGV_DEFAULT}
                                    disabled={!!d._esIcbper}
                                    onChange={(e) =>
                                      actualizarPorcentajeIGV(
                                        i,
                                        Number(e.target.value),
                                      )
                                    }
                                    className="w-full py-1 px-1 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-brand-blue"
                                  >
                                    <option value={18}>18</option>
                                    <option value={10.5}>10.5</option>
                                  </select>
                                ) : (
                                  <span className="block text-center text-gray-400 text-xs">
                                    N/A
                                  </span>
                                )}
                              </td>

                              {/* T.Desc removido visualmente */}
                              
                              {/* Desc.Unit */}
                              <td className="px-2 py-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={d.descuentoUnitario ?? 0}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) =>
                                    actualizarDescuento(
                                      i,
                                      Number(e.target.value),
                                    )
                                  }
                                  disabled={!!d._esIcbper || esPorConsumo}
                                  className={`w-full py-1 px-1 border rounded-lg text-xs text-right outline-none focus:border-brand-blue font-mono ${d._esIcbper || esPorConsumo ? "bg-gray-100 border-gray-100 text-gray-400 cursor-not-allowed" : "bg-gray-50 border-gray-200"}`}
                                />
                              </td>

                              <td className="px-2 py-1.5 text-right font-mono text-gray-700 text-xs">
                                {(d.baseIgv ?? 0).toFixed(2)}
                              </td>
                              <td className="px-2 py-1.5 text-right font-mono font-semibold text-gray-800 text-xs">
                                {(d.totalVentaItem ?? 0).toFixed(2)}
                              </td>
                              <td className="px-2 py-1.5">
                                <button
                                  type="button"
                                  onClick={() => eliminarFila(i)}
                                  className="text-red-400 hover:text-red-600"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Bolsa Plástica ── */}
              <div className="border border-amber-100 rounded-xl p-2 bg-amber-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-800">
                      ¿Desea bolsa plástica?
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowBolsa(!showBolsa)}
                      className="flex items-center gap-0.5 text-[10px] text-amber-600 hover:text-amber-800 transition-colors border border-amber-200 bg-white rounded-lg px-2 py-0.5"
                    >
                      <span>Opciones</span>
                      {showBolsa ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCantidadBolsa((prev) => Math.max(0, prev - 1))
                      }
                      className="w-7 h-7 flex items-center justify-center bg-white hover:bg-amber-100 border border-amber-200 rounded-lg text-amber-700 font-bold transition-colors"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-semibold text-amber-900">
                      {cantidadBolsa}
                    </span>
                    <button
                      type="button"
                      disabled={sinSucursal}
                      onClick={() => setCantidadBolsa((prev) => prev + 1)}
                      className="w-7 h-7 flex items-center justify-center bg-white hover:bg-amber-100 border border-amber-200 rounded-lg text-amber-700 font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                  </div>
                </div>
                {showBolsa && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-amber-700 font-medium w-14">
                        Tamaño:
                      </span>
                      <div className="flex gap-1.5">
                        {(["pequeña", "mediana", "grande"] as const).map(
                          (t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setTamañoBolsa(t)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors border ${tamañoBolsa === t ? "bg-amber-500 text-white border-amber-500" : "bg-white text-amber-700 border-amber-200 hover:bg-amber-100"}`}
                            >
                              {t.charAt(0).toUpperCase() + t.slice(1)} · S/{" "}
                              {PRECIOS_BOLSA[t].toFixed(2)}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={aplicarIcbper}
                        onChange={(e) => setAplicarIcbper(e.target.checked)}
                        className="w-3.5 h-3.5 accent-amber-500"
                      />
                      <span className="text-[10px] text-amber-700">
                        Aplicar ICBPER (S/ {ICBPER_FACTOR} por bolsa) — Total:
                        S/ {(cantidadBolsa * ICBPER_FACTOR).toFixed(2)}
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* ── Totales ── */}
              <div className="flex justify-end items-end pt-4 border-t border-gray-100">
                <div className="space-y-1.5 text-right">
                  {totales.gravadas > 0 && (
                    <div className="flex justify-end gap-8 text-sm text-gray-500">
                      <span>Op. Gravadas:</span>
                      <span className="font-medium text-gray-900 w-24">
                        {simbolo} {totales.gravadas.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {totales.exoneradas > 0 && (
                    <div className="flex justify-end gap-8 text-sm text-gray-500">
                      <span>Op. Exoneradas:</span>
                      <span className="font-medium text-gray-900 w-24">
                        {simbolo} {totales.exoneradas.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {totales.inafectas > 0 && (
                    <div className="flex justify-end gap-8 text-sm text-gray-500">
                      <span>Op. Inafectas:</span>
                      <span className="font-medium text-gray-900 w-24">
                        {simbolo} {totales.inafectas.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-end gap-8 text-sm text-gray-500">
                    <span>IGV:</span>
                    <span className="font-medium text-gray-900 w-24">
                      {simbolo} {totales.igv.toFixed(2)}
                    </span>
                  </div>
                  {totales.totalIcbper > 0 && (
                    <div className="flex justify-end gap-8 text-sm text-gray-500">
                      <span>ICBPER (Bolsas):</span>
                      <span className="font-medium text-amber-600 w-24">
                        {simbolo} {totales.totalIcbper.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {totales.totalDescuentos > 0 && (
                    <div className="flex justify-end gap-8 text-sm text-gray-500">
                      <span>Descuentos:</span>
                      <span className="font-medium text-red-500 w-24">
                        -{simbolo} {totales.totalDescuentos.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-end gap-2 items-center">
                    <span className="text-sm text-gray-500">Desc. Global:</span>
                    {/* Select oculto según requerimiento de usar solo "02" */}
                    <select
                      value={codigoTipoDescGlobal}
                      onChange={(e) => setCodigoTipoDescGlobal(e.target.value)}
                      className="hidden"
                    >
                      <option value="03">03 - No afecta base</option>
                      <option value="02">02 - Afecta base gravada</option>
                    </select>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-400">{simbolo}</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={descuentoGlobal}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) =>
                          setDescuentoGlobal(Number(e.target.value))
                        }
                        className="w-24 py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-right outline-none focus:border-brand-blue font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-8 text-[16px] font-bold text-brand-blue pt-1 border-t border-gray-100">
                    <span>Total:</span>
                    <span className="w-24">
                      {simbolo} {totales.importeTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </form>
          </Card>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-6 ">
          <Card
            title="Vista Previa"
            subtitle="Representación gráfica del comprobante"
          >
            {/* ── Serie y correlativo ── */}
            <div>
              {isSuperAdmin ? (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-600 uppercase">
                      Sucursal
                    </label>
                    <select
                      value={sucursal?.sucursalId ?? ""}
                      disabled={loadingSucursales}
                      onChange={async (e) => {
                        if (!e.target.value) {
                          setSucursal(null);
                          setCorrelativoActual(null);
                          setDetalles([]);
                          setBusquedaProducto([]);
                          setShowDropdownProducto([]);
                          setCantidadBolsa(0);
                          return;
                        }
                        const sel = sucursales.find(
                          (s: Sucursal) =>
                            s.sucursalId === Number(e.target.value),
                        );
                        if (!sel) return;
                        setSucursal(sel);
                        setDetalles([]);
                        setBusquedaProducto([]);
                        setShowDropdownProducto([]);
                        setCantidadBolsa(0);
                        const res = await axios.get(
                          `${process.env.NEXT_PUBLIC_API_URL}/api/Sucursal/${sel.sucursalId}`,
                          {
                            headers: { Authorization: `Bearer ${accessToken}` },
                          },
                        );
                        setCorrelativoActual(res.data.correlativoBoleta);
                        setBoleta((prev) => ({
                          ...prev,
                          serie: sel.serieBoleta,
                          correlativo: String(
                            res.data.correlativoBoleta,
                          ).padStart(8, "0"),
                        }));
                      }}
                      className="w-full py-2 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue text-sm"
                    >
                      <option value="">Seleccionar sucursal</option>
                      {sucursales.map((s: Sucursal) => (
                        <option key={s.sucursalId} value={s.sucursalId}>
                          {s.serieBoleta} — {s.nombre ?? s.codEstablecimiento}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Info serie con estilos compactos */}
                  <div
                    className={`flex items-center gap-2 mt-3 px-2 py-2 rounded-lg border w-full text-sm ${
                      !sucursal
                        ? "bg-amber-50 border-amber-200"
                        : serieDisplay
                          ? "bg-green-50 border-green-300"
                          : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    {!sucursal ? (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-3.5 h-3.5 shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 21h18M9 8h1m-1 4h1m4-4h1m-1 4h1M5 21V7l7-4 7 4v14" />
                        </svg>
                        <span>Elige una sucursal</span>
                      </span>
                    ) : !serieDisplay ? (
                      <span className="text-xs text-gray-400">Sin serie</span>
                    ) : (
                      <>
                        <p className="text-[11px] font-bold uppercase text-gray-500 tracking-wide">
                          Boleta:
                        </p>
                        <span className="text-xs font-mono font-semibold text-gray-800">
                          {serieDisplay}-{correlativoDisplay}
                        </span>
                      </>
                    )}
                  </div>
                </>
              ) : (
                // Caso no superadmin (estilo compacto también)
                <div
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border w-full text-sm ${
                    serieDisplay
                      ? "bg-green-50 border-green-300"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  {loadingSucursal ? (
                    <span className="text-gray-400 text-xs">Cargando...</span>
                  ) : !serieDisplay ? (
                    <span className="text-xs text-gray-400">Sin serie</span>
                  ) : (
                    <>
                      <p className="text-[11px] font-bold uppercase text-gray-500 tracking-wide">
                        Boleta:
                      </p>
                      <span className="text-xs font-mono font-semibold text-gray-800">
                        {serieDisplay}-{correlativoDisplay}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="mb-3 mt-3">
              <select
                value={tamanoPdf}
                onChange={async (e) => {
                  setTamanoPdf(e.target.value);
                  if (!comprobanteIdEmitido) return;
                  setCargandoPreview(true);
                  setPdfA4Url(null); // ← limpia el iframe anterior inmediatamente
                  try {
                    const res = await fetch(
                      `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteIdEmitido}/pdf?tamano=${e.target.value}`,
                      { headers: { Authorization: `Bearer ${accessToken}` } },
                    );
                    if (res.ok) {
                      const blob = await res.blob();
                      setPdfA4Url(
                        URL.createObjectURL(
                          new Blob([blob], { type: "application/pdf" }),
                        ),
                      );
                    }
                  } catch {
                    showToast("Error al cargar el PDF", "error");
                  } finally {
                    setCargandoPreview(false);
                  }
                }}
                className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-brand-blue"
              >
                <option value="A4">A4</option>
                <option value="Carta">Carta</option>
                <option value="Ticket80mm">Ticket 80mm</option>
                <option value="Ticket58mm">Ticket 58mm</option>
                <option value="MediaCarta">Media Carta</option>
              </select>
              <div className="mt-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 uppercase">Tipo de Pago</span>
                <span className="text-xs font-semibold text-gray-700">Contado</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Fecha y Hora de Emisión</label>
                  <input
                    type="datetime-local"
                    value={fechaEmisionEditada ? (boleta.fechaEmision?.slice(0, 16) ?? "") : horaDisplay.slice(0, 16)}
                    min={(() => { const d = new Date(); d.setDate(d.getDate() - 2); return fechaLocalISO(d); })()}
                    max={fechaLocalISO()}
                    onChange={(e) => {
                      setFechaEmisionEditada(true);
                      setBoleta((prev) => ({ ...prev, fechaEmision: e.target.value + ":00", horaEmision: e.target.value + ":00" }));
                    }}
                    className="w-full py-1.5 px-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue text-xs"
                  />
                  {fechaEmisionEditada && (
                    <button type="button" onClick={() => setFechaEmisionEditada(false)} className="text-[10px] text-brand-blue hover:underline">↺ Usar hora actual</button>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Moneda</label>
                  <select
                    value={boleta.tipoMoneda ?? "PEN"}
                    onChange={(e) => {
                      const nueva = e.target.value, anterior = boleta.tipoMoneda ?? "PEN";
                      setBoleta((prev) => ({ ...prev, tipoMoneda: nueva }));
                      if (detalles.length > 0) {
                        setDetalles((prev) => prev.map((d) => {
                          const pb = d._precioBase ?? 0;
                          const npb = nueva === "USD" && anterior === "PEN" ? parseFloat((pb / tipoCambio).toFixed(6)) : nueva === "PEN" && anterior === "USD" ? parseFloat((pb * tipoCambio).toFixed(6)) : pb;
                          const ta = d.tipoAfectacionIGV ?? "10", pct = d.porcentajeIGV ?? 18;
                          const npv = ta === "10" ? parseFloat((npb * (1 + pct / 100)).toFixed(2)) : npb;
                          return { ...d, _precioBase: npb, _precioVentaConIGV: npv, ...calcularDetalle(npb, npv, d.cantidad ?? 1, pct, ta, d.codigoTipoDescuento ?? "01", d.descuentoUnitario ?? 0) };
                        }));
                      }
                    }}
                    className="w-full py-1.5 px-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue text-xs"
                  >
                    <option value="PEN">PEN - Soles</option>
                    <option value="USD">USD - Dólares ({cargandoTipoCambio ? "cargando" : tipoCambio.toFixed(3)})</option>
                  </select>
                </div>
              </div>
            </div>
            {pdfA4Url && !cargandoPreview ? (
              <div className="space-y-3">
                <iframe
                  src={pdfA4Url}
                  className="w-full rounded-lg border border-gray-200"
                  style={{ height: "400px" }}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => window.open(pdfA4Url, "_blank")}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-violet-500 hover:bg-violet-400 active:scale-95 shadow-sm py-2.5 rounded-lg transition-all duration-200"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Abrir
                  </button>
                  <button
                    type="button"
                    disabled={descargando}
                    onClick={async () => {
                      setDescargando(true);
                      try {
                        const a = document.createElement("a");
                        a.href = pdfA4Url;
                        a.download = `${empresa?.numeroDocumento}-03-${boleta.serie}-${boleta.correlativo}.pdf`;
                        a.click();
                      } finally {
                        setTimeout(() => setDescargando(false), 1000);
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 py-2.5 rounded-lg transition-all duration-200 shadow-sm disabled:opacity-70"
                  >
                    {descargando ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                        Descargando...
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" /> Descargar
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={!pdfTicketUrl}
                    onClick={imprimirPdf}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 active:scale-95 py-2.5 rounded-lg transition-all duration-200 shadow-sm disabled:opacity-50"
                  >
                    {!pdfTicketUrl ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                        Generando...
                      </>
                    ) : (
                      <>
                        <Printer className="w-3.5 h-3.5" /> Imprimir
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : cargandoPreview ? (
              <div
                className="w-full flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200"
                style={{ height: "400px" }}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-gray-400">Cargando PDF...</p>
                </div>
              </div>
            ) : (
              <div className="h-68 bg-gray-50 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center p-4 text-center space-y-2">
                {" "}
                <div className="p-4 rounded-full bg-white shadow-sm">
                  <Printer className="w-8 h-8 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Previsualización del PDF
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Se generará automáticamente al emitir
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6 space-y-3">
              <Button
                className="w-full py-3 text-base"
                type="button"
                onClick={emitido ? nuevaBoleta : emitirComprobante}
                disabled={emitiendo || (!emitido && !puedeEmitir)}
              >
                {emitiendo ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Emitiendo...
                  </span>
                ) : emitido ? (
                  "Nueva Boleta"
                ) : (
                  "Emitir Boleta"
                )}
              </Button>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enviarEnResumen}
                  onChange={(e) => setEnviarEnResumen(e.target.checked)}
                  className="w-3.5 h-3.5 accent-brand-blue"
                />
                <span className="text-xs text-gray-500">
                  Enviar mediante resumen (Guardar doc. en BD)
                </span>
              </label>
              {sinSucursal && (
                <p className="text-xs text-amber-600 text-center">
                  Selecciona una sucursal para emitir
                </p>
              )}
              {errorEmision && (
                <p className="text-xs text-red-500 text-center">
                  {errorEmision}
                </p>
              )}
            </div>
          </Card>

          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-brand-blue shrink-0" />
            <p className="text-xs text-blue-800 leading-relaxed">
              Este comprobante será enviado automáticamente a la{" "}
              <strong>SUNAT</strong> y validado en tiempo real.
            </p>
          </div>
        </div>
      </div>

      {showModalCliente && boleta.cliente && !clienteVarios && (
        <ModalGuardarClienteBoleta
          cliente={{
            numeroDocumento: boleta.cliente.numeroDocumento ?? "",
            razonSocial: boleta.cliente.razonSocial ?? "",
            tipoDocumento: boleta.cliente.tipoDocumento ?? "",
            ubigeo: boleta.cliente.ubigeo ?? "",
            direccionLineal: boleta.cliente.direccionLineal ?? "",
            departamento: boleta.cliente.departamento ?? "",
            provincia: boleta.cliente.provincia ?? "",
            distrito: boleta.cliente.distrito ?? "",
          }}
          onGuardar={guardarCliente}
          onCerrar={() => setShowModalCliente(false)}
        />
      )}

      {showModalMonitoreo && (
        <ModalItemsVelsat
          igvPorcentaje={IGV_DEFAULT}
          onGuardar={agregarItemsMonitoreo}
          onCerrar={() => setShowModalMonitoreo(false)}
        />
      )}
    </div>
  );
}

export default function BoletaPage() {
  return (
    <Suspense fallback={null}>
      <BoletaContent />
    </Suspense>
  );
}
