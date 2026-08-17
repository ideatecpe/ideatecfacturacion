"use client";
import React, { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Search,
  Upload,
  Plus,
  Trash2,
  ChevronDown,
  Package,
  Wrench,
  Download,
  CheckCircle,
  XCircle,
  Loader2,
  PackageSearch,
  FileSpreadsheet,
  Ticket,
  X,
  Pencil,
  Tag,
  Boxes,
  AlertTriangle,
  Printer,
  CalendarClock,
  ScanBarcode,
} from "lucide-react";
import axios from "axios";

import { Button } from "@/app/components/ui/Button";
import { Modal } from "@/app/components/ui/Modal";
import EscanerCodigoBarras from "@/app/components/ui/EscanerCodigoBarras";
import { ModalEliminar } from "@/app/components/ui/ModalEliminar";
import { InputBase } from "@/app/components/ui/InputBase";
import { cn } from "@/app/utils/cn";
import { coincideBusqueda } from "@/app/utils/normalizarTexto";

import { ProductoSucursal } from "../gestioProductos/Producto";
import AgregarProducto from "../gestioProductos/AgregarProducto";
import EditarProducto from "../gestioProductos/EditarProducto";
import ProductoCard from "./ProductoCard";

import { useProductosSucursal } from "../gestioProductos/useProductosSucursal";
import { useCategoriasLista } from "../gestioProductos/useCategoriasLista";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { useProductosEmpresaLista } from "../gestioProductos/useProductosEmpresaLista";
import { useSucursalRuc } from "../../operaciones/boleta/gestionBoletas/useSucursalRuc";
import { useRegistrarCategoria } from "../gestioProductos/useRegistrarCategoria";
import { DropdownFiltro } from "@/app/components/ui/DropdownFiltro";
import ModalReporteProductos from "@/app/components/modalProductos/Modalreporteproductos";
import { ModalVentasProductoExcel } from "../gestioProductos/ModalVentasProductoExcel";
import ModalImprimirEtiquetas from "../gestioProductos/ModalImprimirEtiquetas";
import { generarCodigoProducto } from "../gestioProductos/generarCodigoProducto";
import { useVales } from "../gestioProductos/useVales";
import { useEscanerGlobal } from "../../operaciones/useEscanerGlobal";
import { cacheProductos } from "@/lib/offline/offlineDb";

// Umbral de stock bajo (alerta visual) para productos normales, en unidades.
const STOCK_MINIMO_UNIDAD = 5;
// Umbral de stock bajo (alerta visual) para productos paquete/caja, en paquetes equivalentes.
const STOCK_MINIMO_PAQUETE = 2;

// Cantidad de filas por archivo a partir de la cual se recomienda dividir la importación.
// No es un límite duro: el proceso envía un producto por petición, así que un archivo muy
// grande tarda varios minutos y mantiene el modal bloqueado todo ese tiempo.
const MAX_FILAS_RECOMENDADO = 300;

// Empresas cuyos facturadores solo pueden ver el catálogo (sin editar/eliminar).
// TODO: idealmente esto debería venir de la config/permisos del backend, no quemado aquí.
const RUCS_CATALOGO_SOLO_LECTURA = ["10073587382"];

// Traduce el fallo de una fila de la importación a un motivo legible.
// Sin esto, cuando la petición no llega a responder (internet caído, API apagada)
// no hay `response` y el mensaje quedaba en un inútil "Error undefined".
function describirErrorImport(err: unknown, fila: number): string {
  if (!axios.isAxiosError(err)) return "Error inesperado en la aplicación.";

  if (!err.response) {
    return err.code === "ECONNABORTED"
      ? "El servidor tardó demasiado en responder."
      : "Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.";
  }

  const { status, data } = err.response;
  // console.debug y no console.error: una fila rechazada ("ya existe", código de
  // barras repetido) es un resultado esperado del proceso, no un fallo de la app.
  // Con console.error, el overlay de Next levantaba un "Issue" por cada fila.
  console.debug("Import fila", fila, "rechazada:", JSON.stringify(data));

  if (status === 401) return "Tu sesión expiró. Vuelve a iniciar sesión.";
  if (status === 403) return "No tienes permisos para crear productos.";

  return (
    data?.mensaje ??
    data?.message ??
    data?.title ??
    (data?.errors ? JSON.stringify(data.errors) : `Error ${status} del servidor.`)
  );
}


