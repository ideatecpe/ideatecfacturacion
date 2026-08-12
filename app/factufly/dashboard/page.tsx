"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart3,
  FileText,
  Zap,
  ChevronRight,
  X,
  Send,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Bell,
  Calendar,
  ShieldCheck,
  Eye,
  Plus,
  TrendingDown,
  TrendingUp,
  ArrowLeftRight,
  CreditCard,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useRouter } from "next/navigation";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { cn } from "@/app/utils/cn";
import { useAuth } from "@/context/AuthContext";
import { useDashboardEmpresa } from "./gestionDashboard/UseDashboardEmpresa";
import { useDashboardSucursal } from "./gestionDashboard/UseDashboardSucursal";
import { Skeleton } from "@/app/components/ui/Skeleton";
import { useSucursalRuc } from "../operaciones/boleta/gestionBoletas/useSucursalRuc";
import { DropdownSucursal } from "@/app/components/ui/DropdownSucursal";
import { NotificacionesSunatModal } from "@/app/components/modalnotificacionesSunat/NotificacionesSunatModal";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Notificacion {
  id: number;
  title: string;
  desc: string;
  time: string;
  type: "success" | "warning" | "error" | "info";
  detail: string;
  fecha: string;
  comprobante?: string;
}

// ─── Mock Notificaciones ───────────────────────────────────────────────────────

const ALL_NOTIFICACIONES: Notificacion[] = [
  {
    id: 1,
    title: "CDR Aceptado",
    desc: "Factura F001-00124 aceptada con éxito.",
    time: "Hace 5 min",
    type: "success",
    detail:
      "El comprobante F001-00124 emitido a Corporación Lima SAC por S/ 1,180.00 fue aceptado correctamente por SUNAT. CDR recibido con estado 0 (Aceptado).",
    fecha: "15/01/2025 09:32",
    comprobante: "F001-00124",
  },
  {
    id: 2,
    title: "Pendiente de Envío",
    desc: "3 boletas pendientes de envío manual.",
    time: "Hace 1 hora",
    type: "warning",
    detail:
      "Las boletas B001-00853, B001-00851 y B001-00849 no han podido enviarse automáticamente; intente reenviarlas desde el módulo de Comprobantes.",
    fecha: "15/01/2025 08:45",
  },
  {
    id: 3,
    title: "Certificado Digital",
    desc: "Vence en 15 días (05/06/2025).",
    time: "Sistema",
    type: "error",
    detail:
      "Su certificado digital de firma electrónica vence el 05 de junio de 2025.",
    fecha: "15/01/2025 00:00",
  },
  {
    id: 5,
    title: "Factura Rechazada",
    desc: "F001-00122 rechazada por SUNAT (2329).",
    time: "Hace 3 horas",
    type: "error",
    detail: "La factura F001-00122 fue rechazada por SUNAT con error 2329.",
    fecha: "14/01/2025 22:15",
    comprobante: "F001-00122",
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

const formatFecha = (fechaStr: string) => {
  const date = new Date(fechaStr);
  return date.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatMoneda = (valor: number) =>
  `S/ ${valor.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getFechaHoy = (): string => {
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${año}-${mes}-${dia}`;
};

const estadoSunatLabel = (estado: string): "success" | "warning" | "error" => {
  const map: Record<string, "success" | "warning" | "error"> = {
    ACEPTADO: "success",
    PENDIENTE: "warning",
    RECHAZADO: "error",
    ACEPTADO_CON_OBSERVACIONES: "warning",
  };
  return map[estado?.toUpperCase()] ?? "warning";
};

// ─── Modal Base ────────────────────────────────────────────────────────────────

const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}> = ({ open, onClose, children, wide }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200",
          wide ? "max-w-4xl" : "max-w-lg",
        )}
      >
        {children}
      </div>
    </div>
  );
};

const ModalHeader: React.FC<{
  title: string;
  subtitle?: string;
  onClose: () => void;
  icon?: React.ReactNode;
  iconColor?: string;
}> = ({
  title,
  subtitle,
  onClose,
  icon,
  iconColor = "bg-blue-100 text-blue-700",
}) => (
  <div className="flex items-center gap-3 p-6 border-b border-slate-100 shrink-0">
    {icon && (
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
          iconColor,
        )}
      >
        {icon}
      </div>
    )}
    <div className="flex-1 min-w-0">
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
    <button
      onClick={onClose}
      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
    >
      <X size={18} />
    </button>
  </div>
);

