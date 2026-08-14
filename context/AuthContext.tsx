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
  refreshLogo: () => Promise<void>;
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

  const fetchCompanyData = useCallback(
    async (ruc: string, token: string | null) => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
        // Añadimos timestamp para evitar caché del navegador entre ambientes
        const r = await fetch(`${apiUrl}/api/companies/${ruc}?t=${Date.now()}`, {
          headers: { 
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
            "Pragma": "no-cache"
          },
          cache: "no-store"
        });

        if (!r.ok) return;

        let data = await r.json();
        // Si el backend devuelve un array, tomamos el primer elemento
        if (Array.isArray(data)) {
          data = data[0];
        }

        if (!data) return;

        if (data.igv) setIgvOverride(data.igv);
        if (data.environment) {
          setEnvironmentOverride(data.environment === "production" ? "production" : "beta");
        }
        if (data.tipoEmision !== undefined) {
          setTipoEmisionOverride(data.tipoEmision);
          localStorage.setItem("AuthContext_tipoEmision", String(data.tipoEmision));
        }

        try {
          const logoRes = await fetch(`${apiUrl}/api/companies/logo?ruc=${ruc}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (logoRes.ok) {
            const logoData = await logoRes.json();
            if (logoData.success && logoData.logoBase64) {
              setLogoOverride(logoData.logoBase64);
            } else {
              setLogoOverride(null);
            }
          } else {
            setLogoOverride(null);
          }
        } catch (logoErr) {
          setLogoOverride(null);
        }

        try {
          const logoPdfRes = await fetch(`${apiUrl}/api/companies/logo?ruc=${ruc}&tipo=pdf`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (logoPdfRes.ok) {
            const logoPdfData = await logoPdfRes.json();
            if (logoPdfData.success && logoPdfData.logoBase64) {
              setLogoPdfOverride(logoPdfData.logoBase64);
            } else {
              setLogoPdfOverride(null);
            }
          } else {
            setLogoPdfOverride(null);
          }
        } catch (logoPdfErr) {
          setLogoPdfOverride(null);
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

  const refreshLogo = useCallback(async () => {
    const ruc = session?.user?.ruc;
    const token = session?.accessToken ?? null;
    if (!ruc) return;
    await fetchCompanyData(ruc, token);
  }, [session?.user?.ruc, session?.accessToken, fetchCompanyData]);

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
