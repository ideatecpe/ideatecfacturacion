"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Bike,
  Check,
  Clock,
  Copy,
  CreditCard,
  FileText,
  ImagePlus,
  Loader2,
  LocateFixed,
  MapPin,
  Minus,
  Plus,
  Receipt,
  Send,
  Smartphone,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import {
  ErrorTienda,
  MedioPagoPedido,
  PedidoCreado,
  ProductoPublico,
  TiendaPublica,
  TipoComprobantePedido,
  TipoEntregaPedido,
  costoEnvioPara,
  tiendaApi,
} from "@/lib/pedidosOnline";
import { formatearCelular, formatoSoles, guardarLocal, leerLocal } from "./formato";

export interface LineaCarrito {
  producto: ProductoPublico;
  cantidad: number;
}

interface Props {
  tienda: TiendaPublica;
  /** Mesa del QR escaneado, ya validada contra las mesas de la tienda; null sin QR de mesa. */
  mesaQr: string | null;
  lineas: LineaCarrito[];
  /** Suma de los productos (sin el envío). */
  total: number;
  onCambiarCantidad: (producto: ProductoPublico, delta: number) => void;
  onCerrar: () => void;
  onCreado: (pedido: PedidoCreado) => void;
  onCatalogoDesactualizado: () => void;
}

interface ClienteGuardado {
  nombre: string;
  telefono: string;
  tipoComprobante?: TipoComprobantePedido;
  documento?: string;
  razonSocial?: string;
  direccion?: string;
  referencia?: string;
}

const CLAVE_CLIENTE = "tienda_cliente";
const CLIENTE_VACIO: ClienteGuardado = { nombre: "", telefono: "" };
const BILLETES = [10, 20, 50, 100, 200];
const MAX_CAPTURA_MB = 10;
/** SUNAT exige identificar al cliente en boletas desde este monto. */
const MONTO_BOLETA_CON_DNI = 700;
const PREFIJOS_RUC = ["10", "15", "16", "17", "20"];

