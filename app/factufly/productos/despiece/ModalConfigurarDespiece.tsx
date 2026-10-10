"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Check, Info, Loader2, Package, Plus, Scissors, Search, ShoppingCart, Sparkles, Trash2, X } from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { coincideBusqueda } from "@/app/utils/normalizarTexto";
import { abreviaturaUnidad } from "../gestioProductos/unidadMedida";
import { ProductoSucursal } from "../gestioProductos/Producto";
import {
  GuardarParteReceta,
  RecetaDespiece,
  cantidadTexto,
  filtrarDecimal,
  leerNumero,
  mismaUnidad,
  redondearPrecio,
  soles,
} from "./despiece";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Receta a editar; null = configurar un producto nuevo. */
  receta: RecetaDespiece | null;
  /** Producto entero ya elegido (p. ej. desde el listado de productos). */
  productoInicialId?: number | null;
  productos: ProductoSucursal[];
  recetas: RecetaDespiece[];
  guardarReceta: (
    productoBaseId: number,
    partes: GuardarParteReceta[],
    margen: number | null,
    despieceAlVender: boolean,
  ) => Promise<RecetaDespiece>;
  eliminarReceta: (productoBaseId: number) => Promise<void>;
  onGuardado: (receta: RecetaDespiece, partesNuevas: number) => void;
  onEliminado?: (productoBaseId: number) => void;
}

interface FilaParte {
  clave: string;
  productoId: number | null;
  /** Nombre del producto que se creará (cuando productoId es null). */
  nombreNuevo: string;
  rinde: string;
  precioNuevo: string;
  /** El usuario escribió el precio: ya no se recalcula solo. */
  precioEditado?: boolean;
}

const COLORES = ["bg-emerald-500", "bg-sky-500", "bg-violet-500", "bg-amber-500", "bg-pink-500", "bg-teal-500", "bg-indigo-500"];

let contadorClaves = 0;
const nuevaClave = () => `f${++contadorClaves}`;

const puedeDespiezarse = (p: ProductoSucursal) =>
  !p.esCombo && !p.esPaquete && (p.tipoProducto ?? "BIEN").toUpperCase() === "BIEN";

/**
 * Configura en qué partes se despieza un producto y cuánto rinde normalmente cada una.
 * Las partes que todavía no existen se escriben y se crean solas como productos
 * normales (mismo tipo de unidad y categoría, sin stock).
 */
