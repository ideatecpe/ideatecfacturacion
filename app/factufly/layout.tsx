"use client";
import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  BarChart3,
  Zap,
  Settings,
  UserCircle,
  Building2,
  Grip,
  Truck,
  DollarSign,
  Wallet,
  FileSpreadsheet,
  Boxes,
  BookOpenCheck,
} from "lucide-react";
import { Sidebar } from "../components/layout/Sidebar";
import { Topbar } from "../components/layout/Topbar";
import { ToastProvider, useToast } from "../components/ui/Toast";
import { OfflineSalesProvider, useOfflineSales } from "../components/offline/OfflineSalesProvider";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { MenuItem, View } from "../types";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import { useConfiguracion } from "@/hooks/useConfiguracion";

// Única sección preparada para funcionar sin conexión: mientras no haya
// internet, la navegación a cualquier otra pantalla se bloquea (en vez de
// dejar que el usuario entre y se encuentre con una pantalla rota) — en la
// PWA instalada no hay barra de direcciones ni botón "atrás" para salir de ahí.
const RUTA_SEGURA_OFFLINE = "operaciones/boleta-facturaelectronica";

function OfflineGuard({ children }: { children: React.ReactNode }) {
  const { isOnline } = useOfflineSales();
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();

  React.useEffect(() => {
    if (!isOnline) {
      const rutaRelativa = pathname.replace(/^\/factufly\/?/, "").replace(/\/$/, "");
      if (rutaRelativa !== RUTA_SEGURA_OFFLINE) {
        showToast(
          "Sin conexión: solo Nueva Venta está disponible sin internet.",
          "error",
        );
        router.replace(`/factufly/${RUTA_SEGURA_OFFLINE}`);
      }
    }
  }, [isOnline, pathname, router, showToast]);

  return <>{children}</>;
}

