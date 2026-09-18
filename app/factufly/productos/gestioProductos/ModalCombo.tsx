"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ImageOff, ImagePlus, Loader2, Minus, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { useAuth } from "@/context/AuthContext";
import { conVarianteImagen } from "@/app/utils/cloudflareImagen";
import { Categoria, ProductoSucursal } from "./Producto";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** null = crear combo nuevo. */
  combo: ProductoSucursal | null;
  productos: ProductoSucursal[];
  categorias: Categoria[];
  sucursalId: number;
  onGuardado: (combo: ProductoSucursal) => void;
}

interface ItemForm {
  productoId: number;
  cantidad: number;
}

const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

/**
 * Alta y edición de combos: varios productos de la sucursal vendidos juntos a un
 * precio propio. El combo no tiene stock: al venderlo se descuenta cada producto.
 */
export default function ModalCombo({ isOpen, onClose, combo, productos, categorias, sucursalId, onGuardado }: Props) {
  const { accessToken, user } = useAuth();

  const [nombre, setNombre] = useState("");
  const [categoriaId, setCategoriaId] = useState<number | "">("");
  const [precio, setPrecio] = useState("");
  const [imagen, setImagen] = useState<string | null>(null);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [items, setItems] = useState<ItemForm[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputImagenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setNombre(combo?.nomProducto ?? "");
    setCategoriaId(combo?.categoria?.categoriaId ?? "");
    setPrecio(combo ? String(combo.sucursalProducto.precioUnitario ?? "") : "");
    setImagen(combo?.urlImagenProducto ?? null);
    setItems(combo?.comboItems?.map((i) => ({ productoId: i.productoId, cantidad: Number(i.cantidad) })) ?? []);
    setBusqueda("");
    setError(null);
  }, [isOpen, combo]);

  const porId = useMemo(() => new Map(productos.map((p) => [p.productoId, p])), [productos]);

  // Un combo solo puede llevar productos simples: ni otros combos ni paquetes.
  const candidatos = useMemo(() => {
    const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
    if (palabras.length === 0) return [];
    const agregados = new Set(items.map((i) => i.productoId));
    return productos
      .filter((p) => !p.esCombo && !p.esPaquete && !agregados.has(p.productoId) && p.productoId !== combo?.productoId)
      .filter((p) => {
        const texto = normalizar(`${p.nomProducto} ${p.codigo ?? ""} ${p.codigoBarras ?? ""}`);
        return palabras.every((w) => texto.includes(w));
      })
      .slice(0, 8);
  }, [busqueda, productos, items, combo?.productoId]);

  const precioSeparado = items.reduce(
    (s, i) => s + (porId.get(i.productoId)?.sucursalProducto.precioUnitario ?? 0) * i.cantidad,
    0,
  );
  const precioCombo = parseFloat(precio);
  const ahorro = Number.isFinite(precioCombo) ? precioSeparado - precioCombo : 0;

  // Cuántos combos completos alcanzan con el stock actual de los componentes.
  const alcanzaPara = useMemo(() => {
    const limites = items
      .map((i) => {
        const p = porId.get(i.productoId);
        if (!p || p.tipoProducto !== "BIEN" || p.sucursalProducto.stock == null) return null;
        return Math.floor(p.sucursalProducto.stock / i.cantidad);
      })
      .filter((n): n is number => n !== null);
    return limites.length ? Math.max(0, Math.min(...limites)) : null;
  }, [items, porId]);

  const agregar = (p: ProductoSucursal) => {
    setItems((prev) => [...prev, { productoId: p.productoId, cantidad: 1 }]);
    setBusqueda("");
    if (!categoriaId && p.categoria?.categoriaId) setCategoriaId(p.categoria.categoriaId);
  };

  const cambiarCantidad = (productoId: number, delta: number) =>
    setItems((prev) =>
      prev.map((i) => (i.productoId === productoId ? { ...i, cantidad: Math.max(1, Math.min(999, i.cantidad + delta)) } : i)),
    );

  const subirImagen = async (archivo: File) => {
    if (!archivo.type.startsWith("image/")) return;
    setSubiendoImagen(true);
    try {
      const form = new FormData();
      form.append("file", archivo, archivo.name);
      const res = await fetch("/api/upload-imagen", { method: "POST", body: form });
      const data = (await res.json()) as { ok?: boolean; url?: string };
      if (!res.ok || !data.ok || !data.url) throw new Error();
      setImagen(data.url);
    } catch {
      setError("No se pudo subir la imagen.");
    } finally {
      setSubiendoImagen(false);
    }
  };

  const guardar = async () => {
    if (!nombre.trim()) return setError("Ingresa el nombre del combo.");
    if (!categoriaId) return setError("Elige una categoría.");
    if (!Number.isFinite(precioCombo) || precioCombo <= 0) return setError("Ingresa el precio del combo.");
    if (items.length === 0 || (items.length === 1 && items[0].cantidad < 2))
      return setError("Agrega al menos dos productos, o más de una unidad del mismo.");

    setGuardando(true);
    setError(null);
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/productos/combos${combo ? `/${combo.productoId}` : ""}`;
      const res = await fetch(url, {
        method: combo ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          nomProducto: nombre.trim(),
          categoriaId,
          sucursalId,
          precioUnitario: precioCombo,
          urlImagenProducto: imagen,
          usuarioId: user?.id ? Number(user.id) : null,
          items,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.mensaje ?? "No se pudo guardar el combo.");
      onGuardado(data as ProductoSucursal);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el combo.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={guardando ? () => {} : onClose} title={combo ? "Editar combo" : "Nuevo combo"} className="max-w-2xl">
      <div className="space-y-4">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => inputImagenRef.current?.click()}
            className="relative h-24 w-24 shrink-0 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden hover:border-brand-blue/50"
            title="Imagen del combo (opcional)"
          >
            {subiendoImagen ? (
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            ) : imagen ? (
              <img src={conVarianteImagen(imagen, "thumbnail")} alt="" className="w-full h-full object-contain" />
            ) : (
              <ImagePlus className="w-6 h-6 text-gray-300" />
            )}
          </button>
          <input
            ref={inputImagenRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void subirImagen(f);
            }}
          />
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="sm:col-span-2 block">
              <span className="text-xs font-medium text-gray-600">Nombre del combo</span>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value.slice(0, 350))}
                placeholder="Ej.: Combo gaseosa + papas"
                className="mt-1 w-full h-9 px-2.5 rounded-md border border-gray-200 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Categoría</span>
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value ? Number(e.target.value) : "")}
                className="mt-1 w-full h-9 px-2 rounded-md border border-gray-200 text-sm bg-white outline-none focus:border-brand-blue"
              >
                <option value="">Elegir…</option>
                {categorias.map((c) => (
                  <option key={c.categoriaId} value={c.categoriaId}>
                    {c.categoriaNombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Precio del combo (S/)</span>
              <input
                value={precio}
                onChange={(e) => setPrecio(e.target.value.replace(/[^\d.]/g, "").slice(0, 9))}
                inputMode="decimal"
                placeholder="0.00"
                className="mt-1 w-full h-9 px-2.5 rounded-md border border-gray-200 text-sm outline-none tabular-nums focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
              />
            </label>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-700 mb-1.5">Productos del combo</p>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Busca un producto por nombre o código para agregarlo"
              className="w-full h-9 pl-8 pr-8 rounded-md border border-gray-200 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
            />
            {busqueda && (
              <button type="button" onClick={() => setBusqueda("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {candidatos.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                {candidatos.map((p) => (
                  <li key={p.productoId}>
                    <button
                      type="button"
                      onClick={() => agregar(p)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-blue-50"
                    >
                      <Plus className="w-3.5 h-3.5 text-brand-blue shrink-0" />
                      <span className="flex-1 min-w-0 text-sm text-gray-800 truncate">{p.nomProducto}</span>
                      <span className="text-xs text-gray-500 tabular-nums">{soles(p.sucursalProducto.precioUnitario ?? 0)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {items.length === 0 ? (
            <div className="mt-2 rounded-md border border-dashed border-gray-200 py-6 text-center text-xs text-gray-400">
              Todavía no agregaste productos
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-200">
              {items.map((i) => {
                const p = porId.get(i.productoId);
                return (
                  <li key={i.productoId} className="flex items-center gap-3 px-3 py-2">
                    <div className="h-9 w-9 shrink-0 rounded bg-gray-50 flex items-center justify-center overflow-hidden">
                      {p?.urlImagenProducto ? (
                        <img src={conVarianteImagen(p.urlImagenProducto, "thumbnail")} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <ImageOff className="w-4 h-4 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">
                        {p?.nomProducto ?? combo?.comboItems?.find((c) => c.productoId === i.productoId)?.nomProducto ?? "Producto no disponible"}
                      </p>
                      <p className="text-[11px] text-gray-400 tabular-nums">
                        {soles(p?.sucursalProducto.precioUnitario ?? 0)} c/u
                        {p?.tipoProducto === "BIEN" && p.sucursalProducto.stock != null && ` · stock ${p.sucursalProducto.stock}`}
                      </p>
                    </div>
                    <div className="flex items-center rounded-full border border-gray-200">
                      <button type="button" onClick={() => cambiarCantidad(i.productoId, -1)} className="h-7 w-7 flex items-center justify-center text-gray-500">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="min-w-5 text-center text-sm font-semibold tabular-nums">{i.cantidad}</span>
                      <button type="button" onClick={() => cambiarCantidad(i.productoId, 1)} className="h-7 w-7 flex items-center justify-center text-gray-500">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((x) => x.productoId !== i.productoId))}
                      className="p-1.5 text-gray-400 hover:text-rose-500"
                      aria-label="Quitar del combo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-center">
            <div>
              <p className="text-[10px] uppercase font-semibold text-amber-700/70">Por separado</p>
              <p className="text-sm font-bold text-gray-800 tabular-nums">{soles(precioSeparado)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-amber-700/70">El cliente ahorra</p>
              <p className={`text-sm font-bold tabular-nums ${ahorro > 0 ? "text-emerald-700" : "text-gray-400"}`}>
                {ahorro > 0 ? `${soles(ahorro)} (${Math.round((ahorro / precioSeparado) * 100)}%)` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-amber-700/70">Alcanza para</p>
              <p className="text-sm font-bold text-gray-800 tabular-nums">{alcanzaPara == null ? "—" : `${alcanzaPara} combos`}</p>
            </div>
          </div>
        )}

        <p className="flex items-start gap-1.5 text-[11px] text-gray-400">
          <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-500" />
          El combo no tiene stock propio: al venderlo se descuenta el stock de cada producto. En la tienda online aparece primero.
        </p>

        {error && (
          <p className="flex items-center gap-2 rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={guardando} className="h-9 px-4 rounded-md border border-gray-200 text-xs font-semibold text-gray-600">
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || subiendoImagen}
            className="h-9 px-4 rounded-md bg-brand-blue text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-[#0a2050] disabled:opacity-50"
          >
            {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {combo ? "Guardar cambios" : "Crear combo"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
