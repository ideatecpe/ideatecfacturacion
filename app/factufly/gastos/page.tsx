"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// /factufly/gastos no tiene pantalla propia: lleva al listado.
export default function GastosPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/factufly/gastos/todos"); }, [router]);
  return null;
}
