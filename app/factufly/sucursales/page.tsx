"use client";
import { useEffect, useState } from "react";
import {
  Search,
  Plus,
  Edit2,
  FileText,
  Building2,
  MapPin,
  Hash,
  MessageCircle,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react";
import { useToast } from "@/app/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import {
  EditSucursalForm,
  NuevaSucursalForm,
  Sucursal,
} from "@/app/components/modalSucursales/types";
import { NuevaSucursalModal } from "@/app/components/modalSucursales/Nuevasucursalmodal";
import { EditarSucursalModal } from "@/app/components/modalSucursales/Editarsucursalmodal";
import { SeriesSucursalModal } from "@/app/components/modalSucursales/Seriessucursalmodal";
import { cn } from "@/app/utils/cn";

function nextCodigo(sucursales: Sucursal[]): string {
  const nums = sucursales.map((s) => parseInt(s.codigo));
  const max = nums.length ? Math.max(...nums) : -1;
  return String(max + 1).padStart(4, "0");
}

// ─── Stat Strip ───────────────────────────────────────────────────────────────
function StatStrip({
  sucursales,
  totalSeries,
}: {
  sucursales: Sucursal[];
  totalSeries: number;
}) {
  const activas = sucursales.filter((s) => s.habilitado).length;
  const inactivas = sucursales.length - activas;

  const items = [
    {
      label: "Total sucursales",
      value: sucursales.length,
      color: "neutral",
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        </svg>
      ),
    },
    {
      label: "Activas",
      value: activas,
      color: "green",
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
    },
    {
      label: "Inactivas",
      value: inactivas,
      color: "red",
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      ),
    },
    {
      label: "Series registradas",
      value: totalSeries,
      color: "blue",
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      ),
    },
  ] as const;

  const palette = {
    neutral: {
      bg: "bg-gray-100",
      icon: "text-gray-600",
      value: "text-gray-900",
      label: "text-gray-600",
    },
    green: {
      bg: "bg-green-100",
      icon: "text-green-700",
      value: "text-green-900",
      label: "text-green-700",
    },
    red: {
      bg: "bg-red-100",
      icon: "text-red-700",
      value: "text-red-900",
      label: "text-red-700",
    },
    blue: {
      bg: "bg-blue-100",
      icon: "text-blue-700",
      value: "text-blue-900",
      label: "text-blue-700",
    },
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {items.map((item, i) => {
        const p = palette[item.color];
        return (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3"
          >
            <div
              className={`w-7 h-7 rounded-md ${p.bg} flex items-center justify-center ${p.icon} shrink-0`}
            >
              {item.icon}
            </div>
            <div>
              <p className={`text-xl font-semibold leading-none ${p.value}`}>
                {item.value}
              </p>
              <p className={`text-[11px] mt-1 font-medium ${p.label}`}>
                {item.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Series Badge ─────────────────────────────────────────────────────────────
function SeriesBadge({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] font-semibold text-gray-400 uppercase">
        {label}
      </span>
      <span
        className={cn(
          "text-xs font-semibold px-2 py-0.5 rounded-md border inline-block",
          value
            ? "bg-gray-50 text-gray-700 border-gray-200"
            : "bg-gray-50 text-gray-300 border-gray-100",
        )}
      >
        {value || "—"}
      </span>
    </div>
  );
}

// ─── Sucursal Card ────────────────────────────────────────────────────────────
interface SucursalCardProps {
  sucursal: Sucursal;
  canManage: boolean;
  isSuperadmin: boolean;
  onEditar: () => void;
  onSeries: () => void;
  onToggle: () => void;
  togglingId: string | null;
}

function SucursalCard({
  sucursal: s,
  canManage,
  isSuperadmin,
  onEditar,
  onSeries,
  onToggle,
  togglingId,
}: SucursalCardProps) {
  const habilitado = s.habilitado;
  const isToggling = togglingId === s.id;

  return (
    <div
      className={cn(
        "relative bg-white rounded-2xl border transition-all duration-200 overflow-hidden",
        habilitado
          ? "border-gray-200 hover:border-gray-300 hover:shadow-sm"
          : "border-gray-100 opacity-50 hover:opacity-65",
      )}
    >
      <div className="pl-5 pr-4 pt-4 pb-4">
        {/* Top row: badges */}
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[11px] font-bold border border-gray-200">
            <Hash className="w-2.5 h-2.5" />
            {s.codigo}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
              habilitado
                ? "bg-blue-50 text-blue-700 border-blue-100"
                : "bg-gray-100 text-gray-400 border-gray-200",
            )}
          >
            <span
              className={cn(
                "w-1 h-1 rounded-full",
                habilitado ? "bg-blue-600" : "bg-gray-400",
              )}
            />
            {habilitado ? "ACTIVA" : "INACTIVA"}
          </span>
        </div>

        {/* Nombre */}
        <h3 className="text-[15px] font-bold text-gray-900 leading-tight mb-1">
          {s.nombre}
        </h3>

        {/* Dirección */}
        <p className="flex items-start gap-1.5 text-xs text-gray-400 mb-1.5">
          <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-gray-800" />
          {s.direccion || "Sin dirección registrada"}
        </p>

        {/* WhatsApp de aviso de stock bajo */}
        <p className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
          <MessageCircle className="w-3 h-3 shrink-0 text-emerald-600" />
          <span className="font-semibold text-gray-500">Alerta stock bajo:</span>
          {s.numeroStockBajo || "No configurado"}
        </p>

        {/* Series */}
        <div className="border-t border-gray-100 pt-3 mb-4">
          <p className="text-[10px] font-semibold text-gray-600 uppercase mb-2.5">
            Series de comprobantes
          </p>
          <div className="grid grid-cols-4 gap-2">
            <SeriesBadge label="Factura" value={s.serieFactura} />
            <SeriesBadge label="Boleta" value={s.serieBoleta} />
            <SeriesBadge
              label="Nota Crédito Fact."
              value={s.serieNotaCreditoFactura}
            />
            <SeriesBadge
              label="Nota Crédito Bol."
              value={s.serieNotaCreditoBoleta}
            />
            <SeriesBadge
              label="Nota Débito Fact."
              value={s.serieNotaDebitoFactura}
            />
            <SeriesBadge
              label="Nota Débito Bol."
              value={s.serieNotaDebitoBoleta}
            />
            <SeriesBadge label="Guía Remisión" value={s.serieGuiaRemision} />
            <SeriesBadge
              label="Guía Transp."
              value={s.serieGuiaTransportista}
            />
            <SeriesBadge label="Nota Venta" value={s.serieNotaVenta} />
          </div>
        </div>

        {/* Botones de acción */}
        {canManage && (
          <div className="flex items-center gap-1.5 border-t border-gray-100 pt-3">
            <button
              onClick={onEditar}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors"
            >
              <Edit2 className="w-3 h-3" />
              Editar
            </button>
            <button
              onClick={onSeries}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-700 border border-green-100 hover:bg-green-100 transition-colors"
            >
              <FileText className="w-3 h-3" />
              Series
            </button>
            {isSuperadmin && (
              <button
                onClick={onToggle}
                disabled={isToggling}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {habilitado ? (
                  <>
                    <ToggleRight className="w-3.5 h-3.5" />
                    {isToggling ? "Inhabilitando..." : "Inhabilitar"}
                  </>
                ) : (
                  <>
                    <ToggleLeft className="w-3.5 h-3.5" />
                    {isToggling ? "Habilitando..." : "Habilitar"}
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SucursalesPage() {
  const { showToast } = useToast();
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [search, setSearch] = useState("");
  const [pageSize] = useState(10);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [modalNueva, setModalNueva] = useState(false);
  const [modalEditar, setModalEditar] = useState<Sucursal | null>(null);
  const [modalSeries, setModalSeries] = useState<Sucursal | null>(null);
  const [loading, setLoading] = useState(true);

  const { accessToken, user } = useAuth();

  const isSuperadmin = user?.rol === "superadmin";
  const isAdmin = user?.rol === "admin";
  const canManage = isSuperadmin || isAdmin;

  const visibleSucursales = sucursales;
  const filtered = visibleSucursales.filter(
    (s) =>
      s.nombre.toLowerCase().includes(search.toLowerCase()) ||
      s.codigo.includes(search),
  );
  const displayed = filtered.slice(0, pageSize);

  const totalSeries = sucursales.reduce((acc, s) => {
    let count = 0;
    if (s.serieFactura) count++;
    if (s.serieBoleta) count++;
    if (s.serieNotaCreditoFactura) count++;
    if (s.serieNotaCreditoBoleta) count++;
    if (s.serieNotaDebitoFactura) count++;
    if (s.serieNotaDebitoBoleta) count++;
    if (s.serieGuiaRemision) count++;
    if (s.serieGuiaTransportista) count++;
    if (s.serieNotaVenta) count++;
    return acc + count;
  }, 0);

  const fetchSucursales = async () => {
    setLoading(true);
    try {
      let data;

      if (isSuperadmin) {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Sucursal/todas`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        data = res.data.map((s: any) => mapSucursal(s));
      } else {
        // ✅ Usa el endpoint por ID directamente
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Sucursal/${user?.sucursalID}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        data = [mapSucursal(res.data)]; // devuelve un objeto, lo envolvemos en array
      }

      setSucursales(data);
    } catch {
      showToast("Error al cargar sucursales", "error");
    } finally {
      setLoading(false);
    }
  };

  function mapSucursal(s: any): Sucursal {
    return {
      id: s.sucursalId.toString(),
      codigo: s.codEstablecimiento,
      nombre: s.nombre ?? s.codEstablecimiento,
      direccion: s.direccion ?? "",
      numeroStockBajo: s.numeroStockBajo ?? "",
      habilitado: s.estado,
      usuario: "",
      serieFactura: s.serieFactura,
      correlativoFactura: s.correlativoFactura ?? 1,
      serieBoleta: s.serieBoleta,
      correlativoBoleta: s.correlativoBoleta ?? 1,
      serieNotaCreditoFactura: s.serieNotaCreditoFactura,
      correlativoNotaCreditoFactura: s.correlativoNotaCreditoFactura ?? 1,
      serieNotaCreditoBoleta: s.serieNotaCreditoBoleta,
      correlativoNotaCreditoBoleta: s.correlativoNotaCreditoBoleta ?? 1,
      serieNotaDebitoFactura: s.serieNotaDebitoFactura,
      correlativoNotaDebitoFactura: s.correlativoNotaDebitoFactura ?? 1,
      serieNotaDebitoBoleta: s.serieNotaDebitoBoleta,
      correlativoNotaDebitoBoleta: s.correlativoNotaDebitoBoleta ?? 1,
      serieGuiaRemision: s.serieGuiaRemision,
      correlativoGuiaRemision: s.correlativoGuiaRemision ?? 1,
      serieGuiaTransportista: s.serieGuiaTransportista,
      correlativoGuiaTransportista: s.correlativoGuiaTransportista ?? 1,
      serieNotaVenta: s.serieNotaVenta,
      correlativoNotaVenta: s.correlativoNotaVenta ?? 1,
    };
  }

  // ANTES
  useEffect(() => {
    if (accessToken && user) fetchSucursales();
  }, [accessToken, user]);

  const handleCrear = async (form: NuevaSucursalForm) => {
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Sucursal`,
        {
          codEstablecimiento: nextCodigo(sucursales),
          nombre: form.nombre,
          direccion: form.direccion,
          serieFactura: form.serieFactura,
          correlativoFactura: form.correlativoFactura,
          serieBoleta: form.serieBoleta,
          correlativoBoleta: form.correlativoBoleta,
          serieNotaCreditoFactura: form.serieNotaCreditoFactura,
          correlativoNotaCreditoFactura: form.correlativoNotaCreditoFactura,
          serieNotaCreditoBoleta: form.serieNotaCreditoBoleta,
          correlativoNotaCreditoBoleta: form.correlativoNotaCreditoBoleta,
          serieNotaDebitoFactura: form.serieNotaDebitoFactura,
          correlativoNotaDebitoFactura: form.correlativoNotaDebitoFactura,
          serieNotaDebitoBoleta: form.serieNotaDebitoBoleta,
          correlativoNotaDebitoBoleta: form.correlativoNotaDebitoBoleta,
          serieGuiaRemision: form.serieGuiaRemision,
          correlativoGuiaRemision: form.correlativoGuiaRemision,
          serieGuiaTransportista: form.serieGuiaTransportista,
          correlativoGuiaTransportista: form.correlativoGuiaTransportista,
          serieNotaVenta: form.serieNotaVenta,
          correlativoNotaVenta: form.correlativoNotaVenta,
          usernameAdminSucursal: form.usuario,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      setModalNueva(false);
      showToast(`Sucursal "${form.nombre}" creada correctamente`, "success");
      fetchSucursales();
    } catch (error: any) {
      showToast(
        error.response?.data?.mensaje || "Error al crear sucursal",
        "error",
      );
    }
  };

  const handleEditarSeries = async (id: string, data: any) => {
    const sucursalId = isSuperadmin ? id : user?.sucursalID;
    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Sucursal/${sucursalId}`,
        {
          ...data,
          sucursalId: user?.sucursalID,
          nombre: modalSeries?.nombre,
          direccion: modalSeries?.direccion,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      setModalSeries(null);
      showToast("Series actualizadas correctamente", "success");
      fetchSucursales();
    } catch (error: any) {
      showToast(
        error.response?.data?.mensaje || "Error al actualizar series",
        "error",
      );
    }
  };

  const handleEditar = async (id: string, data: EditSucursalForm) => {
    const sucursalId = isSuperadmin ? id : user?.sucursalID;
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Sucursal/${sucursalId}`,
        { nombre: data.nombre, direccion: data.direccion, numeroStockBajo: data.numeroStockBajo || null },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      setModalEditar(null);
      showToast("Sucursal actualizada correctamente", "success");
      fetchSucursales();
    } catch (error: any) {
      showToast(
        error.response?.data?.mensaje || "Error al actualizar sucursal",
        "error",
      );
    }
  };

  const handleToggleEstado = async (id: string) => {
    setTogglingId(id);
    const sucursal = sucursales.find((s) => s.id === id);
    try {
      if (sucursal?.habilitado) {
        // Inhabilitar → DELETE existente
        await axios.delete(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Sucursal/${id}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        showToast(`Sucursal "${sucursal.nombre}" inhabilitada`, "success");
      } else {
        // Habilitar → nuevo endpoint
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Sucursal/${id}/habilitar`,
          {},
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        showToast(`Sucursal "${sucursal?.nombre}" habilitada`, "success");
      }
      fetchSucursales();
    } catch (error: any) {
      showToast(
        error.response?.data?.mensaje || "Error al cambiar estado",
        "error",
      );
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="mx-auto space-y-5 animate-in fade-in duration-500">
      {/* ── Stats (solo superadmin) ── */}
      {isSuperadmin && (
        <StatStrip sucursales={sucursales} totalSeries={totalSeries} />
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3">
        <div className="relative min-w-48 flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o código..."
            className="w-full pl-10 pr-9 py-2.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue/50 outline-none transition-all shadow-sm text-xs"
          />
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {canManage && (
          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setModalNueva(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#0f2e64] hover:bg-[#0a2050] active:scale-95 rounded-lg shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Nueva sucursal
            </button>
          </div>
        )}
      </div>

      {/* ── Cards ── */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse"
            >
              <div className="pl-5 pr-4 pt-4 pb-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-5 w-14 bg-gray-100 rounded-md" />
                  <div className="h-5 w-16 bg-gray-100 rounded-full" />
                </div>
                <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
                <div className="border-t border-gray-100 pt-3 mb-4">
                  <div className="h-2.5 bg-gray-100 rounded w-1/3 mb-2.5" />
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <div key={j} className="space-y-1">
                        <div className="h-2 bg-gray-100 rounded w-full" />
                        <div className="h-6 bg-gray-100 rounded-md w-full" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1.5 border-t border-gray-100 pt-3">
                  <div className="h-7 w-16 bg-gray-100 rounded-lg" />
                  <div className="h-7 w-16 bg-gray-100 rounded-lg" />
                  <div className="h-7 w-20 bg-gray-100 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-400">No se encontraron sucursales</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {displayed.map((s) => (
            <SucursalCard
              key={s.id}
              sucursal={s}
              canManage={canManage}
              isSuperadmin={isSuperadmin}
              togglingId={togglingId}
              onEditar={() => setModalEditar(s)}
              onSeries={() => setModalSeries(s)}
              onToggle={() => handleToggleEstado(s.id)}
            />
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {modalNueva && (
        <NuevaSucursalModal
          nextCode={nextCodigo(sucursales)}
          sucursales={sucursales}
          onClose={() => setModalNueva(false)}
          onSave={handleCrear}
        />
      )}
      {modalEditar && (
        <EditarSucursalModal
          sucursal={modalEditar}
          onClose={() => setModalEditar(null)}
          onSave={handleEditar}
        />
      )}
      {modalSeries && (
        <SeriesSucursalModal
          sucursal={modalSeries}
          onClose={() => setModalSeries(null)}
          onSave={handleEditarSeries}
        />
      )}
    </div>
  );
}