export default function ModalConfigurarDespiece({
  isOpen,
  onClose,
  receta,
  productoInicialId,
  productos,
  recetas,
  guardarReceta,
  eliminarReceta,
  onGuardado,
  onEliminado,
}: Props) {
  const [baseId, setBaseId] = useState<number | null>(null);
  const [filas, setFilas] = useState<FilaParte[]>([]);
  const [margen, setMargen] = useState("30");
  const [alVender, setAlVender] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intentoGuardar, setIntentoGuardar] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setIntentoGuardar(false);
    setConfirmarEliminar(false);
    if (receta) {
      const igual = (u: string | null) => mismaUnidad(u, receta.unidadMedida);
      setBaseId(receta.productoBaseId);
      setFilas(
        receta.partes.map((p) => ({
          clave: nuevaClave(),
          productoId: p.productoId,
          nombreNuevo: "",
          rinde: cantidadTexto(igual(p.unidadMedida) ? p.rendimiento * 100 : p.rendimiento),
          precioNuevo: "",
        })),
      );
      setMargen(receta.margenObjetivo != null ? cantidadTexto(receta.margenObjetivo) : "30");
      setAlVender(!!receta.despieceAlVender);
    } else {
      setBaseId(productoInicialId ?? null);
      setFilas([{ clave: nuevaClave(), productoId: null, nombreNuevo: "", rinde: "", precioNuevo: "" }]);
      setMargen("30");
      setAlVender(false);
    }
  }, [isOpen, receta, productoInicialId]);

  const porId = useMemo(() => new Map(productos.map((p) => [p.productoId, p])), [productos]);
  const base = baseId != null ? porId.get(baseId) ?? null : null;
  const unidadBase = base?.unidadMedida ?? receta?.unidadMedida ?? "KGM";
  const nombreBase = base?.nomProducto ?? receta?.nomProducto ?? "";
  // Las partes nuevas van por kilo; si el entero también va por kilo, el rinde se da en %.
  const unidadParteNueva = "KGM";

  const unidadDeFila = (f: FilaParte) =>
    f.productoId != null
      ? porId.get(f.productoId)?.unidadMedida ?? receta?.partes.find((p) => p.productoId === f.productoId)?.unidadMedida ?? "KGM"
      : unidadParteNueva;

  const nombreDeFila = (f: FilaParte) =>
    f.productoId != null
      ? porId.get(f.productoId)?.nomProducto ?? receta?.partes.find((p) => p.productoId === f.productoId)?.nomProducto ?? "Producto"
      : f.nombreNuevo;

  const enPorcentaje = (f: FilaParte) => mismaUnidad(unidadDeFila(f), unidadBase);

  // Productos que pueden ser el entero: los que no tienen receta todavía.
  const conReceta = useMemo(() => new Set(recetas.map((r) => r.productoBaseId)), [recetas]);
  const candidatosBase = useMemo(
    () => productos.filter((p) => puedeDespiezarse(p) && (!conReceta.has(p.productoId) || p.productoId === receta?.productoBaseId)),
    [productos, conReceta, receta?.productoBaseId],
  );

  const filasConParte = filas.filter((f) => f.productoId != null || f.nombreNuevo.trim());
  const sumaPorcentaje = filasConParte
    .filter(enPorcentaje)
    .reduce((s, f) => s + (Number.isFinite(leerNumero(f.rinde)) ? leerNumero(f.rinde) : 0), 0);
  const todasEnPorcentaje = filasConParte.length > 0 && filasConParte.every(enPorcentaje);
  const merma = 100 - sumaPorcentaje;

  // ── Precio sugerido de las partes nuevas ──
  // Por cada 1 kg del entero: cuesta C y, para ganar m %, todo lo que sale debe venderse
  // en C / (1 − m). Las partes con precio (ya existentes o escritas a mano) aportan lo
  // suyo; lo que falta se reparte por peso entre las que aún no tienen precio. Así, si
  // pones el precio de la menudencia (que lo fija el mercado), la carne carga el resto.
  const costoBase = base?.sucursalProducto.ultimoPrecioCompra ?? receta?.costoUnitario ?? 0;
  const margenNum = leerNumero(margen);
  const margenCalculo = Number.isFinite(margenNum) && margenNum >= 0 && margenNum < 100 ? margenNum : 30;
  const rindePorUnidad = (f: FilaParte) => {
    const r = leerNumero(f.rinde);
    if (!Number.isFinite(r) || r <= 0) return 0;
    return enPorcentaje(f) ? r / 100 : r;
  };
  const precioFijo = (f: FilaParte): number | null => {
    if (f.productoId != null) return porId.get(f.productoId)?.sucursalProducto.precioUnitario ?? null;
    if (f.precioEditado) {
      const v = leerNumero(f.precioNuevo);
      return Number.isFinite(v) && v > 0 ? v : null;
    }
    return null;
  };
  const precioSugerido = (() => {
    if (!(costoBase > 0)) return null;
    const ventaNecesaria = costoBase / (1 - margenCalculo / 100);
    let aportado = 0;
    let rindeSinPrecio = 0;
    for (const f of filasConParte) {
      const r = rindePorUnidad(f);
      const precio = precioFijo(f);
      if (precio != null) aportado += r * precio;
      else rindeSinPrecio += r;
    }
    if (rindeSinPrecio <= 0) return null;
    const precio = (ventaNecesaria - aportado) / rindeSinPrecio;
    return precio > 0 ? redondearPrecio(precio) : null;
  })();
  /** Precio que se ve (y se guarda) en una parte nueva: el escrito o el calculado. */
  const precioMostrado = (f: FilaParte) =>
    f.precioEditado ? f.precioNuevo : rindePorUnidad(f) > 0 && precioSugerido != null ? precioSugerido.toFixed(2) : "";

  const actualizarFila = (clave: string, cambios: Partial<FilaParte>) =>
    setFilas((prev) => prev.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)));

  // Al elegir o crear una parte, el cursor pasa a "Sale normalmente" de esa fila.
  const enfocarRinde = (clave: string) =>
    setTimeout(() => document.getElementById(`rinde-${clave}`)?.focus(), 30);

  const quitarFila = (clave: string) =>
    setFilas((prev) => {
      const next = prev.filter((f) => f.clave !== clave);
      return next.length ? next : [{ clave: nuevaClave(), productoId: null, nombreNuevo: "", rinde: "", precioNuevo: "" }];
    });

  const agregarFila = () =>
    setFilas((prev) => [...prev, { clave: nuevaClave(), productoId: null, nombreNuevo: "", rinde: "", precioNuevo: "" }]);

  const elegidos = new Set(filas.map((f) => f.productoId).filter((id): id is number => id != null));

  const guardar = async () => {
    setIntentoGuardar(true);
    setError(null);
    if (!baseId) return setError("Elige el producto que compras entero.");

    const partes: GuardarParteReceta[] = [];
    for (const f of filasConParte) {
      const nombre = nombreDeFila(f);
      const rinde = leerNumero(f.rinde);
      if (!Number.isFinite(rinde) || rinde <= 0)
        return setError(`Indica cuánto sale normalmente de "${nombre}".`);
      if (f.productoId == null) {
        const precio = leerNumero(precioMostrado(f));
        if (!Number.isFinite(precio) || precio <= 0)
          return setError(`Indica a cuánto vendes "${nombre}" (se crea como producto nuevo).`);
        partes.push({ nombreNuevo: f.nombreNuevo.trim(), unidadMedida: unidadParteNueva, precioVenta: precio, rendimiento: enPorcentaje(f) ? rinde / 100 : rinde });
      } else {
        partes.push({ productoId: f.productoId, rendimiento: enPorcentaje(f) ? rinde / 100 : rinde });
      }
    }
    if (partes.length === 0) return setError("Agrega al menos una parte, por ejemplo «Carne».");
    if (sumaPorcentaje > 100.0001) return setError("Las partes suman más del 100 %: revisa los porcentajes.");

    const m = leerNumero(margen);
    if (Number.isFinite(m) && (m < 0 || m >= 100)) return setError("La ganancia debe estar entre 0 % y 99 %.");

    setGuardando(true);
    try {
      const guardada = await guardarReceta(baseId, partes, Number.isFinite(m) ? m : null, alVender);
      onGuardado(guardada, partes.filter((p) => p.productoId == null).length);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    if (!receta) return;
    setGuardando(true);
    try {
      await eliminarReceta(receta.productoBaseId);
      onEliminado?.(receta.productoBaseId);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo quitar el despiece.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={guardando ? () => {} : onClose}
      title={receta ? `Partes de ${receta.nomProducto ?? "producto"}` : "Configurar despiece"}
      className="max-w-2xl"
    >
      <div className="space-y-5">
        {/* 1. Producto entero */}
        <section>
          <Paso numero={1} titulo="¿Qué producto compras entero?" />
          {receta || (baseId && base) ? (
            <div className="mt-2 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
              <div className="h-9 w-9 shrink-0 rounded-lg bg-brand-blue/10 flex items-center justify-center">
                <Package className="w-4.5 h-4.5 text-brand-blue" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{nombreBase}</p>
                <p className="text-[11px] text-gray-500">
                  Se vende por {abreviaturaUnidad(unidadBase)} · stock {cantidadTexto(base?.sucursalProducto.stock ?? receta?.stock ?? 0)}{" "}
                  {abreviaturaUnidad(unidadBase)}
                </p>
              </div>
              {!receta && (
                <button type="button" onClick={() => setBaseId(null)} className="text-xs font-semibold text-brand-blue hover:underline">
                  Cambiar
                </button>
              )}
            </div>
          ) : (
            <>
              <BuscadorProducto
                className="mt-2"
                productos={candidatosBase}
                placeholder="Busca el producto, por ejemplo «Pollo entero»"
                onElegir={(p) => setBaseId(p.productoId)}
                error={intentoGuardar && !baseId}
              />
              <p className="mt-1.5 text-[11px] text-gray-400">
                Si todavía no existe, créalo como cualquier producto (por kilo) y vuelve aquí. Las compras siguen entrando por Compras.
              </p>
            </>
          )}
        </section>

        {/* 2. Partes */}
        <section>
          <Paso numero={2} titulo="¿En qué partes lo despiezas?" />
          <p className="mt-1 text-[11px] text-gray-500">
            Escribe el nombre de cada parte que vendes. Si no existe como producto, se crea sola. Lo que se bota no se escribe: es la merma.
          </p>

          <div className="mt-2 rounded-lg border border-gray-200 divide-y divide-gray-100">
            <div className="hidden sm:grid grid-cols-[1fr_120px_110px_32px] gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              <span>Parte</span>
              <span>Sale normalmente</span>
              <span>Precio de venta</span>
              <span />
            </div>
            {filas.map((f, i) => {
              const tieneParte = f.productoId != null || !!f.nombreNuevo.trim();
              const producto = f.productoId != null ? porId.get(f.productoId) : null;
              const pct = enPorcentaje(f);
              const rindeInvalido = intentoGuardar && tieneParte && !(leerNumero(f.rinde) > 0);
              const precioInvalido = intentoGuardar && f.productoId == null && tieneParte && !(leerNumero(precioMostrado(f)) > 0);
              const precioCalculado = f.productoId == null && !f.precioEditado && precioMostrado(f) !== "";
              return (
                <div key={f.clave} className="grid grid-cols-[1fr_32px] sm:grid-cols-[1fr_120px_110px_32px] gap-2 px-3 py-2 items-center">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${COLORES[i % COLORES.length]}`} />
                    {tieneParte ? (
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{nombreDeFila(f)}</p>
                        {f.productoId == null ? (
                          <p className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Producto nuevo · por {abreviaturaUnidad(unidadParteNueva)}
                          </p>
                        ) : (
                          <p className="text-[10px] text-gray-400 tabular-nums">
                            {soles(producto?.sucursalProducto.precioUnitario ?? receta?.partes.find((p) => p.productoId === f.productoId)?.precioUnitario ?? 0)} el{" "}
                            {abreviaturaUnidad(unidadDeFila(f))} · stock {cantidadTexto(producto?.sucursalProducto.stock ?? 0)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <BuscadorProducto
                        className="flex-1"
                        productos={productos.filter((p) => puedeDespiezarse(p) && p.productoId !== baseId && !elegidos.has(p.productoId))}
                        placeholder={i === 0 ? "Escribe la parte, ej.: Carne" : i === 1 ? "Ej.: Menudencia" : "Nombre de la parte"}
                        permitirCrear
                        autoFocus={i > 0}
                        onElegir={(p) => {
                          actualizarFila(f.clave, { productoId: p.productoId });
                          enfocarRinde(f.clave);
                        }}
                        onCrear={(nombre) => {
                          actualizarFila(f.clave, { nombreNuevo: nombre });
                          enfocarRinde(f.clave);
                        }}
                      />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => quitarFila(f.clave)}
                    className="sm:order-last p-1.5 text-gray-400 hover:text-rose-500 justify-self-end"
                    aria-label="Quitar parte"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="col-span-2 sm:col-span-1 flex items-center gap-1.5">
                    <div
                      className={`flex items-center h-8 rounded-md border bg-white px-2 w-full ${rindeInvalido ? "border-rose-400" : "border-gray-200"} focus-within:border-brand-blue`}
                    >
                      <input
                        id={`rinde-${f.clave}`}
                        value={f.rinde}
                        onChange={(e) => actualizarFila(f.clave, { rinde: filtrarDecimal(e.target.value, 2) })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") document.getElementById(`precio-${f.clave}`)?.focus();
                        }}
                        inputMode="decimal"
                        placeholder="0"
                        disabled={!tieneParte}
                        className="w-full min-w-0 text-sm outline-none tabular-nums text-right disabled:bg-white"
                      />
                      <span className="ml-1 text-xs text-gray-400 whitespace-nowrap">
                        {pct ? "%" : `${abreviaturaUnidad(unidadDeFila(f))}/${abreviaturaUnidad(unidadBase)}`}
                      </span>
                    </div>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    {f.productoId == null ? (
                      <>
                        <div
                          className={`flex items-center h-8 rounded-md border px-2 focus-within:border-brand-blue ${precioInvalido ? "border-rose-400 bg-white" : precioCalculado ? "border-emerald-300 bg-emerald-50/50" : "border-gray-200 bg-white"}`}
                        >
                          <span className="mr-1 text-xs text-gray-400">S/</span>
                          <input
                            id={`precio-${f.clave}`}
                            value={precioMostrado(f)}
                            onChange={(e) =>
                              actualizarFila(f.clave, { precioNuevo: filtrarDecimal(e.target.value, 2), precioEditado: true })
                            }
                            inputMode="decimal"
                            placeholder="0.00"
                            disabled={!tieneParte}
                            className="w-full min-w-0 text-sm outline-none tabular-nums text-right bg-transparent"
                          />
                        </div>
                        {precioCalculado ? (
                          <p className="mt-0.5 text-[10px] leading-tight text-emerald-700">Calculado para ganar {cantidadTexto(margenCalculo)} %</p>
                        ) : f.precioEditado && precioSugerido != null && rindePorUnidad(f) > 0 ? (
                          <button
                            type="button"
                            onClick={() => actualizarFila(f.clave, { precioNuevo: "", precioEditado: false })}
                            className="mt-0.5 text-[10px] leading-tight text-gray-400 hover:text-brand-blue"
                          >
                            Usar el calculado
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-[11px] text-gray-400 leading-tight">Se ajusta al despiezar</p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Merma */}
            {todasEnPorcentaje && sumaPorcentaje > 0 && (
              <div className="grid grid-cols-[1fr_32px] sm:grid-cols-[1fr_120px_110px_32px] gap-2 px-3 py-2 items-center bg-amber-50/60">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-gray-300" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Merma</p>
                    <p className="text-[10px] text-gray-500">Lo que se bota: no entra al stock</p>
                  </div>
                </div>
                <span className="hidden sm:block" />
                <p className={`col-span-2 sm:col-span-1 text-sm font-semibold tabular-nums text-right pr-2 ${merma < 0 ? "text-rose-600" : "text-amber-700"}`}>
                  {cantidadTexto(Math.max(merma, merma < 0 ? merma : 0))} %
                </p>
                <span className="hidden sm:block" />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={agregarFila}
            className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-brand-blue hover:underline"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar otra parte
          </button>

          {filasConParte.some((f) => f.productoId == null) && (
            <p className="mt-2 text-[11px] text-gray-500 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-px text-gray-400" />
              {costoBase > 0 ? (
                <span>
                  El precio se calcula solo con lo que te cuesta {nombreBase || "el entero"} ({soles(costoBase)} el{" "}
                  {abreviaturaUnidad(unidadBase)}), la merma y la ganancia del paso 3. Si ya sabes a cuánto se vende una
                  parte (por ejemplo la menudencia), escríbelo y las demás se recalculan.
                </span>
              ) : (
                <span>
                  Registra primero la compra de {nombreBase || "este producto"} en Compras: con su costo el precio de cada
                  parte se calcula solo. Mientras tanto, escríbelo tú.
                </span>
              )}
            </p>
          )}

          {/* Barra visual del rendimiento */}
          {todasEnPorcentaje && sumaPorcentaje > 0 && (
            <div className="mt-3">
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
                {filas.map((f, i) => {
                  const v = leerNumero(f.rinde);
                  if (!(v > 0) || !(f.productoId != null || f.nombreNuevo.trim())) return null;
                  return <div key={f.clave} className={COLORES[i % COLORES.length]} style={{ width: `${Math.min(v, 100)}%` }} />;
                })}
                {merma > 0 && <div className="bg-gray-300" style={{ width: `${merma}%` }} />}
              </div>
              <p className="mt-1 text-[11px] text-gray-500">
                De cada 10 {abreviaturaUnidad(unidadBase)} de {nombreBase || "producto"}:{" "}
                {filasConParte
                  .map((f) => `${cantidadTexto((leerNumero(f.rinde) || 0) / 10)} ${abreviaturaUnidad(unidadBase)} de ${nombreDeFila(f)}`)
                  .join(", ")}
                {merma > 0 && ` y ${cantidadTexto(merma / 10)} ${abreviaturaUnidad(unidadBase)} de merma`}.
              </p>
            </div>
          )}
        </section>

        {/* 3. Ganancia */}
        <section>
          <Paso numero={3} titulo="¿Cuánto quieres ganar?" />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div className="flex items-center h-9 w-28 rounded-md border border-gray-200 bg-white px-2 focus-within:border-brand-blue">
              <input
                value={margen}
                onChange={(e) => setMargen(filtrarDecimal(e.target.value, 1))}
                inputMode="decimal"
                className="w-full min-w-0 text-sm outline-none tabular-nums text-right"
              />
              <span className="ml-1 text-xs text-gray-400">%</span>
            </div>
            <p className="flex-1 min-w-[200px] text-[11px] text-gray-500 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-px text-gray-400" />
              De lo que cobras. Al despiezar te propone los precios para ganar esto; tú decides si los usas.
            </p>
          </div>
        </section>

        {/* 4. Cómo se despieza */}
        <section>
          <Paso numero={4} titulo="¿Cómo lo cortas?" />
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <OpcionCorte
              activa={alVender}
              onClick={() => setAlVender(true)}
              icono={<ShoppingCart className="w-4 h-4" />}
              titulo="A pedido, cuando el cliente compra"
              detalle={`En la caja vendes las partes directo. Si no hay cortado, se descuenta solo de ${nombreBase || "el entero"} con lo que sale normalmente.`}
            />
            <OpcionCorte
              activa={!alVender}
              onClick={() => setAlVender(false)}
              icono={<Scissors className="w-4 h-4" />}
              titulo="Por tandas, antes de vender"
              detalle="Cortas varios de una vez, pesas lo que salió y lo registras con «Despiezar». Es lo más exacto."
            />
          </div>
        </section>

        {error && (
          <p className="flex items-center gap-2 rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {receta &&
            (confirmarEliminar ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-600">¿Dejar de despiezar este producto?</span>
                <button type="button" onClick={eliminar} disabled={guardando} className="h-8 px-3 rounded-md bg-rose-600 text-white font-semibold">
                  Sí, quitar
                </button>
                <button type="button" onClick={() => setConfirmarEliminar(false)} className="h-8 px-2 text-gray-500">
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmarEliminar(true)}
                className="h-9 px-3 rounded-md text-xs font-semibold text-rose-600 hover:bg-rose-50"
              >
                Dejar de despiezar
              </button>
            ))}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="h-9 px-4 rounded-md border border-gray-200 text-xs font-semibold text-gray-600"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={guardando}
              className="h-9 px-4 rounded-md bg-brand-blue text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-[#0a2050] disabled:opacity-50"
            >
              {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {receta ? "Guardar cambios" : "Guardar despiece"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function OpcionCorte({
  activa,
  onClick,
  icono,
  titulo,
  detalle,
}: {
  activa: boolean;
  onClick: () => void;
  icono: ReactNode;
  titulo: string;
  detalle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`relative text-left rounded-lg border p-3 transition-colors ${activa ? "border-brand-blue bg-blue-50/60 ring-1 ring-brand-blue/30" : "border-gray-200 bg-white hover:border-gray-300"}`}
    >
      {activa && (
        <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-brand-blue text-white flex items-center justify-center">
          <Check className="w-3 h-3" />
        </span>
      )}
      <span className={`flex items-center gap-1.5 text-xs font-semibold ${activa ? "text-brand-blue" : "text-gray-800"}`}>
        {icono}
        {titulo}
      </span>
      <span className="mt-1 block text-[11px] leading-snug text-gray-500 pr-4">{detalle}</span>
    </button>
  );
}

function Paso({ numero, titulo }: { numero: number; titulo: string }) {
  return (
    <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
      <span className="h-5 w-5 rounded-full bg-brand-blue text-white text-[11px] font-bold flex items-center justify-center">{numero}</span>
      {titulo}
    </h4>
  );
}

/** Buscador de productos con opción de crear uno nuevo con el texto escrito. */
function BuscadorProducto({
  productos,
  placeholder,
  onElegir,
  onCrear,
  permitirCrear = false,
  autoFocus = false,
  error = false,
  className = "",
}: {
  productos: ProductoSucursal[];
  placeholder: string;
  onElegir: (p: ProductoSucursal) => void;
  onCrear?: (nombre: string) => void;
  permitirCrear?: boolean;
  autoFocus?: boolean;
  error?: boolean;
  className?: string;
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cerrar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);

  const q = texto.trim();
  const resultados = useMemo(
    () => (q ? productos.filter((p) => coincideBusqueda(q, p.nomProducto, p.codigo, p.codigoBarras ?? undefined)).slice(0, 7) : []),
    [q, productos],
  );
  const coincidenciaExacta = resultados.some((p) => (p.nomProducto ?? "").trim().toLowerCase() === q.toLowerCase());
  const mostrarCrear = permitirCrear && q.length >= 2 && !coincidenciaExacta;
  const total = resultados.length + (mostrarCrear ? 1 : 0);

  const elegir = (indice: number) => {
    if (indice < resultados.length) onElegir(resultados[indice]);
    else if (mostrarCrear) onCrear?.(q.replace(/\s+/g, " "));
    setTexto("");
    setAbierto(false);
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div
        className={`flex items-center h-9 rounded-md border bg-white px-2.5 ${error ? "border-rose-400" : "border-gray-200"} focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/15`}
      >
        <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <input
          value={texto}
          autoFocus={autoFocus}
          onChange={(e) => {
            setTexto(e.target.value.slice(0, 120));
            setAbierto(true);
            setActivo(0);
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={(e) => {
            if (!abierto || total === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActivo((a) => (a + 1) % total);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActivo((a) => (a - 1 + total) % total);
            } else if (e.key === "Enter") {
              e.preventDefault();
              elegir(activo);
            } else if (e.key === "Escape") {
              setAbierto(false);
            }
          }}
          placeholder={placeholder}
          className="ml-2 w-full min-w-0 text-sm outline-none bg-transparent"
        />
        {texto && (
          <button type="button" onClick={() => setTexto("")} className="text-gray-400">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {abierto && q && (
        <ul className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {resultados.map((p, i) => (
            <li key={p.productoId}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  elegir(i);
                }}
                onMouseEnter={() => setActivo(i)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left ${activo === i ? "bg-blue-50" : ""}`}
              >
                <Package className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="flex-1 min-w-0 text-sm text-gray-800 truncate">{p.nomProducto}</span>
                <span className="text-[11px] text-gray-400 tabular-nums whitespace-nowrap">
                  {soles(p.sucursalProducto.precioUnitario ?? 0)} · {abreviaturaUnidad(p.unidadMedida)}
                </span>
              </button>
            </li>
          ))}
          {mostrarCrear && (
            <li>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  elegir(resultados.length);
                }}
                onMouseEnter={() => setActivo(resultados.length)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-brand-blue border-t border-blue-100 ${activo === resultados.length ? "bg-blue-100/70" : "bg-blue-50/60"}`}
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span className="min-w-0">
                  Crear «{q}» <span className="font-normal text-brand-blue/70">como producto nuevo</span>
                </span>
              </button>
            </li>
          )}
          {resultados.length === 0 && !mostrarCrear && (
            <li className="px-3 py-2.5 text-xs text-gray-400 text-center">No hay productos con ese nombre</li>
          )}
        </ul>
      )}
    </div>
  );
}
