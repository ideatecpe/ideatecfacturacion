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

  const activeView = (pathname.split("/")[2] as View) || "dashboard";

  // ── Auto-open/close sidebar según ancho de ventana (umbral: 1280px) ──────
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
      const url = typeof args[0] === "string" ? args[0] : (args[0] as any).url;
      const method = (args[1]?.method || "GET").toUpperCase();
      let bodyData = "";
      try {
        if (args[1]?.body && typeof args[1].body === "string") {
          bodyData = JSON.parse(args[1].body);
        } else if (args[1]?.body) {
          bodyData = "[Non-string body]";
        }
      } catch (e) {
        bodyData = args[1]?.body as any;
      }

      console.log(`🚀 [FETCH REQ] ${method} ${url}`, bodyData);

      try {
        const response = await originalFetch(...args);
        if (!response.ok) {
          // Usar warn (no error) para que Next.js no muestre el overlay en dev
          console.warn(`⚠️ [FETCH ${response.status}] ${method} ${url}`);
        } else {
          console.log(`✅ [FETCH RES] ${response.status} ${url}`);
        }
        return response;
      } catch (error) {
        console.warn(`❌ [FETCH FAIL] ${url}`, error);
        throw error;
      }
    };

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
      window.fetch = originalFetch;
    };
  }, [pathname]);

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
    { id: "productos", label: "Productos", icon: Package },
    { id: "reportes", label: "Reportes", icon: BarChart3 },
    { id: "sunat", label: "SUNAT", icon: Zap },
    { id: "empresa", label: "Empresa", icon: Settings },
    { id: "sucursales", label: "Sucursales", icon: Building2 },
    { id: "usuarios", label: "Usuarios", icon: UserCircle },
  ];

  const menuItems = todosLosMenuItems.filter((item) => {
    if (item.id === "trabajadores")      return config?.trabajadores ?? false;
    if (item.id === "guiasremision")     return config?.guiaRemision ?? false;
    if (item.id === "carga-comprobantes") return config?.cargaComprobantes ?? false;
    if (item.id === "deudasporcobrar")   return config?.deudasCobrar ?? false;
    if (item.id === "cuentasporcobrar")  return config?.isCredito ?? false;
    return true;
  });

  return (
    <ToastProvider>
      <div className="h-screen flex overflow-x-hidden" style={{ background: "#F5F8FD" }}>
        {/* Backdrop oscuro al abrir sidebar en pantallas < 1280px */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 xl:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        <Sidebar
          isOpen={isSidebarOpen}
          activeView={activeView}
          onViewChange={(view) => {
            router.push(`/factufly/${view}`);
            if (window.innerWidth < 1280) setIsSidebarOpen(false);
          }}
          menuItems={menuItems}
        />
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
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