export default function CheckoutPedido({
  tienda,
  mesaQr,
  lineas,
  total: subtotal,
  onCambiarCantidad,
  onCerrar,
  onCreado,
  onCatalogoDesactualizado,
}: Props) {
  // Se recuerda al cliente frecuente para que no vuelva a escribir sus datos.
  const [guardado] = useState(() => leerLocal<ClienteGuardado>(CLAVE_CLIENTE, CLIENTE_VACIO));
  const [nombre, setNombre] = useState(guardado.nombre);
  const [telefono, setTelefono] = useState(guardado.telefono);

  // El comprobante es opcional: si el cliente no lo pide, el pedido llega sin
  // comprobante y el cajero elige al cobrar (boleta o nota de venta). Solo se deja
  // activado de entrada si la vez anterior el cliente sí dejó su DNI o RUC.
  const [quiereComprobante, setQuiereComprobante] = useState(false);
  const [tipoComprobante, setTipoComprobante] = useState<"BOLETA" | "FACTURA">(
    guardado.tipoComprobante === "FACTURA" ? "FACTURA" : "BOLETA",
  );
  const [dni, setDni] = useState(guardado.tipoComprobante !== "FACTURA" ? (guardado.documento ?? "") : "");
  const [ruc, setRuc] = useState(guardado.tipoComprobante === "FACTURA" ? (guardado.documento ?? "") : "");
  const [razonSocial, setRazonSocial] = useState(guardado.razonSocial ?? "");

  // Con mesas numeradas, "Llevar a mi mesa" solo existe escaneando el QR de una
  // mesa: por el enlace general el cliente ve únicamente recojo y delivery. Si la
  // tienda no numeró sus mesas, la opción sigue disponible y lo ubican por su nombre.
  const usaMesasNumeradas = (tienda.cantidadMesas ?? 0) > 0;
  const opcionesEntrega = [
    tienda.permiteRecojo && "RECOJO",
    tienda.permiteMesa && !usaMesasNumeradas && "MESA",
    tienda.permiteDelivery && "DELIVERY",
  ].filter(Boolean) as TipoEntregaPedido[];

  // Con el QR de una mesa la entrega ya está decidida. Sin él, a la mesa por
  // defecto si está disponible (lo habitual en el local); si no, la primera opción.
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntregaPedido>(
    mesaQr ? "MESA" : opcionesEntrega.includes("MESA") ? "MESA" : (opcionesEntrega[0] ?? "RECOJO"),
  );
  const sinOpcionDeEntrega = !mesaQr && opcionesEntrega.length === 0;

  const [direccion, setDireccion] = useState(guardado.direccion ?? "");
  const [referencia, setReferencia] = useState(guardado.referencia ?? "");
  const [ubicacion, setUbicacion] = useState<string | null>(null);
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);
  const [buscandoDireccion, setBuscandoDireccion] = useState(false);
  const [avisoUbicacion, setAvisoUbicacion] = useState<string | null>(null);
  // Si el cliente ya escribió su dirección, la ubicación no se la pisa. La que se
  // recordó de un pedido anterior no cuenta: si comparte su ubicación es porque
  // ahora está en otro lugar.
  const [direccionEscrita, setDireccionEscrita] = useState(false);
  const [direccionDeUbicacion, setDireccionDeUbicacion] = useState(false);

  const esDelivery = tipoEntrega === "DELIVERY";
  const costoEnvio = esDelivery ? costoEnvioPara(tienda, subtotal) : 0;
  const total = Math.round((subtotal + costoEnvio) * 100) / 100;
  const pedidoMinimo = tienda.pedidoMinimoDelivery ?? 0;
  const faltaParaMinimo = esDelivery && subtotal < pedidoMinimo ? pedidoMinimo - subtotal : 0;
  const faltaParaGratis =
    esDelivery && costoEnvio > 0 && tienda.deliveryGratisDesde ? tienda.deliveryGratisDesde - subtotal : 0;

  /** Trae la dirección de esas coordenadas y la pone en el campo, salvo que el cliente ya haya escrito la suya. */
  const completarDireccion = async (lat: number, lng: number) => {
    setBuscandoDireccion(true);
    try {
      const res = await fetch(`/api/geocodificar?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`);
      const datos = (await res.json()) as { ok?: boolean; direccion?: string | null };
      if (datos.ok && datos.direccion) {
        if (!direccionEscrita) {
          setDireccion(datos.direccion);
          setDireccionDeUbicacion(true);
        }
      } else {
        setAvisoUbicacion("Agregamos tu ubicación, pero no pudimos obtener la dirección: escríbela tú.");
      }
    } catch {
      setAvisoUbicacion("Agregamos tu ubicación, pero no pudimos obtener la dirección: escríbela tú.");
    } finally {
      setBuscandoDireccion(false);
    }
  };

  /** Ubicación exacta del celular: el repartidor llega sin depender solo de la dirección escrita. */
  const usarMiUbicacion = () => {
    if (!("geolocation" in navigator)) {
      setAvisoUbicacion("Tu celular no permite compartir la ubicación. Escribe una buena referencia.");
      return;
    }
    setBuscandoUbicacion(true);
    setAvisoUbicacion(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUbicacion(`${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`);
        setBuscandoUbicacion(false);
        void completarDireccion(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setAvisoUbicacion("No pudimos obtener tu ubicación. Revisa el permiso de ubicación o escribe una buena referencia.");
        setBuscandoUbicacion(false);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const mediosDisponibles: MedioPagoPedido[] = [
    ...(tienda.aceptaYape ? (["Yape"] as const) : []),
    ...(tienda.aceptaEfectivo ? (["Efectivo"] as const) : []),
    ...(tienda.aceptaTarjeta ? (["Tarjeta"] as const) : []),
  ];
  const [medioPago, setMedioPago] = useState<MedioPagoPedido>(mediosDisponibles[0] ?? "Efectivo");
  const [pagaCon, setPagaCon] = useState("");

  const [captura, setCaptura] = useState<{ url: string | null; vistaPrevia: string } | null>(null);
  const [subiendoCaptura, setSubiendoCaptura] = useState(false);
  const [numeroCopiado, setNumeroCopiado] = useState(false);
  const inputCapturaRef = useRef<HTMLInputElement>(null);

  const [observaciones, setObservaciones] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bloquea el scroll de la tienda mientras el panel está abierto.
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = anterior;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (captura?.vistaPrevia) URL.revokeObjectURL(captura.vistaPrevia);
    };
  }, [captura?.vistaPrevia]);

  // Si el carrito se vació desde aquí mismo, no tiene sentido seguir en el checkout.
  useEffect(() => {
    if (lineas.length === 0 && !enviando) onCerrar();
  }, [lineas.length, enviando, onCerrar]);

  const montoPagaCon = parseFloat(pagaCon);
  const vuelto = Number.isFinite(montoPagaCon) ? montoPagaCon - total : 0;
  const billetesSugeridos = BILLETES.filter((b) => b > total).slice(0, 3);
  const boletaExigeDni = quiereComprobante && tipoComprobante === "BOLETA" && total >= MONTO_BOLETA_CON_DNI;

  const copiarNumero = async () => {
    try {
      await navigator.clipboard.writeText((tienda.yapeNumero ?? "").replace(/\D/g, ""));
      setNumeroCopiado(true);
      setTimeout(() => setNumeroCopiado(false), 2000);
    } catch {
      /* el número sigue visible para copiarlo a mano */
    }
  };

  const subirCaptura = async (archivo: File) => {
    if (!archivo.type.startsWith("image/")) {
      setError("La captura debe ser una imagen.");
      return;
    }
    if (archivo.size > MAX_CAPTURA_MB * 1024 * 1024) {
      setError(`La imagen pesa demasiado (máximo ${MAX_CAPTURA_MB} MB).`);
      return;
    }

    const vistaPrevia = URL.createObjectURL(archivo);
    setCaptura({ url: null, vistaPrevia });
    setSubiendoCaptura(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("file", archivo, archivo.name || "captura-yape.jpg");
      const res = await fetch("/api/upload-imagen", { method: "POST", body: form });
      const data = (await res.json()) as { ok?: boolean; url?: string };
      if (!res.ok || !data.ok || !data.url) throw new Error();
      setCaptura({ url: data.url, vistaPrevia });
    } catch {
      setCaptura(null);
      setError("No se pudo subir la captura. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setSubiendoCaptura(false);
    }
  };

  const validar = (): string | null => {
    if (lineas.length === 0) return "Tu pedido está vacío.";
    if (sinOpcionDeEntrega) return "Escanea el QR de tu mesa para hacer tu pedido.";
    if (nombre.trim().length < 2) return "Ingresa tu nombre para llamarte cuando esté listo.";
    const celular = telefono.replace(/\D/g, "");
    if (celular && (celular.length < 6 || celular.length > 15)) return "Revisa tu número de celular.";

    if (esDelivery) {
      if (faltaParaMinimo > 0) return `El pedido mínimo para delivery es ${formatoSoles(pedidoMinimo)}.`;
      if (direccion.trim().length < 5) return "Escribe la dirección donde te llevamos el pedido.";
      if (!celular) return "Para el delivery necesitamos tu celular, por si el repartidor necesita ubicarte.";
    }

    if (quiereComprobante) {
      if (tipoComprobante === "FACTURA") {
        if (ruc.length !== 11 || !PREFIJOS_RUC.some((p) => ruc.startsWith(p))) return "Ingresa un RUC válido de 11 dígitos.";
      } else {
        if (dni && dni.length !== 8 && dni.length !== 9) return "El DNI debe tener 8 dígitos.";
        if (boletaExigeDni && !dni) return `Para boletas desde S/ ${MONTO_BOLETA_CON_DNI} necesitamos tu DNI.`;
      }
    }

    if (medioPago === "Yape") {
      if (subiendoCaptura) return "Espera a que termine de subir la captura.";
      if (!captura?.url) return "Adjunta la captura de tu Yape.";
    }
    if (medioPago === "Efectivo" && pagaCon && (!Number.isFinite(montoPagaCon) || montoPagaCon < total)) {
      return "El monto con el que pagas debe cubrir el total.";
    }
    return null;
  };

  const enviar = async () => {
    const problema = validar();
    if (problema) {
      setError(problema);
      return;
    }

    const tipoFinal: TipoComprobantePedido = quiereComprobante ? tipoComprobante : "NINGUNO";
    const documento = !quiereComprobante ? "" : tipoComprobante === "FACTURA" ? ruc : dni;
    setEnviando(true);
    setError(null);
    try {
      guardarLocal(CLAVE_CLIENTE, {
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        tipoComprobante: tipoFinal,
        documento,
        razonSocial: razonSocial.trim(),
        direccion: direccion.trim() || guardado.direccion,
        referencia: referencia.trim() || guardado.referencia,
      } satisfies ClienteGuardado);

      const creado = await tiendaApi.crearPedido(
        tienda.sucursalId,
        {
          clienteNombre: nombre.trim(),
          clienteTelefono: telefono.replace(/\D/g, "") || undefined,
          tipoComprobante: tipoFinal,
          clienteDocumento: documento || undefined,
          clienteRazonSocial: tipoFinal === "FACTURA" ? razonSocial.trim() || undefined : undefined,
          tipoEntrega,
          mesa: tipoEntrega === "MESA" && mesaQr ? mesaQr : undefined,
          direccionEntrega: esDelivery ? direccion.trim() : undefined,
          referenciaEntrega: esDelivery ? referencia.trim() || undefined : undefined,
          ubicacionEntrega: esDelivery ? (ubicacion ?? undefined) : undefined,
          medioPago,
          pagaCon: medioPago === "Efectivo" && pagaCon ? montoPagaCon : null,
          urlCapturaPago: medioPago === "Yape" ? captura?.url : null,
          observaciones: observaciones.trim() || undefined,
          items: lineas.map((l) => ({ productoId: l.producto.productoId, cantidad: l.cantidad })),
        },
        tienda.entorno,
      );
      onCreado(creado);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar tu pedido. Intenta de nuevo.");
      // 409: cambió el stock o un producto dejó de estar disponible.
      if (e instanceof ErrorTienda && e.status === 409) onCatalogoDesactualizado();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40" onClick={enviando ? undefined : onCerrar} />

      <div className="relative w-full sm:max-w-md h-full bg-slate-50 flex flex-col shadow-2xl">
        <div className="shrink-0 flex items-center gap-2 bg-white border-b border-slate-200 px-2 py-2.5">
          <button
            type="button"
            onClick={onCerrar}
            disabled={enviando}
            aria-label="Volver a la tienda"
            className="h-10 w-10 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-bold text-slate-900">Tu pedido</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* ── Productos ── */}
          <Seccion titulo="Productos">
            <div className="rounded-xl bg-white border border-slate-200 divide-y divide-slate-100">
              {lineas.map(({ producto: p, cantidad }) => (
                <div key={p.productoId} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 line-clamp-2">{p.nombre}</p>
                    <p className="text-xs text-slate-500 tabular-nums">{formatoSoles(p.precio)} c/u</p>
                  </div>
                  <div className="flex items-center rounded-full border border-slate-200 shrink-0">
                    <button
                      type="button"
                      onClick={() => onCambiarCantidad(p, -1)}
                      aria-label="Quitar uno"
                      className="h-8 w-8 flex items-center justify-center text-slate-600"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="min-w-5 text-center text-sm font-bold tabular-nums">{cantidad}</span>
                    <button
                      type="button"
                      onClick={() => onCambiarCantidad(p, 1)}
                      aria-label="Agregar uno"
                      className="h-8 w-8 flex items-center justify-center text-slate-600"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="w-18 text-right text-sm font-semibold tabular-nums">
                    {formatoSoles(Math.round(p.precio * cantidad * 100) / 100)}
                  </p>
                </div>
              ))}
            </div>
          </Seccion>

          {/* ── Entrega ── */}
          {mesaQr ? (
            // Pidió desde el QR de su mesa: no hay nada que elegir.
            <div className="flex items-center gap-3 rounded-xl border border-[var(--t-pri,#0B1F49)]/30 bg-[var(--t-pri,#0B1F49)]/5 p-3.5">
              <span className="h-11 w-11 shrink-0 rounded-xl bg-[var(--t-pri,#0B1F49)] text-[var(--t-sobre-pri,#FFFFFF)] flex items-center justify-center">
                <UtensilsCrossed className="w-5 h-5" />
              </span>
              <div>
                <p className="text-base font-bold text-slate-900">Mesa {mesaQr}</p>
                <p className="text-xs text-slate-600">Te llevamos tu pedido a la mesa.</p>
              </div>
            </div>
          ) : (
            <Seccion titulo="¿Cómo lo recibes?">
              {sinOpcionDeEntrega && (
                <p className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-sm text-amber-800">
                  <UtensilsCrossed className="w-4 h-4 shrink-0 mt-0.5" />
                  Esta tienda atiende los pedidos en las mesas: escanea el QR de tu mesa para hacer tu pedido.
                </p>
              )}
              <div
                className={`grid gap-2 ${
                  opcionesEntrega.length >= 3 ? "grid-cols-3" : opcionesEntrega.length === 1 ? "grid-cols-1" : "grid-cols-2"
                }`}
              >
                {opcionesEntrega.map((opcion) => (
                  <Opcion
                    key={opcion}
                    activa={tipoEntrega === opcion}
                    onClick={() => {
                      setTipoEntrega(opcion);
                      setError(null);
                    }}
                    icono={
                      opcion === "RECOJO" ? (
                        <Store className="w-5 h-5" />
                      ) : opcion === "MESA" ? (
                        <UtensilsCrossed className="w-5 h-5" />
                      ) : (
                        <Bike className="w-5 h-5" />
                      )
                    }
                    titulo={opcion === "RECOJO" ? "Recojo en caja" : opcion === "MESA" ? "Llevar a mi mesa" : "Delivery"}
                    detalle={
                      opcionesEntrega.length === 3
                        ? undefined
                        : opcion === "RECOJO"
                          ? "Te avisamos cuando esté listo"
                          : opcion === "MESA"
                            ? "Te lo llevamos"
                            : "A tu dirección"
                    }
                    compacta={opcionesEntrega.length === 3}
                  />
                ))}
              </div>

              {esDelivery && (
                <div className="rounded-xl bg-white border border-slate-200 p-3.5 space-y-3">
                  {(tienda.zonaDelivery || tienda.tiempoDelivery) && (
                    <div className="space-y-1 text-xs text-slate-600">
                      {tienda.zonaDelivery && (
                        <p className="flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0 mt-px text-slate-400" /> Reparto: {tienda.zonaDelivery}
                        </p>
                      )}
                      {tienda.tiempoDelivery && (
                        <p className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 shrink-0 text-slate-400" /> Llega en {tienda.tiempoDelivery}
                        </p>
                      )}
                    </div>
                  )}

                  <Campo etiqueta="Dirección de entrega">
                    <input
                      value={direccion}
                      onChange={(e) => {
                        setDireccion(e.target.value.slice(0, 200));
                        setDireccionEscrita(true);
                        setDireccionDeUbicacion(false);
                      }}
                      autoComplete="street-address"
                      placeholder={buscandoDireccion ? "Buscando tu dirección…" : "Ej.: Jr. Amalia Puga 123, Dpto. 2"}
                      className={claseInput}
                    />
                    {direccionDeUbicacion && (
                      <p className="text-[11px] text-emerald-700">
                        Dirección tomada de tu ubicación. Revísala y agrega el número o el departamento si hace falta.
                      </p>
                    )}
                  </Campo>
                  <Campo etiqueta="Referencia (opcional)">
                    <input
                      value={referencia}
                      onChange={(e) => setReferencia(e.target.value.slice(0, 200))}
                      placeholder="Ej.: frente al parque, portón verde"
                      className={claseInput}
                    />
                  </Campo>

                  {ubicacion ? (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs">
                      <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span className="flex-1 font-semibold text-emerald-700">Ubicación agregada</span>
                      <a
                        href={`https://www.google.com/maps?q=${ubicacion}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-emerald-700 underline"
                      >
                        Ver
                      </a>
                      <button type="button" onClick={() => setUbicacion(null)} className="font-semibold text-slate-500">
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={usarMiUbicacion}
                      disabled={buscandoUbicacion}
                      className="w-full h-10 flex items-center justify-center gap-2 rounded-lg border border-[var(--t-pri,#0B1F49)]/30 bg-[var(--t-pri,#0B1F49)]/5 text-sm font-semibold text-[var(--t-pri,#0B1F49)] disabled:opacity-60"
                    >
                      {buscandoUbicacion ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
                      {buscandoUbicacion ? "Buscando tu ubicación…" : "Usar mi ubicación actual y completar mi dirección"}
                    </button>
                  )}
                  {avisoUbicacion && <p className="text-xs text-amber-700">{avisoUbicacion}</p>}

                  <p className="text-xs text-slate-600">
                    Envío:{" "}
                    <span className="font-semibold tabular-nums">
                      {costoEnvio > 0 ? formatoSoles(costoEnvio) : "gratis"}
                    </span>
                    {faltaParaGratis > 0 && (
                      <span className="text-emerald-700"> · agrega {formatoSoles(faltaParaGratis)} más y es gratis</span>
                    )}
                  </p>
                  {faltaParaMinimo > 0 && (
                    <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      El pedido mínimo para delivery es {formatoSoles(pedidoMinimo)}. Te faltan {formatoSoles(faltaParaMinimo)}.
                    </p>
                  )}
                </div>
              )}
            </Seccion>
          )}

          {/* ── Cliente ── */}
          <Seccion titulo="Tus datos">
            <Campo etiqueta="Nombre">
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value.slice(0, 100))}
                autoComplete="given-name"
                placeholder="¿A nombre de quién?"
                className={claseInput}
              />
            </Campo>
            <Campo etiqueta={esDelivery ? "Celular" : "Celular (opcional)"}>
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value.replace(/[^\d\s+]/g, "").slice(0, 15))}
                inputMode="tel"
                autoComplete="tel"
                placeholder={
                  esDelivery
                    ? "Para coordinar la entrega"
                    : quiereComprobante
                      ? "Te enviamos tu comprobante por WhatsApp"
                      : "Por si necesitamos contactarte"
                }
                className={claseInput}
              />
            </Campo>
          </Seccion>

          {/* ── Comprobante ── */}
          <Seccion titulo="Comprobante">
            <button
              type="button"
              role="switch"
              aria-checked={quiereComprobante}
              onClick={() => {
                setQuiereComprobante((v) => !v);
                setError(null);
              }}
              className={`w-full flex items-center gap-3 rounded-xl border bg-white p-3 text-left transition-colors ${
                quiereComprobante ? "border-[var(--t-pri,#0B1F49)]/40" : "border-slate-200"
              }`}
            >
              <span
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  quiereComprobante ? "bg-[var(--t-pri,#0B1F49)]" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    quiereComprobante ? "translate-x-4.5" : "translate-x-0.5"
                  }`}
                />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-slate-800">Quiero boleta o factura</span>
                <span className="block text-[11px] leading-tight text-slate-500">
                  {quiereComprobante
                    ? "Elige el tipo y déjanos tus datos."
                    : "Opcional. Si no lo pides, la tienda emite tu comprobante al cobrar."}
                </span>
              </span>
            </button>

            {quiereComprobante && (
            <div className="grid grid-cols-2 gap-2">
              <Opcion
                activa={tipoComprobante === "BOLETA"}
                onClick={() => setTipoComprobante("BOLETA")}
                icono={<Receipt className="w-5 h-5" />}
                titulo="Boleta"
                compacta
              />
              <Opcion
                activa={tipoComprobante === "FACTURA"}
                onClick={() => setTipoComprobante("FACTURA")}
                icono={<FileText className="w-5 h-5" />}
                titulo="Factura"
                compacta
              />
            </div>
            )}
            {!quiereComprobante ? null : tipoComprobante === "BOLETA" ? (
              <Campo etiqueta={boletaExigeDni ? "DNI" : "DNI (opcional)"}>
                <input
                  value={dni}
                  onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  inputMode="numeric"
                  placeholder={boletaExigeDni ? "Obligatorio desde S/ 700" : "Para emitir la boleta a tu nombre"}
                  className={claseInput}
                />
              </Campo>
            ) : (
              <>
                <Campo etiqueta="RUC">
                  <input
                    value={ruc}
                    onChange={(e) => setRuc(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    inputMode="numeric"
                    placeholder="11 dígitos"
                    className={claseInput}
                  />
                </Campo>
                <Campo etiqueta="Razón social (opcional)">
                  <input
                    value={razonSocial}
                    onChange={(e) => setRazonSocial(e.target.value.slice(0, 150))}
                    placeholder="La confirmamos con SUNAT en caja"
                    className={claseInput}
                  />
                </Campo>
              </>
            )}
          </Seccion>

          {/* ── Pago ── */}
          <Seccion titulo="¿Cómo pagas?">
            <div className={`grid gap-2 ${mediosDisponibles.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {mediosDisponibles.map((m) => (
                <Opcion
                  key={m}
                  activa={medioPago === m}
                  onClick={() => {
                    setMedioPago(m);
                    setError(null);
                  }}
                  icono={
                    m === "Efectivo" ? (
                      <Banknote className="w-5 h-5" />
                    ) : m === "Yape" ? (
                      <Smartphone className="w-5 h-5" />
                    ) : (
                      <CreditCard className="w-5 h-5" />
                    )
                  }
                  titulo={m}
                  compacta
                />
              ))}
            </div>

            {medioPago === "Efectivo" && (
              <div className="rounded-xl bg-white border border-slate-200 p-3.5 space-y-2.5">
                <p className="text-sm font-medium text-slate-700">¿Con cuánto pagas?</p>
                <div className="flex flex-wrap gap-2">
                  <ChipMonto activo={pagaCon === total.toFixed(2)} onClick={() => setPagaCon(total.toFixed(2))}>
                    Monto exacto
                  </ChipMonto>
                  {billetesSugeridos.map((b) => (
                    <ChipMonto key={b} activo={pagaCon === b.toFixed(2)} onClick={() => setPagaCon(b.toFixed(2))}>
                      S/ {b}
                    </ChipMonto>
                  ))}
                </div>
                <input
                  value={pagaCon}
                  onChange={(e) => setPagaCon(e.target.value.replace(/[^\d.]/g, "").slice(0, 8))}
                  inputMode="decimal"
                  placeholder="Otro monto (opcional)"
                  className={claseInput}
                />
                {pagaCon && Number.isFinite(montoPagaCon) && vuelto >= 0 && (
                  <p className="text-xs text-emerald-700 font-medium">
                    Tu vuelto: <span className="tabular-nums">{formatoSoles(vuelto)}</span>
                  </p>
                )}
                <p className="text-xs text-slate-500">Pagas al recibir tu pedido.</p>
              </div>
            )}

            {medioPago === "Tarjeta" && (
              <p className="rounded-xl bg-white border border-slate-200 p-3.5 text-sm text-slate-600">
                {tipoEntrega === "MESA"
                  ? "Te llevamos el POS a tu mesa para que pagues con tarjeta de débito o crédito."
                  : esDelivery
                    ? "El repartidor lleva el POS para que pagues con tarjeta de débito o crédito."
                    : "Pagas con tarjeta de débito o crédito en caja al recoger tu pedido."}
              </p>
            )}

            {medioPago === "Yape" && (
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-3.5 space-y-3">
                <div className="flex items-center gap-3">
                  <img src="/mediosPago/yape.jpg?v=2" alt="Yape" className="h-11 w-11 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-violet-700">
                      Yapea <span className="font-bold tabular-nums">{formatoSoles(total)}</span> al número
                    </p>
                    <p className="text-lg font-bold text-slate-900 tabular-nums tracking-wide">
                      {formatearCelular(tienda.yapeNumero)}
                    </p>
                    {tienda.yapeTitular && <p className="text-xs text-slate-500 truncate">{tienda.yapeTitular}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={copiarNumero}
                    className="shrink-0 h-9 px-3 rounded-lg bg-white border border-violet-200 text-violet-700 text-xs font-semibold flex items-center gap-1.5"
                  >
                    {numeroCopiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {numeroCopiado ? "Copiado" : "Copiar"}
                  </button>
                </div>

                <ol className="list-decimal pl-4 space-y-0.5 text-xs text-slate-600">
                  <li>Abre Yape y paga el monto exacto.</li>
                  <li>Toma una captura de la constancia.</li>
                  <li>Adjúntala aquí y envía tu pedido: lo confirmamos en caja.</li>
                </ol>

                <input
                  ref={inputCapturaRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const archivo = e.target.files?.[0];
                    e.target.value = "";
                    if (archivo) void subirCaptura(archivo);
                  }}
                />

                {captura ? (
                  <div className="flex items-center gap-3 rounded-lg bg-white border border-violet-200 p-2">
                    <img src={captura.vistaPrevia} alt="Captura del pago" className="h-16 w-12 rounded object-cover" />
                    <div className="flex-1 min-w-0 text-xs">
                      {subiendoCaptura ? (
                        <p className="flex items-center gap-1.5 text-slate-600">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Subiendo captura…
                        </p>
                      ) : (
                        <p className="flex items-center gap-1.5 font-semibold text-emerald-700">
                          <Check className="w-3.5 h-3.5" /> Captura adjunta
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={subiendoCaptura}
                      onClick={() => inputCapturaRef.current?.click()}
                      className="shrink-0 h-8 px-3 rounded-md text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-40"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => inputCapturaRef.current?.click()}
                    className="w-full flex flex-col items-center gap-1 rounded-lg border-2 border-dashed border-violet-300 bg-white py-4 text-violet-700 hover:border-violet-400"
                  >
                    <ImagePlus className="w-6 h-6" />
                    <span className="text-sm font-semibold">Adjuntar captura de Yape</span>
                  </button>
                )}
              </div>
            )}
          </Seccion>

          <Seccion titulo="Indicaciones (opcional)">
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value.slice(0, 300))}
              rows={2}
              placeholder="Ej.: sin hielo, para llevar"
              className={`${claseInput} h-auto py-2.5 resize-none`}
            />
          </Seccion>
        </div>

        <div className="shrink-0 bg-white border-t border-slate-200 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2.5">
          {error && (
            <p className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
              {error}
            </p>
          )}
          {esDelivery && (
            <div className="space-y-0.5 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>Productos</span>
                <span className="tabular-nums">{formatoSoles(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Envío</span>
                <span className={`tabular-nums ${costoEnvio === 0 ? "font-semibold text-emerald-700" : ""}`}>
                  {costoEnvio > 0 ? formatoSoles(costoEnvio) : "Gratis"}
                </span>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Total a pagar</span>
            <span className="text-xl font-bold text-slate-900 tabular-nums">{formatoSoles(total)}</span>
          </div>
          <button
            type="button"
            onClick={enviar}
            disabled={enviando || subiendoCaptura || faltaParaMinimo > 0 || sinOpcionDeEntrega}
            className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-[var(--t-pri,#0B1F49)] text-[var(--t-sobre-pri,#FFFFFF)] text-base font-bold shadow-sm active:scale-[0.99] transition-transform disabled:opacity-50"
          >
            {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
            {enviando ? "Enviando pedido…" : "Enviar pedido"}
          </button>
        </div>
      </div>
    </div>
  );
}

const claseInput =
  "w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-[var(--t-pri,#0B1F49)] focus:ring-2 focus:ring-[var(--t-pri,#0B1F49)]/15";

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{titulo}</h3>
      {children}
    </section>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600">{etiqueta}</span>
      {children}
    </label>
  );
}

function Opcion({
  activa,
  onClick,
  icono,
  titulo,
  detalle,
  compacta = false,
}: {
  activa: boolean;
  onClick: () => void;
  icono: React.ReactNode;
  titulo: string;
  detalle?: string;
  compacta?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col ${compacta ? "items-center py-3" : "items-start p-3"} gap-1 rounded-xl border bg-white text-left transition-all ${
        activa ? "border-[var(--t-pri,#0B1F49)] ring-2 ring-[var(--t-pri,#0B1F49)]/20 text-[var(--t-pri,#0B1F49)]" : "border-slate-200 text-slate-600"
      }`}
    >
      {icono}
      <span className={`text-sm font-semibold ${activa ? "text-[var(--t-pri,#0B1F49)]" : "text-slate-800"}`}>{titulo}</span>
      {detalle && <span className="text-[11px] leading-tight text-slate-500">{detalle}</span>}
    </button>
  );
}

function ChipMonto({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 px-3 rounded-full border text-xs font-semibold tabular-nums transition-colors ${
        activo ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-slate-200 text-slate-600"
      }`}
    >
      {children}
    </button>
  );
}
