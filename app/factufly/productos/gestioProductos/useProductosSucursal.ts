import { useState, useEffect } from 'react'
import axios from 'axios'
import { ProductoSucursal } from './Producto'
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/app/components/ui/Toast';

export function useProductosSucursal(sucursalIdOverride?: number | null, enabled: boolean = true) {
  const { showToast } = useToast();
  const { accessToken, user } = useAuth();
  const [productosSucursal, setProductosSucursal] = useState<ProductoSucursal[]>([])
  const [loadingSucursal, setLoadingSucursal] = useState(false)

  const fetchProductosSucursal = async (id?: number | null): Promise<ProductoSucursal[]> => {
    const sucursalId = id ?? sucursalIdOverride ?? user?.sucursalID;
    if (!sucursalId) return [];
    setLoadingSucursal(true)
    try {
      const res = await axios.get<ProductoSucursal[]>(
        `${process.env.NEXT_PUBLIC_API_URL}/api/productos/${sucursalId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      setProductosSucursal(res.data)
      return res.data
    } catch {
      showToast("Error al cargar productos", "error");
      return []
    } finally {
      setLoadingSucursal(false)
    }
  }

  useEffect(() => {
    if (accessToken && enabled) fetchProductosSucursal()
  }, [accessToken, sucursalIdOverride, enabled])

  return { productosSucursal, loadingSucursal, setProductosSucursal, fetchProductosSucursal }
}
