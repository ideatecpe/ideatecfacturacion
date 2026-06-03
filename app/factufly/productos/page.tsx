"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  Search,
  Upload,
  Plus,
  Edit2,
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
} from "lucide-react";
import axios from "axios";

import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { Modal } from "@/app/components/ui/Modal";
import { ModalEliminar } from "@/app/components/ui/ModalEliminar";
import { cn } from "@/app/utils/cn";

import { ProductoSucursal } from "./gestioProductos/Producto";
import AgregarProducto from "./gestioProductos/AgregarProducto";
import EditarProducto from "./gestioProductos/EditarProducto";

import { useProductosSucursal } from "./gestioProductos/useProductosSucursal";
import { useCategoriasLista } from "./gestioProductos/useCategoriasLista";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { useRouter } from "next/navigation";
import { useProductosEmpresaLista } from "./gestioProductos/useProductosEmpresaLista";
import { useSucursalRuc } from "../operaciones/boleta/gestionBoletas/useSucursalRuc";
import { useRegistrarCategoria } from "./gestioProductos/useRegistrarCategoria";
import { DropdownFiltro } from "@/app/components/ui/DropdownFiltro";
import ModalReporteProductos from "@/app/components/modalProductos/Modalreporteproductos";
import { ModalVentasProductoExcel } from "./gestioProductos/ModalVentasProductoExcel";
import { generarCodigoProducto } from "./gestioProductos/generarCodigoProducto";

