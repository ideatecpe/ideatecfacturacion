"use client";
import {
  Plus,
  Trash2,
  ShieldCheck,
  Download,
  Printer,
  X,
  UserRound,
  ClipboardList,
  ExternalLink,
  Building2,
  Hash,
  UserCircle,
  Car,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useMemo, useRef } from "react";
import { formatoFechaActual } from "@/app/components/ui/formatoFecha";
import { numeroAlertas } from "@/app/components/ui/numeroAlertas";
import { useToast } from "@/app/components/ui/Toast";
import axios from "axios";
import { Cliente } from "../clientes/gestionClientes/typesCliente";
import { useClientesRuc } from "../clientes/gestionClientes/useClientesRuc";
import { useClienteBoleta } from "../operaciones/boleta/gestionBoletas/useClienteBoleta";
import { useEmpresaEmisor } from "../operaciones/boleta/gestionBoletas/useEmpresaEmisor";
import { useSucursal } from "../operaciones/boleta/gestionBoletas/useSucursal";
import { useSucursalRuc } from "../operaciones/boleta/gestionBoletas/useSucursalRuc";
import { useClienteFactura } from "../operaciones/factura/gestionFacturas/useClienteFactura";
import { ProductoSucursal } from "../productos/gestioProductos/Producto";
import { useProductosSucursal } from "../productos/gestioProductos/useProductosSucursal";
import { sharedVentaStore } from "../operaciones/sharedVentaStore";
import { cn } from "@/app/utils/cn";
import { ModalGuardarClienteBoleta } from "../operaciones/boleta/gestionBoletas/Modalguardarclienteboleta";
import { useTrabajadoresSucursal } from "../trabajadores/gestionTrabajadores/useTrabajadoresSucursal";
import { ModalItemsMonitoreo } from "@/app/components/modalEmision/Modalitemsmonitoreo";

// ── Tipos ──────────────────────────────────────────────────────
type TipoComprobante = "boleta" | "factura";

interface ItemRapido {
  id: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  precioVentaConIGV: number;
  porcentajeIGV: number;
  productoId: number | null;
  unidadMedida: string;
  codigo: string | null;
  tipoAfectacionIGV: string;
  _sucursalProductoId?: number;
  _tipoProducto?: string | null;
  _stockDisponible?: number | null;
  _esIcbper?: boolean;
}

const ICBPER_FACTOR = 0.5;
const PRECIOS_BOLSA = { pequeña: 0.1, mediana: 0.2, grande: 0.3 };
const MEDIOS_PAGO = ["Efectivo", "Tarjeta", "Yape", "Plin", "Transferencia"];

// ── Cálculo de item ────────────────────────────────────────────
function calcItem(item: ItemRapido) {
  if (item._esIcbper) {
    const baseIgv = parseFloat(
      (item.precioUnitario * item.cantidad).toFixed(2),
    );
    return {
      baseIgv,
      montoIGV: 0,
      totalVentaItem: baseIgv,
      valorVenta: baseIgv,
    };
  }

  if (item.tipoAfectacionIGV === "10") {
    const totalVentaItem = parseFloat(
      (item.precioVentaConIGV * item.cantidad).toFixed(2),
    );
    const montoIGV = parseFloat(
      (
        totalVentaItem -
        totalVentaItem / (1 + item.porcentajeIGV / 100)
      ).toFixed(2),
    );
    const baseIgv = parseFloat((totalVentaItem - montoIGV).toFixed(2));
    return { baseIgv, montoIGV, totalVentaItem, valorVenta: baseIgv };
  }

  // exonerado (20) / inafecto (30)
  const baseIgv = parseFloat((item.precioUnitario * item.cantidad).toFixed(2));
  return { baseIgv, montoIGV: 0, totalVentaItem: baseIgv, valorVenta: baseIgv };
}

