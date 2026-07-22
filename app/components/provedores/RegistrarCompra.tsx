"use client";

import React from "react";
import axios from "axios";
import { Plus, Loader2 } from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { cn } from "@/app/utils/cn";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { Proveedor, CompraProveedor } from "@/app/factufly/compras/proveedores/gestionProveedorCompra/Proveedor";
import { useRegistrarCompraProveedor } from "@/app/factufly/compras/proveedores/gestionProveedorCompra/useRegistrarCompraProveedor";
import { useSucursalRuc } from "@/app/factufly/operaciones/boleta/gestionBoletas/useSucursalRuc";
import { ProductoSucursal } from "@/app/factufly/productos/gestioProductos/Producto";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { avisarStockRepuestoWhatsapp } from "@/app/factufly/productos/gestioProductos/stockAlerta";
import LineaCompraRow, { LineaCompra, NUEVO_PROVEEDOR_VALUE } from "./LineaCompraRow";
import AgregarProveedor from "./AgregarProveedor";

/** Switch segmentado: misma data en todas las líneas que comparten sucursal,
 * para no repetir el fetch de productos cada vez que se agrega una línea. */
function useProductosPorSucursalCache() {
  const { accessToken } = useAuth();
  const [cache, setCache] = React.useState<Record<number, ProductoSucursal[]>>({});
  const [loadingIds, setLoadingIds] = React.useState<Set<number>>(new Set());
  const enVueloRef = React.useRef<Set<number>>(new Set());

  const ensureProductos = React.useCallback(
    async (sucursalId: number) => {
      if (!sucursalId || cache[sucursalId] || enVueloRef.current.has(sucursalId)) return;
      enVueloRef.current.add(sucursalId);
      setLoadingIds((prev) => new Set(prev).add(sucursalId));
      try {
        const res = await axios.get<ProductoSucursal[]>(
          `${process.env.NEXT_PUBLIC_API_URL}/api/productos/${sucursalId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        setCache((prev) => ({ ...prev, [sucursalId]: res.data }));
      } catch {
        // silencioso: la fila mostrará "Seleccione un producto" vacío
      } finally {
        enVueloRef.current.delete(sucursalId);
        setLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(sucursalId);
          return next;
        });
      }
    },
    [accessToken, cache],
  );

  return { cache, loadingIds, ensureProductos };
}

function SwitchSegmentado<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  activeClassName,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  activeClassName: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">
        {label}
      </span>
      <div className="flex bg-gray-100 rounded-md p-0.5 gap-0.5 border border-gray-200">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-2.5 py-1 text-xs font-bold rounded transition-all whitespace-nowrap disabled:opacity-50",
              value === opt.value
                ? activeClassName
                : "text-gray-500 hover:text-gray-700 hover:bg-white/60",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  proveedores: Proveedor[];
  proveedorPreseleccionado?: Proveedor | null;
  onCompraRegistrada: (compra: CompraProveedor) => void;
  onProveedorCreado?: (proveedor: Proveedor) => void;
}

let lineaKeySeq = 0;
const nuevaLinea = (proveedorId = 0, sucursalId = 0): LineaCompra => ({
  key: ++lineaKeySeq,
  proveedorId,
  sucursalId,
  productoId: 0,
  unidadMedida: "",
  cantidad: "",
  precioCompra: "",
  docReferencia: "",
  fechaVencimiento: "",
});

export default function RegistrarCompra({
  isOpen,
  onClose,
  proveedores,
  proveedorPreseleccionado,
  onCompraRegistrada,
  onProveedorCreado,
}: Props) {
  const { showToast } = useToast();
  const { user, accessToken } = useAuth();
  const { config } = useConfiguracion();
  const isSuperAdmin = user?.rol === "superadmin";
  const sucursalFija = !isSuperAdmin
    ? { id: parseInt(user?.sucursalID ?? "0"), nombre: user?.nombreSucursal ?? "" }
    : undefined;

  const { registrarCompraProveedor } = useRegistrarCompraProveedor();
  const { sucursales } = useSucursalRuc(isOpen && isSuperAdmin);
  const { cache: productosCache, loadingIds: productosLoadingIds, ensureProductos } =
    useProductosPorSucursalCache();

  const forzadoUnProveedor = !!proveedorPreseleccionado;

  const [modoProveedor, setModoProveedor] = React.useState<"unico" | "varios">("unico");
  const [modoDoc, setModoDoc] = React.useState<"unico" | "porLinea">("unico");
  const [proveedorIdHeader, setProveedorIdHeader] = React.useState<number>(0);
  const [docReferenciaHeader, setDocReferenciaHeader] = React.useState<string>("");
  const [lineas, setLineas] = React.useState<LineaCompra[]>([nuevaLinea()]);
  const [errors, setErrors] = React.useState<Record<string, boolean>>({});
  const [lineaErrors, setLineaErrors] = React.useState<Record<number, Record<string, boolean>>>({});
  const [guardando, setGuardando] = React.useState(false);
  const [progreso, setProgreso] = React.useState<{ total: number; actual: number } | null>(null);
  const [isAgregarProveedorOpen, setIsAgregarProveedorOpen] = React.useState(false);
  const [lineaTargetNuevoProveedor, setLineaTargetNuevoProveedor] = React.useState<number | null>(null);

  const modoSucursal: "fijo" | "porItem" = isSuperAdmin ? "porItem" : "fijo";

  React.useEffect(() => {
    if (isOpen) {
      setModoProveedor("unico");
      setModoDoc("unico");
      setProveedorIdHeader(proveedorPreseleccionado?.proveedorId ?? 0);
      setDocReferenciaHeader("");
      setLineas([nuevaLinea(proveedorPreseleccionado?.proveedorId ?? 0, sucursalFija?.id ?? 0)]);
      setErrors({});
      setLineaErrors({});
      setGuardando(false);
      setProgreso(null);
    }
  }, [isOpen, proveedorPreseleccionado]);

  const handleCambiarModoProveedor = (modo: "unico" | "varios") => {
    setModoProveedor(modo);
    if (modo === "unico") {
      setModoDoc("unico");
    }
    setLineas([nuevaLinea(modo === "unico" ? proveedorIdHeader : 0, sucursalFija?.id ?? 0)]);
    setLineaErrors({});
  };

  const handleAgregarLinea = () =>
    setLineas((prev) => [
      ...prev,
      nuevaLinea(modoProveedor === "unico" ? proveedorIdHeader : 0, sucursalFija?.id ?? 0),
    ]);

  const handleEliminarLinea = (key: number) =>
    setLineas((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));

  const handleAbrirNuevoProveedor = (lineaKey: number | null) => {
    setLineaTargetNuevoProveedor(lineaKey);
    setIsAgregarProveedorOpen(true);
  };

  const handleProveedorCreado = (nuevo: Proveedor) => {
    onProveedorCreado?.(nuevo);

    if (lineaTargetNuevoProveedor != null) {
      const key = lineaTargetNuevoProveedor;
      setLineas((prev) =>
        prev.map((l) => (l.key === key ? { ...l, proveedorId: nuevo.proveedorId } : l)),
      );
      setLineaErrors((prev) => ({ ...prev, [key]: { ...prev[key], proveedorId: false } }));
    } else {
      setProveedorIdHeader(nuevo.proveedorId);
      setLineas((prev) => prev.map((l) => ({ ...l, proveedorId: nuevo.proveedorId })));
      if (errors.proveedorIdHeader) setErrors((prev) => ({ ...prev, proveedorIdHeader: false }));
    }
    setLineaTargetNuevoProveedor(null);
  };

  const handleLineaChange = (key: number, field: keyof Omit<LineaCompra, "key">, value: string | number) => {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
    setLineaErrors((prev) => ({ ...prev, [key]: { ...prev[key], [field]: false } }));
  };

  const resolverProductoDeLinea = (l: LineaCompra): ProductoSucursal | undefined => {
    const sucursalIdEfectiva = modoSucursal === "porItem" ? l.sucursalId : sucursalFija?.id ?? 0;
    const productosSucursal = productosCache[sucursalIdEfectiva] ?? [];
    return productosSucursal.find((p) => p.productoId === l.productoId);
  };

  const validar = (): boolean => {
    const newErrors: Record<string, boolean> = {};
    if (modoProveedor === "unico" && proveedorIdHeader === 0) newErrors.proveedorIdHeader = true;

    const newLineaErrors: Record<number, Record<string, boolean>> = {};
    const mensajes: string[] = [];

    lineas.forEach((l, idx) => {
      if (l.estado === "guardado") return;

      const le: Record<string, boolean> = {};
      if (modoProveedor === "varios" && l.proveedorId === 0) le.proveedorId = true;
      if (modoSucursal === "porItem" && l.sucursalId === 0) le.sucursalId = true;
      if (l.productoId === 0) le.productoId = true;
      if (!l.cantidad || Number(l.cantidad) <= 0) le.cantidad = true;
      if (!l.precioCompra || Number(l.precioCompra) <= 0) le.precioCompra = true;

      if (l.productoId !== 0 && l.cantidad) {
        const producto = resolverProductoDeLinea(l);
        if (producto?.esPaquete) {
          if (!producto.productoBaseId || !producto.factorConversion) {
            le.productoId = true;
            mensajes.push(
              `Línea ${idx + 1}: "${producto.nomProducto}" es un paquete sin producto base/factor de conversión configurado. Corrígelo en Productos antes de comprarlo.`,
            );
          } else if (!Number.isInteger(Number(l.cantidad))) {
            le.cantidad = true;
            mensajes.push(
              `Línea ${idx + 1}: la cantidad de un paquete/caja debe ser un número entero. Si necesitas una fracción, regístrala usando el producto base (unidad).`,
            );
          }
        }
      }

      if (Object.keys(le).length > 0) newLineaErrors[l.key] = le;
    });

    setErrors(newErrors);
    setLineaErrors(newLineaErrors);

    if (mensajes.length > 0) showToast(mensajes[0], "error");

    return Object.keys(newErrors).length === 0 && Object.keys(newLineaErrors).length === 0;
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar()) return;

    // Solo se reenvían las líneas que aún no se guardaron — evita duplicar compras
    // ya registradas si el usuario reintenta después de un error parcial.
    const pendientes = lineas.filter((l) => l.estado !== "guardado");
    if (pendientes.length === 0) return;

    setGuardando(true);
    setProgreso({ total: pendientes.length, actual: 0 });

    let huboError = false;
    let ultimaCreada: CompraProveedor | null = null;
    const registrosOk: { sucursalId: number; productoId: number; cantidad: number }[] = [];

    for (let i = 0; i < pendientes.length; i++) {
      const l = pendientes[i];
      setLineas((prev) => prev.map((x) => (x.key === l.key ? { ...x, estado: "guardando" } : x)));

      const proveedorId = modoProveedor === "unico" ? proveedorIdHeader : l.proveedorId;
      const sucursalId = modoSucursal === "porItem" ? l.sucursalId : sucursalFija?.id ?? 0;
      const docReferencia =
        modoProveedor === "varios" && modoDoc === "porLinea"
          ? l.docReferencia
          : docReferenciaHeader;

      const producto = resolverProductoDeLinea(l);

      const creada = await registrarCompraProveedor({
        proveedorId,
        sucursalId,
        productoId: l.productoId,
        precioCompra: Number(l.precioCompra),
        cantidad: Number(l.cantidad),
        unidadMedida: l.unidadMedida || undefined,
        docReferencia: docReferencia.trim() || undefined,
        idUsuario: user?.id ? Number(user.id) : undefined,
        fechaVencimiento: l.fechaVencimiento || undefined,
      });

      if (creada) {
        ultimaCreada = creada;
        // Los paquetes reponen el stock del producto BASE (no el vendido en la línea),
        // así que no se puede calcular el cruce de umbral con los datos de esta línea.
        if (!producto?.esPaquete) {
          registrosOk.push({ sucursalId, productoId: l.productoId, cantidad: Number(l.cantidad) });
        }
        setLineas((prev) => prev.map((x) => (x.key === l.key ? { ...x, estado: "guardado" } : x)));
      } else {
        huboError = true;
        setLineas((prev) => prev.map((x) => (x.key === l.key ? { ...x, estado: "error" } : x)));
      }
      setProgreso({ total: pendientes.length, actual: i + 1 });
    }

    setGuardando(false);
    if (ultimaCreada) onCompraRegistrada(ultimaCreada);

    if (config?.numeroStockBajo && registrosOk.length) {
      avisarStockRepuestoSiAplica(registrosOk, config.numeroStockBajo);
    }

    if (!huboError) onClose();
  };

  // ── Avisar por WhatsApp si algún producto repuesto cruzó el umbral de stock bajo ──
  const avisarStockRepuestoSiAplica = async (
    registros: { sucursalId: number; productoId: number; cantidad: number }[],
    numero: string,
  ) => {
    const umbral = config?.umbralStockBajo ?? 10;
    const sucursalIds = Array.from(new Set(registros.map((r) => r.sucursalId)));
    const frescos = new Map<number, ProductoSucursal[]>();

    await Promise.all(
      sucursalIds.map(async (sucursalId) => {
        try {
          const res = await axios.get<ProductoSucursal[]>(
            `${process.env.NEXT_PUBLIC_API_URL}/api/productos/${sucursalId}`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );
          frescos.set(sucursalId, res.data);
        } catch {
          // silencioso: esa sucursal simplemente no participa del aviso
        }
      }),
    );

    const repuestos = registros
      .map((r) => {
        const producto = frescos.get(r.sucursalId)?.find((p) => p.productoId === r.productoId);
        if (!producto) return null;
        const stockDespues = producto.sucursalProducto.stock ?? 0;
        const stockAntes = stockDespues - r.cantidad;
        if (stockAntes > umbral || stockDespues <= umbral) return null;
        return { nomProducto: producto.nomProducto, stock: stockDespues };
      })
      .filter((p): p is { nomProducto: string; stock: number } => p !== null);

    if (repuestos.length) avisarStockRepuestoWhatsapp(repuestos, numero);
  };

  const totalGeneral = lineas.reduce(
    (acc, l) => acc + (Number(l.cantidad) || 0) * (Number(l.precioCompra) || 0),
    0,
  );

  const mostrarColProveedor = modoProveedor === "varios";
  const mostrarColSucursal = modoSucursal === "porItem";
  const mostrarColDoc = modoProveedor === "varios" && modoDoc === "porLinea";

  const guardadosCount = lineas.filter((l) => l.estado === "guardado").length;
  const erroresCount = lineas.filter((l) => l.estado === "error").length;
  const hayGuardados = guardadosCount > 0;
  const hayPendientes = lineas.some((l) => l.estado !== "guardado");

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar nueva compra / ingreso de stock" className="max-w-7xl">
      <form className="space-y-2.5" onSubmit={handleGuardar}>
        {/* ── Switches: modo de compra + modo documento, en 2 columnas ── */}
        {(!forzadoUnProveedor || modoProveedor === "varios") && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {!forzadoUnProveedor && (
              <SwitchSegmentado
                label="Modo de compra"
                value={modoProveedor}
                disabled={guardando || hayGuardados}
                onChange={handleCambiarModoProveedor}
                activeClassName="bg-white text-brand-blue shadow-sm"
                options={[
                  { value: "unico", label: "Un proveedor" },
                  { value: "varios", label: "Varios proveedores" },
                ]}
              />
            )}

            {modoProveedor === "varios" && (
              <SwitchSegmentado
                label="Documento de referencia"
                value={modoDoc}
                disabled={guardando}
                onChange={setModoDoc}
                activeClassName="bg-white text-emerald-700 shadow-sm"
                options={[
                  { value: "unico", label: "Único (interno)" },
                  { value: "porLinea", label: "Por proveedor" },
                ]}
              />
            )}
          </div>
        )}

        {/* ── Proveedor (cabecera, solo modo único) ── */}
        {modoProveedor === "unico" && (
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
              Proveedor <span className="text-rose-500">*</span>
            </label>
            <select
              value={proveedorIdHeader}
              onChange={(e) => {
                const id = Number(e.target.value);
                if (id === NUEVO_PROVEEDOR_VALUE) {
                  handleAbrirNuevoProveedor(null);
                  return;
                }
                setProveedorIdHeader(id);
                setLineas((prev) => prev.map((l) => ({ ...l, proveedorId: id })));
                if (errors.proveedorIdHeader) setErrors((prev) => ({ ...prev, proveedorIdHeader: false }));
              }}
              disabled={guardando || forzadoUnProveedor}
              className={`w-full h-8 px-2.5 text-sm bg-gray-50 border rounded-md outline-none focus:border-brand-blue/50 disabled:opacity-60 ${
                errors.proveedorIdHeader ? "border-rose-400" : "border-gray-200"
              }`}
            >
              <option value={0}>Seleccione un proveedor</option>
              <option value={NUEVO_PROVEEDOR_VALUE} className="font-semibold text-brand-blue">
                + Agregar nuevo proveedor
              </option>
              {proveedores.map((p) => (
                <option key={p.proveedorId} value={p.proveedorId}>
                  {p.razonSocial}
                </option>
              ))}
            </select>
            {errors.proveedorIdHeader && (
              <p className="text-xs text-rose-500 font-medium">Debe seleccionar un proveedor</p>
            )}
          </div>
        )}

        {/* ── Documento de Referencia + Sucursal, en 2 columnas ── */}
        {((modoProveedor === "unico" || modoDoc === "unico") || (!isSuperAdmin && sucursalFija)) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(modoProveedor === "unico" || modoDoc === "unico") && (
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
                  Documento de Referencia <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={docReferenciaHeader}
                  onChange={(e) => setDocReferenciaHeader(e.target.value)}
                  placeholder="N° de factura/guía o informe interno"
                  disabled={guardando}
                  className="w-full h-8 px-2.5 text-sm bg-gray-50 border border-gray-200 rounded-md outline-none focus:border-brand-blue/50 disabled:opacity-60"
                />
              </div>
            )}

            {!isSuperAdmin && sucursalFija && (
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500 uppercase">Sucursal</label>
                <div className="w-full h-8 flex items-center px-2.5 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700 font-semibold">
                  {sucursalFija.nombre}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Líneas de productos (tabla) ── */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-gray-500 uppercase">
            Productos a ingresar
          </label>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-y-auto" style={{ maxHeight: "min(38vh, 340px)" }}>
              <table className="w-full text-xs border-collapse" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "32px" }} />
                  {mostrarColProveedor && <col />}
                  {mostrarColSucursal && <col />}
                  {mostrarColDoc && <col />}
                  <col />
                  <col style={{ width: "100px" }} />
                  <col style={{ width: "115px" }} />
                  <col style={{ width: "130px" }} />
                  <col style={{ width: "95px" }} />
                  <col style={{ width: "32px" }} />
                </colgroup>
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                  <tr>
                    <th className="px-2 py-2 text-left font-bold text-gray-500 uppercase text-[10px]">#</th>
                    {mostrarColProveedor && (
                      <th className="px-1.5 py-2 text-left font-bold text-gray-500 uppercase text-[10px]">
                        Proveedor
                      </th>
                    )}
                    {mostrarColSucursal && (
                      <th className="px-1.5 py-2 text-left font-bold text-gray-500 uppercase text-[10px]">
                        Sucursal
                      </th>
                    )}
                    {mostrarColDoc && (
                      <th className="px-1.5 py-2 text-left font-bold text-gray-500 uppercase text-[10px]">
                        Doc. Ref.
                      </th>
                    )}
                    <th className="px-1.5 py-2 text-left font-bold text-gray-500 uppercase text-[10px]">
                      Producto
                    </th>
                    <th className="px-1.5 py-2 text-left font-bold text-gray-500 uppercase text-[10px]">
                      Cantidad
                    </th>
                    <th className="px-1.5 py-2 text-left font-bold text-gray-500 uppercase text-[10px]">
                      Precio compra unitario
                    </th>
                    <th className="px-1.5 py-2 text-left font-bold text-gray-500 uppercase text-[10px]">
                      Vencimiento <span className="normal-case font-normal text-gray-400">(opc.)</span>
                    </th>
                    <th className="px-1.5 py-2 text-right font-bold text-gray-500 uppercase text-[10px]">
                      Subtotal
                    </th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {lineas.map((l, idx) => (
                    <LineaCompraRow
                      key={l.key}
                      index={idx}
                      linea={l}
                      mostrarProveedor={mostrarColProveedor}
                      mostrarSucursal={mostrarColSucursal}
                      mostrarDocLinea={mostrarColDoc}
                      proveedores={proveedores}
                      sucursales={sucursales}
                      sucursalFija={sucursalFija}
                      productosCache={productosCache}
                      productosLoadingIds={productosLoadingIds}
                      ensureProductos={ensureProductos}
                      errors={lineaErrors[l.key] ?? {}}
                      disabled={guardando || l.estado === "guardado"}
                      canRemove={lineas.length > 1 && l.estado !== "guardado"}
                      onChange={handleLineaChange}
                      onRemove={handleEliminarLinea}
                      onAgregarProveedor={handleAbrirNuevoProveedor}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleAgregarLinea}
              disabled={guardando}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-brand-blue bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar producto
            </button>

            <p className="text-xs text-gray-500">
              Total general:{" "}
              <span className="text-sm font-bold text-emerald-700">S/ {totalGeneral.toFixed(2)}</span>
            </p>
          </div>
        </div>

        {/* ── Progreso ── */}
        {guardando && progreso && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Registrando compra...
              </span>
              <span className="font-semibold">
                {progreso.actual} / {progreso.total}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-blue transition-all duration-300 rounded-full"
                style={{ width: `${Math.round((progreso.actual / progreso.total) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="pt-2 flex items-center justify-between gap-3">
          {/* ── Estado: pequeño y discreto, solo aparece después de intentar guardar ── */}
          {(guardadosCount > 0 || erroresCount > 0) ? (
            <p className="text-[11px] text-gray-500">
              <span className="text-emerald-600 font-semibold">{guardadosCount} guardado{guardadosCount === 1 ? "" : "s"}</span>
              {erroresCount > 0 && (
                <>
                  {" "}·{" "}
                  <span className="text-rose-600 font-semibold">{erroresCount} con error</span>
                </>
              )}
              {" "}de {lineas.length} línea{lineas.length === 1 ? "" : "s"}
            </p>
          ) : (
            <span />
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={onClose} disabled={guardando}>
              {hayGuardados ? "Cerrar" : "Cancelar"}
            </Button>
            <Button type="submit" disabled={guardando || !hayPendientes}>
              {guardando ? "Registrando..." : hayGuardados ? "Guardar faltantes" : "Registrar Compra"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>

    <AgregarProveedor
      isOpen={isAgregarProveedorOpen}
      onClose={() => {
        setIsAgregarProveedorOpen(false);
        setLineaTargetNuevoProveedor(null);
      }}
      onProveedorAgregado={handleProveedorCreado}
      elevated
    />
    </>
  );
}