export default function ProductosPage() {
  const { showToast } = useToast();
  const { accessToken, user } = useAuth();
  const { config } = useConfiguracion();
  const router = useRouter();
  const isSuperAdmin = user?.rol === "superadmin";
  const soloLectura = user?.ruc === "10073587382" && user?.rol === "facturador";

  // ── Vales ──────────────────────────────────────────────────────
  interface Vale {
    idVale: number;
    nombre: string;
    descripcion: string;
    fechaEmision: string;
    duracion: string;
    estado: boolean;
  }
  type ValeForm = { nombre: string; descripcion: string; duracion: string; estado: boolean };
  const VALE_EMPTY: ValeForm = { nombre: "", descripcion: "", duracion: "", estado: true };

  const [showModalVales, setShowModalVales] = useState(false);
  const [vales, setVales] = useState<Vale[]>([]);
  const [loadingVales, setLoadingVales] = useState(false);
  const [valeForm, setValeForm] = useState<ValeForm>(VALE_EMPTY);
  const [editingVale, setEditingVale] = useState<Vale | null>(null);
  const [showFormVale, setShowFormVale] = useState(false);
  const [savingVale, setSavingVale] = useState(false);
  const [deletingValeId, setDeletingValeId] = useState<number | null>(null);

  const fetchVales = async () => {
    setLoadingVales(true);
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Vales`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      setVales(res.data);
    } catch {
      showToast("Error al cargar los vales", "error");
    } finally {
      setLoadingVales(false);
    }
  };

  const abrirModalVales = () => {
    setShowModalVales(true);
    setShowFormVale(false);
    setEditingVale(null);
    setValeForm(VALE_EMPTY);
    fetchVales();
  };

  const abrirFormNuevoVale = () => {
    setEditingVale(null);
    setValeForm(VALE_EMPTY);
    setShowFormVale(true);
  };

  const abrirFormEditarVale = (vale: Vale) => {
    setEditingVale(vale);
    setValeForm({
      nombre: vale.nombre,
      descripcion: vale.descripcion,
      duracion: vale.duracion,
      estado: vale.estado,
    });
    setShowFormVale(true);
  };

  const guardarVale = async () => {
    if (!valeForm.nombre.trim() || !valeForm.duracion.trim()) {
      showToast("Nombre y duración son obligatorios", "error");
      return;
    }
    setSavingVale(true);
    try {
      if (editingVale) {
        await axios.put(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Vales/${editingVale.idVale}`,
          {
            nombre: valeForm.nombre,
            descripcion: valeForm.descripcion,
            fechaEmision: editingVale.fechaEmision,
            duracion: valeForm.duracion,
            estado: valeForm.estado,
          },
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        showToast("Vale actualizado correctamente", "success");
      } else {
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Vales`,
          {
            nombre: valeForm.nombre,
            descripcion: valeForm.descripcion,
            duracion: valeForm.duracion,
          },
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        showToast("Vale creado correctamente", "success");
      }
      setShowFormVale(false);
      setEditingVale(null);
      setValeForm(VALE_EMPTY);
      fetchVales();
    } catch {
      showToast("Error al guardar el vale", "error");
    } finally {
      setSavingVale(false);
    }
  };

  const eliminarVale = async (id: number) => {
    setDeletingValeId(id);
    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Vales/${id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      showToast("Vale eliminado", "success");
      setVales((prev) => prev.filter((v) => v.idVale !== id));
    } catch {
      showToast("Error al eliminar el vale", "error");
    } finally {
      setDeletingValeId(null);
    }
  };

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
  const [filtroAfectacion, setFiltroAfectacion] = useState<string[]>([]);
  const [filtroTipoProducto, setFiltroTipoProducto] = useState<string[]>([]);

  const [search, setSearch] = useState("");
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

  //modal reporte
  const [isReporteOpen, setIsReporteOpen] = useState(false);
  const [isVentasProductoOpen, setIsVentasProductoOpen] = useState(false);
  const sucursalId = parseInt(user?.sucursalID ?? "0");

  //Categorias
  const { categorias, setCategorias, loadingCategorias, fetchCategorias } =
    useCategoriasLista();

  const { registrarCategoria, loadingRegistrar } = useRegistrarCategoria(() => {
    if (user?.ruc) fetchCategorias(user.ruc); // ← refetch para obtener ids reales
  });

  useEffect(() => {
    if (accessToken && user?.ruc) fetchCategorias(user.ruc);
  }, [accessToken, user?.ruc]);

  // REEMPLAZA el bloque filtered:
  const filtrosAvanzadosActivos =
    filtroStock || filtroAfectacion.length > 0 || filtroTipoProducto.length > 0;

  const filtered = productos.filter((p) => {
    const matchSearch =
      p.nomProducto.toLowerCase().includes(search.toLowerCase()) ||
      p.codigo.toLowerCase().includes(search.toLowerCase());

    const matchCategoria =
      filterCategoria === "Todos" ||
      p.categoria?.categoriaNombre === filterCategoria;

    const matchStock = !filtroStock || p.sucursalProducto.stock === 0;

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
      matchAfectacion &&
      matchTipo &&
      matchSucursal
    );
  });

  const handleProductoEditado = (productoEditado: ProductoSucursal) => {
    setProductos((prev) =>
      prev.map((p) =>
        p.productoId === productoEditado.productoId ? productoEditado : p,
      ),
    );
  };

  const handleOpenEdit = (prod: ProductoSucursal) => {
    setEditTarget(prod);
    setIsEditOpen(true);
  };

  const handleOpenDelete = (prod: ProductoSucursal) => {
    setDeleteTarget(prod);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/api/productos/${deleteTarget.productoId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      showToast("Producto eliminado correctamente.", "success");
      setProductos((prev) =>
        prev.filter((p) => p.productoId !== deleteTarget.productoId),
      );
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

      const filas: {
        fila: number;
        nomProducto: string;
        precioUnitario: number | null;
        tipoProducto: string;
        tipoAfectacionIGV: string;
        incluirIGV: boolean;
        unidadMedida: string;
        categoria: string;
        codigo: string;
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

      const ok: string[] = [];
      const errores: { fila: number; nombre: string; error: string }[] = [];
      const sucursalId = isSuperAdmin
        ? importSucursalId
        : parseInt(user?.sucursalID ?? "0");

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
          generarCodigoProducto(f.nomProducto, productosEmpresa.length + i);

        const payload = {
          nomProducto: f.nomProducto,
          precioUnitario: f.precioUnitario,
          tipoProducto: f.tipoProducto,
          tipoAfectacionIGV: f.tipoAfectacionIGV,
          incluirIGV: f.incluirIGV,
          unidadMedida: f.unidadMedida,
          codigo: codigoFinal,
          categoriaId: catId,
          sucursalId,
        };

        try {
          const res = await axios.post<ProductoSucursal>(
            `${process.env.NEXT_PUBLIC_API_URL}/api/productos`,
            payload,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );
          ok.push(f.nomProducto);

          // Actualizar lista si la sucursal coincide con el filtro o si es el admin de esa sucursal
          const sucursalNombre = sucursales.find(
            (s) => s.sucursalId === sucursalId,
          )?.nombre;
          if (
            !isSuperAdmin ||
            !filtroSucursal ||
            filtroSucursal === sucursalNombre
          ) {
            setProductos((prev) => [...prev, res.data]);
          }
        } catch (err) {
          let msg = "Error desconocido";
          if (axios.isAxiosError(err)) {
            const data = err.response?.data;
            msg = data?.mensaje ?? data?.message ?? data?.title ?? data?.errors
              ? JSON.stringify(data?.errors ?? data)
              : `Error ${err.response?.status}`;
            console.error("Import error fila", f.fila, JSON.stringify(data));
          }
          errores.push({ fila: f.fila, nombre: f.nomProducto, error: msg });
        }

        setImportProgreso({ total: filas.length, actual: i + 1 });
      }

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
    <div className="space-y-3 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Buscador — izquierda */}
          <div className="relative min-w-48 flex-1 max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar productos por código o nombre..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all shadow-sm text-xs"
            />
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
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
                      filtroStock,
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

            <div className="w-px h-4 bg-gray-200 shrink-0" />

            {/* Afectación IGV */}
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
        <p className="text-sm text-gray-500">
          Mostrando{" "}
          <span className="font-semibold text-gray-900">{filtered.length}</span>{" "}
          productos
        </p>
      </div>

      {/* Grid */}

      <div
        className="overflow-y-auto rounded-xl "
        style={{
          maxHeight: showFiltrosAvanzados
            ? "calc(100vh - 275px)"
            : "calc(100vh - 215px)",
          scrollbarWidth: "thin",
          scrollbarColor: "#CBD5E1 transparent",
        }}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pb-2">
          {loadingProductos &&
            Array.from({ length: 12 }).map((_, i) => (
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

          {!loadingProductos && filtered.length === 0 && (
            <div className="col-span-4 flex flex-col items-center justify-center py-16 text-center">
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
          {!loadingProductos &&
            filtered.map((prod) => (
              <Card
                key={prod.sucursalProducto.sucursalProductoId}
                className="group hover:border-brand-blue transition-all"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      {prod.codigo}
                    </p>
                    <h4 className="font-bold text-gray-900 group-hover:text-brand-blue transition-colors line-clamp-2">
                      {prod.nomProducto}
                    </h4>
                    <p className="text-[10px] font-medium text-gray-400 bg-gray-100 w-fit px-1.5 py-0.5 rounded uppercase">
                      {prod.categoria?.categoriaNombre}
                    </p>
                    {isSuperAdmin && (
                      <p className="text-[10px] text-gray-400 flex mt-1 bg-blue-50 w-fit px-1.5 py-0.5 rounded">
                        <span className="font-bold">Sucursal: &nbsp; </span>{" "}
                        {prod.sucursalProducto.nomSucursal}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-1">
                    {!soloLectura && (
                      <>
                        <button
                          onClick={() => handleOpenEdit(prod)}
                          className="p-1.5 text-gray-500 hover:text-brand-blue hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(prod)}
                          className="p-1.5 text-gray-500 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  <div className="text-right">
                    <p className="text-[12px] text-gray-400 uppercase font-bold">
                      {prod.tipoAfectacionIGV === "10"
                        ? "Gravado"
                        : prod.tipoAfectacionIGV === "20"
                          ? "Exonerado"
                          : "Inafecto"}
                    </p>
                    <p className="text-[12px] text-gray-400 uppercase font-bold">
                      {prod.tipoAfectacionIGV === "10"
                        ? prod.incluirIGV
                          ? "Precio (Inc. IGV)"
                          : "Precio (Sin. IGV)"
                        : "Precio (NA. IGV)"}
                    </p>
                    {/*prod.sucursalProducto.precioUnitario */}
                    <p className="text-[14px] font-black text-brand-blue">
                      S/ {prod.sucursalProducto.precioUnitario.toFixed(2)}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
        </div>
      </div>

      <AgregarProducto
        isOpen={isNewOpen}
        onClose={() => setIsNewOpen(false)}
        onProductoAgregado={(producto) =>
          setProductos((prev) => [...prev, producto])
        }
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
                      className="w-full py-2 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-blue"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Duración (días) *</label>
                    <input
                      type="text"
                      value={valeForm.duracion}
                      onChange={(e) => setValeForm((p) => ({ ...p, duracion: e.target.value }))}
                      placeholder="Ej: 30"
                      className="w-full py-2 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-blue"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Descripción</label>
                    <textarea
                      value={valeForm.descripcion}
                      onChange={(e) => setValeForm((p) => ({ ...p, descripcion: e.target.value }))}
                      placeholder="Descripción del vale..."
                      rows={4}
                      className="w-full py-2 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-blue resize-none"
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
                Llena con tus productos y sube el archivo.
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
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue disabled:opacity-50"
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
                Solo formato .xlsx (Excel)
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
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-1.5 max-h-40 overflow-y-auto">
                  <p className="text-xs font-bold text-rose-700 flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5" />{" "}
                    {importResultados.errores.length} fila(s) con error
                  </p>
                  {importResultados.errores.map((e, i) => (
                    <p key={i} className="text-xs text-rose-600">
                      <span className="font-semibold">Fila {e.fila}</span> ·{" "}
                      {e.nombre} — {e.error}
                    </p>
                  ))}
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
    </div>
  );
}
