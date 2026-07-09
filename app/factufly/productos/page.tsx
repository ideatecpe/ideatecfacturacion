"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProductosPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/factufly/productos/lista");
  }, [router]);

  return null;
}
