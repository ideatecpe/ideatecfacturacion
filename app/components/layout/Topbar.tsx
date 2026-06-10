"use client";

import { useState, useRef, useEffect } from "react";
import {
  Menu,
  ChevronRight,
  Bell,
  Settings,
  LogOut,
  User,
  Check,
  AlertCircle,
  Info,
  Globe,
  MapPin,
  FlaskConical,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { View } from "@/app/types";
import { signOut } from "next-auth/react";
import { useAuth } from "@/context/AuthContext";
import { DateChip } from "./DateChip";
import { useNotifications } from "@/hooks/useNotifications";
import Link from "next/link";

interface TopbarProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  activeView: View;
}

export const Topbar = ({
  isSidebarOpen,
  toggleSidebar,
  activeView,
}: TopbarProps) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const [lastSeenAt, setLastSeenAt] = useState<string>(
    new Date().toISOString(),
  );
  const [unseenCount, setUnseenCount] = useState(0);

  const { user } = useAuth();

  const isSuperAdmin = user?.rol === "superadmin";
  const {
    pendingDocs,
    lastAccepted,
    lastRejected,
    totalPending,
    connected,
    certInfo,
    generatedAt,
  } = useNotifications({
    sucursalId: isSuperAdmin
      ? null
      : user?.sucursalID
        ? Number(user.sucursalID)
        : null,
    empresaRuc: isSuperAdmin ? user?.ruc : null,
  });

  const isBeta = user?.environment === "beta";

  const logoSrc = user?.logoBase64
    ? `data:image/png;base64,${user.logoBase64}`
    : "/user.png";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node))
        setUserOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unreadCount =
    totalPending +
    (lastRejected ? 1 : 0) +
    (certInfo?.isExpiringSoon || certInfo?.isExpired ? 1 : 0);

  // Reemplaza el useEffect por este:
  const prevGeneratedAt = useRef<string>("");
  const isFirstLoad = useRef<boolean>(true);

  useEffect(() => {
    if (!generatedAt) return;

    if (isFirstLoad.current) {
      // Al cargar por primera vez, muestra el unreadCount inicial
      setUnseenCount(unreadCount);
      isFirstLoad.current = false;
    } else if (generatedAt !== prevGeneratedAt.current && !notifOpen) {
      // Cada actualización posterior suma 1
      setUnseenCount((prev) => prev + 1);
    }

    prevGeneratedAt.current = generatedAt;
  }, [generatedAt, unreadCount, notifOpen]);

  // Al abrir el panel, marca como leído:
  const handleOpenNotif = () => {
    const isOpening = !notifOpen;
    setNotifOpen(isOpening);
    setUserOpen(false);
    if (isOpening) {
      setLastSeenAt(new Date().toISOString());
      setUnseenCount(0);
    }
  };

  return (
    <>
      <header
        className={`flex flex-col shrink-0 sticky top-0 z-40 border-b transition-colors ${
          isBeta
            ? "bg-amber-50 border-amber-300"
            : "bg-[#ffffff] border-[#D9E4F5]"
        }`}
        style={!isBeta ? { boxShadow: "0 1px 3px rgba(15,46,100,0.06)" } : undefined}
      >
      <div className="h-14 flex items-center justify-between px-4">
        {/* ── Izquierda ── */}
        <div className="flex items-center gap-3">
          {/* Botón hamburguesa */}
          <button
            onClick={toggleSidebar}
            className={`p-2 rounded-lg border transition-all shadow-sm ${
              isBeta
                ? "bg-amber-100 border-amber-200 text-amber-700 hover:bg-amber-200"
                : "bg-white border-[#D9E4F5] text-brand-blue hover:bg-[#EEF3FB] hover:border-brand-blue/20"
            }`}
          >
            {isSidebarOpen ? (
              <Menu className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>

          {/* Breadcrumb */}
          <div className="hidden md:flex items-center gap-1.5">
            <span className="text-[12px] font-semibold text-brand-blue tracking-wide">
              Sistema
            </span>
            <ChevronRight className="w-3 h-3 text-brand-blue/25" />
            <span className="font-semibold text-brand-blue capitalize text-[12px] ">
              {activeView === "operaciones" ? "Emisión" : activeView}
            </span>
          </div>

          <DateChip />
        </div>

        {/* ── Derecha ── */}
        <div className="flex items-center gap-3">
          {/* Context badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-2">
            <div className="flex flex-col leading-none">
              <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest">
                Empresa
              </span>
              <span
                className={`text-xs font-black uppercase tracking-wide mt-0.5 ${
                  isBeta ? "text-amber-800" : "text-brand-blue"
                }`}
              >
                {user?.nombreEmpresa}
              </span>
            </div>

            {!isSuperAdmin && user?.nombreSucursal && (
              <>
                <div className="w-px h-5 bg-[#D9E4F5] mx-1" />
                <MapPin
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isBeta ? "text-amber-600" : "text-brand-blue/80"
                  }`}
                />
                <div className="flex flex-col leading-none">
                  <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest">
                    Sucursal
                  </span>
                  <span className="text-xs font-bold text-slate-700 mt-0.5 truncate">
                    {user.nombreSucursal}
                  </span>
                </div>
              </>
            )}

            {isSuperAdmin && (
              <>
                <div className="w-px h-5 bg-[#D9E4F5] mx-1" />
                <Globe className="w-3 h-3 text-emerald-500 shrink-0" />
                <div className="flex flex-col leading-none">
                  <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">
                    Acceso
                  </span>
                  <span className="text-xs font-bold text-emerald-400 mt-0.5">
                    Global
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Campana de notificaciones */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={handleOpenNotif}
              className={`p-2.5 rounded-xl relative group transition-all ${
                isBeta
                  ? "hover:bg-amber-100 text-amber-500"
                  : "hover:bg-white text-slate-400 hover:text-[#0f2e64]"
              }`}
            >
              <Bell
                className={`w-5 h-5 transition-colors ${
                  isBeta
                    ? "group-hover:text-amber-700"
                    : "group-hover:text-[#0f2e64]"
                }`}
              />
              {unseenCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-4.5 h-4.5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center px-1">
                  <span className="text-[10px] font-bold text-white leading-none">
                    {unseenCount}
                  </span>
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="fixed sm:absolute inset-x-2 sm:inset-x-auto sm:right-0 top-[3.75rem] sm:top-auto sm:mt-2 sm:w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-fade-in">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <span className="text-sm font-bold text-gray-900">
                    Notificaciones
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400" : "bg-gray-300"}`}
                    />
                    {unseenCount > 0 && (
                      <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        {unseenCount} nuevas
                      </span>
                    )}
                  </div>
                </div>

                <ul className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                  {/* Pendientes */}
                  {totalPending > 0 && (
                    <li className="flex items-start gap-3 px-4 py-3 bg-amber-50/40">
                      <div className="mt-0.5 p-1.5 bg-white rounded-lg border border-gray-100 shadow-sm shrink-0">
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">
                          {totalPending} documento{totalPending > 1 ? "s" : ""}{" "}
                          pendiente{totalPending > 1 ? "s" : ""}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {totalPending === 1
                            ? pendingDocs[0]?.numeroCompleto
                            : `Más reciente: ${pendingDocs[0]?.numeroCompleto}`}
                        </p>
                      </div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 shrink-0" />
                    </li>
                  )}

                  {/* Último aceptado */}
                  {lastAccepted && (
                    <li className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer">
                      <div className="mt-0.5 p-1.5 bg-white rounded-lg border border-gray-100 shadow-sm shrink-0">
                        <Check className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">
                          Último aceptado
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {lastAccepted.numeroCompleto} —{" "}
                          {lastAccepted.destinatario}
                        </p>
                        {lastAccepted.importeTotal && (
                          <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                            {lastAccepted.tipoMoneda}{" "}
                            {parseFloat(lastAccepted.importeTotal).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </li>
                  )}

                  {/* Último rechazado */}
                  {lastRejected && (
                    <li className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer bg-red-50/30">
                      <div className="mt-0.5 p-1.5 bg-white rounded-lg border border-gray-100 shadow-sm shrink-0">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">
                          Último rechazado
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {lastRejected.numeroCompleto} —{" "}
                          {lastRejected.destinatario}
                        </p>
                        {lastRejected.mensajeRespuestaSunat && (
                          <p className="text-[10px] text-red-500 font-medium mt-1 truncate">
                            {lastRejected.mensajeRespuestaSunat}
                          </p>
                        )}
                      </div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 shrink-0" />
                    </li>
                  )}

                  {/* Certificado por vencer */}
                  {certInfo &&
                    (certInfo.isExpiringSoon || certInfo.isExpired) && (
                      <li
                        className={`flex items-start gap-3 px-4 py-3 ${certInfo.isExpired ? "bg-red-50/60" : "bg-amber-50/40"}`}
                      >
                        <div className="mt-0.5 p-1.5 bg-white rounded-lg border border-gray-100 shadow-sm shrink-0">
                          <AlertTriangle
                            className={`w-4 h-4 ${certInfo.isExpired ? "text-red-500" : "text-amber-500"}`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">
                            {certInfo.isExpired
                              ? "Certificado vencido"
                              : "Certificado por vencer"}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {certInfo.isExpired
                              ? `Venció hace ${Math.abs(certInfo.daysLeft)} días`
                              : `Vence en ${certInfo.daysLeft} días`}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {new Date(certInfo.expiryDate).toLocaleDateString(
                              "es-PE",
                            )}
                          </p>
                        </div>
                      </li>
                    )}

                  {/* Sin notificaciones */}
                  {totalPending === 0 &&
                    !lastAccepted &&
                    !lastRejected &&
                    !certInfo?.isExpiringSoon && (
                      <li className="px-4 py-6 text-center text-sm text-gray-400">
                        Sin actividad hoy
                      </li>
                    )}
                </ul>
              </div>
            )}
          </div>

          <div className="hidden lg:block h-5 w-px bg-[#D9E4F5]" />

          {/* Menú de usuario */}
          <div className="relative" ref={userRef}>
            <button
              onClick={() => {
                setUserOpen((v) => !v);
                setNotifOpen(false);
              }}
              className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-all group cursor-pointer ${
                isBeta ? "hover:bg-amber-100" : "hover:bg-[#EEF3FB]"
              }`}
            >
              {/* Avatar circular */}
              <div
                className={`w-9 h-9 rounded-full overflow-hidden border-2 shrink-0 transition-colors ${
                  isBeta
                    ? "border-amber-300 group-hover:border-amber-400"
                    : "border-[#D9E4F5] group-hover:border-brand-blue/30"
                }`}
              >
                <img
                  src={logoSrc}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Nombre + email */}
              <div className="hidden md:flex flex-col leading-none text-left">
           <p className="text-[12px] font-bold text-brand-blue leading-none tracking-wide capitalize">
  {user?.username}
</p>
                <p className="text-[10px] font-semibold text-slate-500  mt-0.5 uppercase tracking-widest">
                  {isSuperAdmin
                    ? "Super Admin"
                    : user?.rol === "admin"
                      ? "Administrador"
                      : user?.rol}
                </p>
              </div>

              {/* Chevron */}
              <ChevronRight
                className={`w-3.5 h-3.5 text-slate-600 transition-transform duration-200 shrink-0 ${
                  userOpen ? "rotate-90" : ""
                }`}
              />
            </button>

            {userOpen && (
              <div className="fixed sm:absolute inset-x-2 sm:inset-x-auto sm:right-0 top-[3.75rem] sm:top-auto sm:mt-2 sm:w-56 bg-white rounded-2xl shadow-xl overflow-hidden z-50 animate-fade-in">
                <div className="px-4 py-3 border-b border-brand-blue/20 bg-brand-blue">
                  <p className="text-sm font-bold text-gray-100">
                    {user?.username}
                  </p>
                  <p className="text-xs text-gray-200 mt-0.5">{user?.email}</p>
                  {!isSuperAdmin && user?.nombreSucursal && (
                    <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                      <MapPin className="w-2.5 h-2.5" />
                      {user.nombreSucursal}
                    </span>
                  )}
                  {isSuperAdmin && (
                    <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                      <Globe className="w-2.5 h-2.5" />
                      Acceso Global
                    </span>
                  )}
                  {isBeta && (
                    <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                      <FlaskConical className="w-2.5 h-2.5" />
                      Entorno Beta
                    </span>
                  )}
                </div>

                <ul className="">
                  <li>
                    <Link
                      href="/factufly/empresa"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors group"
                    >
                      <div className="p-1.5 bg-gray-100 rounded-lg group-hover:bg-blue-50 transition-colors">
                        <Settings className="w-3.5 h-3.5 text-gray-500 group-hover:text-blue-600 transition-colors" />
                      </div>
                      <span className="text-[12px]">Empresa</span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/factufly/sunat"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors group"
                    >
                      <div className="p-1.5 bg-gray-100 rounded-lg group-hover:bg-blue-50 transition-colors">
                        <Zap className="w-3.5 h-3.5 text-gray-500 group-hover:text-blue-600 transition-colors" />
                      </div>
                      <span className="text-[12px]">SUNAT</span>
                    </Link>
                  </li>
                </ul>

                <div className="border-t border-gray-100 ">
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors group"
                  >
                    <div className="p-1.5 bg-red-50 rounded-lg group-hover:bg-red-100 transition-colors">
                      <LogOut className="w-3.5 h-3.5 text-red-500" />
                    </div>
                    <span className="text-[12px]">Cerrar sesión</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Banner beta — pegado al topbar */}
      {isBeta && (
        <div className="bg-amber-400 border-t border-amber-300 px-6 py-1.5 flex items-center gap-3">
          <FlaskConical className="w-3.5 h-3.5 text-amber-900 shrink-0" />
          <span className="bg-amber-800 text-amber-100 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0">
            Beta
          </span>
          <p className="text-amber-900 text-xs font-medium">
            Estás en el entorno de pruebas —{" "}
            <strong className="font-bold">No emitas comprobantes reales a SUNAT.</strong>{" "}
            Los documentos generados aquí no tienen validez tributaria.
          </p>
        </div>
      )}
      </header>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.15s ease-out both;
        }
      `}</style>
    </>
  );
};