export default function EmisionRapidaPage({
  tipoExterno,
}: {
  tipoExterno?: TipoComprobante;
}) {
  const { showToast } = useToast();
  const { accessToken, user } = useAuth();
  const isSuperAdmin = user?.rol === "superadmin";
  const IGV_DEFAULT = user?.igv ?? 18;

  const { empresa } = useEmpresaEmisor();

  //estado para envio por resumen
  const [enviarEnResumen, setEnviarEnResumen] = useState(false);

  //sucursales tanto para admin y superadmin
  const { sucursal, loadingSucursal } = useSucursal();
  const { sucursales, loadingSucursales } = useSucursalRuc(isSuperAdmin);

  // ── Tipo comprobante ───────────────────────────────────────
  const [tipoLocal, setTipoLocal] = useState<TipoComprobante>("boleta");
  const tipo = tipoExterno ?? tipoLocal;

  //guardar url del PDF
  const [pdfUrlEmitido, setPdfUrlEmitido] = useState<string | null>(null);
  const [pdfTicketUrl, setPdfTicketUrl] = useState<string | null>(null);

  //emitir nueva factura
  const [emitido, setEmitido] = useState(false);

  //emision items por monitoreo
  const [showModalMonitoreo, setShowModalMonitoreo] = useState(false);

  // ── Hooks cliente ──────────────────────────────────────────
  const {
    cliente: clienteBoleta,
    loadingCliente: loadingB,
    errorCliente: errorB,
    buscarCliente: buscarB,
  } = useClienteBoleta();
  const {
    cliente: clienteFactura,
    loadingCliente: loadingF,
    errorCliente: errorF,
    buscarCliente: buscarF,
  } = useClienteFactura();
  const cliente = tipo === "boleta" ? clienteBoleta : clienteFactura;
  const loadingCli = tipo === "boleta" ? loadingB : loadingF;
  const errorCli = tipo === "boleta" ? errorB : errorF;
  const buscarCli = tipo === "boleta" ? buscarB : buscarF;
  const { clientes, fetchClientes } = useClientesRuc();

  // ── Estado cliente ─────────────────────────────────────────
  const [tipoDoc, setTipoDoc] = useState("01");
  const [busqueda, setBusqueda] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [clienteVarios, setClienteVarios] = useState(false);
  const [clienteManual, setClienteManual] = useState("");
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<{
    clienteId: number | null;
    tipoDocumento: string;
    numeroDocumento: string;
    razonSocial: string;
    ubigeo: string;
    direccionLineal: string;
    departamento: string;
    provincia: string;
    distrito: string;
  } | null>(null);
  const [correoCliente, setCorreoCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [enviarCorreo, setEnviarCorreo] = useState(false);
  const [enviarWhatsapp, setEnviarWhatsapp] = useState(false);

  //comprobante sin detalle
  const [porConsumo, setPorConsumo] = useState(false);
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);

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
          sucursalID: isSuperAdmin
            ? sucursalActual?.sucursalId
            : user?.sucursalID,
          numeroDocumento: clienteSeleccionado?.numeroDocumento,
          razonSocialNombre: clienteSeleccionado?.razonSocial,
          nombreComercial: extra.nombreComercial || "",
          telefono: extra.telefono || "",
          correo: extra.correo || "",
          tipoDocumentoId: clienteSeleccionado?.tipoDocumento,
          direccion: {
            ubigeo: clienteSeleccionado?.ubigeo || "",
            direccionLineal:
              extra.direccionLineal ||
              clienteSeleccionado?.direccionLineal ||
              "",
            departamento: clienteSeleccionado?.departamento || "",
            provincia: clienteSeleccionado?.provincia || "",
            distrito: clienteSeleccionado?.distrito || "",
            tipoDireccion: "PRINCIPAL",
          },
        },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      showToast("Cliente guardado correctamente", "success");
      setShowModalCliente(false);
      const listaActualizada = await fetchClientes();
      const clienteGuardado = listaActualizada?.find(
        (c: any) => c.numeroDocumento === clienteSeleccionado?.numeroDocumento,
      );
      setClienteSeleccionado((prev) =>
        prev
          ? {
              ...prev,
              clienteId: clienteGuardado?.clienteId ?? null,
              direccionLineal: extra.direccionLineal,
            }
          : null,
      );
      setCorreoCliente(extra.correo);
      setTelefonoCliente(extra.telefono);
    } catch {
      showToast("Error al guardar el cliente", "error");
    }
  };

  const isFirstRenderTipo = useRef(true);
  useEffect(() => {
    setTipoDoc(tipo === "factura" ? "06" : "01");
    if (isSuperAdmin) {
      setSucursalActual(null);
      setCorrelativoActual(null);
    }
    setClienteVarios(false);

    // Si ya se emitió un comprobante y se cambia el tipo, reiniciamos todo el formulario
    if (emitido) {
      resetForm();
    }

    if (isFirstRenderTipo.current) {
      isFirstRenderTipo.current = false;
      return;
    }

    setBusqueda("");
    setClienteSeleccionado(null);
    setCorreoCliente("");
    setTelefonoCliente("");
    setEnviarCorreo(false);
    setEnviarWhatsapp(false);
  }, [tipo]);

  // Cargar estado inicial desde sharedVentaStore
  useEffect(() => {
    const data = sharedVentaStore.get();

    if (data.extra) {
      if (data.extra.porConsumo !== undefined)
        setPorConsumo(data.extra.porConsumo);
      if (data.extra.cantidadBolsa !== undefined)
        setCantidadBolsa(data.extra.cantidadBolsa);
      if (data.extra.tamañoBolsa !== undefined)
        setTamañoBolsa(data.extra.tamañoBolsa);
      if (data.extra.aplicarIcbper !== undefined)
        setAplicarIcbper(data.extra.aplicarIcbper);
      if (data.extra.trabajadorIdGlobal !== undefined)
        setTrabajadorIdGlobal(data.extra.trabajadorIdGlobal);
      if (data.extra.trabajadoresPorItem !== undefined)
        setTrabajadoresPorItem(data.extra.trabajadoresPorItem);
    }

    if (data.items && data.items.length > 0) {
      const mapped = data.items.map((i) => ({
        id: i.id || i._id || crypto.randomUUID(),
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario ?? i._precioBase ?? 0,
        // DetalleLocal uses 'precioVenta', ItemRapido uses 'precioVentaConIGV'
        precioVentaConIGV:
          i.precioVenta ??
          i.precioVentaConIGV ??
          i._precioVentaConIGV ??
          i.precioUnitario ??
          0,
        porcentajeIGV: i.porcentajeIGV ?? 18,
        productoId: i.productoId,
        unidadMedida: i.unidadMedida || "NIU",
        codigo: i.codigo || null,
        tipoAfectacionIGV: i.tipoAfectacionIGV || "10",
        _sucursalProductoId: i._sucursalProductoId,
        _tipoProducto: i._tipoProducto,
        _stockDisponible: i._stockDisponible,
        _esIcbper: i._esIcbper,
      }));
      if (data.extra.trabajadoresPorItem !== undefined) {
        const normalizado: Record<string, number> = {};
        mapped.forEach((item: any, i: number) => {
          const claveOriginal = item._id ?? String(i);
          const valor =
            data.extra.trabajadoresPorItem[claveOriginal] ??
            data.extra.trabajadoresPorItem[String(i)];
          if (valor) normalizado[item.id] = valor;
        });
        setTrabajadoresPorItem(normalizado);
      }
      setItems(mapped);
      setBusquedaProducto(mapped.map((i) => i.descripcion || ""));
      setShowDropdownProducto(mapped.map(() => false));
    }
    if (data.cliente) {
      if (
        tipoExterno === "factura" &&
        data.cliente.tipoDocumento !== "06" &&
        data.cliente.tipoDocumento !== "04"
      ) {
        // no cargar cliente inválido para factura
      } else {
        setClienteSeleccionado(data.cliente);
        if (data.cliente.tipoDocumento) setTipoDoc(data.cliente.tipoDocumento);
        if (data.cliente.numeroDocumento)
          setBusqueda(data.cliente.numeroDocumento);
      }
    }
  }, []);

  // Sincronizar cliente desde hook (búsqueda API)
  useEffect(() => {
    if (!cliente) return;
    setNoEncontrado(false);
    setClienteSeleccionado({
      clienteId: null,
      tipoDocumento: (cliente as any).tipoDocumento ?? tipoDoc,
      numeroDocumento: (cliente as any).numeroDocumento ?? "",
      razonSocial: (cliente as any).razonSocial ?? "",
      ubigeo: (cliente as any).ubigeo ?? "",
      direccionLineal: (cliente as any).direccionLineal ?? "",
      departamento: (cliente as any).departamento ?? "",
      provincia: (cliente as any).provincia ?? "",
      distrito: (cliente as any).distrito ?? "",
    });
    setCorreoCliente("");
    setTelefonoCliente("");
    setEnviarCorreo(false);
    setEnviarWhatsapp(false);
  }, [cliente]);

  useEffect(() => {
    if (emitido) {
      sharedVentaStore.clear();
    }
  }, [emitido]);

  useEffect(() => {
    if (errorCli) setNoEncontrado(true);
    setErrorVisible(true);
  }, [errorCli]);

  // Clientes varios — limpia contacto, no muestra dirección
  const isFirstRenderClienteVarios = useRef(true);
  useEffect(() => {
    if (isFirstRenderClienteVarios.current) {
      isFirstRenderClienteVarios.current = false;
      if (!clienteVarios) return;
    }

    if (clienteVarios) {
      setTipoDoc("00");
      setClienteSeleccionado({
        clienteId: null,
        tipoDocumento: "0",
        numeroDocumento: "0",
        razonSocial: "Clientes Varios",
        ubigeo: "",
        direccionLineal: "",
        departamento: "",
        provincia: "",
        distrito: "",
      });
      setBusqueda("");
      setShowDropdown(false);
      setCorreoCliente("");
      setTelefonoCliente("");
      setEnviarCorreo(false);
      setEnviarWhatsapp(false);
      setErrorVisible(false);
    } else {
      setClienteSeleccionado(null);
      setBusqueda("");
      setTipoDoc(tipo === "factura" ? "06" : "01");
    }
  }, [clienteVarios]);

  // Buscar automático por longitud
  useEffect(() => {
    if (clienteVarios) return;
    const lon = tipoDoc === "01" ? 8 : tipoDoc === "06" ? 11 : 12;
    if (!lon || busqueda.length !== lon) return;
    const yaEsta = clientes.some((c) => c.numeroDocumento === busqueda);
    if (!yaEsta) buscarCli(tipoDoc, busqueda);
  }, [busqueda, tipoDoc, clientes, clienteVarios]);

  const clientesFiltrados = clientes.filter((c) => {
    if (tipo === "factura") {
      if (
        c.tipoDocumento.tipoDocumentoId !== "06" &&
        c.tipoDocumento.tipoDocumentoId !== "04"
      )
        return false;
      if (c.tipoDocumento.tipoDocumentoId !== tipoDoc) return false;
    } else {
      if (c.tipoDocumento.tipoDocumentoId !== tipoDoc) return false;
    }
    if (!busqueda) return true;
    return (
      c.numeroDocumento.includes(busqueda) ||
      c.razonSocialNombre.toLowerCase().includes(busqueda.toLowerCase())
    );
  });

  const seleccionarDeLista = (c: Cliente) => {
    setBusqueda(c.numeroDocumento);
    setShowDropdown(false);
    const dir = c.direccion?.[0];
    setCorreoCliente(c.correo ?? "");
    setTelefonoCliente(c.telefono ?? "");
    setEnviarCorreo(false);
    setEnviarWhatsapp(false);
    setClienteSeleccionado({
      clienteId: c.clienteId,
      tipoDocumento: c.tipoDocumento.tipoDocumentoId,
      numeroDocumento: c.numeroDocumento,
      razonSocial: c.razonSocialNombre,
      ubigeo: dir?.ubigeo ?? "",
      direccionLineal: dir?.direccionLineal ?? "",
      departamento: dir?.departamento ?? "",
      provincia: dir?.provincia ?? "",
      distrito: dir?.distrito ?? "",
    });
  };

  // ── Serie / correlativo ────────────────────────────────────
  const [sucursalActual, setSucursalActual] = useState<any>(null);
  const [correlativoActual, setCorrelativoActual] = useState<number | null>(
    null,
  );

  const RUC_TRABAJADORES = "10073587382";
  const esSalonBelleza = user?.ruc === RUC_TRABAJADORES;
  const sucursalIdEfectivo = isSuperAdmin
    ? (sucursalActual?.sucursalId ?? 0)
    : parseInt(user?.sucursalID ?? "0");

  const { trabajadores } = useTrabajadoresSucursal(
    esSalonBelleza ? sucursalIdEfectivo : undefined,
    esSalonBelleza,
  );
  const [trabajadorIdGlobal, setTrabajadorIdGlobal] = useState<number>(0);
  const [trabajadoresPorItem, setTrabajadoresPorItem] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    if (!trabajadorIdGlobal) return;
    setTrabajadoresPorItem((prev) => {
      const nuevo = { ...prev };
      items.forEach((item) => {
        if (!nuevo[item.id]) nuevo[item.id] = trabajadorIdGlobal;
      });
      return nuevo;
    });
  }, [trabajadorIdGlobal]);

  useEffect(() => {
    if (!sucursal) return;
    if (isSuperAdmin) return; // ← superadmin elige manualmente
    setSucursalActual(sucursal);
    setCorrelativoActual(
      tipo === "boleta"
        ? sucursal.correlativoBoleta
        : sucursal.correlativoFactura,
    );
  }, [sucursal, tipo]);

  const serie =
    tipo === "boleta"
      ? (sucursalActual?.serieBoleta ?? "")
      : (sucursalActual?.serieFactura ?? "");

  //cargamos productos de acuerdo a al rol
  const { productosSucursal, fetchProductosSucursal } = useProductosSucursal(
    isSuperAdmin ? sucursalActual?.sucursalId : undefined,
  );

  //sin sucursal seleccionada
  const sinSucursal = isSuperAdmin && !sucursalActual;

  // ── Moneda ─────────────────────────────────────────────────
  const [tipoMoneda, setTipoMoneda] = useState("PEN");
  const [tipoCambio] = useState(3.75);
  const simbolo = tipoMoneda === "USD" ? "$" : "S/";
  const monedaAnteriorRef = useRef("PEN");

  // ── Medio de pago ──────────────────────────────────────────
  const [medioPago, setMedioPago] = useState("Efectivo");

  // ── Items ──────────────────────────────────────────────────
  const [items, setItems] = useState<ItemRapido[]>([]);
  const [busquedaProducto, setBusquedaProducto] = useState<string[]>([]);
  const [showDropdownProducto, setShowDropdownProducto] = useState<boolean[]>(
    [],
  );
  const inputRefs = useRef<(HTMLInputElement | HTMLTextAreaElement | null)[]>(
    [],
  );

  // guard: skip porConsumo else-branch on first render
  const porConsumoMountedRef = useRef(false);

  //por consumo sin detalle
  useEffect(() => {
    if (porConsumo) {
      porConsumoMountedRef.current = true;
      setItems((prev) => {
        const sinBolsa = prev.filter((i) => i._esIcbper);
        const consumoItem: ItemRapido = {
          id: "por-consumo",
          descripcion: "Por Consumo",
          cantidad: 1,
          precioUnitario: 0,
          precioVentaConIGV: 0,
          porcentajeIGV: IGV_DEFAULT,
          tipoAfectacionIGV: "10",
          productoId: null,
          unidadMedida: "ZZ",
          codigo: null,
        };

        return [consumoItem, ...sinBolsa];
      });
      setBusquedaProducto((prev) => {
        const sinBolsa = prev.filter((s) => s !== "Por Consumo");
        return ["Por Consumo", ...sinBolsa];
      });
    } else {
      if (!porConsumoMountedRef.current) {
        porConsumoMountedRef.current = true;
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== "por-consumo"));
      setBusquedaProducto((prev) => prev.filter((s) => s !== "Por Consumo"));
    }
  }, [porConsumo]);

  // Al cambiar moneda — recalcular precios de items normales
  useEffect(() => {
    const anterior = monedaAnteriorRef.current;
    if (anterior === tipoMoneda) return;
    monedaAnteriorRef.current = tipoMoneda;
    if (items.length === 0) return;
    setItems((prev) =>
      prev.map((item) => {
        if (item._esIcbper) return item;
        // Recalcular desde el precio base original para evitar errores de redondeo acumulado
        let pb: number;
        if (tipoMoneda === "USD" && anterior === "PEN") {
          pb = parseFloat((item.precioUnitario / tipoCambio).toFixed(6));
        } else if (tipoMoneda === "PEN" && anterior === "USD") {
          pb = parseFloat((item.precioUnitario * tipoCambio).toFixed(6));
        } else {
          pb = item.precioUnitario;
        }
        // Calcular precioVenta desde la base, sin redondeo intermedio
        const pv = parseFloat((pb * (1 + item.porcentajeIGV / 100)).toFixed(2));
        return { ...item, precioUnitario: pb, precioVentaConIGV: pv };
      }),
    );
  }, [tipoMoneda]);

  const agregarItemsMonitoreo = (
    itemsGenerados: { descripcion: string; precio: number }[],
  ) => {
    itemsGenerados.forEach((it) => {
      const precioBase = parseFloat(
        (it.precio / (1 + IGV_DEFAULT / 100)).toFixed(6),
      );
      const nuevo: ItemRapido = {
        id: crypto.randomUUID(),
        descripcion: it.descripcion,
        cantidad: 1,
        precioUnitario: precioBase,
        precioVentaConIGV: it.precio,
        porcentajeIGV: IGV_DEFAULT,
        tipoAfectacionIGV: "10",
        productoId: null,
        unidadMedida: "ZZ",
        codigo: null,
      };
      setItems((prev) => [
        ...prev.filter((i) => !i._esIcbper),
        nuevo,
        ...prev.filter((i) => i._esIcbper),
      ]);
      setBusquedaProducto((prev) => [...prev, it.descripcion]);
      setShowDropdownProducto((prev) => [...prev, false]);
      inputRefs.current = [...inputRefs.current, null];
    });
    setShowModalMonitoreo(false);
  };

  const agregarItem = () => {
    const nuevo: ItemRapido = {
      id: crypto.randomUUID(),
      descripcion: "",
      cantidad: 1,
      precioUnitario: 0,
      precioVentaConIGV: 0,
      porcentajeIGV: IGV_DEFAULT,
      tipoAfectacionIGV: "10",
      productoId: null,
      unidadMedida: "NIU",
      codigo: null,
    };

    setItems((prev) => [
      ...prev.filter((i) => !i._esIcbper),
      nuevo,
      ...prev.filter((i) => i._esIcbper),
    ]);
    setBusquedaProducto((prev) => {
      const sb = prev.filter((_, i) => !items[i]?._esIcbper);
      return [...sb, "", ...prev.filter((_, i) => items[i]?._esIcbper)];
    });
    setShowDropdownProducto((prev) => {
      const sb = prev.filter((_, i) => !items[i]?._esIcbper);
      return [...sb, false, ...prev.filter((_, i) => items[i]?._esIcbper)];
    });
    inputRefs.current = [
      ...inputRefs.current.filter((_, i) => !items[i]?._esIcbper),
      null,
      ...inputRefs.current.filter((_, i) => items[i]?._esIcbper),
    ];

    if (trabajadorIdGlobal) {
      setTrabajadoresPorItem((prev) => ({
        ...prev,
        [nuevo.id]: trabajadorIdGlobal,
      }));
    }
  };

  const eliminarItem = (index: number) => {
    setPorConsumo(false);
    if (items[index]?._esIcbper) {
      setCantidadBolsa(0);
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
    setBusquedaProducto((prev) => prev.filter((_, i) => i !== index));
    setShowDropdownProducto((prev) => prev.filter((_, i) => i !== index));
    inputRefs.current = inputRefs.current.filter((_, i) => i !== index);
  };

  const actualizarCampo = (
    index: number,
    campo: keyof ItemRapido,
    valor: any,
  ) => {
    setItems((prev) => {
      const nuevos = [...prev];
      const item = { ...nuevos[index], [campo]: valor };
      if (campo === "precioVentaConIGV") {
        const pv = Number(valor);
        item.precioUnitario = parseFloat(
          (pv / (1 + item.porcentajeIGV / 100)).toFixed(6),
        );
        item.precioVentaConIGV = pv;
      }
      if (campo === "porcentajeIGV") {
        const pct = Number(valor);
        item.precioUnitario = parseFloat(
          (item.precioVentaConIGV / (1 + pct / 100)).toFixed(6),
        );
        item.porcentajeIGV = pct;
      }
      nuevos[index] = item;
      return nuevos;
    });
  };

  const actualizarCantidad = (index: number, delta: number) => {
    setItems((prev) => {
      const nuevos = [...prev];
      const item = nuevos[index];
      const nueva = Math.max(1, (item.cantidad ?? 1) + delta);
      nuevos[index] = { ...item, cantidad: nueva };
      return nuevos;
    });
  };

  const seleccionarProducto = (producto: ProductoSucursal, index: number) => {
    // Bloquear duplicado — sumar cantidad al existente
    const existente = items.findIndex(
      (it, i) =>
        i !== index && it.productoId === producto.productoId && !it._esIcbper,
    );
    if (
      producto.nomProducto.toUpperCase().includes("BOLSA PLASTICA") ||
      producto.nomProducto.toUpperCase().includes("BOLSA PLÁSTICA")
    ) {
      setCantidadBolsa((prev) => prev + 1);
      eliminarItem(index);
      showToast("Usa el contador de bolsa plástica abajo", "info");
      return;
    }
    if (existente !== -1) {
      setItems((prev) => {
        const nuevos = [...prev];
        const sumado =
          (nuevos[existente].cantidad ?? 1) + (nuevos[index]?.cantidad ?? 1);
        const stock = nuevos[existente]._stockDisponible;
        nuevos[existente] = {
          ...nuevos[existente],
          cantidad: stock != null ? Math.min(sumado, stock) : sumado,
        };
        return nuevos.filter((_, i) => i !== index);
      });
      setBusquedaProducto((prev) => prev.filter((_, i) => i !== index));
      setShowDropdownProducto((prev) => prev.filter((_, i) => i !== index));
      inputRefs.current = inputRefs.current.filter((_, i) => i !== index);
      showToast(`Cantidad acumulada en ítem ${existente + 1}`, "success");
      return;
    }

    const precioSistema = producto.sucursalProducto.precioUnitario;
    const precioEnMoneda =
      tipoMoneda === "USD"
        ? parseFloat((precioSistema / tipoCambio).toFixed(6))
        : precioSistema;

    const ta = producto.tipoAfectacionIGV ?? "10";
    const pct = ta === "10" ? IGV_DEFAULT : 0;

    const precioBase =
      ta === "10" && producto.incluirIGV
        ? parseFloat((precioEnMoneda / (1 + pct / 100)).toFixed(6))
        : precioEnMoneda;

    const precioVenta =
      ta === "10"
        ? producto.incluirIGV
          ? precioEnMoneda
          : parseFloat((precioEnMoneda * (1 + pct / 100)).toFixed(2))
        : precioEnMoneda; // exonerado/inafecto — precio venta = precio base

    setItems((prev) => {
      const nuevos = [...prev];
      nuevos[index] = {
        ...nuevos[index],
        productoId: producto.productoId,
        codigo: producto.codigo,
        descripcion: producto.nomProducto,
        unidadMedida: producto.unidadMedida,
        porcentajeIGV: pct,
        precioUnitario: precioBase,
        precioVentaConIGV: precioVenta,
        tipoAfectacionIGV: ta,
        _sucursalProductoId: producto.sucursalProducto.sucursalProductoId,
        _tipoProducto: producto.tipoProducto,
        _stockDisponible: producto.sucursalProducto.stock,
      };
      return nuevos;
    });
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

  // ── Bolsa ICBPER ───────────────────────────────────────────
  const [cantidadBolsa, setCantidadBolsa] = useState(0);
  const [tamañoBolsa, setTamañoBolsa] = useState<
    "pequeña" | "mediana" | "grande"
  >("mediana");
  const [aplicarIcbper, setAplicarIcbper] = useState(false);
  const [showBolsaOpts, setShowBolsaOpts] = useState(false);

  // before the load effect reads it (both fire on mount in order)
  const isFirstSaveRef = useRef(true);
  useEffect(() => {
    if (isFirstSaveRef.current) {
      isFirstSaveRef.current = false;
      return;
    }
    if (emitido) return;
    sharedVentaStore.save(clienteSeleccionado, items, {
      porConsumo,
      cantidadBolsa,
      tamañoBolsa,
      aplicarIcbper,
      trabajadorIdGlobal,
      trabajadoresPorItem,
    });
  }, [
    clienteSeleccionado,
    items,
    porConsumo,
    cantidadBolsa,
    tamañoBolsa,
    aplicarIcbper,
  ]);

  const bolsaMountedRef = useRef(false);
  useEffect(() => {
    if (productosSucursal.length === 0) return;

    if (!bolsaMountedRef.current) {
      bolsaMountedRef.current = true;
      if (cantidadBolsa === 0) return;
    }

    const productoBolsa = productosSucursal.find(
      (p: ProductoSucursal) =>
        p.nomProducto.toUpperCase().includes("BOLSA PLASTICA") ||
        p.nomProducto.toUpperCase().includes("BOLSA PLÁSTICA"),
    );

    setItems((prev) => {
      const sinBolsa = prev.filter((d) => !d._esIcbper);
      if (cantidadBolsa === 0) return sinBolsa;
      const precioConIGV = PRECIOS_BOLSA[tamañoBolsa];
      const bolsaItem: ItemRapido = {
        id: "bolsa-icbper",
        productoId: productoBolsa?.productoId ?? null,
        codigo: productoBolsa?.codigo ?? "BOLSA",
        descripcion: `${productoBolsa?.nomProducto ?? "BOLSA PLASTICA"} (${tamañoBolsa})`,
        cantidad: cantidadBolsa,
        unidadMedida: productoBolsa?.unidadMedida ?? "NIU",
        precioUnitario: precioConIGV,
        precioVentaConIGV: precioConIGV,
        porcentajeIGV: 0,
        tipoAfectacionIGV: "20",
        _sucursalProductoId:
          productoBolsa?.sucursalProducto?.sucursalProductoId,
        _tipoProducto: productoBolsa?.tipoProducto ?? null,
        _stockDisponible: productoBolsa?.sucursalProducto?.stock ?? null,
        _esIcbper: true,
      };

      return [...sinBolsa, bolsaItem];
    });
    setBusquedaProducto((prev) => {
      const sinBolsa = prev.filter((s) => !s.startsWith("BOLSA PLASTICA"));
      if (cantidadBolsa === 0) return sinBolsa;
      return [...sinBolsa, `BOLSA PLASTICA (${tamañoBolsa})`];
    });
  }, [cantidadBolsa, productosSucursal, tamañoBolsa, aplicarIcbper]);

  // ── Totales ────────────────────────────────────────────────
  const totales = useMemo(() => {
    let gravadas = 0,
      exoneradas = 0,
      inafectas = 0,
      igv = 0,
      totalIcbper = 0;
    for (const item of items) {
      const calc = calcItem(item);
      if (item._esIcbper) {
        exoneradas += calc.baseIgv;
        if (aplicarIcbper)
          totalIcbper += parseFloat((item.cantidad * ICBPER_FACTOR).toFixed(2));
      } else if (item.tipoAfectacionIGV === "10") {
        gravadas += calc.baseIgv;
        igv += calc.montoIGV;
      } else if (item.tipoAfectacionIGV === "20") {
        exoneradas += calc.baseIgv;
      } else if (item.tipoAfectacionIGV === "30") {
        inafectas += calc.baseIgv;
      }
    }
    gravadas = parseFloat(gravadas.toFixed(2));
    exoneradas = parseFloat(exoneradas.toFixed(2));
    inafectas = parseFloat(inafectas.toFixed(2));
    igv = parseFloat(igv.toFixed(2));
    totalIcbper = parseFloat(totalIcbper.toFixed(2));
    const valorVenta = parseFloat(
      (gravadas + exoneradas + inafectas).toFixed(2),
    );
    const importeTotal = parseFloat(
      (valorVenta + igv + totalIcbper).toFixed(2),
    );
    return {
      gravadas,
      exoneradas,
      inafectas,
      igv,
      totalIcbper,
      valorVenta,
      importeTotal,
    };
  }, [items, aplicarIcbper]);

  // ── Emitir ─────────────────────────────────────────────────
  const [emitiendo, setEmitiendo] = useState(false);
  const [errorEmision, setErrorEmision] = useState<string | null>(null);
  const [comprobanteIdEmitido, setComprobanteIdEmitido] = useState<
    number | null
  >(null);

  const emitirComprobante = async () => {
    if (!clienteSeleccionado && !clienteVarios) {
      showToast("Debe ingresar un cliente", "error");
      return;
    }

    // Validar longitud de documento
    if (!clienteVarios && clienteSeleccionado) {
      const numDoc = clienteSeleccionado.numeroDocumento;
      if (tipo === "boleta" && tipoDoc === "01" && numDoc.length !== 8) {
        showToast("El DNI debe tener exactamente 8 dígitos", "error");
        return;
      }
      if (tipo === "factura" && tipoDoc === "06" && numDoc.length !== 11) {
        showToast("El RUC debe tener exactamente 11 dígitos", "error");
        return;
      }
    }

    if (
      tipo === "factura" &&
      clienteSeleccionado?.tipoDocumento !== "06" &&
      clienteSeleccionado?.tipoDocumento !== "04"
    ) {
      showToast("Para factura el cliente debe tener RUC o CE", "error");
      return;
    }
    const itemsReales = items.filter((i) => !i._esIcbper);
    if (itemsReales.length === 0) {
      showToast("Debe agregar al menos un ítem", "error");
      return;
    }
    const sinDesc = itemsReales.findIndex((d) => !d.descripcion?.trim());
    if (sinDesc !== -1) {
      showToast(`El ítem ${sinDesc + 1} no tiene descripción`, "error");
      return;
    }
    if (enviarCorreo && !correoCliente.trim()) {
      showToast("Ingrese el correo del cliente", "error");
      return;
    }
    const sinPrecio = itemsReales.findIndex((i) => i.precioVentaConIGV <= 0);
    if (sinPrecio !== -1) {
      showToast(
        `El ítem ${sinPrecio + 1} debe tener un precio mayor a cero`,
        "error",
      );
      return;
    }

    setEmitiendo(true);
    setErrorEmision(null);

    try {
      const { fechaHora: ahora, fecha: hoy } = formatoFechaActual();
      const clienteFinal = {
        ...clienteSeleccionado,
        tipoDocumento:
          tipo === "factura" && clienteSeleccionado?.tipoDocumento === "06"
            ? "6"
            : clienteSeleccionado?.tipoDocumento,
        ubigeo: clienteSeleccionado?.ubigeo || null,
        direccionLineal: clienteSeleccionado?.direccionLineal || null,
        departamento: clienteSeleccionado?.departamento || null,
        provincia: clienteSeleccionado?.provincia || null,
        distrito: clienteSeleccionado?.distrito || null,
      };

      const details = items.map((item, idx) => {
        const calc = calcItem(item);
        const icbper =
          item._esIcbper && aplicarIcbper
            ? parseFloat((item.cantidad * ICBPER_FACTOR).toFixed(2))
            : 0;
        return {
          item: idx + 1,
          productoId: item.productoId,
          codigo: item.codigo,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          unidadMedida: item.unidadMedida,
          precioUnitario: item.precioUnitario,
          tipoAfectacionIGV: item._esIcbper
            ? "20"
            : (item.tipoAfectacionIGV ?? "10"),
          porcentajeIGV: item.porcentajeIGV,
          baseIgv: calc.baseIgv,
          montoIGV: calc.montoIGV,
          codigoTipoDescuento: "01",
          descuentoUnitario: 0,
          descuentoTotal: 0,
          valorVenta: calc.valorVenta,
          precioVenta: item.precioVentaConIGV,
          totalVentaItem: calc.totalVentaItem + icbper,
          icbper,
          factorIcbper: item._esIcbper && aplicarIcbper ? ICBPER_FACTOR : 0,
          trabajadorId: esSalonBelleza
            ? trabajadoresPorItem[item.id] || null
            : null,
        };
      });

      const moneda = tipoMoneda === "USD" ? "DÓLARES" : "SOLES";
      const payload = {
        ublVersion: "2.1",
        tipoOperacion: "0101",
        tipoComprobante: tipo === "boleta" ? "03" : "01",
        tipoMoneda,
        tipoCambio: tipoMoneda === "USD" ? tipoCambio : undefined,
        fechaEmision: ahora,
        horaEmision: ahora,
        fechaVencimiento: hoy,
        tipoPago: "Contado",
        serie,
        correlativo: String(correlativoActual ?? 1).padStart(8, "0"),
        company: {
          ...empresa,
          establecimientoAnexo:
            sucursalActual?.codEstablecimiento ??
            empresa?.establecimientoAnexo ??
            "0000",
        },
        cliente: {
          ...clienteFinal,
          correo: correoCliente || null,
          enviadoPorCorreo: enviarCorreo,
          whatsApp: telefonoCliente || null,
          enviadoPorWhatsApp: enviarWhatsapp,
        },
        details,
        pagos: [
          {
            medioPago,
            monto: totales.importeTotal,
            fechaPago: ahora,
            numeroOperacion: "",
            entidadFinanciera: "",
            observaciones: "",
          },
        ],
        cuotas: [],
        guias: [],
        totalOperacionesGravadas: totales.gravadas,
        totalOperacionesExoneradas: totales.exoneradas,
        totalOperacionesInafectas: totales.inafectas,
        totalIGV: totales.igv,
        totalIcbper: totales.totalIcbper,
        totalImpuestos: parseFloat(
          (totales.igv + totales.totalIcbper).toFixed(2),
        ),
        totalDescuentos: 0,
        subTotal: parseFloat((totales.valorVenta + totales.igv).toFixed(2)),
        importeTotal: totales.importeTotal,
        valorVenta: totales.valorVenta,
        montoCredito: 0,
        descuentoGlobal: 0,
        codigoTipoDescGlobal: "03",
        usuarioCreacion: user?.id ?? 0,
        enviadoEnResumen: tipo === "factura" ? null : enviarEnResumen,
        legends: [
          { code: "1000", value: numeroAlertas(totales.importeTotal, moneda) },
        ],
      };

      // ── 1. Generar XML y guardar en BD ──────────────────────
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/GenerarXml`,
        payload,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const comprobanteId = res.data.comprobanteId;

      // ✅ Guardar id ANTES de llamar a SUNAT
      setComprobanteIdEmitido(comprobanteId);

      // ── 2. Enviar a SUNAT o guardar en resumen ──────────────
      if (!enviarEnResumen) {
        await enviarASunat(comprobanteId);
      } else {
        showToast("Comprobante guardado como pendiente", "success");
        setEmitido(true);
        procesarSegundoPlano(comprobanteId);
      }
    } catch (err: any) {
      // Error en GenerarXml / BD — no llegó a SUNAT
      const data = err?.response?.data;
      const msg =
        data?.mensaje ?? data?.message ?? "Error al generar el comprobante";
      const det = data?.detalle;
      setErrorEmision(det ? `${msg}: ${det}` : msg);
      showToast("Error al generar el comprobante.", "error");
    } finally {
      setEmitiendo(false);
    }
  };

  const enviarASunat = async (comprobanteId: number) => {
    try {
      const resSunat = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteId}/enviar-sunat`,
        null,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (resSunat.data.exitoso) {
        showToast(
          resSunat.data.mensaje ?? "Comprobante emitido correctamente.",
          "success",
        );
        setEmitido(true);
        procesarSegundoPlano(comprobanteId);
      } else {
        // SUNAT respondió pero rechazó — sin reintento
        const serieCorrelativo = `${serie}-${String(correlativoActual ?? 1).padStart(8, "0")}`;
        setErrorEmision(
          resSunat.data.mensaje ?? "Comprobante rechazado por SUNAT",
        );
        showToast(`El comprobante ${serieCorrelativo} fue rechazado.`, "error");
        setEmitido(true);
        procesarSegundoPlano(comprobanteId);
      }
    } catch (err: any) {
      const tieneRespuesta = !!err?.response;

      if (tieneRespuesta) {
        // SUNAT respondió con error HTTP — sin reintento
        const serieCorrelativo = `${serie}-${String(correlativoActual ?? 1).padStart(8, "0")}`;
        const mensaje =
          err?.response?.data?.mensaje ?? err?.response?.data?.message ?? "";
        setErrorEmision(mensaje || "Comprobante rechazado por SUNAT");
        showToast(`El comprobante ${serieCorrelativo} fue rechazado.`, "error");
        setEmitido(true);
        procesarSegundoPlano(comprobanteId);
      } else {
        // SUNAT no responde / timeout — reintento silencioso
        const serieCorrelativo = `${serie}-${String(correlativoActual ?? 1).padStart(8, "0")}`;
        setErrorEmision("No se pudo conectar con SUNAT.");
        showToast(
          `El comprobante ${serieCorrelativo} fue generado. Verificar estado en sección Comprobantes.`,
          "error",
        );
        setEmitido(true);
        procesarSegundoPlano(comprobanteId);
        reintentarEnSegundoPlano(comprobanteId); // ← sin await
      }
    }
  };

  const procesarSegundoPlano = async (comprobanteId: number) => {
    const corrNum = String((correlativoActual ?? 1) - 1).padStart(8, "0");
    const serieNum = `${serie}-${corrNum}`;
    const esBoleta = tipo === "boleta";

    try {
      const resPdf = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteId}/pdf?tamano=A4`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!resPdf.ok) throw new Error("No se pudo obtener el PDF");
      const pdfBlob = await resPdf.blob();
      setPdfUrlEmitido(
        URL.createObjectURL(new Blob([pdfBlob], { type: "application/pdf" })),
      );

      const resTicket = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteId}/pdf?tamano=Ticket58mm`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (resTicket.ok) {
        const ticketBlob = await resTicket.blob();
        setPdfTicketUrl(
          URL.createObjectURL(
            new Blob([ticketBlob], { type: "application/pdf" }),
          ),
        );
      }

      if (
        (enviarCorreo && correoCliente) ||
        (enviarWhatsapp && telefonoCliente)
      ) {
        const pdfFile = new File(
          [pdfBlob],
          `${empresa?.numeroDocumento}-${esBoleta ? "Boleta" : "Factura"}-${serieNum}.pdf`,
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
            items: items
              .filter((i) => !i._esIcbper)
              .map((i) => ({
                descripcion: i.descripcion ?? "",
                cantidad: i.cantidad ?? 1,
                precioUnitario: i.precioVentaConIGV ?? 0,
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
                clienteSeleccionado?.razonSocial ?? "Cliente",
              );
              formData.append(
                "subject",
                `Tu ${esBoleta ? "boleta" : "factura"} ${serieNum}`,
              );
              formData.append(
                "body",
                `Adjuntamos su ${esBoleta ? "boleta de venta" : "factura"} electrónica.`,
              );
              formData.append("tipo", esBoleta ? "3" : "1");
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
                ? `Comprobante enviado a ${correosLista.length} correos`
                : "Comprobante enviado por correo",
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
                    filename: `${empresa?.numeroDocumento}-${esBoleta ? "Boleta" : "Factura"}-${serieNum}.pdf`,
                    mime_type: "application/pdf",
                    text: `Estimado(a) ${clienteSeleccionado?.razonSocial ?? ""}, adjuntamos su ${esBoleta ? "boleta de venta" : "factura"} electrónica ${serieNum}.`,
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
                  ? `Comprobante enviado a ${telefonosLista.length} números`
                  : "Documento enviado por WhatsApp",
                "success",
              );
          } catch {
            showToast("Error al enviar por WhatsApp", "error");
          }
        }
      }
    } catch {
      showToast("Error al obtener el PDF", "error");
    }

    // Correlativo
    const sucursalId = isSuperAdmin
      ? sucursalActual?.sucursalId
      : user?.sucursalID;
    const resSucursal = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL}/api/Sucursal/${sucursalId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    setCorrelativoActual(
      tipo === "boleta"
        ? resSucursal.data.correlativoBoleta
        : resSucursal.data.correlativoFactura,
    );

    // Auto-guardar cliente nuevo
    const esClienteNuevo =
      clienteSeleccionado?.clienteId === null &&
      clienteSeleccionado?.razonSocial;
    const tieneContacto =
      (correoCliente && enviarCorreo) || (telefonoCliente && enviarWhatsapp);
    if (esClienteNuevo && tieneContacto) {
      try {
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Cliente`,
          {
            sucursalID: isSuperAdmin
              ? sucursalActual?.sucursalId
              : user?.sucursalID,
            numeroDocumento: clienteSeleccionado.numeroDocumento,
            razonSocialNombre: clienteSeleccionado.razonSocial,
            nombreComercial: "",
            telefono: telefonoCliente || "",
            correo: correoCliente || "",
            tipoDocumentoId: clienteSeleccionado.tipoDocumento,
            direccion:
              clienteSeleccionado.tipoDocumento === "01"
                ? {}
                : {
                    ubigeo: clienteSeleccionado.ubigeo ?? "",
                    direccionLineal: clienteSeleccionado.direccionLineal ?? "",
                    departamento: clienteSeleccionado.departamento ?? "",
                    provincia: clienteSeleccionado.provincia ?? "",
                    distrito: clienteSeleccionado.distrito ?? "",
                    tipoDireccion: "PRINCIPAL",
                  },
          },
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
      } catch {}
    }
  };

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

  const resetForm = () => {
    sharedVentaStore.clear(); // Limpiar persistencia al reiniciar
    // ── Items ──────────────────────────────────────
    setItems([]);
    setBusquedaProducto([]);
    setShowDropdownProducto([]);
    inputRefs.current = [];
    setPorConsumo(false);

    // ── Cliente ────────────────────────────────────
    setClienteSeleccionado(null);
    setBusqueda("");
    setClienteVarios(false);
    setNoEncontrado(false);
    setClienteManual("");

    // ── Contacto ───────────────────────────────────
    setCorreoCliente("");
    setTelefonoCliente("");
    setEnviarCorreo(false);
    setEnviarWhatsapp(false);

    // ── Bolsa ──────────────────────────────────────
    setCantidadBolsa(0);
    setAplicarIcbper(false);
    setTamañoBolsa("mediana");

    // ── Pago ───────────────────────────────────────
    setMedioPago("Efectivo");

    // ── Emisión ────────────────────────────────────
    setErrorEmision(null);
    setComprobanteIdEmitido(null);
    setEmitido(false);
    setPdfUrlEmitido(null); // ← agregar
    setPdfTicketUrl(null); // ← agregar

    // ── Sucursal (solo superadmin) ─────────────────
    if (isSuperAdmin) {
      setSucursalActual(null);
      setCorrelativoActual(null);
    }

    //Envio por resumen
    setEnviarEnResumen(false);

    setTrabajadorIdGlobal(0);
    setTrabajadoresPorItem({});
  };

  const descargarPdf = async () => {
    if (!comprobanteIdEmitido) return;
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/${comprobanteIdEmitido}/pdf?tamano=A4`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          responseType: "blob",
        },
      );
      const url = URL.createObjectURL(
        new Blob([res.data], { type: "application/pdf" }),
      );
      const ruc = empresa?.numeroDocumento ?? "empresa";
      const tipoDoc = tipo === "boleta" ? "03" : "01";
      const nombreArchivo = `${ruc}-${tipoDoc}-${serie}-${String((correlativoActual ?? 1) - 1).padStart(8, "0")}.pdf`;
      const a = document.createElement("a");
      a.href = url;
      a.download = nombreArchivo;
      a.click();
    } catch {
      showToast("Error al descargar el PDF", "error");
    }
  };

  const imprimirPdf = () => {
    if (!pdfTicketUrl) return;
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = pdfTicketUrl;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    };
  };

  const longEsperadaDoc = tipoDoc === "01" ? 8 : tipoDoc === "06" ? 11 : null;
  const docInvalido =
    !clienteVarios &&
    !!busqueda &&
    longEsperadaDoc !== null &&
    busqueda.length !== longEsperadaDoc;

  //activar boton emitir
  const puedeEmitir =
    !emitiendo &&
    !sinSucursal &&
    !!serie &&
    !!correlativoActual &&
    (!!clienteSeleccionado || clienteVarios) &&
    items.filter((i) => !i._esIcbper).length > 0;

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-2 animate-in fade-in duration-500 -mt-2">
      {/* Header */}
      <div className="flex items-start justify-between">
        {/* Toggle Boleta / Factura */}
        {!tipoExterno && (
          <div className="flex items-center gap-1 bg-gray-100/80 border border-gray-200 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setTipoLocal("boleta")}
              className={`px-6 py-2 rounded-lg text-xs font-semibold transition-colors border
                ${
                  tipo === "boleta"
                    ? "bg-brand-blue text-white border-brand-blue shadow-sm"
                    : "bg-blue-50 text-brand-blue border-blue-200 hover:bg-blue-100"
                }`}
            >
              Boleta
            </button>
            <button
              type="button"
              onClick={() => setTipoLocal("factura")}
              className={`px-6 py-2 rounded-lg text-xs font-semibold transition-colors border
                ${
                  tipo === "factura"
                    ? "bg-brand-blue text-white border-brand-blue shadow-sm"
                    : "bg-blue-50 text-brand-blue border-blue-200 hover:bg-blue-100"
                }`}
            >
              Factura
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Columna izquierda ── */}
        <div className="lg:col-span-2 space-y-4 ">
          {/* ── Datos del Cliente ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2 space-y-2">
            <div className="flex items-center gap-2 ">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-sm">
                <UserRound className="w-4 h-4 text-brand-blue" />
              </div>
              <h3 className="text-sm font-bold text-gray-800">
                Datos del Cliente
              </h3>
              {tipo === "boleta" && (
                <label className="ml-auto flex items-center gap-1.5 cursor-pointer select-none ">
                  <input
                    type="checkbox"
                    checked={clienteVarios}
                    onChange={(e) => setClienteVarios(e.target.checked)}
                    className="w-3.5 h-3.5 accent-brand-blue"
                  />
                  <span className="text-xs text-gray-500">Clientes Varios</span>
                </label>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tipo doc + búsqueda */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">
                  {tipo === "factura" ? "RUC / CE" : "Tipo y Nº Documento"}
                </label>
                <div className="flex gap-2">
                  {tipo === "boleta" ? (
                    <select
                      value={tipoDoc}
                      onChange={(e) => {
                        setTipoDoc(e.target.value);
                        setBusqueda("");
                        setClienteSeleccionado(null);
                        setErrorVisible(false);
                      }}
                      disabled={clienteVarios}
                      className="w-1/3 py-2 px-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-blue disabled:opacity-50"
                    >
                      <option value="00" disabled hidden>
                        —
                      </option>
                      <option value="01">DNI</option>
                      <option value="04">CE</option>
                    </select>
                  ) : (
                    <select
                      value={tipoDoc}
                      onChange={(e) => {
                        setTipoDoc(e.target.value);
                        setBusqueda("");
                        setClienteSeleccionado(null);
                      }}
                      className="w-1/3 py-2 px-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-blue"
                    >
                      <option value="06">RUC</option>
                      <option value="04">CE</option>
                    </select>
                  )}

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
                          !e.target.value
                        ) {
                          setClienteSeleccionado(null);
                          setNoEncontrado(false);
                          setClienteManual("");
                          setCorreoCliente("");
                          setTelefonoCliente("");
                          setEnviarCorreo(false);
                          setEnviarWhatsapp(false);
                          setErrorVisible(false);
                        }
                      }}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() =>
                        setTimeout(() => setShowDropdown(false), 150)
                      }
                      maxLength={
                        tipoDoc === "01" ? 8 : tipoDoc === "06" ? 11 : 12
                      }
                      placeholder={
                        tipoDoc === "06"
                          ? "11 dígitos RUC"
                          : tipoDoc === "01"
                            ? "8 dígitos DNI"
                            : "Nº documento"
                      }
                      className={`w-full pl-4 pr-10 py-2 bg-gray-50 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-blue/10 transition-all disabled:opacity-50
                        ${docInvalido ? "border-red-300 bg-red-50 focus:border-red-400" : "border-gray-200 focus:border-brand-blue"}`}
                    />
                    {loadingCli && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
                    )}
                    {showDropdown &&
                      clientesFiltrados.length > 0 &&
                      !clienteVarios && (
                        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                          {clientesFiltrados.map((c) => (
                            <button
                              key={c.clienteId}
                              type="button"
                              onMouseDown={() => seleccionarDeLista(c)}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                            >
                              <span className="text-xs text-gray-800">
                                {c.numeroDocumento} — {c.razonSocialNombre}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    {docInvalido && (
                      <p className="text-[10px] text-red-500 pl-1 mt-1">
                        {tipoDoc === "01"
                          ? "El DNI debe tener 8 dígitos"
                          : "El RUC debe tener 11 dígitos"}
                      </p>
                    )}
                  </div>
                </div>
                {/* Razón social */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    disabled={clienteVarios || !noEncontrado}
                    value={
                      clienteVarios
                        ? "Clientes Varios"
                        : (clienteSeleccionado?.razonSocial ?? clienteManual)
                    }
                    onChange={(e) => {
                      setClienteManual(e.target.value);
                      setErrorVisible(e.target.value.length === 0);
                      setClienteSeleccionado({
                        clienteId: null,
                        tipoDocumento: tipoDoc,
                        numeroDocumento: busqueda,
                        razonSocial: e.target.value,
                        ubigeo: "",
                        direccionLineal: "",
                        departamento: "",
                        provincia: "",
                        distrito: "",
                      });
                    }}
                    placeholder="Nombre / Razón social"
                    className="w-full py-2 px-4 bg-gray-100 border border-gray-200 rounded-xl text-gray-600 text-sm"
                  />
                  {!clienteVarios &&
                    clienteSeleccionado?.clienteId === null &&
                    clienteSeleccionado?.razonSocial && (
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
                {errorCli && errorVisible && (
                  <p className="text-xs text-red-500">
                    {errorCli} Digitar nombre manualmente.
                  </p>
                )}
              </div>

              {/* Correo y teléfono */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">
                  Contacto
                </label>
                <div
                  className={`flex items-center gap-1.5 bg-gray-50 border rounded-xl px-3 py-2
                  ${enviarCorreo && !correoCliente ? "border-red-300 bg-red-50" : "border-gray-200"}`}
                >
                  <input
                    type="text"
                    value={correoCliente}
                    onChange={(e) => {
                      setCorreoCliente(e.target.value);
                      if (!e.target.value) setEnviarCorreo(false);
                    }}
                    disabled={!clienteSeleccionado || clienteVarios}
                    placeholder="correo@cliente.com, otro@email.com"
                    className="flex-1 bg-transparent text-sm outline-none min-w-0 placeholder:text-gray-400 disabled:opacity-40"
                  />
                  <label className="flex items-center gap-1 shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enviarCorreo}
                      onChange={(e) => setEnviarCorreo(e.target.checked)}
                      disabled={!correoCliente}
                      className="w-3.5 h-3.5 accent-brand-blue"
                    />
                    <span className="text-xs text-gray-500">Enviar</span>
                  </label>
                </div>
                <div className="space-y-1">
                  <div
                    className={`flex items-center gap-1.5 bg-gray-50 border rounded-xl px-3 py-2 ${
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
                      disabled={!clienteSeleccionado || clienteVarios}
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
                            .every((n) => n.startsWith("9") && n.length === 9)
                        }
                        onChange={(e) => setEnviarWhatsapp(e.target.checked)}
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
                      .every((n) => n.startsWith("9") && n.length === 9) && (
                      <p className="text-[10px] text-red-500 pl-1 mt-0.5">
                        Cada número debe empezar con 9 y tener 9 dígitos
                      </p>
                    )}
                </div>
              </div>
            </div>
          </div>

          {esSalonBelleza && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                  <UserCircle className="w-4 h-4 text-purple-500" />
                </div>
                <h3 className="text-sm font-bold text-gray-800">
                  Datos del Trabajador
                </h3>
              </div>

              {/* Select global */}
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-500 shrink-0">
                  Realizado por:
                </label>
                <select
                  value={trabajadorIdGlobal}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setTrabajadorIdGlobal(id);
                    // aplicar a todos los items
                    const nuevo: Record<string, number> = {};
                    items.forEach((item) => {
                      nuevo[item.id] = id;
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

              {/* Por item — solo si hay más de 1 servicio real */}
              {items.filter((i) => !i._esIcbper).length > 1 && (
                <div className="space-y-2 pt-1 border-t border-gray-100">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">
                    Asignar por servicio
                  </p>
                  {items
                    .filter((i) => !i._esIcbper)
                    .map((item) => (
                      <div key={item.id} className="flex items-center gap-3">
                        <span className="text-xs text-gray-600 flex-1 truncate">
                          {item.descripcion || "Sin descripción"}
                        </span>
                        <select
                          value={
                            trabajadoresPorItem[item.id] ?? trabajadorIdGlobal
                          }
                          onChange={(e) =>
                            setTrabajadoresPorItem((prev) => ({
                              ...prev,
                              [item.id]: Number(e.target.value),
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

          {/* ── Detalle de Venta ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                  {" "}
                  <ClipboardList className="w-4 h-4 text-brand-blue" />{" "}
                </div>
                <h3 className="text-sm font-bold text-gray-800">
                  Detalle de Venta
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {/* Checkbox por consumo */}
                {user?.ruc !== "20512134832" && (
                  <label
                    className={`flex items-center gap-1.5 select-none ml-2 ${sinSucursal ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
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
                    <span className="text-xs text-gray-500">Por Consumo</span>
                  </label>
                )}
                {!porConsumo && (
                  <button
                    type="button"
                    onClick={agregarItem}
                    disabled={sinSucursal}
                    className={`flex items-center gap-1 text-xs font-semibold text-brand-blue hover:text-blue-700 transition-colors bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg ${sinSucursal ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar ítem
                  </button>
                )}
                {!porConsumo && user?.ruc == "20512134832" && (
                  <button
                    type="button"
                    onClick={() => setShowModalMonitoreo(true)}
                    disabled={sinSucursal}
                    className={`flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg ${sinSucursal ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <Car className="w-3.5 h-3.5" /> Ítems por servicio
                  </button>
                )}
              </div>
            </div>

            <div className="border border-gray-100 rounded-xl overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: "560px" }}>
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-2.5 text-left text-gray-400 font-semibold w-6">
                      #
                    </th>
                    <th className="px-2 py-2.5 text-left text-gray-400 font-semibold">
                      Descripción
                    </th>
                    <th className="px-2 py-2.5 text-center text-gray-400 font-semibold w-24">
                      Cantidad
                    </th>
                    <th className="px-2 py-2.5 text-center text-gray-400 font-semibold w-16">
                      % IGV
                    </th>
                    <th className="px-2 py-2.5 text-right text-gray-400 font-semibold w-28">
                      P. Unit ({simbolo})
                    </th>
                    <th className="px-2 py-2.5 text-right text-gray-400 font-semibold w-20">
                      Total
                    </th>
                    <th className="px-2 py-2.5 w-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-xs text-gray-400"
                      >
                        Sin ítems. Haz clic en "Agregar ítem" para comenzar.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, i) => {
                      const calc = calcItem(item);
                      const icbperItem =
                        item._esIcbper && aplicarIcbper
                          ? parseFloat(
                              (item.cantidad * ICBPER_FACTOR).toFixed(2),
                            )
                          : 0;
                      const esPorConsumo = item.id === "por-consumo";
                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-gray-50/60 transition-colors"
                        >
                          <td className="px-2 py-2 text-gray-400">{i + 1}</td>

                          {/* Descripción + buscador */}
                          <td
                            className="px-2 py-2"
                            style={{
                              overflow: "visible",
                              position: "relative",
                            }}
                          >
                            <textarea
                              ref={(el) => {
                                inputRefs.current[i] = el;
                              }}
                              value={busquedaProducto[i] ?? item.descripcion}
                              disabled={item._esIcbper || esPorConsumo}
                              onChange={(e) => {
                                const nb = [...busquedaProducto];
                                nb[i] = e.target.value;
                                setBusquedaProducto(nb);
                                const nd = [...showDropdownProducto];
                                nd[i] = true;
                                setShowDropdownProducto(nd);
                                if (!item.productoId)
                                  actualizarCampo(
                                    i,
                                    "descripcion",
                                    e.target.value,
                                  );

                                // Auto-grow height dynamically
                                e.target.style.height = "auto";
                                e.target.style.height = `${e.target.scrollHeight}px`;
                              }}
                              onFocus={(e) => {
                                const nd = [...showDropdownProducto];
                                nd[i] = true;
                                setShowDropdownProducto(nd);
                                setFocusedItemIndex(i);

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
                                setTimeout(() => {
                                  const nd = [...showDropdownProducto];
                                  nd[i] = false;
                                  setShowDropdownProducto(nd);
                                  setFocusedItemIndex(null);

                                  // Reset height to single-line collapsed state
                                  if (target) {
                                    target.style.height = "";
                                  }
                                }, 200);
                                const txt = busquedaProducto[i] ?? "";
                                if (txt && !item.productoId)
                                  actualizarCampo(i, "descripcion", txt);
                              }}
                              placeholder="Buscar o escribir producto..."
                              rows={1}
                              className={`w-full py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-brand-blue disabled:opacity-50 disabled:cursor-not-allowed resize-none transition-[border-color,box-shadow] duration-200 ${
                                focusedItemIndex === i
                                  ? "overflow-y-hidden whitespace-pre-wrap"
                                  : "h-8 overflow-hidden whitespace-nowrap text-ellipsis"
                              }`}
                            />
                            {showDropdownProducto[i] &&
                              !item._esIcbper &&
                              (() => {
                                const rect =
                                  inputRefs.current[i]?.getBoundingClientRect();
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
                                    {filtrados.map((p: ProductoSucursal) => (
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
                                      </button>
                                    ))}
                                  </div>
                                );
                              })()}
                          </td>

                          {/* Cantidad con +/- */}
                          <td className="px-2 py-2">
                            {item._esIcbper || esPorConsumo ? (
                              <span className="block text-center text-gray-500">
                                {item.cantidad}
                              </span>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => actualizarCantidad(i, -1)}
                                  className="w-6 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-md text-gray-600 font-bold transition-colors"
                                >
                                  −
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  value={item.cantidad}
                                  onChange={(e) => {
                                    const v = Number(e.target.value);
                                    if (v < 1) return;
                                    actualizarCantidad(i, v - item.cantidad);
                                  }}
                                  className="w-10 py-1 border border-gray-200 rounded-lg text-xs text-center bg-gray-50 outline-none focus:border-brand-blue"
                                />
                                <button
                                  type="button"
                                  onClick={() => actualizarCantidad(i, 1)}
                                  className="w-6 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-md text-gray-600 font-bold transition-colors"
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </td>

                          {/* % IGV */}
                          <td className="px-2 py-2">
                            {item._esIcbper ||
                            item.tipoAfectacionIGV !== "10" ? (
                              <span className="block text-center text-gray-400 text-[10px]">
                                {item._esIcbper
                                  ? "Exon."
                                  : item.tipoAfectacionIGV === "20"
                                    ? "Exon."
                                    : "Inaf."}
                              </span>
                            ) : (
                              <select
                                value={item.porcentajeIGV}
                                onChange={(e) =>
                                  actualizarCampo(
                                    i,
                                    "porcentajeIGV",
                                    Number(e.target.value),
                                  )
                                }
                                className="w-full py-1.5 px-1 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-brand-blue"
                              >
                                <option value={18}>18</option>
                                <option value={10.5}>10.5</option>
                              </select>
                            )}
                          </td>

                          {/* Precio unit c/IGV */}
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.precioVentaConIGV}
                              disabled={item._esIcbper}
                              onChange={(e) =>
                                actualizarCampo(
                                  i,
                                  "precioVentaConIGV",
                                  Number(e.target.value),
                                )
                              }
                              className="w-full py-1.5 px-1 bg-gray-50 border border-gray-200 rounded-lg text-xs text-right outline-none focus:border-brand-blue font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </td>

                          {/* Total */}
                          <td className="px-2 py-2 text-right font-mono font-semibold text-gray-800">
                            {(calc.totalVentaItem + icbperItem).toFixed(2)}
                          </td>

                          <td className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() => eliminarItem(i)}
                              className="text-red-400 hover:text-red-600 transition-colors"
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

            {/* Bolsa ICBPER */}
            <div className="border border-amber-100 rounded-xl p-2 bg-amber-50/60 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-800">
                    ¿Desea bolsa plástica?
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowBolsaOpts(!showBolsaOpts)}
                    className="text-[10px] text-amber-600 hover:text-amber-800 border border-amber-200 bg-white rounded-lg px-2 py-0.5 transition-colors"
                  >
                    Opciones {showBolsaOpts ? "▲" : "▼"}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCantidadBolsa((prev) => Math.max(0, prev - 1))
                    }
                    className="w-7 h-7 flex items-center justify-center bg-white hover:bg-amber-100 border border-amber-200 rounded-lg text-amber-700 font-bold"
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
                    className="w-7 h-7 flex items-center justify-center bg-white hover:bg-amber-100 border border-amber-200 rounded-lg text-amber-700 font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
              {showBolsaOpts && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-amber-700 font-medium w-14">
                      Tamaño:
                    </span>
                    <div className="flex gap-1.5">
                      {(["pequeña", "mediana", "grande"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTamañoBolsa(t)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-colors
                            ${tamañoBolsa === t ? "bg-amber-500 text-white border-amber-500" : "bg-white text-amber-700 border-amber-200 hover:bg-amber-100"}`}
                        >
                          {t.charAt(0).toUpperCase() + t.slice(1)} · S/{" "}
                          {PRECIOS_BOLSA[t].toFixed(2)}
                        </button>
                      ))}
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
                      Aplicar ICBPER (S/ {ICBPER_FACTOR} por bolsa) — Total: S/{" "}
                      {(cantidadBolsa * ICBPER_FACTOR).toFixed(2)}
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          {/* Selector sucursal superadmin */}
          {isSuperAdmin && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">
                  Sucursal
                </label>
                {loadingSucursales && (
                  <div className="w-3 h-3 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              <select
                value={sucursalActual?.sucursalId ?? ""}
                disabled={loadingSucursales}
                onChange={async (e) => {
                  if (!e.target.value) {
                    setSucursalActual(null);
                    setCorrelativoActual(null);
                    setItems([]);
                    setBusquedaProducto([]);
                    setShowDropdownProducto([]);
                    setCantidadBolsa(0);
                    return;
                  }
                  const seleccionada = sucursales.find(
                    (s: any) => s.sucursalId === Number(e.target.value),
                  );
                  if (!seleccionada) return;
                  setSucursalActual(seleccionada);
                  setItems([]);
                  setBusquedaProducto([]);
                  setShowDropdownProducto([]);
                  setCantidadBolsa(0);

                  // Obtener correlativo actualizado
                  const res = await axios.get(
                    `${process.env.NEXT_PUBLIC_API_URL}/api/Sucursal/${seleccionada.sucursalId}`,
                    { headers: { Authorization: `Bearer ${accessToken}` } },
                  );
                  setCorrelativoActual(
                    tipo === "boleta"
                      ? res.data.correlativoBoleta
                      : res.data.correlativoFactura,
                  );
                }}
                className="w-full py-2.5 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-blue"
              >
                <option value="">Seleccionar sucursal</option>
                {sucursales.map((s: any) => (
                  <option key={s.sucursalId} value={s.sucursalId}>
                    {tipo === "boleta" ? s.serieBoleta : s.serieFactura} —{" "}
                    {s.nombre ?? s.codEstablecimiento}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Serie destacada */}

          <div
            className={cn(
              "flex items-center gap-2 px-2.5 py-2 rounded-lg border w-full text-sm",
              isSuperAdmin && !sucursalActual
                ? "bg-amber-50 border-amber-200"
                : serie
                  ? "bg-green-50 border-green-300"
                  : "bg-gray-50 border-gray-200",
            )}
          >
            {isSuperAdmin && !sucursalActual ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                <Building2 className="w-3.5 h-3.5" />
                <span>Elige una sucursal</span>
              </span>
            ) : loadingSucursal ? (
              <span className="text-gray-400 text-xs">Cargando...</span>
            ) : !serie ? (
              <span className="text-xs text-gray-400">Sin serie</span>
            ) : (
              <>
                <p className="text-[11px] font-bold uppercase text-gray-500 tracking-wide">
                  {tipo === "boleta" ? "Boleta:" : "Factura:"}
                </p>
                <span className="text-[12px] font-mono font-semibold text-gray-800">
                  {serie}-{String(correlativoActual ?? 1).padStart(8, "0")}
                </span>
              </>
            )}
          </div>

          {/* ── Medio de Pago / Moneda ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Tipo de Pago:</span>
              <span className="text-xs font-bold text-gray-800">Contado</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Medio de pago */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                  Medio de Pago
                </label>
                <select
                  value={medioPago}
                  onChange={(e) => setMedioPago(e.target.value)}
                  className="w-full py-2 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-blue"
                >
                  {MEDIOS_PAGO.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Moneda */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                  Moneda
                </label>
                <select
                  value={tipoMoneda}
                  onChange={(e) => setTipoMoneda(e.target.value)}
                  className="w-full py-2 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-blue"
                >
                  <option value="PEN">PEN — Soles</option>
                  <option value="USD">
                    USD — Dólares ({tipoCambio.toFixed(2)})
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* Resumen de Pago */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-800">Resumen de Pago</h3>

            <div className="space-y-2">
              {totales.gravadas > 0 && (
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Op. Gravadas</span>
                  <span className="font-medium text-gray-700">
                    {simbolo} {totales.gravadas.toFixed(2)}
                  </span>
                </div>
              )}
              {totales.exoneradas > 0 && (
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Op. Exoneradas</span>
                  <span className="font-medium text-gray-700">
                    {simbolo} {totales.exoneradas.toFixed(2)}
                  </span>
                </div>
              )}
              {totales.inafectas > 0 && (
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Op. Inafectas</span>
                  <span className="font-medium text-gray-700">
                    {simbolo} {totales.inafectas.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-xs text-gray-500">
                <span>
                  IGV{" "}
                  {items.filter((i) => !i._esIcbper).length > 0 && (
                    <span className="text-gray-400">
                      (
                      {[
                        ...new Set(
                          items
                            .filter((i) => !i._esIcbper)
                            .map((i) => i.porcentajeIGV),
                        ),
                      ].join("% / ")}
                      %)
                    </span>
                  )}
                </span>
                <span className="font-medium text-gray-700">
                  {simbolo} {totales.igv.toFixed(2)}
                </span>
              </div>
              {totales.totalIcbper > 0 && (
                <div className="flex justify-between text-xs text-gray-500">
                  <span>ICBPER (Bolsas)</span>
                  <span className="font-medium text-amber-600">
                    {simbolo} {totales.totalIcbper.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-brand-blue pt-3 border-t border-gray-100">
                <span>Total a Pagar</span>
                <span>
                  {simbolo} {totales.importeTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Botón emitir */}
            <button
              type="button"
              onClick={emitido ? () => resetForm() : emitirComprobante}
              disabled={emitiendo || (!emitido && !puedeEmitir)}
              className={`w-full py-2 bg-brand-blue text-white font-bold rounded-xl text-md transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-100
                ${
                  emitiendo || (!emitido && !puedeEmitir)
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-blue-700 hover:shadow-blue-200 cursor-pointer"
                }`}
            >
              {emitiendo ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                  Emitiendo...
                </>
              ) : emitido ? (
                `Nueva ${tipo === "boleta" ? "Boleta" : "Factura"}`
              ) : (
                `Emitir ${tipo === "boleta" ? "Boleta" : "Factura"}`
              )}
            </button>

            {tipo === "boleta" && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enviarEnResumen}
                  onChange={(e) => setEnviarEnResumen(e.target.checked)}
                  className="w-3.5 h-3.5 accent-brand-blue"
                />
                <span className="text-xs text-gray-500">
                  Enviar mendiante resumen (Guardar doc. en BD)
                </span>
              </label>
            )}

            {errorEmision && (
              <p className="text-[10px] text-red-500 text-center leading-relaxed">
                {errorEmision}
              </p>
            )}

            {comprobanteIdEmitido && (
              <div className="relative flex items-center gap-2 p-3 bg-linear-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl shadow-sm">
                <button
                  type="button"
                  onClick={() => window.open(pdfUrlEmitido!, "_blank")}
                  disabled={!pdfUrlEmitido}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-violet-500 hover:bg-violet-400 active:scale-95 shadow-sm py-2.5 rounded-lg transition-all duration-200 disabled:opacity-50"
                >
                  {!pdfUrlEmitido ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                      Generando...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-3.5 h-3.5" /> Abrir
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={descargarPdf}
                  disabled={!pdfUrlEmitido}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 py-2.5 rounded-lg transition-all duration-200 shadow-sm disabled:opacity-50"
                >
                  {!pdfUrlEmitido ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                      Generando...
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" /> Descargar
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={imprimirPdf}
                  disabled={!pdfTicketUrl}
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
                <button
                  type="button"
                  onClick={() => setComprobanteIdEmitido(null)}
                  className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center bg-white hover:bg-red-500 hover:text-white text-gray-400 active:scale-95 border border-gray-200 hover:border-red-500 rounded-full transition-all duration-200 shadow-sm"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Series configuradas 
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">⚙️</span>
              <h4 className="text-xs font-bold text-gray-500">Series Configuradas</h4>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className={`border rounded-xl p-3 space-y-0.5 transition-colors
                ${tipo === 'boleta' ? 'border-brand-blue bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                <p className="text-[9px] uppercase font-bold text-gray-400 tracking-wide">Boleta</p>
                <p className="text-xs font-mono font-semibold text-gray-700">
                  {sucursal?.serieBoleta ?? '—'}-{String(sucursal?.correlativoBoleta ?? 1).padStart(8, '0')}
                </p>
              </div>
              <div className={`border rounded-xl p-3 space-y-0.5 transition-colors
                ${tipo === 'factura' ? 'border-brand-blue bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                <p className="text-[9px] uppercase font-bold text-gray-400 tracking-wide">Factura</p>
                <p className="text-xs font-mono font-semibold text-gray-700">
                  {sucursal?.serieFactura ?? '—'}-{String(sucursal?.correlativoFactura ?? 1).padStart(8, '0')}
                </p>
              </div>
            </div>
          </div>*/}

          {/* SUNAT badge */}
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-brand-blue shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 leading-relaxed">
              Este comprobante será enviado automáticamente a la{" "}
              <strong>SUNAT</strong> y validado en tiempo real.
            </p>
          </div>
        </div>
      </div>

      {showModalCliente && clienteSeleccionado && !clienteVarios && (
        <ModalGuardarClienteBoleta
          cliente={{
            numeroDocumento: clienteSeleccionado.numeroDocumento ?? "",
            razonSocial: clienteSeleccionado.razonSocial ?? "",
            tipoDocumento: clienteSeleccionado.tipoDocumento ?? "",
            ubigeo: clienteSeleccionado.ubigeo ?? "",
            direccionLineal: clienteSeleccionado.direccionLineal ?? "",
            departamento: clienteSeleccionado.departamento ?? "",
            provincia: clienteSeleccionado.provincia ?? "",
            distrito: clienteSeleccionado.distrito ?? "",
          }}
          onGuardar={guardarCliente}
          onCerrar={() => setShowModalCliente(false)}
        />
      )}
      {showModalMonitoreo && (
        <ModalItemsMonitoreo
          igvPorcentaje={IGV_DEFAULT}
          onGuardar={agregarItemsMonitoreo}
          onCerrar={() => setShowModalMonitoreo(false)}
        />
      )}
    </div>
  );
}
