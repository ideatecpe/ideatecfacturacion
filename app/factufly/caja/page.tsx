"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CajaPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/factufly/caja/corte");
  }, [router]);

  return null;
}
