import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// ── Función para renovar el access token usando el refresh token ──
async function refreshAccessToken(token: any) {
  try {
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/Auth/refresh-token`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: token.refreshToken }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      // El refresh token es inválido o expiró — forzar re-login
      return { ...token, error: "RefreshAccessTokenError" };
    }

    return {
      ...token,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      // Guardar la fecha de expiración del nuevo token (en ms)
      accessTokenExpires: new Date(data.expiresAt).getTime(),
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "RUC o Email", type: "text" },
        password: { label: "Password", type: "password" },
        environment: { label: "Environment", type: "text" },
        rememberMe: { label: "Remember Me", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          throw new Error("Credenciales incompletas");
        }

        try {
          const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/Auth/login`;
          const payload = {
            identifier: credentials.identifier,
            password: credentials.password,
            environment: credentials.environment || "production",
            rememberMe: credentials.rememberMe === "true",
          };

          const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          const contentType = response.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            const textResponse = await response.text();
            console.error(
              "❌ Respuesta no es JSON:",
              textResponse.substring(0, 200),
            );
            throw new Error(
              `El servidor no respondió con JSON. Status: ${response.status}`,
            );
          }

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.message || "Credenciales inválidas");
          }

          return {
            id: data.user.usuarioID.toString(),
            email: data.user.email,
            username: data.user.username,
            rol: data.user.rol,
            ruc: data.user.ruc,
            sucursalID: data.user.sucursalID ?? null,
            nombreSucursal: data.user.nombreSucursal ?? null,
            nombreEmpresa: data.user.nombreEmpresa ?? null,
            environment: data.user.environment ?? null,
            igv: data.user.igv ?? 18,
            tipoEmision: data.user.tipoEmision ?? true,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            // Guardar cuándo expira el access token del backend
            accessTokenExpires: new Date(data.expiresAt).getTime(),
          };
        } catch (error: any) {
          console.error("❌ Error en authorize:", error);
          throw new Error(error.message || "Error al autenticar");
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Al hacer login, guardar datos del usuario + expiración
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.username = user.username;
        token.rol = user.rol;
        token.ruc = user.ruc;
        token.sucursalID = user.sucursalID;
        token.nombreSucursal = user.nombreSucursal;
        token.nombreEmpresa = user.nombreEmpresa;
        token.igv = user.igv;
        token.tipoEmision = user.tipoEmision;
        token.environment = user.environment;
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.accessTokenExpires = user.accessTokenExpires;
      }

      // Si el access token aún es válido, devolver tal cual
      // Se renueva 1 día antes de expirar para evitar cortes
      const ahora = Date.now();
      const expira = (token.accessTokenExpires as number) || 0;
      const unDiaEnMs = 24 * 60 * 60 * 1000;

      if (expira > 0 && ahora < expira - unDiaEnMs) {
        return token;
      }

      // El token está a punto de expirar o ya expiró — renovar con refresh token
      if (token.refreshToken) {
        return await refreshAccessToken(token);
      }

      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id as string,
        email: token.email as string,
        username: token.username as string,
        rol: token.rol as string,
        ruc: token.ruc as string,
        sucursalID: token.sucursalID as string | null,
        nombreSucursal: token.nombreSucursal as string | null,
        igv: token.igv as number,
        tipoEmision: token.tipoEmision as boolean,
        nombreEmpresa: token.nombreEmpresa as string | null,
        environment: token.environment as string | null
      };
      session.accessToken = token.accessToken as string;
      session.refreshToken = token.refreshToken as string;
      // Propagar error de refresh al cliente para que pueda forzar re-login
      if (token.error) {
        (session as any).error = token.error;
      }

      return session;
    },
  },
  pages: {
    signIn: "/",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 días: la sesión permanece activa al cerrar el navegador (estilo Facebook/Gmail)
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
