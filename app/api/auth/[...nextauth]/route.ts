import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// TODO: Activar cuando el backend implemente refresh token
// async function refreshAccessToken(token: any) { ... }

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

          console.log("🔐 [NEXTAUTH BACKEND LOGIN API CALL]:", {
            method: "POST",
            url: apiUrl,
            payload: payload,
          });

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
      // Al hacer login, guardar datos del usuario
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
