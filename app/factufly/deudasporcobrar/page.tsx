"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  X,
  Filter,
  ChevronDown,
  RefreshCw,
  Check,
  CreditCard,
  FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/app/utils/cn";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { Card } from "@/app/components/ui/Card";
import { useDeudaContado } from "./gestionDeudasPorCobrar/UseDeudaContado";
import { useRegistrarPagoDeuda } from "./gestionDeudasPorCobrar/UseRegistrarPagoDeuda";
import {
  DeudaContado,
  RegistrarPagoDeudaPayload,
} from "./gestionDeudasPorCobrar/DeudaContado";
import {
  formatFecha,
  formatMoneda,
  tipoComprobanteLabel,
  ESTADO_CUOTA_COLORS,
} from "../cuentasporcobrar/gestionCuentasPorCobrar/helpers";
import { useSucursalRuc } from "../operaciones/boleta/gestionBoletas/useSucursalRuc";
import { useSucursal } from "../operaciones/boleta/gestionBoletas/useSucursal";
import { ModalDeudasPorCobrar } from "@/app/components/modalDeudasPorCobrar/ModalDeudasPorCobrar";
import { ModalReporteDeudaContado } from "@/app/components/modalDeudasPorCobrar/ModalReporteDeudaContado";

const TIPO_OPTS = ["Todos", "Factura", "Boleta"];

