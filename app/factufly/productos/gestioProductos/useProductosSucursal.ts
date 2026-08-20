import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { ProductoSucursal } from './Producto'
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/app/components/ui/Toast';
import { cacheProductos, getProductosCache } from '@/lib/offline/offlineDb';
import { esFalloDeRed } from '@/lib/offline/senalRed';

export function useProductosSucursal(sucursalIdOverride?: number | null, enabled: boolean = true) {
  const { showToast } = useToast();
  const { accessToken, user } = useAuth();
  const [productosSucursal, setProductosSucursal] = useState<ProductoSucursal[]>([])
  const [loadingSucursal, setLoadingSucursal] = useState(false)
  const [productosDesactualizados, setProductosDesactualizados] = useState(false)
  const [fechaCache, setFechaCache] = useState<string | null>(null)

  // ── Estrategia Stale-While-Revalidate (Offline-First / Instant Load) ──
  // Al abrir la caja, se cargan de inmediato los productos desde IndexedDB (en ~10ms),
  // permitiendo que el cajero vea y venda al instante. En paralelo, la API consulta
  // al servidor en segundo plano para actualizar el stock real y guardar los cambios.
  const secuenciaRef = useRef(0)          // nº de la petición en curso
  const secuenciaAplicadaRef = useRef(0)  // nº de la última respuesta del servidor aplicada
  const hayDatosServidorRef = useRef(false)
  const hayProductosRef = useRef(false)

  // Vuelca el cache local a pantalla de forma inmediata
  const aplicarCache = async (sucursalId: number): Promise<ProductoSucursal[] | null> => {
    try {
      const cache = await getProductosCache(sucursalId);
      if (
        cache &&
        cache.productos.length > 0 &&
        !hayDatosServidorRef.current &&
        !hayProductosRef.current
      ) {
        hayProductosRef.current = true;
        setProductosSucursal(cache.productos);
        setFechaCache(cache.updatedAt);
        return cache.productos;
      }
    } catch { /* ignore */ }
    return null;
  }

  const fetchProductosSucursal = async (id?: number | null): Promise<ProductoSucursal[]> => {
    const sucursalId = id ?? sucursalIdOverride ?? user?.sucursalID;
    if (!sucursalId) return [];

    const secuencia = ++secuenciaRef.current;

    // ⚡ PASO 1: Carga local inmediata desde IndexedDB
    // Si la pantalla aún no tiene productos y no han llegado datos del servidor,
    // cargamos de inmediato desde IndexedDB (toma ~10ms) para que la pantalla abra al instante.
    if (!hayProductosRef.current && !hayDatosServidorRef.current) {
      await aplicarCache(Number(sucursalId));
    }

    // Solo mostrar skeleton/loading si el disco local está totalmente vacío (primera vez)
    if (!hayProductosRef.current) {
      setLoadingSucursal(true);
    }

    // 🌐 PASO 2: Petición en segundo plano al servidor (Background Sync)
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/productos/${sucursalId}`;
      console.log("URL productos:", url);
      const res = await axios.get<ProductoSucursal[]>(
        url,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
          params: { _: Date.now() },
        }
      )
      // Solo se aplica la respuesta más reciente
      if (secuencia >= secuenciaAplicadaRef.current) {
        secuenciaAplicadaRef.current = secuencia;
        hayDatosServidorRef.current = true;
        hayProductosRef.current = true;
        setProductosSucursal(res.data)
        setProductosDesactualizados(false)
        setFechaCache(null)
        cacheProductos(Number(sucursalId), res.data).catch(() => {})
      }
      return res.data
    } catch (err) {
      // Si la petición al servidor falló de verdad y no teníamos productos en pantalla, usamos caché
      if (!hayProductosRef.current) {
        const desdeCache = await aplicarCache(Number(sucursalId))
        if (desdeCache) return desdeCache
        if (!esFalloDeRed(err)) {
          showToast("Error al cargar productos", "error");
        }
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
    if (accessToken && enabled && (sucursalIdOverride || user?.sucursalID)) {
      fetchProductosSucursal()
    }
  }, [accessToken, sucursalIdOverride, user?.sucursalID, enabled])

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
