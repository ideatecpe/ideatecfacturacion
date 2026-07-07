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
} from "lucide-react";
import { Sidebar } from "../components/layout/Sidebar";
import { Topbar } from "../components/layout/Topbar";
import { ToastProvider } from "../components/ui/Toast";
import { MenuItem, View } from "../types";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import { useConfiguracion } from "@/hooks/useConfiguracion";

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

    const requestInterceptor = axios.interceptors.request.use((config) => {
      return config;
    });

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => Promise.reject(error),
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
      } catch (error) {
        const url = typeof args[0] === "string" ? args[0] : (args[0] as any).url;
        console.warn(`[FETCH FAIL] ${url}`);
        throw error;
      }
    };

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
      window.fetch = originalFetch;
    };
  }, [pathname]);

  const menuItems = React.useMemo<MenuItem[]>(() => {
    const todosLosMenuItems: MenuItem[] = [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "operaciones", label: "Emisión", icon: Grip },
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
        children: [
          { id: "lista", label: "Listado" },
          ...(config?.isStock
            ? [
                { id: "kardex", label: "Kardex" },
                { id: "stockValorizado", label: "Stock Valorizado" },
                { id: "rentabilidad", label: "Rentabilidad" },
              ]
            : []),
        ],
      },
      {
        id: "compras",
        label: "Compras",
        icon: Boxes,
        children: [
          { id: "proveedores", label: "Proveedores" },
          { id: "ordenes", label: "Órdenes" },
        ],
      },
      { id: "reportes", label: "Reportes", icon: BarChart3 },
      { id: "sunat", label: "SUNAT", icon: Zap },
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
      return true;
    });
  }, [config]);

  return (
    <ToastProvider>
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
          <Sidebar
            isOpen={isSidebarOpen}
            activeView={activeView}
            activeSubView={activeSubView}
            onViewChange={(path) => {
              router.push(`/factufly/${path}`);
              if (window.innerWidth < 1280) setIsSidebarOpen(false);
            }}
            menuItems={menuItems}
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
          />
          <main className="flex-1 p-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
            <div className="mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
