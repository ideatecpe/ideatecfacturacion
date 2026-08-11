import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const { pathname } = req.nextUrl;

  // Rutas públicas que no deben ser filtradas por la redirección
  if (
    pathname.startsWith("/docs") ||
    pathname.startsWith("/api/auth") ||
    pathname.includes("_next") ||
    pathname.includes("favicon")
  ) {
    return NextResponse.next();
  }

  // 1. Si el usuario ya tiene sesión activa e ingresa a la raíz / (el login), redirigir inmediatamente a dashboard
  if (token && pathname === "/") {
    return NextResponse.redirect(new URL("/factufly/dashboard", req.url));
  }

  // 2. Si intenta ingresar a las rutas de la app /factufly y NO está autenticado, redirigir al login (/)
  if (!token && pathname.startsWith("/factufly")) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/factufly/:path*", "/docs/:path*", "/"],
};
