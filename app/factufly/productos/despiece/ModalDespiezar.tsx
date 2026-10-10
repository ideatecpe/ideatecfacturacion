"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Info,
  Loader2,
  Scissors,
  Settings2,
  Trash2,
  Wand2,
} from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { abreviaturaUnidad } from "../gestioProductos/unidadMedida";
import {
  Despiece,
  RecetaDespiece,
  cantidadTexto,
  costoPeps,
  filtrarDecimal,
  leerNumero,
  mismaUnidad,
  porcentajeTexto,
  preciosSugeridos,
  repartirCosto,
  soles,
} from "./despiece";
import { DespiezarPayload } from "./useDespiece";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  receta: RecetaDespiece | null;
  despiezar: (payload: DespiezarPayload) => Promise<Despiece>;
  onDespiezado?: (resultado: Despiece) => void;
  /** Abre la configuración de partes de este producto. */
  onConfigurar?: () => void;
}

interface FilaDespiece {
  productoId: number;
  cantidad: string;
  /** El usuario pesó y escribió la cantidad: ya no se recalcula con el rendimiento. */
  cantidadEditada: boolean;
  precio: string;
}

const COLORES = ["bg-emerald-500", "bg-sky-500", "bg-violet-500", "bg-amber-500", "bg-pink-500", "bg-teal-500", "bg-indigo-500"];
const redondear3 = (n: number) => Math.round(n * 1000) / 1000;
// Columnas de las partes desde sm; en móvil cada parte es una tarjeta. Clase completa
// en un literal para que Tailwind la detecte.
const COLUMNAS_SM = "sm:grid-cols-[minmax(0,1.3fr)_8rem_5.5rem_9rem_5rem]";

/**
 * Despieza un producto entero: se indica cuánto se despieza, se pesan las partes
 * (vienen propuestas según lo que rinde normalmente) y la pantalla muestra en vivo el
 * costo real de cada parte, la merma y la ganancia con los precios de venta.
 */
