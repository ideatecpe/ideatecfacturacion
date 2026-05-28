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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const activeView = (pathname.split("/")[2] as View) || "dashboard";

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
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as any).url;
      const method = (args[1]?.method || 'GET').toUpperCase();
      let bodyData = '';
      try {
        if (args[1]?.body && typeof args[1].body === 'string') {
          bodyData = JSON.parse(args[1].body);
        } else if (args[1]?.body) {
          bodyData = '[Non-string body]';
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


  const esUsuarioVelsat =
    user?.username?.toLowerCase() === "velsat" || user?.ruc === "10073587382";

  const todosLosMenuItems: MenuItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "operaciones", label: "Emisión", icon: Grip },
    { id: "comprobantes", label: "Comprobantes", icon: FileText },
    { id: "carga-comprobantes", label: "Carga Comprobantes", icon: FileSpreadsheet },
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

  const RUCS_GUIAS_REMISION = ["20512134832"];

  const menuItems = todosLosMenuItems.filter((item) => {
    if (item.id === "trabajadores") return user?.ruc === "10073587382";
    if (item.id === "carga-comprobantes") return esUsuarioVelsat;
    return true;
  });

  return (
    <ToastProvider>
      <div className="h-screen flex bg-brand-light overflow-x-hidden">
        <Sidebar
          isOpen={isSidebarOpen}
          activeView={activeView}
          onViewChange={(view) => router.push(`/factufly/${view}`)}
          menuItems={menuItems}
        />
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Topbar
            isSidebarOpen={isSidebarOpen}
            toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            activeView={activeView}
          />
          <main className="flex-1 px-6 overflow-y-auto overflow-x-hidden custom-scrollbar py-2">
            <div className="mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}