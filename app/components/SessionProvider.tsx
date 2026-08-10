'use client';

import { Session } from 'next-auth';
import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

export function SessionProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return (
    // La sesión ya llega resuelta desde el servidor (cookie JWT firmada, sin
    // depender de red). Sin refetchOnWindowFocus, NextAuth intentaba
    // revalidarla contra /api/auth/session cada vez que la pestaña recuperaba
    // el foco — si en ese momento no había conexión, la sesión quedaba
    // momentáneamente en null y toda la pantalla se vaciaba hasta recargar.
    <NextAuthSessionProvider
      session={session}
      refetchOnWindowFocus={false}
    >
      {children}
    </NextAuthSessionProvider>
  );
}