// ─── Card: Desglose de Notas ───────────────────────────────────────────────────

const DesgloseNotasCard: React.FC<{
  dashboard: import("./gestionDashboard/Dashboard").DashboardData | null;
  loading: boolean;
}> = ({ dashboard, loading }) => {
  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-50">
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-xl border border-gray-100 space-y-2"
            >
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const ncDia = dashboard?.totalNotasCreditoDelDia ?? 0;
  const ncOtras = dashboard?.totalNotasCreditoOtrasFechas ?? 0;
  const ndDia = dashboard?.totalNotasDebitoDelDia ?? 0;
  const ndOtras = dashboard?.totalNotasDebitoOtrasFechas ?? 0;
  const hayNotasOtrasFechas = ncOtras > 0 || ndOtras > 0;
  const hayNV = (dashboard?.totalNotasVentaDelDia ?? 0) > 0;

  return (
    <Card
      title="Desglose de Notas"
      subtitle="Impacto de notas de crédito y débito según fecha del documento afectado"
    >
      <div className={hayNV ? "grid grid-cols-2 lg:grid-cols-6 gap-2 mt-1" : "grid grid-cols-2 lg:grid-cols-5 gap-2 mt-1"}>
        {/* NC del día */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-100 bg-rose-50/50">
          <TrendingDown size={13} className="text-rose-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-rose-600 uppercase tracking-wide">NC · Hoy</p>
            <p className="text-sm font-bold text-rose-700 truncate">{formatMoneda(ncDia)}</p>
          </div>
        </div>

        {/* ND del día */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-100 bg-emerald-50/50">
          <TrendingUp size={13} className="text-emerald-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">ND · Hoy</p>
            <p className="text-sm font-bold text-emerald-700 truncate">{formatMoneda(ndDia)}</p>
          </div>
        </div>

        {/* NC otras fechas */}
        <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border",
          hayNotasOtrasFechas ? "border-amber-100 bg-amber-50/50" : "border-gray-100 bg-gray-50/40")}>
          <ArrowLeftRight size={13} className={hayNotasOtrasFechas ? "text-amber-500 shrink-0" : "text-gray-300 shrink-0"} />
          <div className="min-w-0">
            <p className={cn("text-[10px] font-semibold uppercase tracking-wide", hayNotasOtrasFechas ? "text-amber-600" : "text-gray-400")}>NC · Anteriores</p>
            <p className={cn("text-sm font-bold truncate", hayNotasOtrasFechas ? "text-amber-700" : "text-gray-400")}>{formatMoneda(ncOtras)}</p>
          </div>
        </div>

        {/* ND otras fechas */}
        <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border",
          hayNotasOtrasFechas ? "border-amber-100 bg-amber-50/50" : "border-gray-100 bg-gray-50/40")}>
          <ArrowLeftRight size={13} className={hayNotasOtrasFechas ? "text-amber-500 shrink-0" : "text-gray-300 shrink-0"} />
          <div className="min-w-0">
            <p className={cn("text-[10px] font-semibold uppercase tracking-wide", hayNotasOtrasFechas ? "text-amber-600" : "text-gray-400")}>ND · Anteriores</p>
            <p className={cn("text-sm font-bold truncate", hayNotasOtrasFechas ? "text-amber-700" : "text-gray-400")}>{formatMoneda(ndOtras)}</p>
          </div>
        </div>

        {/* Notas de Venta */}
        {hayNV && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-100 bg-amber-50/50">
            <FileText size={13} className="text-amber-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">NV · Hoy</p>
              <p className="text-sm font-bold text-amber-700 truncate">{formatMoneda(dashboard?.totalNotasVentaDelDia ?? 0)}</p>
            </div>
          </div>
        )}

        {/* Ventas netas */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#D9E4F5] bg-[#EEF3FB]">
          <BarChart3 size={13} className="text-brand-blue shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-brand-blue/60 uppercase tracking-wide">Netas del Día</p>
            <p className="text-sm font-bold text-brand-blue truncate">{formatMoneda(dashboard?.ventasNetas ?? 0)}</p>
            <p className="text-[9px] text-brand-blue/40 mt-0.5">Brutas + ND − NC del día</p>
          </div>
        </div>
      </div>

      {hayNotasOtrasFechas && (
        <p className="text-[10px] text-amber-600 mt-2 flex items-center gap-1">
          <AlertTriangle size={10} />
          Hay notas que afectan documentos de días anteriores.
        </p>
      )}
    </Card>
  );
};