function SidebarConGuardaOffline({
  isOpen,
  activeView,
  activeSubView,
  menuItems,
  router,
  setIsSidebarOpen,
}: {
  isOpen: boolean;
  activeView: View;
  activeSubView: string;
  menuItems: MenuItem[];
  router: ReturnType<typeof useRouter>;
  setIsSidebarOpen: (v: boolean) => void;
}) {
  const { isOnline } = useOfflineSales();
  const { showToast } = useToast();

  return (
    <Sidebar
      isOpen={isOpen}
      activeView={activeView}
      activeSubView={activeSubView}
      isOnline={isOnline}
      onViewChange={(path) => {
        if (!isOnline && path !== RUTA_SEGURA_OFFLINE) {
          showToast(
            "Sin conexión: solo Nueva Venta está disponible sin internet.",
            "error",
          );
          return;
        }
        router.push(`/factufly/${path}`);
        if (window.innerWidth < 1280) setIsSidebarOpen(false);
      }}
      menuItems={menuItems}
    />
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const { config } = useConfiguracion();
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  // Cuando la animación de entrada termina, quitamos el transform del wrapper.
  // Un transform (incluso translateX(0)) convierte al div en el bloque
  // contenedor de los hijos position:fixed (el Sidebar), lo que rompe su
  // posicionamiento respecto a la ventana en móvil.
  const [settled, setSettled] = useState(false);

  const activeView = (pathname.split("/")[2] as View) || "dashboard";
  const activeSubView = pathname.split("/")[3] || "";

  // ── Auto-open/close sidebar según ancho de ventana (umbral: 1280px) ──────
  // Animación de entrada
  React.useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
  }, []);

  React.useEffect(() => {
    if (!entered) return;
    const t = setTimeout(() => setSettled(true), 1100);
    return () => clearTimeout(t);
  }, [entered]);

  React.useEffect(() => {
    const BREAKPOINT = 1280;
    // Estado inicial correcto en el cliente
    setIsSidebarOpen(window.innerWidth >= BREAKPOINT);

    let eraGrande = window.innerWidth >= BREAKPOINT;
    const handleResize = () => {
      const esGrande = window.innerWidth >= BREAKPOINT;
      if (esGrande !== eraGrande) {      // solo actúa al cruzar el umbral
        setIsSidebarOpen(esGrande);
        eraGrande = esGrande;
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  React.useEffect(() => {
    if (pathname === "/factufly" || pathname === "/factufly/") {
      router.push("/factufly/dashboard");
    }

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const cancelado = error.code === "ERR_CANCELED" || axios.isCancel?.(error);
        if (
          !cancelado &&
          (!error.response || error.code === "ERR_NETWORK" || error.code === "ECONNABORTED" || (typeof navigator !== "undefined" && !navigator.onLine))
        ) {
          // No se asume "sin conexión" con un solo fallo (puede ser un 401, CORS,
          // timeout del backend o una API de terceros caída): se verifica antes.
          window.dispatchEvent(new Event("app:posible-sin-conexion"));
        }
        return Promise.reject(error);
      },
    );

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        // Solo registra fallos (sin body ni objetos pesados) para no saturar
        // la consola ni retener memoria durante sesiones largas.
        if (!response.ok) {
          const url = typeof args[0] === "string" ? args[0] : (args[0] as any).url;
          const method = (args[1]?.method || "GET").toUpperCase();
          console.warn(`[FETCH ${response.status}] ${method} ${url}`);
        }
        return response;
      } catch (error: any) {
        const url = typeof args[0] === "string" ? args[0] : (args[0] as any).url;
        console.warn(`[FETCH FAIL] ${url}`);
        if (error?.name !== "AbortError") {
          window.dispatchEvent(new Event("app:posible-sin-conexion"));
        }
        throw error;
      }
    };

    return () => {
      axios.interceptors.response.eject(responseInterceptor);
      window.fetch = originalFetch;
    };
  }, [pathname]);

  const menuItems = React.useMemo<MenuItem[]>(() => {
    const todosLosMenuItems: MenuItem[] = [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      {
        id: "operaciones",
        label: "Emisión",
        icon: Grip,
        children: [
          { id: "boleta-facturaelectronica", label: "Nueva Venta" },
          { id: "nota-credito", label: "Nota de Crédito" },
          { id: "nota-debito", label: "Nota de Débito" },
          { id: "guia-remision", label: "Guía de Remisión" },
        ],
      },
      { id: "comprobantes", label: "Comprobantes", icon: FileText },
      {
        id: "carga-comprobantes",
        label: "Carga Comprobantes",
        icon: FileSpreadsheet,
      },
      { id: "guiasremision", label: "Guias de Remisión", icon: Truck },
      { id: "deudasporcobrar", label: "Deudas por Cobrar", icon: Wallet },
      { id: "cuentasporcobrar", label: "Cuentas por Cobrar", icon: DollarSign },
      { id: "clientes", label: "Clientes", icon: Users },
      { id: "trabajadores", label: "Trabajadores", icon: UserCircle },
      {
        id: "productos",
        label: "Productos",
        icon: Package,
        // Con isStock activo se muestran las subopciones; sin él, "Productos"
        // es un ítem directo que navega al listado (sin submenú de un solo item).
        ...(config?.isStock
          ? {
              children: [
                { id: "lista", label: "Listado" },
                { id: "kardex", label: "Kardex" },
                { id: "stockValorizado", label: "Stock Valorizado" },
                { id: "rentabilidad", label: "Rentabilidad" },
                { id: "vencidos", label: "Productos Vencidos" },
              ],
            }
          : {}),
      },
      {
        id: "compras",
        label: "Compras",
        icon: Boxes,
        children: [
          { id: "proveedores", label: "Proveedores" },
          { id: "ingresos-stock", label: "Ingresos de Stock" },
        ],
      },
      { id: "reportes", label: "Reportes", icon: BarChart3 },
      { id: "sunat", label: "SUNAT", icon: Zap },
      { id: "sire", label: "SIRE", icon: BookOpenCheck },
      { id: "empresa", label: "Empresa", icon: Settings },
      { id: "sucursales", label: "Sucursales", icon: Building2 },
      { id: "usuarios", label: "Usuarios", icon: UserCircle },
    ];

    return todosLosMenuItems.filter((item) => {
      if (item.id === "trabajadores")      return config?.trabajadores ?? false;
      if (item.id === "guiasremision")     return config?.guiaRemision ?? false;
      if (item.id === "carga-comprobantes") return config?.cargaComprobantes ?? false;
      if (item.id === "deudasporcobrar")   return config?.deudasCobrar ?? false;
      if (item.id === "cuentasporcobrar")  return config?.isCredito ?? false;
      if (item.id === "compras")           return config?.isStock ?? false;
      if (item.id === "sire")              return config?.usaSire ?? false;
      return true;
    });
  }, [config]);

  const activeSubViewLabel = React.useMemo(() => {
    const parent = menuItems.find((m) => m.id === activeView);
    return parent?.children?.find((c) => c.id === activeSubView)?.label;
  }, [menuItems, activeView, activeSubView]);

  return (
    <ToastProvider>
      <OfflineSalesProvider>
        <OfflineGuard>
          <div className="h-screen flex overflow-hidden" style={{ background: "#F5F8FD" }}>
            {/* Backdrop oscuro al abrir sidebar en pantallas < 1280px */}
            {isSidebarOpen && (
              <div
                className="fixed inset-0 z-40 bg-black/40 xl:hidden"
                onClick={() => setIsSidebarOpen(false)}
              />
            )}
            {/* Sidebar — entra desde la izquierda */}
            <div
              style={{
                transform: settled
                  ? "none"
                  : entered
                    ? "translateX(0)"
                    : "translateX(-110%)",
                opacity: entered ? 1 : 0,
                transition: entered ? "transform 1s cubic-bezier(0.22, 1, 0.36, 1), opacity 1s ease" : "none",
                zIndex: 50,
                position: "relative",
              }}
            >
              <SidebarConGuardaOffline
                isOpen={isSidebarOpen}
                activeView={activeView}
                activeSubView={activeSubView}
                menuItems={menuItems}
                router={router}
                setIsSidebarOpen={setIsSidebarOpen}
              />
            </div>
            {/* Contenido — entra desde la derecha */}
            <div
              className="flex-1 flex flex-col min-w-0 h-full overflow-hidden"
              style={{
                transform: settled
                  ? "none"
                  : entered
                    ? "translateX(0)"
                    : "translateX(110%)",
                opacity: entered ? 1 : 0,
                transition: entered ? "transform 1s cubic-bezier(0.22, 1, 0.36, 1), opacity 1s ease" : "none",
              }}
            >
              <Topbar
                isSidebarOpen={isSidebarOpen}
                toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                activeView={activeView}
                activeSubViewLabel={activeSubViewLabel}
              />
              <main className="flex-1 p-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
                <div className="mx-auto">
                  <ErrorBoundary key={pathname}>{children}</ErrorBoundary>
                </div>
              </main>
            </div>
          </div>
        </OfflineGuard>
      </OfflineSalesProvider>
    </ToastProvider>
  );
}