export default function DeudasPorCobrarPage() {
  const { user, accessToken } = useAuth();
  const { showToast } = useToast();
  const rucEmpresa = user?.ruc ?? "";
  const isBeta = user?.environment === "beta";

  const isSuperAdmin = user?.rol === "superadmin";
  const { sucursales } = useSucursalRuc(isSuperAdmin);
  const { sucursal } = useSucursal();

  const [sucursalFiltro, setSucursalFiltro] = useState<string | null>(null);

  const getCodEstablecimiento = () => {
    if (isSuperAdmin) return sucursalFiltro;
    return sucursal?.codEstablecimiento ?? null;
  };

  const hookDeudas = useDeudaContado();
  const hookPagar = useRegistrarPagoDeuda();

  const [deudas, setDeudas] = useState<DeudaContado[]>([]);
  const [deudaPagar, setDeudaPagar] = useState<DeudaContado | null>(null);
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [avFechaDesde, setAvFechaDesde] = useState("");
  const [avFechaHasta, setAvFechaHasta] = useState("");
  const [avClienteDoc, setAvClienteDoc] = useState("");
  const [avSerie, setAvSerie] = useState("");
  const [avCorrelativo, setAvCorrelativo] = useState("");
  const [avEstadoPago, setAvEstadoPago] = useState<
    "PENDIENTE" | "PAGADO" | "TODOS"
  >("TODOS");
  const [modoAvanzado, setModoAvanzado] = useState<"fechas" | "comprobante">(
    "fechas",
  );
  const [showModalReporte, setShowModalReporte] = useState(false);

  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());

  const cargar = async () => {
    const data = await hookDeudas.fetchDeudas({
      empresaRuc: rucEmpresa,
      establecimientoAnexo: isSuperAdmin
        ? sucursalFiltro
        : (getCodEstablecimiento() ?? null),
    });
    setDeudas(data);
  };

  useEffect(() => {
    if (!user || !accessToken) return;
    if (!isSuperAdmin && !sucursal) return;
    cargar();
  }, [user, accessToken, sucursalFiltro, sucursal]);

  const buscarAvanzado = async () => {
    if (modoAvanzado === "comprobante") {
      if (!avSerie || !avCorrelativo) {
        showToast("Ingrese serie y correlativo", "error");
        return;
      }
      const data = await hookDeudas.fetchDeudas({
        empresaRuc: rucEmpresa,
        serie: avSerie,
        correlativo: Number(avCorrelativo),
        estadoPago: "TODOS",
      });
      setDeudas(data);
      return;
    }
    if (
      !avClienteDoc &&
      !avFechaDesde &&
      !avFechaHasta &&
      avEstadoPago === "PENDIENTE"
    ) {
      showToast("Ingrese al menos un criterio de búsqueda", "error");
      return;
    }
    const data = await hookDeudas.fetchDeudas({
      empresaRuc: rucEmpresa,
      fechaInicio: avFechaDesde || null,
      fechaFin: avFechaHasta || null,
      clienteNumDoc: avClienteDoc || null,
      estadoPago: avEstadoPago,
    });
    setDeudas(data);
  };

  const limpiarAvanzado = () => {
    const habiaFiltro =
      !!avFechaDesde ||
      !!avFechaHasta ||
      !!avClienteDoc ||
      !!avSerie ||
      !!avCorrelativo ||
      avEstadoPago !== "PENDIENTE";
    setAvFechaDesde("");
    setAvFechaHasta("");
    setAvClienteDoc("");
    setAvSerie("");
    setAvCorrelativo("");
    setAvEstadoPago("TODOS");
    setModoAvanzado("fechas");
    if (habiaFiltro) cargar();
  };

  const filtered = useMemo(() => {
    return deudas
      .filter((d) => {
        const matchSearch =
          d.clienteRznSocial.toLowerCase().includes(search.toLowerCase()) ||
          d.clienteNumDoc.includes(search) ||
          d.numeroCompleto.toLowerCase().includes(search.toLowerCase());
        const matchTipo =
          filtroTipo === "Todos" ||
          tipoComprobanteLabel(d.tipoComprobante) === filtroTipo;
        return matchSearch && matchTipo;
      })
      .sort((a, b) => {
        const fechaDiff =
          new Date(b.fechaEmision).getTime() -
          new Date(a.fechaEmision).getTime();
        if (fechaDiff !== 0) return fechaDiff;
        const serieComp = a.serie.localeCompare(b.serie);
        if (serieComp !== 0) return serieComp;
        return b.correlativo - a.correlativo;
      });
  }, [deudas, search, filtroTipo]);

  const handlePagar = async (payload: RegistrarPagoDeudaPayload) => {
    const ok = await hookPagar.registrarPago(payload.pagoId, payload);
    if (ok) {
      setDeudaPagar(null);
      cargar();
    }
  };

  const loading = hookDeudas.loading;

  return (
    <div className="space-y-3 py-1 animate-in fade-in duration-500">
      {showModalReporte && (
        <ModalReporteDeudaContado
          empresaRuc={rucEmpresa}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setShowModalReporte(false)}
        />
      )}
      {/* Modal Pagar */}
      {deudaPagar && (
        <ModalDeudasPorCobrar
          deuda={deudaPagar}
          onClose={() => setDeudaPagar(null)}
          onConfirm={handlePagar}
          loading={hookPagar.loading}
          usuarioId={Number(user?.id ?? 0)}
          onRefrescar={cargar}
        />
      )}

      {/* Filtros */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="relative flex-1 max-w-md">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, RUC/DNI o N° comprobante..."
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
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={() => setShowModalReporte(true)}
              className="flex items-center gap-1.5 px-2.5 py-2.5 text-xs font-medium border border-gray-200 rounded-md transition-all shadow-sm bg-white text-gray-700 hover:bg-gray-50 whitespace-nowrap"
            >
              <FileSpreadsheet size={14} /> Reporte Excel
            </button>
            {isSuperAdmin && (
              <div className="relative">
                <select
                  value={sucursalFiltro ?? ""}
                  onChange={(e) => setSucursalFiltro(e.target.value || null)}
                  className={cn(
                    "appearance-none pl-3 pr-8 py-2.5 text-xs font-medium border rounded-md outline-none cursor-pointer transition-all shadow-sm",
                    sucursalFiltro
                      ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "bg-white border-gray-200 text-gray-600",
                  )}
                >
                  <option value="">Todas las sucursales</option>
                  {sucursales.map((s) => (
                    <option key={s.sucursalId} value={s.codEstablecimiento}>
                      {s.nombre ?? s.codEstablecimiento}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={13}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
            )}
            <DropdownFiltro
              label="Tipo"
              value={filtroTipo}
              options={TIPO_OPTS}
              onChange={setFiltroTipo}
            />
            {filtroTipo !== "Todos" && (
              <button
                onClick={() => setFiltroTipo("Todos")}
                className="text-xs text-gray-400 hover:text-red-500 underline underline-offset-2 transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden animate-in slide-in-from-top-2 duration-200">
          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {(
              [
                { key: "fechas", label: "Por fechas / cliente" },
                { key: "comprobante", label: "Comprobante exacto" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setModoAvanzado(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-all whitespace-nowrap",
                  modoAvanzado === tab.key
                    ? "border-blue-600 text-blue-600 bg-blue-50/50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="px-5 py-4">
            <div className="flex flex-wrap items-end gap-4">
              {modoAvanzado === "fechas" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                      Nº Doc. Cliente
                    </label>
                    <input
                      type="text"
                      value={avClienteDoc}
                      onChange={(e) => setAvClienteDoc(e.target.value)}
                      placeholder="RUC o DNI"
                      className="h-8 py-0 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 focus:bg-white transition-all w-44"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                      Fecha desde
                    </label>
                    <input
                      type="date"
                      value={avFechaDesde}
                      max={hoy}
                      onChange={(e) => {
                        setAvFechaDesde(e.target.value);
                        if (avFechaHasta && e.target.value > avFechaHasta)
                          setAvFechaHasta("");
                      }}
                      className="h-8 py-0 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 focus:bg-white transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                      Fecha hasta
                    </label>
                    <input
                      type="date"
                      value={avFechaHasta}
                      min={avFechaDesde || undefined}
                      max={hoy}
                      onChange={(e) => setAvFechaHasta(e.target.value)}
                      className="h-8 py-0 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 focus:bg-white transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                      Estado pago
                    </label>
                    <select
                      value={avEstadoPago}
                      onChange={(e) =>
                        setAvEstadoPago(
                          e.target.value as "PENDIENTE" | "PAGADO" | "TODOS",
                        )
                      }
                      className="h-8 py-0 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 focus:bg-white transition-all"
                    >
                      <option value="PENDIENTE">Pendiente</option>
                      <option value="PAGADO">Pagado</option>
                      <option value="TODOS">Todos</option>
                    </select>
                  </div>
                </>
              )}

              {modoAvanzado === "comprobante" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                      Serie
                    </label>
                    <input
                      type="text"
                      value={avSerie}
                      onChange={(e) => setAvSerie(e.target.value.toUpperCase())}
                      placeholder="F001"
                      className="h-8 py-0 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 focus:bg-white transition-all w-28"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                      Correlativo
                    </label>
                    <input
                      type="number"
                      value={avCorrelativo}
                      onChange={(e) => setAvCorrelativo(e.target.value)}
                      placeholder="14730"
                      className="h-8 py-0 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 focus:bg-white transition-all w-32"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center gap-2 self-end">
                <button
                  onClick={buscarAvanzado}
                  disabled={loading}
                  className="h-8 flex items-center gap-1.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                >
                  <Search size={13} /> Buscar
                </button>
                <button
                  onClick={limpiarAvanzado}
                  className="h-8 flex items-center gap-1.5 px-3 text-xs font-medium text-gray-500 bg-white border border-gray-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 rounded-lg transition-all"
                >
                  <X size={12} /> Limpiar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contador */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Total{" "}
          <span className="font-semibold text-gray-900">{filtered.length}</span>{" "}
          comprobante{filtered.length !== 1 ? "s" : ""}
          {avEstadoPago === "PAGADO"
            ? " pagados"
            : avEstadoPago === "TODOS"
              ? ""
              : " pendientes de pago"}
        </p>
      </div>

      {/* Tabla */}
      <style>{`
        .dc-table tbody { display: block; overflow-y: auto; 
        max-height: calc(100vh - ${isBeta ? 365 : 305}px); scrollbar-width: thin; scrollbar-color: #CBD5E1 transparent; }
        .dc-table thead tr, .dc-table tbody tr { display: table; width: 100%; table-layout: fixed; }
        .dc-table thead { width: 100%; }
      `}</style>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse dc-table">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-32">
                  Fecha
                </th>
                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-44">
                  Comprobante
                </th>
                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-32 text-right">
                  Total
                </th>
                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-32 text-right">
                  Pagado
                </th>
                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-32 text-right">
                  Restante
                </th>
                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-28 text-center">
                  Estado
                </th>
                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-36 text-center">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCw
                        size={24}
                        className="animate-spin text-blue-400"
                      />
                      <span className="text-sm text-gray-400">
                        Cargando deudas por cobrar...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-16 text-center text-sm text-gray-400"
                  >
                    No se encontraron comprobantes pendientes.
                  </td>
                </tr>
              ) : (
                filtered.map((d) => {
                  const restante = d.saldoReal ?? (d.montoTotal - d.montoPagado);
                  const colorBadge =
                    ESTADO_CUOTA_COLORS[d.estado] ??
                    ESTADO_CUOTA_COLORS.PENDIENTE;
                  const yaEstaPagado = d.estado === "PAGADO";
                  return (
                    <tr
                      key={d.pagoId}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-3 py-1 text-xs text-gray-900 font-medium whitespace-nowrap w-32">
                        {formatFecha(d.fechaEmision)}
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap w-44">
                        <p className="text-[12px] font-medium text-gray-900 flex items-center gap-1.5">
                          {d.numeroCompleto}
                          {d.tieneNotas && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap">
                              NC/ND
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">
                          {tipoComprobanteLabel(d.tipoComprobante)}
                          {d.tipoMoneda === "USD" && (
                            <span className="ml-1 text-[9px] font-bold text-blue-500">USD</span>
                          )}
                        </p>
                      </td>
                      <td className="px-3 py-1">
                        <p className="text-[12px] font-semibold text-gray-900">
                          {d.clienteRznSocial}
                        </p>
                        <p className="text-xs text-gray-400">
                          {d.clienteNumDoc}
                        </p>
                      </td>
                      <td className="px-3 py-1 text-right whitespace-nowrap w-32">
                        <p className="text-[12px] font-semibold text-gray-900">
                          {formatMoneda(d.montoTotal, d.tipoMoneda)}
                        </p>
                        {d.tieneNotas && (() => {
                          const diff = d.saldoReal - d.montoTotal;
                          const esNC = diff < 0;
                          return (
                            <p className={`text-[10px] font-medium ${esNC ? "text-red-500" : "text-blue-500"}`}>
                              {esNC ? "NC" : "ND"}: {esNC ? "" : "+"}{formatMoneda(diff, d.tipoMoneda)}
                            </p>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-1 text-xs font-semibold text-emerald-600 text-right whitespace-nowrap w-32">
                        {formatMoneda(d.montoPagado, d.tipoMoneda)}
                      </td>
                      <td className="px-3 py-1 text-xs font-semibold text-blue-700 text-right whitespace-nowrap w-32">
                        {formatMoneda(restante, d.tipoMoneda)}
                      </td>
                      <td className="px-3 py-1 text-center w-28">
                        <span
                          className={cn(
                            "text-[11px] font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap",
                            colorBadge,
                          )}
                        >
                          {d.estado}
                        </span>
                      </td>
                      <td className="px-3 py-1 text-center w-36">
                        {yaEstaPagado ? (
                          <button
                            onClick={() => setDeudaPagar(d)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <Check size={13} /> Ver pagos
                          </button>
                        ) : (
                          <button
                            onClick={() => setDeudaPagar(d)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <CreditCard size={13} /> Pagar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// DropdownFiltro
interface DropdownFiltroProps {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}

const DropdownFiltro = ({
  label,
  value,
  options,
  onChange,
}: DropdownFiltroProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const active = value !== "Todos";
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-2.5 text-xs font-medium border rounded-md outline-none transition-all shadow-sm whitespace-nowrap",
          active
            ? "bg-blue-600 text-white border-blue-600"
            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
        )}
      >
        {active ? value : label}
        {active ? (
          <X
            size={13}
            className="text-white/80"
            onClick={(e) => {
              e.stopPropagation();
              onChange("Todos");
            }}
          />
        ) : (
          <ChevronDown
            size={14}
            className={cn("transition-transform", open && "rotate-180")}
          />
        )}
      </button>
      {open && (
        <div className="absolute top-full mt-1.5 left-0 z-40 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden min-w-36">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 text-xs transition-colors text-left",
                value === opt
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-gray-700 hover:bg-gray-50",
              )}
            >
              {opt}
              {value === opt && (
                <Check size={13} className="text-blue-600 shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
