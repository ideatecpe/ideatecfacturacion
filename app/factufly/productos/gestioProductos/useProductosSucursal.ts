import { useState, useEffect } from 'react'
import axios from 'axios'
import { ProductoSucursal } from './Producto'
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/app/components/ui/Toast';
import { cacheProductos, getProductosCache } from '@/lib/offline/offlineDb';

export function useProductosSucursal(sucursalIdOverride?: number | null, enabled: boolean = true) {
  const { showToast } = useToast();
  const { accessToken, user } = useAuth();
  const [productosSucursal, setProductosSucursal] = useState<ProductoSucursal[]>([])
  const [loadingSucursal, setLoadingSucursal] = useState(false)
  const [productosDesactualizados, setProductosDesactualizados] = useState(false)
  const [fechaCache, setFechaCache] = useState<string | null>(null)

  const fetchProductosSucursal = async (id?: number | null): Promise<ProductoSucursal[]> => {
    const sucursalId = id ?? sucursalIdOverride ?? user?.sucursalID;
    if (!sucursalId) return [];

    // ── Cache-first: mostrar productos al instante desde IndexedDB ──
    // Si aún no hay productos en memoria, cargar el cache local primero
    // para que la grilla aparezca de inmediato (stale-while-revalidate).
    let mostróCache = false;
    if (productosSucursal.length === 0) {
      try {
        const cache = await getProductosCache(Number(sucursalId));
        if (cache && cache.productos.length > 0) {
          setProductosSucursal(cache.productos);
          setProductosDesactualizados(true);
          setFechaCache(cache.updatedAt);
          mostróCache = true;
        }
      } catch { /* ignore */ }
    }

    // Solo mostrar loading si no hay nada que mostrar (ni cache ni estado previo)
    if (productosSucursal.length === 0 && !mostróCache) {
      setLoadingSucursal(true);
    }

    // ── Revalidar desde el API en segundo plano ──
    try {
      const res = await axios.get<ProductoSucursal[]>(
        `${process.env.NEXT_PUBLIC_API_URL}/api/productos/${sucursalId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      setProductosSucursal(res.data)
      setProductosDesactualizados(false)
      setFechaCache(null)
      cacheProductos(Number(sucursalId), res.data).catch(() => {})
      return res.data
    } catch {
      // Si ya mostramos cache, no es error: el usuario ya ve productos.
      if (!mostróCache && productosSucursal.length === 0) {
        // Sin conexión y sin cache previo: intentar IndexedDB como último recurso
        try {
          const cache = await getProductosCache(Number(sucursalId))
          if (cache) {
            setProductosSucursal(cache.productos)
            setProductosDesactualizados(true)
            setFechaCache(cache.updatedAt)
            return cache.productos
          }
        } catch { /* ignore */ }
        showToast("Error al cargar productos", "error");
      }
      return productosSucursal
    } finally {
      setLoadingSucursal(false)
    }
  }

  // Descuento local/optimista de stock para ventas encoladas sin conexión:
  // evita que, dentro de la misma sesión, se sobrevenda más allá de lo que
  // el dispositivo sabe. La reconciliación real ocurre en el backend al sincronizar.
  const descontarStockLocal = (items: { sucursalProductoId: number; cantidad: number }[]) => {
    setProductosSucursal((prev) => {
      const actualizado = prev.map((p) => {
        const item = items.find(
          (i) => i.sucursalProductoId === p.sucursalProducto.sucursalProductoId,
        );
        if (!item) return p;
        return {
          ...p,
          sucursalProducto: {
            ...p.sucursalProducto,
            stock: (p.sucursalProducto.stock ?? 0) - item.cantidad,
          },
        };
      });
      const sucursalId = sucursalIdOverride ?? user?.sucursalID;
      if (sucursalId) cacheProductos(Number(sucursalId), actualizado).catch(() => {});
      return actualizado;
    });
  };

  useEffect(() => {
    if (accessToken && enabled) fetchProductosSucursal()
  }, [accessToken, sucursalIdOverride, enabled])

  return {
    productosSucursal,
    loadingSucursal,
    setProductosSucursal,
    fetchProductosSucursal,
    descontarStockLocal,
    productosDesactualizados,
    fechaCache,
  }
}
