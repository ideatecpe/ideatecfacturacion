import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/app/globals.css";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { SessionProvider } from "@/app/components/SessionProvider";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/app/components/ui/Toast";
import { PwaRegister } from "@/app/components/PwaRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://factufly.pe'),
  title: {
    default: 'FactuFly | Sistema de Facturación Electrónica SUNAT',
    template: '%s | FactuFly',
  },
  description: 'Sistema de facturación electrónica para empresas peruanas. Autorizado por SUNAT, emite facturas, boletas y notas de crédito de forma rápida y segura.',
  keywords: ['Facturación electrónica', 'SUNAT', 'Perú', 'Sistema de facturación', 'Facturas electrónicas Perú', 'FactuFly', 'Software facturación'],
  authors: [{ name: 'Ideatec' }],
  creator: 'Ideatec',
  publisher: 'Ideatec',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: 'FactuFly | Facturación Electrónica SUNAT',
    description: 'Emite comprobantes electrónicos 100% validos por SUNAT rápidamente con FactuFly.',
    url: 'https://factufly.pe',
    siteName: 'FactuFly',
    locale: 'es_PE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FactuFly | Sistema de Facturación Electrónica',
    description: 'Emite facturas y boletas rápidamente. Totalmente compatible con SUNAT.',
  },
  verification: {
    google: 'añadir-tu-codigo-verificacion-aqui',
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FactuFly',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f2e64',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Se resuelve la sesión en el servidor (solo lee/verifica la cookie JWT
  // firmada, sin llamar a ningún servicio externo) y se le pasa lista al
  // cliente. Así, si la app se recarga sin internet, useSession() ya arranca
  // "authenticated" en vez de necesitar un fetch en vivo a /api/auth/session
  // que fallaría sin conexión.
  const session = await getServerSession(authOptions);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'FactuFly',
    image: 'https://factufly.pe/logofnsb.png',
    description: 'Sistema de facturación electrónica para empresas en Perú, autorizado por SUNAT.',
    url: 'https://factufly.pe',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'PE'
    },
    areaServed: {
      '@type': 'Country',
      name: 'Peru'
    }
  };

  return (
    <html lang="es">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Preconectar al CDN de imágenes de productos (Cloudflare Images):
            en 3G el handshake TLS puede tomar 200-400ms por conexión; hacerlo
            por adelantado ahorra ese tiempo en la primera imagen que se cargue. */}
        <link rel="preconnect" href="https://imagedelivery.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://imagedelivery.net" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased `}
      >
        <PwaRegister />
        <SessionProvider session={session}>
          <AuthProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </AuthProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