// ─── Dashboard Page ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const isSuperAdmin = user?.rol === "superadmin";

  const hookEmpresa = useDashboardEmpresa();
  const hookSucursal = useDashboardSucursal();
  const { sucursales } = useSucursalRuc(isSuperAdmin);
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState<
    number | null
  >(null);
  const [showTodasAlertas, setShowTodasAlertas] = useState(false);
  const [fecha, setFecha] = useState<string>(getFechaHoy());

  const { dashboard, loading, error } = useMemo(() => {
    if (isSuperAdmin && sucursalSeleccionada) return hookSucursal;
    if (isSuperAdmin) return hookEmpresa;
    return hookSucursal;
  }, [isSuperAdmin, sucursalSeleccionada, hookEmpresa, hookSucursal]);

  const userRuc = user?.ruc;
  const userSucursalID = user?.sucursalID;

  const fetchDashboardSucursal = hookSucursal.fetchDashboard;
  const fetchDashboardEmpresa = hookEmpresa.fetchDashboard;

  const fetchData = useCallback(
    (fechaParam: string, sucursalParam: number | null) => {
      if (!userRuc) return;
      if (isSuperAdmin) {
        if (sucursalParam) {
          fetchDashboardSucursal({
            sucursalId: sucursalParam,
            fecha: fechaParam,
            limite: 10,
          });
        } else {
          fetchDashboardEmpresa({
            ruc: userRuc,
            fecha: fechaParam,
            limite: 10,
          });
        }
      } else {
        fetchDashboardSucursal({
          sucursalId: Number(userSucursalID),
          fecha: fechaParam,
          limite: 10,
        });
      }
    },
    [
      userRuc,
      userSucursalID,
      isSuperAdmin,
      fetchDashboardSucursal,
      fetchDashboardEmpresa,
    ],
  );

  useEffect(() => {
    fetchData(fecha, sucursalSeleccionada);
  }, [fetchData, fecha, sucursalSeleccionada]);

  const handleSucursalChange = (id: number | null) => {
    if (id === null) hookSucursal.reset();
    else hookEmpresa.reset();
    setSucursalSeleccionada(id);
    fetchData(fecha, id);
  };

  const handleFechaChange = (nuevaFecha: string) => {
    setFecha(nuevaFecha);
    fetchData(nuevaFecha, sucursalSeleccionada);
  };

  const chartData = useMemo(() => {
    const dias: { name: string; sales: number }[] = [];
    const base = new Date(fecha + "T00:00:00");
    for (let i = 6; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      const fechaStr = d.toISOString().split("T")[0];
      const encontrado = (dashboard?.rendimientoVentas ?? []).find((r) =>
        r.fecha.startsWith(fechaStr),
      );
      dias.push({
        name: d.toLocaleDateString("es-PE", {
          weekday: "short",
          day: "2-digit",
        }),
        sales: encontrado ? Number(encontrado.totalVentas.toFixed(2)) : 0,
      });
    }
    return dias;
  }, [dashboard?.rendimientoVentas, fecha]);

  // ─── KPIs ─────────────────────────────────────────────────────────
  const kpis = [
    {
      label: "Ventas del Día",
      value: formatMoneda(dashboard?.ventasDelDia ?? 0),
      icon: BarChart3,
      color: "text-[#0f2e64]",
      bar: "bg-[#0f2e64]",
    },
    {
      label: "Ventas Netas",
      value: formatMoneda(dashboard?.ventasNetas ?? 0),
      icon: TrendingUp,
      color: "text-blue-500",
      bar: "bg-blue-500",
    },
    ...((dashboard?.totalComisionTarjetaDelDia ?? 0) > 0 ? [{
      label: "Comisión POS",
      value: formatMoneda(dashboard?.totalComisionTarjetaDelDia ?? 0),
      icon: CreditCard,
      color: "text-cyan-600",
      bar: "bg-cyan-500",
    }] : []),
    {
      label: "Facturas Emitidas",
      value: String(dashboard?.facturasEmitidas ?? 0),
      icon: FileText,
      color: "text-emerald-600",
      bar: "bg-emerald-500",
    },
    {
      label: "Boletas Emitidas",
      value: String(dashboard?.boletasEmitidas ?? 0),
      icon: FileText,
      color: "text-violet-600",
      bar: "bg-violet-500",
    },
    {
      label: "N. de Crédito",
      value: String(dashboard?.notasCreditoEmitidas ?? 0),
      icon: TrendingDown,
      color: "text-rose-600",
      bar: "bg-rose-500",
    },
    {
      label: "N. de Débito",
      value: String(dashboard?.notasDebitoEmitidas ?? 0),
      icon: TrendingUp,
      color: "text-orange-500",
      bar: "bg-orange-500",
    },
    ...((dashboard?.notasVentaEmitidas ?? 0) > 0 ? [{
      label: "N. de Venta",
      value: String(dashboard?.notasVentaEmitidas ?? 0),
      icon: FileText,
      color: "text-amber-600",
      bar: "bg-amber-500",
    }] : []),
  ];

  const isPageLoading = loading || isAuthLoading || (!dashboard && !error);

  return (
    <>
      {showTodasAlertas && (
        <NotificacionesSunatModal
          onClose={() => setShowTodasAlertas(false)}
          sucursalId={
            isSuperAdmin ? sucursalSeleccionada : Number(user?.sucursalID)
          }
          empresaRuc={
            isSuperAdmin && !sucursalSeleccionada ? user?.ruc : undefined
          }
        />
      )}

      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-1 min-w-45 sm:flex-none items-center gap-3">
          {isSuperAdmin && (
            <DropdownSucursal
              sucursales={sucursales}
              seleccionada={sucursalSeleccionada}
              onSelect={handleSucursalChange}
            />
          )}
          <div className="flex flex-1 items-center gap-2 bg-white border border-[#E2EAF6] rounded-lg px-3 py-2.5 hover:border-brand-blue/30 transition-colors">
            <span className="text-xs text-slate-500 font-medium">Fecha</span>
            <input
              type="date"
              value={fecha}
              max={getFechaHoy()}
              onChange={(e) => handleFechaChange(e.target.value)}
              className="text-xs text-brand-blue font-medium border-none outline-none bg-transparent cursor-pointer h-4 leading-none [&::-webkit-datetime-edit]:p-0 [&::-webkit-datetime-edit-fields-wrapper]:p-0 [&::-webkit-date-and-time-value]:m-0"
            />
          </div>
        </div>
        <Button onClick={() => router.push("/factufly/operaciones/boleta-facturaelectronica")} className="flex-1 min-w-0 sm:flex-none whitespace-nowrap">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nuevo </span>Comprobante
        </Button>
      </div>

      {/* ─── Alerta de error ─────────────────────────────────────────── */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-red-900">
                Error al cargar datos
              </p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => fetchData(fecha, sucursalSeleccionada)}
            className="bg-white border-red-200 text-red-700 hover:bg-red-50 text-xs px-3 py-1.5"
          >
            <RotateCcw size={14} className="mr-2" /> Reintentar
          </Button>
        </div>
      )}

      <div className="space-y-3 animate-in fade-in duration-500">
        {/* ─── KPI Grid ────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3">
          {isPageLoading
            ? Array.from({ length: 7 }).map((_, i) => (
                <Card key={i} className="p-0 flex-1 min-w-[140px]">
                  <div className="p-3 flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-2.5 w-16" />
                      <Skeleton className="h-4 w-14" />
                    </div>
                  </div>
                </Card>
              ))
            : kpis.map((kpi, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-[#E2EAF6] overflow-hidden flex shadow-sm flex-1 min-w-[140px]"
                >
                  <div className="flex-1 px-3 py-2.5 flex items-center gap-2.5 min-w-0">
                    <kpi.icon className={cn("w-4 h-4 shrink-0", kpi.color)} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">
                        {kpi.label}
                      </p>
                      <p className="text-sm font-bold text-brand-blue mt-0.5 truncate">
                        {kpi.value}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
        </div>

        {/* ─── Desglose de Notas ──────────────────────────────────────── */}
        <DesgloseNotasCard dashboard={dashboard} loading={isPageLoading} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* ─── Gráfico de ventas ──────────────────────────────────────── */}
          {isPageLoading ? (
            <Card className="lg:col-span-2">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-50">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <div className="h-80 w-full">
                <Skeleton className="w-full h-full rounded-xl" />
              </div>
            </Card>
          ) : (
            <Card
              className="lg:col-span-2"
              title="Rendimiento de Ventas"
              subtitle="Resumen de los últimos 7 días"
            >
              <div className="h-56 w-full mt-2 min-h-0">
                {!dashboard || chartData.every((d) => d.sales === 0) ? (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                    Sin datos en el período seleccionado
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient
                          id="colorSales"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#0f2e64"
                            stopOpacity={0.12}
                          />
                          <stop
                            offset="95%"
                            stopColor="#0f2e64"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f0f0f0"
                      />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#94a3b8" }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#94a3b8" }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "12px",
                          border: "none",
                          boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                        }}
                        formatter={(value: number | undefined) => [
                          `S/ ${(value ?? 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`,
                          "Ventas",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="sales"
                        stroke="#0f2e64"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorSales)"
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          )}

          {/* ─── Notificaciones SUNAT ───────────────────────────────────── */}
          {loading ? (
            <Card className="border-t-4 border-t-brand-red">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-50">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-3 p-3">
                    <Skeleton className="w-2 h-2 rounded-full mt-1.5 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-2 w-16 mt-1" />
                    </div>
                  </div>
                ))}
                <Skeleton className="h-10 w-full rounded-lg mt-2" />
              </div>
            </Card>
          ) : (
            // ─── Notificaciones SUNAT ───────────────────────────────────────────────────
            <Card
              title="Notificaciones SUNAT"
              subtitle="Estado de comprobantes y alertas"
            >
              <div className="space-y-0">
                {/* Aceptados */}
                <div className="flex gap-3 p-2 rounded-lg border border-transparent">
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-emerald-500" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      Aceptados del día
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      Todos los comprobantes que SUNAT aceptó correctamente hoy.
                    </p>
                  </div>
                </div>

                {/* Rechazados */}
                <div className="flex gap-3 p-2 rounded-lg border border-transparent">
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-rose-500" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      Rechazados del día
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      Comprobantes que SUNAT rechazó hoy. Revisa el código de
                      error y corrige antes de reenviar.
                    </p>
                  </div>
                </div>

                {/* Pendientes */}
                <div className="flex gap-3 p-2 rounded-lg border border-transparent">
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-amber-500" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      Pendientes de envío
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      Comprobantes emitidos hoy que aún no han recibido
                      respuesta de SUNAT.
                    </p>
                  </div>
                </div>

                {/* Certificado */}
                <div className="flex gap-3 p-3 rounded-lg border border-transparent">
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-blue-500" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      Certificado digital
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      Vigencia de tu certificado de firma electrónica. Te
                      alertamos si está por vencer.
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full mt-2"
                  onClick={() => setShowTodasAlertas(true)}
                >
                  Ver todas las alertas
                </Button>
                
              </div>
            </Card>
          )}
        </div>

        {/* ─── Comprobantes Recientes ──────────────────────────────────── */}
        {loading ? (
          <Card>
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-50">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50">
                    {["w-24", "w-32", "w-20", "w-16", "w-20"].map((w, i) => (
                      <th key={i} className="px-6 py-3">
                        <Skeleton className={`h-3 ${w}`} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {["w-24", "w-40", "w-20", "w-16"].map((w, j) => (
                        <td key={j} className="px-6 py-4">
                          <Skeleton className={`h-4 ${w}`} />
                        </td>
                      ))}
                      <td className="px-6 py-4">
                        <Skeleton className="h-6 w-20 rounded-full" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card
            title="Comprobantes Recientes"
            action={
              <Button
                variant="ghost"
                className="text-brand-blue text-xs py-1.5 px-2 h-auto"
                onClick={() => router.push("/factufly/comprobantes")}
              >
                Ver todos <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            }
          >
            <div className="overflow-x-auto -mx-3">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr style={{ background: "#F5F8FD" }}>
                    {["ID Comprobante", "Cliente", "Fecha", "Total", "Estado"].map((h) => (
                      <th key={h} className="px-4 py-2 text-[10px] font-semibold text-gray-800 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF3FB]">
                  {(dashboard?.comprobantesRecientes ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                        Sin comprobantes recientes
                      </td>
                    </tr>
                  ) : (
                    (dashboard?.comprobantesRecientes ?? []).map((doc, i) => (
                      <tr key={i} className="hover:bg-[#F5F8FD] transition-colors">
                        <td className="px-4 py-2">
                          <span className="text-xs font-semibold text-brand-blue">{doc.numeroCompleto}</span>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-600 max-w-40 truncate">
                          {doc.clienteRznSocial}
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-400">
                          {formatFecha(doc.fechaEmision)}
                        </td>
                        <td className="px-4 py-2 text-xs font-semibold text-brand-blue">
                          {formatMoneda(doc.importeTotal)}
                        </td>
<td className="px-4 py-2">
  <Badge variant={estadoSunatLabel(doc.estadoSunat)} className="text-[10px]!">
    {doc.estadoSunat}
  </Badge>
</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

