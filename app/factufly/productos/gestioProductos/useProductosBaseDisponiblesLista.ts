import { useState, useEffect } from 'react'
import axios from 'axios'
import { ProductoBase } from './Producto'
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/app/components/ui/Toast';

export function useProductosBaseDisponiblesLista(sucursalId?: number) {
  
  const { showToast } = useToast();
  const { accessToken, user } = useAuth();
  const [productosBase, setProductosBase] = useState<ProductoBase[]>([])
  const [loadingBase, setLoadingBase] = useState(false)

  const idToUse = sucursalId ?? parseInt(user?.sucursalID ?? "0");

  const fetchProductosBase = async () => {
    if (!idToUse) return;
    setLoadingBase(true)
    try {
      const res = await axios.get<ProductoBase[]>(
        `${process.env.NEXT_PUBLIC_API_URL}/api/productos/disponibles/${idToUse}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
          params: { _: Date.now() },
        }
      )
      setProductosBase(res.data)
    } catch {
      showToast("Error al cargar productos disponibles", "error");
    } finally {
      setLoadingBase(false)
    }
  }

  useEffect(() => {
    if (accessToken) fetchProductosBase()
  }, [accessToken, idToUse])  // ✅ re-fetcha si cambia la sucursal

  return { productosBase, loadingBase, fetchProductosBase }
}