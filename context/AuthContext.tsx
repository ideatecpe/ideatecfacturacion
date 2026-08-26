"use client";
import {
  createContext,
  useContext,
  ReactNode,
  useMemo,
  useCallback,
  useState,
  useEffect,
} from "react";
import { useSession, signOut } from "next-auth/react";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  rol: string;
  ruc: string;
  sucursalID: string | null;
  nombreSucursal: string | null;
  nombreEmpresa: string | null;
  environment: string | null;
  logoBase64: string | null;
  logoPdfBase64: string | null;
  igv: number;
  tipoEmision: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => void;
  setEnvironment: (env: string) => void;
  refreshLogo: (newLogo?: string | null, newLogoPdf?: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { data: session, status } = useSession();
  const [igvOverride, setIgvOverride] = useState<number | null>(null);
  const [environmentOverride, setEnvironmentOverride] = useState<string | null>(
    null,
  );
  const [logoOverride, setLogoOverride] = useState<string | null>(null);
  const [logoPdfOverride, setLogoPdfOverride] = useState<string | null>(null);
  const [tipoEmisionOverride, setTipoEmisionOverride] = useState<boolean | null>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("AuthContext_tipoEmision");
      if (stored !== null) return stored === "true";
    }
    return null;
  });

  // ── ⚡ Carga INMEDIATA desde Caché Local (0ms para 3G y Offline) ──────────
  useEffect(() => {
    const ruc = session?.user?.ruc;
    if (!ruc || typeof window === "undefined") return;
    try {
      const cachedLogo = localStorage.getItem(`logo_cache_${ruc}`);
      const cachedLogoPdf = localStorage.getItem(`logo_pdf_cache_${ruc}`);
      if (cachedLogo) {
        setLogoOverride(cachedLogo);
      }
      if (cachedLogoPdf) {
        setLogoPdfOverride(cachedLogoPdf);
      }
    } catch (e) {
      // Ignorar errores de lectura de localStorage
    }
  }, [session?.user?.ruc]);

  const fetchCompanyData = useCallback(
    async (ruc: string, token: string | null) => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
        const companyUrl = `${apiUrl}/api/companies/${ruc}?t=${Date.now()}`;

        // Añadimos timestamp para evitar caché del navegador entre ambientes
        const r = await fetch(companyUrl, {
          headers: { 
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
            "Pragma": "no-cache"
          },
          cache: "no-store"
        });

        if (r.ok) {
          let data = await r.json();
          if (Array.isArray(data)) data = data[0];
          if (data) {
            if (data.igv) setIgvOverride(data.igv);
            if (data.environment) {
              setEnvironmentOverride(data.environment === "production" ? "production" : "beta");
            }
            if (data.tipoEmision !== undefined) {
              setTipoEmisionOverride(data.tipoEmision);
              try { localStorage.setItem("AuthContext_tipoEmision", String(data.tipoEmision)); } catch {}
            }
          }
        }

        // ── 🖼️ Fetch Logo Avatar (Topbar) ──
        try {
          const logoUrl = `${apiUrl}/api/companies/logo?ruc=${ruc}&t=${Date.now()}`;
          const logoRes = await fetch(logoUrl, {
            headers: { 
              Authorization: `Bearer ${token}`,
              "Cache-Control": "no-cache",
              "Pragma": "no-cache"
            },
            cache: "no-store"
          });
          if (logoRes.ok) {
            const logoData = await logoRes.json();
            if (logoData.success && logoData.logoBase64) {
              setLogoOverride(logoData.logoBase64);
              try {
                localStorage.setItem(`logo_cache_${ruc}`, logoData.logoBase64);
              } catch {}
            } else {
              setLogoOverride(null);
              try {
                localStorage.removeItem(`logo_cache_${ruc}`);
              } catch {}
            }
          }
        } catch (logoErr) {
          // Si hay fallo de red (ej. 3G lento o sin conexión), se mantiene la versión en caché sin borrarla
        }

        // ── 📄 Fetch Logo PDF ──
        try {
          const logoPdfUrl = `${apiUrl}/api/companies/logo?ruc=${ruc}&tipo=pdf&t=${Date.now()}`;
          const logoPdfRes = await fetch(logoPdfUrl, {
            headers: { 
              Authorization: `Bearer ${token}`,
              "Cache-Control": "no-cache",
              "Pragma": "no-cache"
            },
            cache: "no-store"
          });
          if (logoPdfRes.ok) {
            const logoPdfData = await logoPdfRes.json();
            if (logoPdfData.success && logoPdfData.logoBase64) {
              setLogoPdfOverride(logoPdfData.logoBase64);
              try {
                localStorage.setItem(`logo_pdf_cache_${ruc}`, logoPdfData.logoBase64);
              } catch {}
            } else {
              setLogoPdfOverride(null);
              try {
                localStorage.removeItem(`logo_pdf_cache_${ruc}`);
              } catch {}
            }
          }
        } catch (logoPdfErr) {
          // Mantener caché local de PDF si falla la red
        }
      } catch (error) {
        console.error("Error fetching company data:", error);
      }
    },
    [],
  );

  useEffect(() => {
    const ruc = session?.user?.ruc;
    const token = session?.accessToken ?? null;
    if (!ruc || status !== "authenticated") return;
    fetchCompanyData(ruc, token);
  }, [session?.user?.ruc, session?.accessToken, status, fetchCompanyData]);

  const refreshLogo = useCallback(
    async (newLogo?: string | null, newLogoPdf?: string | null) => {
      const ruc = session?.user?.ruc;
      const token = session?.accessToken ?? null;
      if (!ruc) return;

      // Actualización instantánea inmediata en estado y caché (0ms)
      if (newLogo !== undefined) {
        setLogoOverride(newLogo);
        try {
          if (newLogo) localStorage.setItem(`logo_cache_${ruc}`, newLogo);
          else localStorage.removeItem(`logo_cache_${ruc}`);
        } catch {}
      }

      if (newLogoPdf !== undefined) {
        setLogoPdfOverride(newLogoPdf);
        try {
          if (newLogoPdf) localStorage.setItem(`logo_pdf_cache_${ruc}`, newLogoPdf);
          else localStorage.removeItem(`logo_pdf_cache_${ruc}`);
        } catch {}
      }

      await fetchCompanyData(ruc, token);
    },
    [session?.user?.ruc, session?.accessToken, fetchCompanyData]
  );

  const user: AuthUser | null = useMemo(() => {
    if (!session?.user) return null;
    return {
      id: session.user.id ?? "",
      username: session.user.username ?? "",
      email: session.user.email ?? "",
      rol: session.user.rol ?? "",
      ruc: session.user.ruc ?? "",
      sucursalID: session.user.sucursalID ?? null,
      nombreSucursal: session.user.nombreSucursal ?? null,
      nombreEmpresa: session.user.nombreEmpresa ?? null,
      environment: environmentOverride ?? session.user.environment ?? null,
      logoBase64: logoOverride,
      logoPdfBase64: logoPdfOverride,
      igv: igvOverride ?? session.user.igv ?? 18,
      tipoEmision: tipoEmisionOverride ?? session.user.tipoEmision ?? true,
    };
  }, [
    session?.user?.id,
    session?.user?.username,
    session?.user?.email,
    session?.user?.rol,
    session?.user?.ruc,
    session?.user?.sucursalID,
    session?.user?.environment,
    environmentOverride,
    logoOverride,
    logoPdfOverride,
    igvOverride,
    tipoEmisionOverride,
  ]);

  const logout = useCallback(async () => {
    // 1. Limpiar estados locales
    setEnvironmentOverride(null);
    setIgvOverride(null);
    setLogoOverride(null);
    setLogoPdfOverride(null);
    setTipoEmisionOverride(null);

    // 2. Limpiar localStorage relacionado con Auth
    if (typeof window !== "undefined") {
      localStorage.removeItem("AuthContext_tipoEmision");
    }

    // 3. Cerrar sesión en NextAuth
    await signOut({ callbackUrl: "/" });
  }, []);

  // Efecto para limpiar si la sesión expira o se cierra externamente
  useEffect(() => {
    if (status === "unauthenticated") {
      setEnvironmentOverride(null);
      setIgvOverride(null);
      setLogoOverride(null);
      setLogoPdfOverride(null);
      setTipoEmisionOverride(null);
    }
  }, [status]);

  const setEnvironment = useCallback((env: string) => {
    setEnvironmentOverride(env);
  }, []);

  const value = useMemo(
    () => ({
      user,
      accessToken: session?.accessToken ?? null,
      refreshToken: session?.refreshToken ?? null,
      isAuthenticated: status === "authenticated",
      isLoading: status === "loading",
      logout,
      setEnvironment,
      refreshLogo,
    }),
    [
      user,
      session?.accessToken,
      session?.refreshToken,
      status,
      logout,
      setEnvironment,
      refreshLogo,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