export default function ModalDespiezar({ isOpen, onClose, receta, despiezar, onDespiezado, onConfigurar }: Props) {
  const [cantidad, setCantidad] = useState("");
  const [filas, setFilas] = useState<FilaDespiece[]>([]);
  const [margen, setMargen] = useState("30");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Despiece | null>(null);
  const [stockAntes, setStockAntes] = useState(0);
  const cantidadRef = useRef<HTMLInputElement>(null);

  const partes = useMemo(() => (receta?.partes ?? []).filter((p) => p.disponible), [receta]);
  const partesNoDisponibles = (receta?.partes ?? []).filter((p) => !p.disponible);

  const reiniciar = () => {
    if (!receta) return;
    setCantidad("");
    setFilas(
      partes.map((p) => ({
        productoId: p.productoId,
        cantidad: "",
        cantidadEditada: false,
        precio: p.precioUnitario > 0 ? p.precioUnitario.toFixed(2) : "",
      })),
    );
    setMargen(receta.margenObjetivo != null ? cantidadTexto(receta.margenObjetivo) : "30");
    setError(null);
    setResultado(null);
    setTimeout(() => cantidadRef.current?.focus(), 80);
  };

  useEffect(() => {
    if (isOpen) reiniciar();
    // Solo al abrir o al cambiar de producto: la receta se relee después de despiezar
    // y no debe borrar el resultado que se está mostrando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, receta?.productoBaseId]);

  if (!receta) return null;

  const unidad = abreviaturaUnidad(receta.unidadMedida);
  const cant = leerNumero(cantidad);
  const cantValida = Number.isFinite(cant) && cant > 0;

  const cambiarCantidad = (texto: string) => {
    const limpio = filtrarDecimal(texto, 3);
    setCantidad(limpio);
    const n = leerNumero(limpio);
    // Propone lo que sale normalmente de cada parte; las que ya se pesaron no se tocan.
    setFilas((prev) =>
      prev.map((f) => {
        if (f.cantidadEditada) return f;
        const parte = partes.find((p) => p.productoId === f.productoId);
        if (!parte) return f;
        return { ...f, cantidad: Number.isFinite(n) && n > 0 ? cantidadTexto(redondear3(n * parte.rendimiento)) : "" };
      }),
    );
  };

  const actualizarFila = (productoId: number, cambios: Partial<FilaDespiece>) =>
    setFilas((prev) => prev.map((f) => (f.productoId === productoId ? { ...f, ...cambios } : f)));

  // ── Cálculo en vivo ──
  const filasCalc = filas.map((f) => {
    const parte = partes.find((p) => p.productoId === f.productoId)!;
    const q = leerNumero(f.cantidad);
    const precio = leerNumero(f.precio);
    return {
      fila: f,
      parte,
      cantidad: Number.isFinite(q) && q > 0 ? q : 0,
      precio: Number.isFinite(precio) && precio > 0 ? precio : 0,
    };
  });

  const stockAlcanza = !cantValida || cant <= receta.stock + 0.0005;
  const costoTotal = cantValida ? costoPeps(receta.lotes, cant) : null;
  const sinCostoRegistrado = cantValida && stockAlcanza && costoTotal == null;
  const costo = costoTotal ?? 0;

  const reparto = repartirCosto(costo, filasCalc.map((f) => ({ cantidad: f.cantidad, precio: f.precio })));
  const m = leerNumero(margen);
  const margenValido = Number.isFinite(m) && m >= 0 && m < 100;
  // Los sugeridos mantienen la proporción de los precios actuales (no de los que se están editando).
  const sugeridos = preciosSugeridos(
    costo,
    filasCalc.map((f) => ({ cantidad: f.cantidad, precio: f.parte.precioUnitario })),
    margenValido ? m : 30,
  );

  const todasMismaUnidad = partes.every((p) => mismaUnidad(p.unidadMedida, receta.unidadMedida));
  const sumaPartes = filasCalc.reduce((s, f) => s + f.cantidad, 0);
  const merma = cantValida && todasMismaUnidad ? redondear3(cant - sumaPartes) : null;
  const mermaPct = merma != null && cantValida ? (merma / cant) * 100 : null;
  const mermaNormalPct = todasMismaUnidad ? Math.max(0, 100 - partes.reduce((s, p) => s + p.rendimiento * 100, 0)) : null;
  const mermaAlta = mermaPct != null && mermaNormalPct != null && mermaPct > mermaNormalPct + 3;
  const partesExceden = merma != null && merma < -0.0005;

  const venta = filasCalc.reduce((s, f) => s + f.cantidad * f.precio, 0);
  const ganancia = venta - costo;
  const margenReal = venta > 0 ? (ganancia / venta) * 100 : null;
  const algunaSinPrecio = filasCalc.some((f) => f.cantidad > 0 && f.precio <= 0);
  const cambiosPrecio = filasCalc.filter((f) => f.precio > 0 && Math.abs(f.precio - f.parte.precioUnitario) >= 0.005);

  const aplicarSugeridos = () =>
    setFilas((prev) =>
      prev.map((f) => {
        const i = filasCalc.findIndex((x) => x.fila.productoId === f.productoId);
        return i >= 0 && sugeridos[i] > 0 ? { ...f, precio: sugeridos[i].toFixed(2) } : f;
      }),
    );

  const volverPreciosActuales = () =>
    setFilas((prev) =>
      prev.map((f) => {
        const parte = partes.find((p) => p.productoId === f.productoId);
        return { ...f, precio: parte && parte.precioUnitario > 0 ? parte.precioUnitario.toFixed(2) : "" };
      }),
    );

  const puedeConfirmar =
    cantValida && stockAlcanza && costoTotal != null && sumaPartes > 0 && !partesExceden && !enviando;

  const confirmar = async () => {
    setError(null);
    if (!cantValida) return setError(`Indica cuántos ${unidad} vas a despiezar.`);
    if (!stockAlcanza) return setError(`Solo tienes ${cantidadTexto(receta.stock)} ${unidad} de ${receta.nomProducto}.`);
    if (sumaPartes <= 0) return setError("Indica cuánto salió de al menos una parte.");
    if (partesExceden) return setError(`Las partes suman más de los ${cantidadTexto(cant)} ${unidad} que despiezas.`);
    if (algunaSinPrecio)
      return setError("Pon el precio de venta de todas las partes que salieron: así se reparte bien el costo.");

    setEnviando(true);
    setStockAntes(receta.stock);
    try {
      const r = await despiezar({
        productoBaseId: receta.productoBaseId,
        cantidad: cant,
        actualizarPrecios: true,
        margenObjetivo: margenValido ? m : null,
        partes: filasCalc
          .filter((f) => f.cantidad > 0)
          .map((f) => ({ productoId: f.fila.productoId, cantidad: redondear3(f.cantidad), precioVenta: f.precio > 0 ? f.precio : null })),
      });
      setResultado(r);
      onDespiezado?.(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar el despiece.");
    } finally {
      setEnviando(false);
    }
  };

  const titulo = `Despiezar ${receta.nomProducto ?? ""}`.trim();

  return (
    <Modal isOpen={isOpen} onClose={enviando ? () => {} : onClose} title={titulo} className="max-w-3xl">
      {resultado ? (
        <ResultadoDespiece
          resultado={resultado}
          stockRestante={Math.max(0, stockAntes - resultado.cantidad)}
          onOtro={reiniciar}
          onCerrar={onClose}
        />
      ) : (
        <div className="space-y-4">
          {/* Cabecera: lo que hay del entero */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-600">
            <span>
              Tienes <strong className="text-gray-900 tabular-nums">{cantidadTexto(receta.stock)} {unidad}</strong>
            </span>
            <span>
              Te costó{" "}
              <strong className="text-gray-900 tabular-nums">
                {receta.costoUnitario != null ? soles(receta.costoUnitario) : "—"}
              </strong>{" "}
              el {unidad}
            </span>
            {onConfigurar && (
              <button
                type="button"
                onClick={onConfigurar}
                className="ml-auto flex items-center gap-1 font-semibold text-brand-blue hover:underline"
              >
                <Settings2 className="w-3.5 h-3.5" /> Configurar partes
              </button>
            )}
          </div>

          {/* Cuánto se despieza */}
          <div>
            <label className="text-sm font-semibold text-gray-800" htmlFor="cantidad-despiece">
              ¿Cuántos {unidad} vas a despiezar?
            </label>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <div
                className={`flex items-center h-11 w-44 rounded-lg border-2 bg-white px-3 ${!stockAlcanza ? "border-rose-400" : "border-gray-200 focus-within:border-brand-blue"}`}
              >
                <input
                  id="cantidad-despiece"
                  ref={cantidadRef}
                  value={cantidad}
                  onChange={(e) => cambiarCantidad(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                  className="w-full min-w-0 text-xl font-bold outline-none tabular-nums text-right"
                />
                <span className="ml-2 text-sm font-semibold text-gray-400">{unidad}</span>
              </div>
              {receta.stock > 0 && (
                <button
                  type="button"
                  onClick={() => cambiarCantidad(cantidadTexto(receta.stock))}
                  className="h-8 px-3 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 hover:border-brand-blue hover:text-brand-blue"
                >
                  Todo ({cantidadTexto(receta.stock)} {unidad})
                </button>
              )}
            </div>
            {!stockAlcanza && (
              <p className="mt-1 text-xs text-rose-600">
                Solo tienes {cantidadTexto(receta.stock)} {unidad}. Si llegó más, regístralo primero en Compras.
              </p>
            )}
            {sinCostoRegistrado && (
              <p className="mt-1 text-xs text-rose-600">
                Parte de ese stock no tiene costo registrado. Registra su ingreso en Compras antes de despiezar.
              </p>
            )}
          </div>

          {/* Partes */}
          <div>
            <p className="text-sm font-semibold text-gray-800">Pesa cada parte y corrige si hace falta</p>
            <p className="text-[11px] text-gray-500">Te proponemos lo que sale normalmente. El costo de cada parte se calcula solo.</p>

            {/* En pantallas chicas cada parte es una tarjeta; desde sm, una fila con columnas. */}
            <div className="mt-2 rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm">
              <div className={`hidden sm:grid ${COLUMNAS_SM} gap-2 px-3 py-2 bg-gray-50 rounded-t-lg text-[10px] font-semibold uppercase tracking-wide text-gray-500`}>
                <span>Parte</span>
                <span>Salió</span>
                <span className="text-right">Te cuesta</span>
                <span>Precio de venta</span>
                <span className="text-right">Ganas</span>
              </div>
              {filasCalc.map((f, i) => {
                const u = abreviaturaUnidad(f.parte.unidadMedida);
                const esperado = cantValida ? redondear3(cant * f.parte.rendimiento) : null;
                const r = reparto[i];
                const sug = sugeridos[i];
                const cambio = f.precio > 0 && Math.abs(f.precio - f.parte.precioUnitario) >= 0.005;
                return (
                  <div key={f.fila.productoId} className={`grid grid-cols-2 ${COLUMNAS_SM} gap-x-2 gap-y-2 px-3 py-2.5 items-start`}>
                    <div className="col-span-2 sm:col-span-1 flex items-center gap-2 min-w-0 sm:pt-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${COLORES[i % COLORES.length]}`} />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 truncate">{f.parte.nomProducto}</p>
                        <p className="text-[10px] text-gray-400 tabular-nums">
                          stock {cantidadTexto(f.parte.stock)} {u}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="sm:hidden mb-0.5 text-[10px] font-semibold uppercase text-gray-400">Salió</p>
                      <div className="flex items-center h-9 rounded-md border border-gray-200 bg-white px-2 focus-within:border-brand-blue">
                        <input
                          value={f.fila.cantidad}
                          onChange={(e) =>
                            actualizarFila(f.fila.productoId, { cantidad: filtrarDecimal(e.target.value, 3), cantidadEditada: true })
                          }
                          inputMode="decimal"
                          placeholder="0"
                          aria-label={`Cantidad de ${f.parte.nomProducto}`}
                          className="w-full min-w-0 font-semibold outline-none tabular-nums text-right"
                        />
                        <span className="ml-1 text-xs text-gray-400">{u}</span>
                      </div>
                      {esperado != null && f.fila.cantidadEditada && Math.abs(esperado - f.cantidad) >= 0.001 && (
                        <button
                          type="button"
                          onClick={() =>
                            actualizarFila(f.fila.productoId, { cantidad: cantidadTexto(esperado), cantidadEditada: false })
                          }
                          className="mt-0.5 text-[10px] text-gray-400 hover:text-brand-blue"
                          title="Volver a lo que sale normalmente"
                        >
                          normal: {cantidadTexto(esperado)} {u}
                        </button>
                      )}
                    </div>

                    <div className="order-last sm:order-none flex sm:block items-baseline gap-1 whitespace-nowrap sm:text-right tabular-nums sm:pt-1">
                      <p className="sm:hidden text-[11px] text-gray-500">Te cuesta</p>
                      {f.cantidad > 0 && costoTotal != null ? (
                        <>
                          <p className="font-semibold text-gray-800">{soles(r.costoUnitario)}</p>
                          <p className="text-[10px] text-gray-400">el {u}</p>
                        </>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </div>

                    <div>
                      <p className="sm:hidden mb-0.5 text-[10px] font-semibold uppercase text-gray-400">Precio de venta</p>
                      <div
                        className={`flex items-center h-9 rounded-md border bg-white px-2 focus-within:border-brand-blue ${cambio ? "border-brand-blue/60 bg-blue-50/40" : "border-gray-200"}`}
                      >
                        <span className="mr-1 text-xs text-gray-400">S/</span>
                        <input
                          value={f.fila.precio}
                          onChange={(e) => actualizarFila(f.fila.productoId, { precio: filtrarDecimal(e.target.value, 2) })}
                          inputMode="decimal"
                          placeholder="0.00"
                          aria-label={`Precio de ${f.parte.nomProducto}`}
                          className="w-full min-w-0 font-semibold outline-none tabular-nums text-right bg-transparent"
                        />
                      </div>
                      <p className="mt-0.5 text-[10px] text-gray-400 tabular-nums">
                        {cambio ? (
                          <>antes {soles(f.parte.precioUnitario)}</>
                        ) : sug > 0 && costoTotal != null && Math.abs(sug - f.precio) >= 0.005 ? (
                          <button
                            type="button"
                            onClick={() => actualizarFila(f.fila.productoId, { precio: sug.toFixed(2) })}
                            className="hover:text-brand-blue"
                          >
                            sugerido {soles(sug)}
                          </button>
                        ) : (
                          <>precio actual</>
                        )}
                      </p>
                    </div>

                    <div className="order-last sm:order-none flex sm:block items-baseline justify-end gap-1 whitespace-nowrap text-right tabular-nums sm:pt-1">
                      <p className="sm:hidden text-[11px] text-gray-500">Ganas</p>
                      {f.cantidad > 0 && f.precio > 0 && costoTotal != null ? (
                        <>
                          <p className={`font-semibold ${r.gananciaUnitaria >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                            {soles(r.gananciaUnitaria)}
                          </p>
                          <p className="text-[10px] text-gray-400">por {u}</p>
                        </>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {merma != null && (
                <div
                  className={`grid grid-cols-2 ${COLUMNAS_SM} gap-2 px-3 py-2.5 items-center rounded-b-lg ${partesExceden ? "bg-rose-50" : mermaAlta ? "bg-amber-50" : "bg-gray-50/60"}`}
                >
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <div>
                      <p className="font-medium text-gray-700">Merma</p>
                      <p className="text-[10px] text-gray-500">Lo que se bota · se calcula sola</p>
                    </div>
                  </div>
                  <div className="tabular-nums text-right sm:text-left">
                    <p className={`font-semibold ${partesExceden ? "text-rose-600" : "text-gray-700"}`}>
                      {cantidadTexto(merma)} {unidad}
                    </p>
                    {mermaPct != null && (
                      <p className="text-[10px] text-gray-500">
                        {porcentajeTexto(mermaPct)}
                        {mermaNormalPct != null && ` · normal ${porcentajeTexto(mermaNormalPct)}`}
                      </p>
                    )}
                  </div>
                  <div className="col-span-2 sm:col-span-3 text-[11px]">
                    {partesExceden ? (
                      <span className="flex items-center gap-1.5 text-rose-600 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Las partes pesan más de lo que despiezas.
                      </span>
                    ) : mermaAlta ? (
                      <span className="flex items-center gap-1.5 text-amber-700 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Salió más merma de lo normal.
                      </span>
                    ) : (
                      <span className="text-gray-400">Su costo lo pagan las partes que vendes.</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {partesNoDisponibles.length > 0 && (
              <p className="mt-1.5 text-[11px] text-amber-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {partesNoDisponibles.map((p) => p.nomProducto).join(", ")} ya no está en esta sucursal: cámbiala en «Configurar partes».
              </p>
            )}
          </div>

          {/* Precios y ganancia */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
            <span className="text-xs text-gray-600">Quiero ganar</span>
            <div className="flex items-center h-8 w-20 rounded-md border border-gray-200 bg-white px-2 focus-within:border-brand-blue">
              <input
                value={margen}
                onChange={(e) => setMargen(filtrarDecimal(e.target.value, 1))}
                inputMode="decimal"
                aria-label="Ganancia que quieres"
                className="w-full min-w-0 text-sm font-semibold outline-none tabular-nums text-right"
              />
              <span className="ml-1 text-xs text-gray-400">%</span>
            </div>
            <button
              type="button"
              onClick={aplicarSugeridos}
              disabled={costoTotal == null || sumaPartes <= 0}
              className="h-8 px-3 rounded-md bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800 flex items-center gap-1.5 hover:bg-amber-100 disabled:opacity-40"
            >
              <Wand2 className="w-3.5 h-3.5" /> Usar precios sugeridos
            </button>
            {cambiosPrecio.length > 0 && (
              <button type="button" onClick={volverPreciosActuales} className="text-xs text-gray-500 hover:text-gray-700 hover:underline">
                Dejar los precios actuales
              </button>
            )}
          </div>

          {/* Resumen */}
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-brand-blue/5 border border-brand-blue/15 p-3 text-center">
            <div>
              <p className="text-[10px] uppercase font-semibold text-gray-500">Te cuesta</p>
              <p className="text-base font-bold text-gray-900 tabular-nums">{costoTotal != null ? soles(costoTotal) : "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-gray-500">Si vendes todo</p>
              <p className="text-base font-bold text-gray-900 tabular-nums">{venta > 0 ? soles(venta) : "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-gray-500">Ganas</p>
              <p className={`text-base font-bold tabular-nums ${ganancia >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                {venta > 0 && costoTotal != null ? (
                  <>
                    {soles(ganancia)}
                    {margenReal != null && <span className="text-xs font-semibold"> ({Math.round(margenReal)} %)</span>}
                  </>
                ) : (
                  "—"
                )}
              </p>
            </div>
          </div>

          {cambiosPrecio.length > 0 && (
            <p className="text-[11px] text-gray-600 flex items-start gap-1.5">
              <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-px text-brand-blue" />
              <span>
                Al confirmar cambia el precio de venta de{" "}
                {cambiosPrecio.map((f, i) => (
                  <span key={f.fila.productoId}>
                    {i > 0 && (i === cambiosPrecio.length - 1 ? " y " : ", ")}
                    <strong>{f.parte.nomProducto}</strong> ({soles(f.parte.precioUnitario)} → {soles(f.precio)})
                  </span>
                ))}
                .
              </span>
            </p>
          )}

          <p className="text-[11px] text-gray-400 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
            El costo se reparte según lo que vale cada parte: la que se vende más cara carga más costo, y la merma la pagan las partes que vendes.
          </p>

          {error && (
            <p className="flex items-center gap-2 rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={enviando}
              className="h-10 px-4 rounded-md border border-gray-200 text-xs font-semibold text-gray-600"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={!puedeConfirmar}
              className="h-10 px-5 rounded-md bg-brand-blue text-white text-sm font-semibold flex items-center gap-2 hover:bg-[#0a2050] disabled:opacity-40"
            >
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
              {cantValida ? `Despiezar ${cantidadTexto(cant)} ${unidad}` : "Despiezar"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ResultadoDespiece({
  resultado,
  stockRestante,
  onOtro,
  onCerrar,
}: {
  resultado: Despiece;
  stockRestante: number;
  onOtro: () => void;
  onCerrar: () => void;
}) {
  const unidad = abreviaturaUnidad(resultado.unidadMedida);
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center text-center pt-2">
        <div className="h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <p className="mt-2 text-base font-bold text-gray-900">Despiece registrado</p>
        <p className="text-xs text-gray-500">
          Salieron {cantidadTexto(resultado.cantidad)} {unidad} de {resultado.nomProducto} · quedan{" "}
          {cantidadTexto(stockRestante)} {unidad}
        </p>
      </div>

      <ul className="rounded-lg border border-gray-200 divide-y divide-gray-100">
        {resultado.partes.map((p) => {
          const u = abreviaturaUnidad(p.unidadMedida);
          return (
            <li key={p.productoId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-sm">
              <span className="font-semibold text-emerald-700 tabular-nums w-20">
                +{cantidadTexto(p.cantidad)} {u}
              </span>
              <span className="flex-1 min-w-[140px] font-medium text-gray-800">{p.nomProducto}</span>
              <span className="text-xs text-gray-500 tabular-nums">
                cuesta {soles(p.costoUnitario)} el {u}
              </span>
              <span className="text-xs tabular-nums">
                {p.precioNuevo != null ? (
                  <span className="text-brand-blue font-semibold">
                    precio {soles(p.precioAnterior ?? 0)} → {soles(p.precioNuevo)}
                  </span>
                ) : (
                  <span className="text-gray-400">precio sin cambios</span>
                )}
              </span>
            </li>
          );
        })}
        {resultado.cantidadMerma != null && resultado.cantidadMerma > 0 && (
          <li className="flex items-center gap-4 px-3 py-2.5 text-sm text-gray-500">
            <span className="tabular-nums w-20">{cantidadTexto(resultado.cantidadMerma)} {unidad}</span>
            <span className="flex-1">Merma ({porcentajeTexto(resultado.porcentajeMerma ?? 0)})</span>
          </li>
        )}
      </ul>

      <p className="text-[11px] text-gray-400 text-center">
        Ya puedes vender las partes. Si te equivocaste, puedes deshacerlo desde el historial mientras no se haya vendido nada.
      </p>

      <div className="flex justify-center gap-2">
        <button type="button" onClick={onOtro} className="h-10 px-4 rounded-md border border-gray-200 text-xs font-semibold text-gray-700">
          Despiezar otra vez
        </button>
        <button type="button" onClick={onCerrar} className="h-10 px-5 rounded-md bg-brand-blue text-white text-xs font-semibold">
          Listo
        </button>
      </div>
    </div>
  );
}
