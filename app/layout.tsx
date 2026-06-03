import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/app/globals.css";
import { SessionProvider } from "@/app/components/SessionProvider";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/app/components/ui/Toast";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased `}
      >
        <SessionProvider>
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
