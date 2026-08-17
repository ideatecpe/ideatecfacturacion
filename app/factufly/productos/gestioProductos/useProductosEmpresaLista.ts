// gestioProductos/useProductosEmpresaLista.ts

import { useState, useEffect } from 'react'
import axios from 'axios'
import { ProductoSucursal } from './Producto'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/app/components/ui/Toast'
import { esFalloDeRed } from '@/lib/offline/senalRed';

export function useProductosEmpresaLista( enabled: boolean = true ) {
  const { showToast } = useToast()
  const { accessToken, user } = useAuth()
  const [productosEmpresa, setProductosEmpresa] = useState<ProductoSucursal[]>([])
  const [loadingEmpresa, setLoadingEmpresa] = useState(false)

  const fetchProductosEmpresa = async () => {
    setLoadingEmpresa(true)
    try {
      const res = await axios.get<ProductoSucursal[]>(
        `${process.env.NEXT_PUBLIC_API_URL}/api/productos/${user?.ruc}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
          params: { _: Date.now() },
        }
      )
      setProductosEmpresa(res.data)
    } catch (err) {
      if (!esFalloDeRed(err)) {
        showToast("Error al cargar productos de la empresa", "error")
      }
    } finally {
      setLoadingEmpresa(false)
    }
  }

  useEffect(() => {
    if (accessToken && user?.ruc && enabled) fetchProductosEmpresa()
  }, [accessToken, user?.ruc, enabled])

  return { productosEmpresa, loadingEmpresa, setProductosEmpresa, fetchProductosEmpresa }
}