export default function ProductosPage() {
  const { showToast } = useToast();
  const { accessToken, user } = useAuth();
  const { config } = useConfiguracion();
  const isSuperAdmin = user?.rol === "superadmin";
  const soloLectura =
    !!user?.ruc &&
    RUCS_CATALOGO_SOLO_LECTURA.includes(user.ruc) &&
    user?.rol === "facturador";

  // ── Vales ──────────────────────────────────────────────────────
  const {
    showModalVales,
    setShowModalVales,
    vales,
    loadingVales,
    valeForm,
    setValeForm,
    editingVale,
    setEditingVale,
    showFormVale,
    setShowFormVale,
    savingVale,
    deletingValeId,
    abrirModalVales,
    abrirFormNuevoVale,
    abrirFormEditarVale,
    guardarVale,
    eliminarVale,
  } = useVales();

  //Productos de la sucursal actual
  const { productosSucursal, loadingSucursal, setProductosSucursal } =
    useProductosSucursal(null, !isSuperAdmin); // solo fetcha si no es superAdmin

  //Todos los productos de la emoresa o todas las sucursales
  const { productosEmpresa, loadingEmpresa, setProductosEmpresa } =
    useProductosEmpresaLista(isSuperAdmin); // solo fetcha si es superAdmin

  const productos = isSuperAdmin ? productosEmpresa : productosSucursal;
  const loadingProductos = isSuperAdmin ? loadingEmpresa : loadingSucursal;
  const setProductos = isSuperAdmin
    ? setProductosEmpresa
    : setProductosSucursal;

  //filtro para superadmin
  const { sucursales } = useSucursalRuc(isSuperAdmin); // solo fetcha si es superAdmin
  const [filtroSucursal, setFiltroSucursal] = useState<string>("");

  // AFiltros avanzados
  const [showFiltrosAvanzados, setShowFiltrosAvanzados] = useState(false);
  const [filtroStock, setFiltroStock] = useState(false);
  const [filtroStockBajo, setFiltroStockBajo] = useState(false);
  const [filtroPromocion, setFiltroPromocion] = useState(false);
  const [filtroPaquete, setFiltroPaquete] = useState(false);
  const [filtroVencimientoAntes, setFiltroVencimientoAntes] = useState<string>("");
  const [filtroAfectacion, setFiltroAfectacion] = useState<string[]>([]);
  const [filtroTipoProducto, setFiltroTipoProducto] = useState<string[]>([]);

  const [search, setSearch] = useState("");
  const [escaneando, setEscaneando] = useState(false);
  const [filterCategoria, setFilterCategoria] = useState("Todos");

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [editTarget, setEditTarget] = useState<ProductoSucursal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductoSucursal | null>(
    null,
  );
const [importFile, setImportFile] = useState<File | null>(null);
  const [importSucursalId, setImportSucursalId] = useState<number>(0);
  const [importando, setImportando] = useState(false);
  const [importProgreso, setImportProgreso] = useState<{
    total: number;
    actual: number;
  } | null>(null);
  const [importResultados, setImportResultados] = useState<{
    ok: string[];
    errores: { fila: number; nombre: string; error: string }[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // modal reporte y ventas
  const [isReporteOpen, setIsReporteOpen] = useState(false);
  const [isVentasProductoOpen, setIsVentasProductoOpen] = useState(false);
  const sucursalId = parseInt(user?.sucursalID ?? "0");

  // Promoción masiva: selección múltiple de productos para aplicar el mismo % de descuento
  const [modoSeleccionPromo, setModoSeleccionPromo] = useState(false);
  const [seleccionadosPromo, setSeleccionadosPromo] = useState<Set<number>>(new Set());
  const [isPromoMasivaOpen, setIsPromoMasivaOpen] = useState(false);
  const [porcentajePromoMasiva, setPorcentajePromoMasiva] = useState("");
  const [aplicandoPromoMasiva, setAplicandoPromoMasiva] = useState(false);
  const [promoProgreso, setPromoProgreso] = useState<{ total: number; actual: number } | null>(null);

  // Impresión de códigos de barras
  const [modalImprimirOpen, setModalImprimirOpen] = useState(false);
  const [pendingPrintList, setPendingPrintList] = useState<ProductoSucursal[]>([]);

  // Escáner global (lector de códigos de barras USB/Bluetooth físico):
  // Si el usuario escanea un código de barras en cualquier parte de la pantalla (sin haber hecho clic en el buscador),
  // se captura automáticamente, se coloca en el buscador y se filtra la lista de productos de inmediato.
  const algunModalAbierto =
    isNewOpen ||
    isEditOpen ||
    isImportOpen ||
    isDeleteOpen ||
    isPromoMasivaOpen ||
    modalImprimirOpen ||
    showModalVales ||
    isReporteOpen ||
    isVentasProductoOpen ||
    escaneando;

  useEscanerGlobal(
    (codigo) => {
      setSearch(codigo);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    },
    { enabled: !algunModalAbierto }
  );

  // Ids de productos cuya imagen falló al cargar: se muestra el placeholder "Sin imagen".
  const [imgErrorIds, setImgErrorIds] = useState<Set<number>>(new Set());

  // ── Virtualización de la grilla ──────────────────────────────────
  // Solo se montan en el DOM las filas visibles (+ overscan), para que la
  // página no se ponga lenta con catálogos grandes (cientos/miles de productos).
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const gridProbeRef = useRef<HTMLDivElement>(null);
  const [columnasGrid, setColumnasGrid] = useState(2);

  useEffect(() => {
    const medirColumnas = () => {
      if (!gridProbeRef.current) return;
      const cols = window
        .getComputedStyle(gridProbeRef.current)
        .gridTemplateColumns.split(" ").length;
      setColumnasGrid(cols > 0 ? cols : 1);
    };
    medirColumnas();
    window.addEventListener("resize", medirColumnas);
    return () => window.removeEventListener("resize", medirColumnas);
  }, []);

  const abrirModalImprimir = (lista: ProductoSucursal[]) => {
    const conCodigo = lista.filter((p) => !!p.codigoBarras);
    if (conCodigo.length === 0) {
      showToast("Los productos seleccionados no tienen código de barras.", "info");
      return;
    }
    setPendingPrintList(conCodigo);
    setModalImprimirOpen(true);
  };

  //Categorias
  const { categorias, setCategorias, loadingCategorias, fetchCategorias } =
    useCategoriasLista();

  const { registrarCategoria, loadingRegistrar } = useRegistrarCategoria(() => {
    if (user?.ruc) fetchCategorias(user.ruc); // ← refetch para obtener ids reales
  });

  useEffect(() => {
    if (accessToken && user?.ruc) fetchCategorias(user.ruc);
  }, [accessToken, user?.ruc, fetchCategorias]);

  // Mapa rápido productoId -> producto, para resolver el producto base de un paquete
  const productosPorId = React.useMemo(
    () => new Map(productos.map((p) => [p.productoId, p])),
    [productos],
  );

  // REEMPLAZA el bloque filtered:
  const filtrosAvanzadosActivos =
    (config?.isStock && filtroStock) ||
    (config?.isStock && filtroStockBajo) ||
    (config?.isStock && filtroPromocion) ||
    (config?.isStock && filtroPaquete) ||
    (config?.isStock && !!filtroVencimientoAntes) ||
    filtroAfectacion.length > 0 ||
    filtroTipoProducto.length > 0;

  // Stock real de un producto: si es paquete, el del producto base (no el propio, que ya no se usa).
  const getStockEfectivo = (p: ProductoSucursal): number | null => {
    if (p.esPaquete && p.productoBaseId) {
      const base = productosPorId.get(p.productoBaseId);
      return base?.sucursalProducto.stock ?? null;
    }
    return p.sucursalProducto.stock ?? null;
  };

  // Estado de alerta de stock: "agotado" (0), "bajo" (por debajo del umbral), "normal".
  // Paquetes se comparan en paquetes equivalentes; productos normales, en unidades.
  // Cada producto puede desactivar esta alerta y/o traer su propio umbral configurado;
  // si no trae umbral propio, se usa el umbral general de la empresa (Configuración).
  const getEstadoStock = (p: ProductoSucursal): "agotado" | "bajo" | "normal" => {
    if (p.sucursalProducto.alertaStockBajoActiva === false) return "normal";

    const stockEfectivo = getStockEfectivo(p);
    if (stockEfectivo == null) return "normal";
    if (stockEfectivo === 0) return "agotado";

    if (p.esPaquete && p.factorConversion) {
      const equivalente = stockEfectivo / p.factorConversion;
      const umbral = p.sucursalProducto.stockMinimoAlerta ?? STOCK_MINIMO_PAQUETE;
      return equivalente < umbral ? "bajo" : "normal";
    }

    const umbral = p.sucursalProducto.stockMinimoAlerta ?? config?.umbralStockBajo ?? STOCK_MINIMO_UNIDAD;
    return stockEfectivo < umbral ? "bajo" : "normal";
  };

  const filtered = productos.filter((p) => {
    const matchSearch = coincideBusqueda(search, p.nomProducto, p.codigo, p.codigoBarras);

    const matchCategoria =
      filterCategoria === "Todos" ||
      p.categoria?.categoriaNombre === filterCategoria;

    const matchStock =
      !config?.isStock || !filtroStock || getStockEfectivo(p) === 0;

    const matchStockBajo =
      !config?.isStock || !filtroStockBajo || getEstadoStock(p) === "bajo";

    const matchPromocion =
      !config?.isStock || !filtroPromocion || !!p.sucursalProducto.enPromocion;

    const matchPaquete =
      !config?.isStock || !filtroPaquete || !!p.esPaquete;

    const matchVencimiento =
      !config?.isStock ||
      !filtroVencimientoAntes ||
      (!!p.sucursalProducto.proximoVencimiento &&
        p.sucursalProducto.proximoVencimiento.slice(0, 10) <= filtroVencimientoAntes);

    const matchAfectacion =
      filtroAfectacion.length === 0 ||
      filtroAfectacion.includes(p.tipoAfectacionIGV);

    const matchTipo =
      filtroTipoProducto.length === 0 ||
      filtroTipoProducto.includes(p.tipoProducto ?? "");

    const matchSucursal =
      !filtroSucursal || p.sucursalProducto.nomSucursal === filtroSucursal;

    return (
      matchSearch &&
      matchCategoria &&
      matchStock &&
      matchStockBajo &&
      matchPromocion &&
      matchPaquete &&
      matchVencimiento &&
      matchAfectacion &&
      matchTipo &&
      matchSucursal
    );
  });

  // Agrupa la lista filtrada en filas de `columnasGrid` productos, para
  // virtualizar por fila (@tanstack/react-virtual sobre una grilla responsiva).
  const filasVirtual = React.useMemo(() => {
    const filas: ProductoSucursal[][] = [];
    for (let i = 0; i < filtered.length; i += columnasGrid) {
      filas.push(filtered.slice(i, i + columnasGrid));
    }
    return filas;
  }, [filtered, columnasGrid]);

  const rowVirtualizer = useVirtualizer({
    count: filasVirtual.length,
    getScrollElement: () => gridScrollRef.current,
    estimateSize: () => 215,
    overscan: 4,
  });

  const handleProductoEditado = (
    productoEditado: ProductoSucursal,
    productoBaseActualizado?: ProductoSucursal,
  ) => {
    setProductos((prev) => {
      const next = prev.map((p) => {
        if (
          p.sucursalProducto.sucursalProductoId ===
          productoEditado.sucursalProducto.sucursalProductoId
        )
          return productoEditado;
        if (
          productoBaseActualizado &&
          p.sucursalProducto.sucursalProductoId ===
            productoBaseActualizado.sucursalProducto.sucursalProductoId
        )
          return productoBaseActualizado;
        return p;
      });
      const sId = user?.sucursalID ? Number(user.sucursalID) : null;
      if (sId) {
        cacheProductos(sId, next).catch(() => {});
      }
      return next;
    });
  };

  const handleOpenEdit = (prod: ProductoSucursal) => {
    setEditTarget(prod);
    setIsEditOpen(true);
  };

  const handleOpenDelete = (prod: ProductoSucursal) => {
    // No permitir eliminar un producto que es base de algún paquete/caja activo,
    // para no dejar paquetes huérfanos apuntando a un producto inexistente.
    const paquetesQueLoUsan = productos.filter(
      (p) => p.esPaquete && p.productoBaseId === prod.productoId,
    );
    if (paquetesQueLoUsan.length > 0) {
      const nombres = paquetesQueLoUsan.map((p) => p.nomProducto).join(", ");
      showToast(
        `No puedes eliminar "${prod.nomProducto}": es el producto base de ${nombres}.`,
        "error",
      );
      return;
    }
    setDeleteTarget(prod);
    setIsDeleteOpen(true);
  };

  const toggleSeleccionPromo = (productoId: number) => {
    setSeleccionadosPromo((prev) => {
      const next = new Set(prev);
      if (next.has(productoId)) next.delete(productoId);
      else next.add(productoId);
      return next;
    });
  };

  const cancelarSeleccionPromo = () => {
    setModoSeleccionPromo(false);
    setSeleccionadosPromo(new Set());
  };

  // Aplica o quita promoción a los productos seleccionados.
  // Procesa en lotes paralelos y reporta progreso (X de Y).
  const actualizarPromocionMasiva = async (
    enPromocion: boolean,
    porcentaje: number | null,
  ) => {
    const productosObjetivo = productos.filter((p) =>
      seleccionadosPromo.has(p.productoId),
    );
    if (productosObjetivo.length === 0) return;

    setAplicandoPromoMasiva(true);
    setPromoProgreso({ total: productosObjetivo.length, actual: 0 });

    let ok = 0;
    let errores = 0;

    const construirPayload = (p: ProductoSucursal) => ({
      productoId: p.productoId,
      codigo: p.codigo,
      tipoProducto: p.tipoProducto ?? "BIEN",
      nomProducto: p.nomProducto,
      unidadMedida: p.unidadMedida,
      tipoAfectacionIGV: p.tipoAfectacionIGV,
      incluirIGV: p.incluirIGV,
      categoriaId: p.categoria?.categoriaId ?? 0,
      sucursalProductoId: p.sucursalProducto.sucursalProductoId,
      precioUnitario: p.sucursalProducto.precioUnitario,
      urlImagenProducto: p.urlImagenProducto ?? null,
      stock:
        config?.isStock && p.tipoProducto === "BIEN"
          ? p.sucursalProducto.stock ?? 0
          : null,
      costoUnitario:
        config?.isStock && p.tipoProducto === "BIEN"
          ? p.sucursalProducto.ultimoPrecioCompra ?? null
          : null,
      alertaVencimientoActiva:
        config?.isStock && p.tipoProducto === "BIEN"
          ? p.sucursalProducto.alertaVencimientoActiva ?? true
          : null,
      alertaStockBajoActiva:
        config?.isStock && p.tipoProducto === "BIEN"
          ? p.sucursalProducto.alertaStockBajoActiva ?? true
          : null,
      stockMinimoAlerta:
        config?.isStock && p.tipoProducto === "BIEN"
          ? p.sucursalProducto.stockMinimoAlerta ?? null
          : null,
      codigoBarras: p.codigoBarras || null,
      codigoSunat: p.codigoSunat || undefined,
      esPaquete: p.esPaquete ?? false,
      productoBaseId: p.esPaquete ? p.productoBaseId ?? null : null,
      factorConversion: p.esPaquete ? p.factorConversion ?? null : null,
      precioMayorista: p.sucursalProducto.precioMayorista ?? null,
      cantidadMinimaMayorista: p.sucursalProducto.cantidadMinimaMayorista ?? null,
      enPromocion,
      porcentajeDescuento: porcentaje,
      ubicacionTienda: config?.isStock ? p.sucursalProducto.ubicacionTienda ?? null : null,
      usuarioId: user?.id ? parseInt(user.id) : null,
    });

    const procesarUno = async (p: ProductoSucursal) => {
      try {
        await axios.put(
          `${process.env.NEXT_PUBLIC_API_URL}/api/productos/${p.productoId}`,
          construirPayload(p),
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        setProductos((prev) =>
          prev.map((x) =>
            x.sucursalProducto.sucursalProductoId ===
            p.sucursalProducto.sucursalProductoId
              ? {
                  ...x,
                  sucursalProducto: {
                    ...x.sucursalProducto,
                    enPromocion,
                    porcentajeDescuento: porcentaje,
                  },
                }
              : x,
          ),
        );
        ok++;
      } catch {
        errores++;
      } finally {
        setPromoProgreso((prev) =>
          prev ? { ...prev, actual: prev.actual + 1 } : prev,
        );
      }
    };

    // Lotes paralelos para no saturar el backend con todas las peticiones a la vez.
    const TAMANO_LOTE = 5;
    for (let i = 0; i < productosObjetivo.length; i += TAMANO_LOTE) {
      const lote = productosObjetivo.slice(i, i + TAMANO_LOTE);
      await Promise.allSettled(lote.map(procesarUno));
    }

    setAplicandoPromoMasiva(false);
    setPromoProgreso(null);
    cancelarSeleccionPromo();

    if (ok > 0)
      showToast(
        `${ok} producto(s) ${enPromocion ? "puestos en promoción" : "sin promoción"}.`,
        "success",
      );
    if (errores > 0) showToast(`${errores} producto(s) con error.`, "error");
  };

  const aplicarPromocionMasiva = async () => {
    const porcentaje = Number(porcentajePromoMasiva);
    if (!porcentaje || porcentaje <= 0 || porcentaje > 100) {
      showToast("Ingresa un % de descuento entre 1 y 100.", "info");
      return;
    }
    await actualizarPromocionMasiva(true, porcentaje);
    setIsPromoMasivaOpen(false);
    setPorcentajePromoMasiva("");
  };

  const quitarPromocionMasiva = () => actualizarPromocionMasiva(false, null);

  // Extrae el imageId de una URL de Cloudflare Images.
  // Formato: https://imagedelivery.net/{hash}/{imageId}/{variant}
  const extractCloudflareImageId = (url: string): string | null => {
    try {
      const parts = new URL(url).pathname.split("/").filter(Boolean);
      return parts.length >= 2 ? parts[parts.length - 2] : null;
    } catch {
      return null;
    }
  };

  const eliminarImagenCloudflare = async (url: string) => {
    const imageId = extractCloudflareImageId(url);
    if (!imageId) return;
    try {
      await fetch("/api/upload-imagen", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      });
    } catch {
      /* fallo silencioso: no bloquear el borrado del producto */
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/api/productos/${deleteTarget.sucursalProducto.sucursalProductoId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      // El producto se eliminó en el backend: eliminar también su imagen de Cloudflare,
      // PERO solo si ningún otro producto está usando esa misma URL. Al importar desde
      // Excel se reutiliza la URL de la imagen, así que varios productos pueden apuntar
      // al mismo archivo y borrarlo dejaría a los demás sin imagen.
      if (deleteTarget.urlImagenProducto) {
        const otroLaUsa = productos.some(
          (p) =>
            p.sucursalProducto.sucursalProductoId !==
              deleteTarget.sucursalProducto.sucursalProductoId &&
            p.urlImagenProducto === deleteTarget.urlImagenProducto,
        );
        if (!otroLaUsa) {
          await eliminarImagenCloudflare(deleteTarget.urlImagenProducto);
        }
      }
      showToast("Producto eliminado correctamente.", "success");
      setProductos((prev) => {
        const next = prev.filter(
          (p) =>
            p.sucursalProducto.sucursalProductoId !==
            deleteTarget.sucursalProducto.sucursalProductoId,
        );
        const sId = user?.sucursalID ? Number(user.sucursalID) : null;
        if (sId) {
          cacheProductos(sId, next).catch(() => {});
        }
        return next;
      });
      setDeleteTarget(null);
      setIsDeleteOpen(false);
    } catch (error) {
      console.error("Error al eliminar producto:", error);

      if (axios.isAxiosError(error)) {
        if (!error.response) {
          // Sin conexión o API no responde
          showToast(
            "Sin conexión. Verifica tu internet e intenta nuevamente.",
            "error",
          );
        } else {
          const status = error.response.status;
          if (status === 404) {
            showToast("No se encontró el producto a eliminar.", "error");
          } else if (status === 403) {
            showToast(
              "No tienes permisos para eliminar este producto.",
              "error",
            );
          } else {
            showToast(
              "No se pudo eliminar el producto. Intenta nuevamente.",
              "error",
            );
          }
        }
      } else {
        showToast("Error inesperado. Intenta nuevamente.", "error");
      }
    }
  };

  // Motivos de error agrupados y ordenados por frecuencia, para leer de un vistazo
  // qué pasó en una importación de cientos de filas.
  const resumenErroresImport = React.useMemo(() => {
    const conteo = new Map<string, number>();
    for (const e of importResultados?.errores ?? []) {
      conteo.set(e.error, (conteo.get(e.error) ?? 0) + 1);
    }
    return [...conteo.entries()]
      .map(([error, cantidad]) => ({ error, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [importResultados]);

  // Descarga el detalle completo de errores como CSV para poder corregir el Excel.
  const descargarErroresImport = () => {
    const errores = importResultados?.errores ?? [];
    if (errores.length === 0) return;

    const escapar = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [
      ["Fila", "Producto", "Motivo"].join(";"),
      ...errores.map((e) =>
        [escapar(e.fila), escapar(e.nombre), escapar(e.error)].join(";"),
      ),
    ].join("\r\n");

    // BOM para que Excel respete las tildes.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `errores-importacion_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const resetImport = () => {
    setImportFile(null);
    setImportSucursalId(isSuperAdmin ? 0 : parseInt(user?.sucursalID ?? "0"));
    setImportando(false);
    setImportProgreso(null);
    setImportResultados(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!importFile || !accessToken) return;

    // Validar sucursal
    if (isSuperAdmin && importSucursalId === 0) {
      showToast("Debes seleccionar una sucursal para importar.", "error");
      return;
    }

    setImportando(true);
    setImportResultados(null);

    try {
      // ── PASO 1: el servidor parsea el Excel ──────────────────────
      const formData = new FormData();
      formData.append("file", importFile);

      const parseRes = await fetch("/api/productos/importar", {
        method: "POST",
        body: formData,
      });

      const parseJson = await parseRes.json();

      if (!parseRes.ok) {
        showToast(parseJson.error ?? "Error al leer el archivo.", "error");
        setImportando(false);
        return;
      }

      // Espejo de FilaProducto en app/api/productos/importar/route.ts
      const filas: {
        fila: number;
        nomProducto: string;
        precioUnitario: number | null;
        precioCompra: number | null;
        stock: number | null;
        tipoProducto: string;
        tipoAfectacionIGV: string;
        incluirIGV: boolean;
        unidadMedida: string;
        categoria: string;
        codigo: string;
        codigoBarras: string;
        urlImagenProducto: string;
        errorValidacion?: string;
      }[] = parseJson.filas;

      if (!filas || filas.length === 0) {
        showToast("El archivo no contiene productos para importar.", "error");
        setImportando(false);
        return;
      }

      // ── PASO 2: Asegurar que existan todas las categorías ─────────
      const nombresCategoriasExcel = Array.from(
        new Set(filas.map((f) => f.categoria).filter(Boolean)),
      );
      let categoriasActuales = [...categorias];
      let huboCategoriasNuevas = false;

      for (const nombreCat of nombresCategoriasExcel) {
        const existe = categoriasActuales.some(
          (c) => c.categoriaNombre.toLowerCase() === nombreCat.toLowerCase(),
        );
        if (!existe) {
          try {
            await axios.post(
              `${process.env.NEXT_PUBLIC_API_URL}/api/Categorias`,
              { categoriaNombre: nombreCat, empresaRuc: user?.ruc },
              { headers: { Authorization: `Bearer ${accessToken}` } },
            );
            huboCategoriasNuevas = true;
          } catch (err) {
            console.error(`Error creando categoría ${nombreCat}:`, err);
            showToast(
              `No se pudo crear la categoría: ${nombreCat}. Los productos asociados podrían fallar.`,
              "error",
            );
          }
        }
      }

      if (huboCategoriasNuevas && user?.ruc) {
        categoriasActuales = await fetchCategorias(user.ruc);
      }

      // ── PASO 3: enviar cada fila al API de productos ──────────────
      setImportProgreso({ total: filas.length, actual: 0 });

      if (filas.length > MAX_FILAS_RECOMENDADO) {
        showToast(
          `El archivo tiene ${filas.length} filas: la importación puede tardar varios minutos. ` +
            `Para la próxima, divídelo en archivos de ${MAX_FILAS_RECOMENDADO} productos.`,
          "info",
        );
      }

      const ok: string[] = [];
      const errores: { fila: number; nombre: string; error: string }[] = [];
      const sucursalId = isSuperAdmin
        ? importSucursalId
        : parseInt(user?.sucursalID ?? "0");

      // Los productos creados se acumulan aquí y la lista se actualiza UNA sola vez
      // al terminar. Hacer setProductos por fila copiaba el arreglo completo en cada
      // iteración (O(n²)) y volvía inusable la importación de archivos grandes.
      const nuevosProductos: ProductoSucursal[] = [];
      const sucursalNombre = sucursales.find(
        (s) => s.sucursalId === sucursalId,
      )?.nombre;
      const perteneceALaVistaActual =
        !isSuperAdmin || !filtroSucursal || filtroSucursal === sucursalNombre;

      for (let i = 0; i < filas.length; i++) {
        const f = filas[i];

        // Errores de validación detectados por el servidor
        if (f.errorValidacion) {
          errores.push({
            fila: f.fila,
            nombre: f.nomProducto || "(vacío)",
            error: f.errorValidacion,
          });
          setImportProgreso({ total: filas.length, actual: i + 1 });
          continue;
        }

        // Buscar categoría por nombre (usar la lista actualizada)
        const catId =
          categoriasActuales.find(
            (c) =>
              c.categoriaNombre.toLowerCase() === f.categoria.toLowerCase(),
          )?.categoriaId ?? 0;

        const codigoFinal = f.codigo ||
          generarCodigoProducto(f.nomProducto, productos.length + i);

        // Stock y costo solo tienen sentido para bienes y si la empresa maneja inventario.
        // El backend exige el costo cuando llega stock > 0 (abre el lote PEPS inicial);
        // el parser ya marca como error las filas con stock pero sin precio de compra.
        const manejaInventario = !!config?.isStock && f.tipoProducto === "BIEN";

        const payload = {
          nomProducto: f.nomProducto,
          precioUnitario: f.precioUnitario,
          tipoProducto: f.tipoProducto,
          tipoAfectacionIGV: f.tipoAfectacionIGV,
          incluirIGV: f.incluirIGV,
          unidadMedida: f.unidadMedida,
          codigo: codigoFinal,
          codigoBarras: f.codigoBarras || null,
          // Se reutiliza la URL de Cloudflare tal cual: la imagen ya está subida,
          // no hace falta volver a subirla.
          urlImagenProducto: f.urlImagenProducto || null,
          categoriaId: catId,
          sucursalId,
          stock: manejaInventario ? f.stock : null,
          costoUnitario: manejaInventario ? f.precioCompra : null,
        };

        try {
          const res = await axios.post<ProductoSucursal>(
            `${process.env.NEXT_PUBLIC_API_URL}/api/productos`,
            payload,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );
          ok.push(f.nomProducto);

          // Actualizar lista si la sucursal coincide con el filtro o si es el admin de esa sucursal
          if (perteneceALaVistaActual) nuevosProductos.push(res.data);
        } catch (err) {
          errores.push({
            fila: f.fila,
            nombre: f.nomProducto,
            error: describirErrorImport(err, f.fila),
          });
        }

        setImportProgreso({ total: filas.length, actual: i + 1 });
      }

      if (nuevosProductos.length > 0)
        setProductos((prev) => [...prev, ...nuevosProductos]);

      setImportResultados({ ok, errores });
      if (ok.length > 0)
        showToast(
          `${ok.length} producto(s) importado(s) correctamente.`,
          "success",
        );
      if (errores.length > 0)
        showToast(`${errores.length} fila(s) con error.`, "error");
    } catch (err) {
      console.error(err);
      showToast("Error inesperado. Intenta nuevamente.", "error");
    } finally {
      setImportando(false);
    }
  };

  return (
    <div className="space-y-2 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Buscador — izquierda */}
          <div className="flex items-center gap-2 min-w-48 flex-1 max-w-md">
            <div className="relative flex-1 min-w-0">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                  }
                }}
                placeholder="Buscar por nombre, código o escanear código de barras..."
                className="w-full pl-10 pr-8 py-2.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue/50 outline-none transition-all shadow-sm text-xs"
              />
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {/* Escanear con la cámara del celular para buscar por código de barras */}
            <button
              type="button"
              onClick={() => setEscaneando(true)}
              title="Escanear código de barras con la cámara"
              className="h-9.5 w-9.5 shrink-0 flex items-center justify-center bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue rounded-md border border-brand-blue/20 transition-colors"
            >
              <ScanBarcode className="w-4 h-4" />
            </button>
          </div>

          {/* Filtros + acciones — derecha, bajan juntos */}
          <div className="flex items-center gap-2 flex-wrap">
            {isSuperAdmin && (
              <DropdownFiltro
                label="Sucursal: Todas"
                value={filtroSucursal || "Todos"}
                options={["Todos", ...sucursales.map((s) => s.nombre)]}
                onChange={(v) => setFiltroSucursal(v === "Todos" ? "" : v)}
              />
            )}
            <DropdownFiltro
              label="Categoría: Todos"
              value={filterCategoria}
              options={[
                "Todos",
                ...categorias.map((cat) => cat.categoriaNombre),
              ]}
              onChange={(v) => setFilterCategoria(v)}
            />

            <button
              onClick={() => setShowFiltrosAvanzados((prev) => !prev)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-2.5 text-xs font-medium border rounded-md transition-all whitespace-nowrap shadow-sm",
                filtrosAvanzadosActivos
                  ? "bg-green-50 border-green-300 text-green-700"
                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-300",
              )}
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
                />
              </svg>
              Filtros avanzados
              {filtrosAvanzadosActivos && (
                <span className="bg-green-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {
                    [
                      config?.isStock && filtroStock,
                      config?.isStock && filtroStockBajo,
                      config?.isStock && filtroPromocion,
                      config?.isStock && filtroPaquete,
                      config?.isStock && !!filtroVencimientoAntes,
                      ...filtroAfectacion,
                      ...filtroTipoProducto,
                    ].filter(Boolean).length
                  }
                </span>
              )}
            </button>

            <div className="w-px h-6 bg-gray-200" />

            <Button
              variant="outline"
              onClick={() => setIsImportOpen(true)}
              className="py-2.5 px-3 text-xs rounded-md h-auto"
            >
              <Upload className="w-3.5 h-3.5" /> Importar
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsReporteOpen(true)}
              className="py-2.5 px-3 text-xs rounded-md h-auto"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Reporte Productos
            </Button>
            <button
              onClick={() => setIsVentasProductoOpen(true)}
              className="flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Reporte Ventas
            </button>
            {config?.isVale && (
              <Button
                variant="outline"
                onClick={abrirModalVales}
                className="py-2.5 px-3 text-xs rounded-md h-auto"
              >
                <Ticket className="w-3.5 h-3.5" /> Administrar Vales
              </Button>
            )}
            {!soloLectura && (
              <Button
                variant={modoSeleccionPromo ? "primary" : "outline"}
                onClick={() =>
                  modoSeleccionPromo ? cancelarSeleccionPromo() : setModoSeleccionPromo(true)
                }
                className="py-2.5 px-3 text-xs rounded-md h-auto"
              >
                <Tag className="w-3.5 h-3.5" />
                {modoSeleccionPromo ? "Cancelar selección" : "Seleccionar"}
              </Button>
            )}
            {!soloLectura && (
              <Button
                onClick={() => setIsNewOpen(true)}
                className="py-2.5 px-3 text-xs rounded-md h-auto"
              >
                <Plus className="w-3.5 h-3.5" /> Producto/servicio
              </Button>
            )}
          </div>
        </div>

        {/* Panel filtros avanzados — barra full width compacta */}
        {showFiltrosAvanzados && (
          <div className="flex items-center gap-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 animate-in fade-in duration-200">
            {/* Label */}
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap shrink-0">
              Filtrar por
            </span>

            {/* Afectación IGV - Oculto temporalmente */}
            {/*
            <div className="w-px h-4 bg-gray-200 shrink-0" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap shrink-0">
                IGV
              </span>
              <div className="flex gap-1">
                {[
                  {
                    value: "10",
                    label: "Gravado",
                    color: "bg-blue-100 text-blue-700 border-blue-300",
                  },
                  {
                    value: "20",
                    label: "Exonerado",
                    color: "bg-green-100 text-green-700 border-green-300",
                  },
                  {
                    value: "30",
                    label: "Inafecto",
                    color: "bg-amber-100 text-amber-700 border-amber-300",
                  },
                ].map(({ value, label, color }) => {
                  const active = filtroAfectacion.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setFiltroAfectacion((prev) =>
                          active
                            ? prev.filter((v) => v !== value)
                            : [...prev, value],
                        )
                      }
                      className={cn(
                        "px-2.5 py-1 text-xs font-semibold border rounded-lg transition-all whitespace-nowrap",
                        active
                          ? color
                          : "bg-white border-gray-200 text-gray-500 hover:border-gray-300",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            */}

            {config?.isStock && (
              <>
                <div className="w-px h-4 bg-gray-200 shrink-0" />

                {/* Stock */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap shrink-0">
                    Stock
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiltroStock((prev) => !prev)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-semibold border rounded-lg transition-all whitespace-nowrap",
                      filtroStock
                        ? "bg-slate-100 text-slate-600 border-slate-300"
                        : "bg-white border-gray-200 text-gray-500 hover:border-gray-300",
                    )}
                  >
                    Sin stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroStockBajo((prev) => !prev)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-semibold border rounded-lg transition-all whitespace-nowrap",
                      filtroStockBajo
                        ? "bg-amber-100 text-amber-700 border-amber-300"
                        : "bg-white border-gray-200 text-gray-500 hover:border-gray-300",
                    )}
                  >
                    Stock bajo
                  </button>
                </div>

                <div className="w-px h-4 bg-gray-200 shrink-0" />

                {/* Promoción */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap shrink-0">
                    Promoción
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiltroPromocion((prev) => !prev)}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border rounded-lg transition-all whitespace-nowrap",
                      filtroPromocion
                        ? "bg-blue-100 text-blue-700 border-blue-300"
                        : "bg-white border-gray-200 text-gray-500 hover:border-gray-300",
                    )}
                  >
                    <Tag size={12} /> En promoción
                  </button>
                </div>

                <div className="w-px h-4 bg-gray-200 shrink-0" />

                {/* Paquetes */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap shrink-0">
                    Paquetes
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiltroPaquete((prev) => !prev)}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border rounded-lg transition-all whitespace-nowrap",
                      filtroPaquete
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-white border-gray-200 text-gray-500 hover:border-gray-300",
                    )}
                  >
                    <Boxes size={12} /> Solo paquetes/cajas
                  </button>
                </div>

                <div className="w-px h-4 bg-gray-200 shrink-0" />

                {/* Vencimiento */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap shrink-0 flex items-center gap-1">
                    <CalendarClock size={12} /> Vence antes de
                  </span>
                  <input
                    type="date"
                    value={filtroVencimientoAntes}
                    onChange={(e) => setFiltroVencimientoAntes(e.target.value)}
                    className={cn(
                      "px-2 py-1 text-xs font-semibold border rounded-lg transition-all outline-none",
                      filtroVencimientoAntes
                        ? "bg-amber-50 border-amber-300 text-amber-700"
                        : "bg-white border-gray-200 text-gray-500",
                    )}
                  />
                  {filtroVencimientoAntes && (
                    <button
                      type="button"
                      onClick={() => setFiltroVencimientoAntes("")}
                      className="text-gray-400 hover:text-rose-500 transition-colors"
                      title="Quitar filtro de vencimiento"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </>
            )}

            <div className="w-px h-4 bg-gray-200 shrink-0" />

            {/* Tipo Producto */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap shrink-0">
                Tipo
              </span>
              <div className="flex gap-1">
                {[
                  { value: "BIEN", label: "Bien", icon: <Package size={12} /> },
                  {
                    value: "SERVICIO",
                    label: "Servicio",
                    icon: <Wrench size={12} />,
                  },
                ].map(({ value, label, icon }) => {
                  const active = filtroTipoProducto.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setFiltroTipoProducto((prev) =>
                          active
                            ? prev.filter((v) => v !== value)
                            : [...prev, value],
                        )
                      }
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border rounded-lg transition-all whitespace-nowrap",
                        active
                          ? "bg-green-50 border-green-300 text-green-700"
                          : "bg-white border-gray-200 text-gray-500 hover:border-gray-300",
                      )}
                    >
                      {icon} {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Limpiar — empujado a la derecha */}
            {filtrosAvanzadosActivos && (
              <>
                <div className="flex-1" />
                <button
                  onClick={() => {
                    setFiltroStock(false);
                    setFiltroStockBajo(false);
                    setFiltroPromocion(false);
                    setFiltroPaquete(false);
                    setFiltroVencimientoAntes("");
                    setFiltroAfectacion([]);
                    setFiltroTipoProducto([]);
                    setFiltroSucursal("");
                  }}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-rose-500 font-bold transition-colors whitespace-nowrap shrink-0 px-2 py-1.5 hover:bg-rose-50 rounded-md"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpiar filtros
                </button>
              </>
            )}
          </div>
        )}
      </div>


      <div className="flex items-center justify-between">
        <p className="text-[12px] text-gray-500">
          Mostrando{" "}
          <span className="font-semibold text-gray-900">{filtered.length}</span>{" "}
          productos
        </p>
      </div>

      {/* Barra de selección para promoción masiva */}
      {modoSeleccionPromo && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 animate-in fade-in duration-200">
          <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
            {(() => {
              const elegibles = filtered.filter((p) => p.tipoProducto === "BIEN");
              const todosSeleccionados = elegibles.length > 0 && elegibles.every((p) => seleccionadosPromo.has(p.productoId));
              const algunoSeleccionado = !todosSeleccionados && elegibles.some((p) => seleccionadosPromo.has(p.productoId));
              return (
                <input
                  type="checkbox"
                  checked={todosSeleccionados}
                  ref={(el) => { if (el) el.indeterminate = algunoSeleccionado; }}
                  onChange={() => {
                    if (todosSeleccionados) {
                      setSeleccionadosPromo(new Set());
                    } else {
                      setSeleccionadosPromo(new Set(elegibles.map((p) => p.productoId)));
                    }
                  }}
                  className="w-4 h-4 accent-brand-blue"
                />
              );
            })()}
            <span className="text-xs font-semibold text-blue-700">
              {seleccionadosPromo.size > 0 ? `${seleccionadosPromo.size} seleccionado(s)` : "Seleccionar todos"}
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={cancelarSeleccionPromo}
              className="py-1.5 px-3 text-xs rounded-md h-auto flex-1 sm:flex-none justify-center whitespace-nowrap"
            >
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={quitarPromocionMasiva}
              disabled={
                seleccionadosPromo.size === 0 ||
                aplicandoPromoMasiva ||
                !productos.some((p) => seleccionadosPromo.has(p.productoId) && !!p.sucursalProducto.enPromocion)
              }
              className="py-1.5 px-3 text-xs rounded-md h-auto flex-1 sm:flex-none justify-center whitespace-nowrap"
            >
              {aplicandoPromoMasiva && promoProgreso
                ? `Quitando ${promoProgreso.actual} de ${promoProgreso.total}...`
                : "Quitar promoción"}
            </Button>
            <Button
              onClick={() => setIsPromoMasivaOpen(true)}
              disabled={seleccionadosPromo.size === 0}
              className="py-1.5 px-3 text-xs rounded-md h-auto flex-1 sm:flex-none justify-center whitespace-nowrap"
            >
              <Tag className="w-3.5 h-3.5" /> Aplicar % a seleccionados
            </Button>
            <Button
              variant="outline"
              onClick={() => abrirModalImprimir(productos.filter((p) => seleccionadosPromo.has(p.productoId)))}
              disabled={seleccionadosPromo.size === 0}
              className="py-1.5 px-3 text-xs rounded-md h-auto flex-1 sm:flex-none justify-center whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimir códigos
            </Button>
          </div>
        </div>
      )}

      {/* Grid */}

      <div
        ref={gridScrollRef}
        className="overflow-y-auto rounded-xl"
        style={{
          maxHeight: `calc(100vh - ${170 + (showFiltrosAvanzados ? 55 : 0) + (modoSeleccionPromo ? 55 : 0)}px)`,
          scrollbarWidth: "thin",
          scrollbarColor: "#CBD5E1 transparent",
        }}
      >
        {/* Sonda oculta: solo sirve para medir cuántas columnas tiene la
            grilla en el breakpoint actual (Tailwind), independiente de los
            datos, para poder repartir `filtered` en filas virtualizadas. */}
        <div
          ref={gridProbeRef}
          aria-hidden
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2"
          style={{ position: "absolute", visibility: "hidden", height: 0, overflow: "hidden", pointerEvents: "none" }}
        />

        {loadingProductos && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 pb-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse border border-gray-200 rounded-xl p-4 space-y-4"
              >
                <div className="h-3 bg-gray-200 rounded w-1/3" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
                <div className="flex justify-between pt-4">
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-12" />
                    <div className="h-5 bg-gray-200 rounded w-16" />
                  </div>
                  <div className="space-y-2 text-right">
                    <div className="h-3 bg-gray-200 rounded w-20" />
                    <div className="h-6 bg-gray-200 rounded w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loadingProductos && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-gray-100 rounded-full p-4 mb-3">
              <PackageSearch className="w-10 h-10 text-gray-300" />
            </div>
            <p className="text-gray-500 font-semibold text-sm">
              No se encontraron productos
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Intenta ajustar los filtros de búsqueda
            </p>
          </div>
        )}

        {!loadingProductos && filtered.length > 0 && (
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              position: "relative",
              width: "100%",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const fila = filasVirtual[virtualRow.index];
              if (!fila) return null;
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="pb-2"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                    {fila.map((prod) => (
                      <ProductoCard
                        key={prod.sucursalProducto.sucursalProductoId}
                        prod={prod}
                        isSuperAdmin={isSuperAdmin}
                        soloLectura={soloLectura}
                        isStock={config?.isStock}
                        modoSeleccionPromo={modoSeleccionPromo}
                        seleccionado={seleccionadosPromo.has(prod.productoId)}
                        toggleSeleccionPromo={toggleSeleccionPromo}
                        handleOpenEdit={handleOpenEdit}
                        handleOpenDelete={handleOpenDelete}
                        abrirModalImprimir={abrirModalImprimir}
                        productoBase={
                          prod.esPaquete && prod.productoBaseId
                            ? productosPorId.get(prod.productoBaseId)
                            : undefined
                        }
                        getEstadoStock={getEstadoStock}
                        filtroVencimientoActivo={!!filtroVencimientoAntes}
                        diasAlertaVencimiento={config?.diasAlertaVencimiento}
                        imgError={imgErrorIds.has(prod.sucursalProducto.sucursalProductoId)}
                        onImgError={() =>
                          setImgErrorIds((prev) => {
                            const next = new Set(prev);
                            next.add(prod.sucursalProducto.sucursalProductoId);
                            return next;
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <EscanerCodigoBarras
        isOpen={escaneando}
        onClose={() => setEscaneando(false)}
        onDetectado={(codigo) => setSearch(codigo)}
        titulo="Buscar producto por código de barras"
      />
      <AgregarProducto
        isOpen={isNewOpen}
        onClose={() => setIsNewOpen(false)}
        onProductoAgregado={(producto) => {
          setProductos((prev) => {
            const next = [...prev, producto];
            const sId = user?.sucursalID ? Number(user.sucursalID) : null;
            if (sId) {
              cacheProductos(sId, next).catch(() => {});
            }
            return next;
          });
        }}
        categorias={categorias}
        onAgregarCategoria={registrarCategoria}
        loadingCategoria={loadingRegistrar}
      />
      <EditarProducto
        isOpen={isEditOpen}
        producto={editTarget}
        onClose={() => setIsEditOpen(false)}
        onProductoEditado={handleProductoEditado}
        categorias={categorias}
      />
      <ModalReporteProductos
        isOpen={isReporteOpen}
        onClose={() => setIsReporteOpen(false)}
        categorias={categorias}
        sucursales={sucursales}
      />
      {isVentasProductoOpen && (
        <ModalVentasProductoExcel
          sucursalId={sucursalId}
          onClose={() => setIsVentasProductoOpen(false)}
        />
      )}

      {/* ── Modal Administrar Vales ── */}
      {showModalVales && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <Ticket className="w-4 h-4 text-brand-blue" />
                <h2 className="text-sm font-bold text-gray-800">Administrar Vales</h2>
              </div>
              <button
                onClick={() => { setShowModalVales(false); setShowFormVale(false); }}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={16} className="text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {showFormVale ? (
                /* ── Formulario crear / editar ── */
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    {editingVale ? "Editar vale" : "Nuevo vale"}
                  </h3>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Nombre *</label>
                    <input
                      type="text"
                      value={valeForm.nombre}
                      onChange={(e) => setValeForm((p) => ({ ...p, nombre: e.target.value }))}
                      placeholder="Nombre del vale"
                      className="w-full py-2 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-blue/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Duración (días) *</label>
                    <input
                      type="text"
                      value={valeForm.duracion}
                      onChange={(e) => setValeForm((p) => ({ ...p, duracion: e.target.value }))}
                      placeholder="Ej: 30"
                      className="w-full py-2 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-blue/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Descripción</label>
                    <textarea
                      value={valeForm.descripcion}
                      onChange={(e) => setValeForm((p) => ({ ...p, descripcion: e.target.value }))}
                      placeholder="Descripción del vale..."
                      rows={4}
                      className="w-full py-2 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-blue/50 resize-none"
                    />
                  </div>
                </div>
              ) : (
                /* ── Lista de vales ── */
                <>
                  {loadingVales ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  ) : vales.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      No hay vales registrados
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {vales.map((vale) => (
                        <div
                          key={vale.idVale}
                          className="flex items-start justify-between gap-3 p-3 border border-gray-200 rounded-xl"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-semibold text-gray-800">{vale.nombre}</p>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${vale.estado ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                                {vale.estado ? "Activo" : "Inactivo"}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5">Duración: {vale.duracion} días</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => abrirFormEditarVale(vale)}
                              className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors text-blue-500"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => eliminarVale(vale.idVale)}
                              disabled={deletingValeId === vale.idVale}
                              className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-red-400 disabled:opacity-50"
                            >
                              {deletingValeId === vale.idVale
                                ? <Loader2 size={13} className="animate-spin" />
                                : <Trash2 size={13} />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex gap-3">
              {showFormVale ? (
                <>
                  <button
                    onClick={() => { setShowFormVale(false); setEditingVale(null); }}
                    className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={guardarVale}
                    disabled={savingVale}
                    className="flex-1 py-2 rounded-xl bg-brand-blue text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
                  >
                    {savingVale ? "Guardando..." : editingVale ? "Actualizar" : "Crear vale"}
                  </button>
                </>
              ) : (
                <button
                  onClick={abrirFormNuevoVale}
                  className="flex-1 py-2 rounded-xl bg-brand-blue text-white text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Plus size={14} /> Nuevo vale
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal importar */}
      <Modal
        isOpen={isImportOpen}
        onClose={() => {
          if (!importando) {
            setIsImportOpen(false);
            resetImport();
          }
        }}
        title="Importar Productos desde Excel"
      >
        <form className="space-y-4" onSubmit={handleImport}>
          {/* ── Descargar plantilla ── */}
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <div>
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">
                Paso 1 — Descarga la plantilla
              </p>
              <p className="text-xs text-blue-600 mt-0.5">
                Llena con tus productos y sube el archivo. También puedes subir el
                Excel de <strong>Reporte Productos</strong> tal como se descarga.
              </p>
            </div>
            <a
              href="/api/productos/plantilla"
              download
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" /> Descargar plantilla
            </a>
          </div>

          {/* ── Configuración de Importación ── */}
          <div className="grid grid-cols-1 gap-4">
            {/* Sucursal (solo superadmin) */}
            {isSuperAdmin && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                  Sucursal Destino <span className="text-rose-500">*</span>
                </label>
                <select
                  value={importSucursalId}
                  onChange={(e) => setImportSucursalId(Number(e.target.value))}
                  disabled={importando || !!importResultados}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50 disabled:opacity-50"
                >
                  <option value={0}>Seleccione sucursal</option>
                  {sucursales.map((s) => (
                    <option key={s.sucursalId} value={s.sucursalId}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* ── Subir archivo ── */}
          {!importResultados && (
            <label className="block border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-brand-blue transition-colors cursor-pointer">
              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-600 mb-1">
                Paso 2 — Arrastra o selecciona tu archivo
              </p>
              <p className="text-xs text-gray-400 mb-3">
                Solo formato .xlsx (Excel) · Recomendado hasta{" "}
                {MAX_FILAS_RECOMENDADO} productos por archivo
              </p>
              {importFile ? (
                <span className="text-xs text-brand-blue font-semibold">
                  ✓ {importFile.name}
                </span>
              ) : (
                <span className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-semibold rounded-lg">
                  Seleccionar archivo
                </span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  setImportFile(e.target.files?.[0] ?? null);
                }}
              />
            </label>
          )}

          {/* ── Progreso ── */}
          {importando && importProgreso && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Importando
                  productos...
                </span>
                <span className="font-semibold">
                  {importProgreso.actual} / {importProgreso.total}
                </span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-blue transition-all duration-300 rounded-full"
                  style={{
                    width: `${Math.round((importProgreso.actual / importProgreso.total) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* ── Resultados ── */}
          {importResultados && (
            <div className="space-y-3">
              {importResultados.ok.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-green-700 flex items-center gap-1.5 mb-1">
                    <CheckCircle className="w-3.5 h-3.5" />{" "}
                    {importResultados.ok.length} producto(s) importado(s) con
                    éxito
                  </p>
                </div>
              )}
              {importResultados.errores.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-rose-700 flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" />{" "}
                      {importResultados.errores.length} fila(s) con error
                    </p>
                    <button
                      type="button"
                      onClick={descargarErroresImport}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-rose-200 text-rose-700 text-[11px] font-semibold rounded-lg hover:bg-rose-100 transition-colors whitespace-nowrap"
                    >
                      <Download className="w-3 h-3" /> Descargar detalle
                    </button>
                  </div>

                  {/* Motivos agrupados: con cientos de filas, el detalle fila por fila
                      es ilegible; primero se muestra en qué falló y cuántas veces. */}
                  <div className="space-y-1">
                    {resumenErroresImport.map(({ error, cantidad }) => (
                      <p key={error} className="text-xs text-rose-700">
                        <span className="font-bold">{cantidad}×</span> {error}
                      </p>
                    ))}
                  </div>

                  <div className="space-y-1 max-h-40 overflow-y-auto border-t border-rose-200 pt-2">
                    {importResultados.errores.map((e, i) => (
                      <p key={i} className="text-xs text-rose-600">
                        <span className="font-semibold">Fila {e.fila}</span> ·{" "}
                        {e.nombre} — {e.error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Acciones ── */}
          <div className="flex justify-end gap-3 pt-1">
            {importResultados ? (
              <>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => resetImport()}
                >
                  Importar otro
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setIsImportOpen(false);
                    resetImport();
                  }}
                >
                  Cerrar
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setIsImportOpen(false);
                    resetImport();
                  }}
                  disabled={importando}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={!importFile || importando}>
                  {importando ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />{" "}
                      Importando...
                    </>
                  ) : (
                    "Importar"
                  )}
                </Button>
              </>
            )}
          </div>
        </form>
      </Modal>

      <ModalEliminar
        isOpen={isDeleteOpen}
        mensaje="Eliminarás el producto"
        nombre={deleteTarget?.nomProducto ?? ""}
        documento={deleteTarget?.codigo}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
      />


      <ModalImprimirEtiquetas
        isOpen={modalImprimirOpen}
        onClose={() => setModalImprimirOpen(false)}
        productos={pendingPrintList}
        onError={(msg) => showToast(msg, "error")}
      />

      {/* Modal: aplicar % de descuento a los productos seleccionados */}
      <Modal
        isOpen={isPromoMasivaOpen}
        onClose={() => {
          if (!aplicandoPromoMasiva) setIsPromoMasivaOpen(false);
        }}
        title="Aplicar promoción a varios productos"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Se marcarán <strong>{seleccionadosPromo.size}</strong> producto(s) como "en
            promoción" con el mismo porcentaje de descuento.
          </p>
          <InputBase
            label="% Descuento"
            type="number"
            step="0.01"
            value={porcentajePromoMasiva}
            onChange={(e) => setPorcentajePromoMasiva(e.target.value)}
            placeholder="Ej: 20"
            showError={false}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setIsPromoMasivaOpen(false)}
              disabled={aplicandoPromoMasiva}
            >
              Cancelar
            </Button>
            <Button onClick={aplicarPromocionMasiva} disabled={aplicandoPromoMasiva}>
              {aplicandoPromoMasiva
                ? promoProgreso
                  ? `Aplicando ${promoProgreso.actual} de ${promoProgreso.total}...`
                  : "Aplicando..."
                : "Aplicar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
