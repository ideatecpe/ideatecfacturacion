import { useState, useEffect } from 'react'
import axios from 'axios'
import { ProductoBase } from './Producto'
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/app/components/ui/Toast';

export function useSearchProductosBaseDisponiblesLista(sucursalId?: number, palabra: string = "") {
  const { showToast } = useToast();
  const { accessToken, user } = useAuth();
  const [productosBase, setProductosBase] = useState<ProductoBase[]>([])
  const [loadingBase, setLoadingBase] = useState(false)

  const idToUse = sucursalId ?? parseInt(user?.sucursalID ?? "0");

  useEffect(() => {
    if (!accessToken || !idToUse) return;

    if (!palabra.trim()) {
      setProductosBase([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingBase(true)
      try {
        const res = await axios.get<ProductoBase[]>(
          `${process.env.NEXT_PUBLIC_API_URL}/api/productos/base/disponibles/buscar`,
          {
            params: { sucursalId: idToUse, palabra, _: Date.now() },
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
            },
          }
        )
        setProductosBase(res.data)
      }  catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          setProductosBase([]); // ✅
        } else {
          showToast("Error al buscar productos disponibles", "error");
        } 
      }finally {
        setLoadingBase(false)
      }
    }, 400); // debounce 400ms

    return () => clearTimeout(timer);
  }, [accessToken, idToUse, palabra])

  return { productosBase, loadingBase }
}