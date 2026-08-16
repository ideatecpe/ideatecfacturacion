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

  // ── Regla de oro del stock ──────────────────────────────────────────
  // CON internet, los productos salen SIEMPRE del API. El cache de IndexedDB
  // es el plan B para seguir vendiendo sin conexión, NO una fuente que compita
  // con el servidor. Antes se pintaba el cache "mientras carga" (patrón
  // stale-while-revalidate) y eso hacía que dos cajas del mismo negocio
  // mostraran stock distinto del mismo producto: una veía el número real y la
  // otra el que tenía guardado desde su última visita.
  const secuenciaRef = useRef(0)          // nº de la petición en curso
  const secuenciaAplicadaRef = useRef(0)  // nº de la última respuesta del servidor aplicada
  const hayDatosServidorRef = useRef(false)
  const hayProductosRef = useRef(false)

  // Vuelca el cache local a pantalla. Solo se llama cuando el servidor no es
  // una opción: sin conexión al arrancar, o después de que la petición falló.
  const aplicarCache = async (sucursalId: number): Promise<ProductoSucursal[] | null> => {
    try {
      const cache = await getProductosCache(sucursalId);
      // Se vuelve a comprobar aquí: leer IndexedDB es asíncrono y en ese rato
      // pudo llegar la respuesta real, que siempre manda sobre el cache.
      if (
        cache &&
        cache.productos.length > 0 &&
        !hayDatosServidorRef.current &&
        !hayProductosRef.current
      ) {
        hayProductosRef.current = true;
        setProductosSucursal(cache.productos);
        setProductosDesactualizados(true);
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

    // Única situación en que se muestra el cache de entrada: el navegador
    // afirma que no hay red, así que esperar al API solo dejaría la caja vacía.
    const sinConexion = typeof navigator !== "undefined" && !navigator.onLine;
    if (sinConexion && !hayProductosRef.current) {
      await aplicarCache(Number(sucursalId));
    }

    // Solo mostrar loading si no hay nada que mostrar (ni cache ni estado previo)
    if (!hayProductosRef.current) {
      setLoadingSucursal(true);
    }

    // ── Fuente real: el API ──
    try {
      const res = await axios.get<ProductoSucursal[]>(
        `${process.env.NEXT_PUBLIC_API_URL}/api/productos/${sucursalId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          // El stock cambia con cada venta, incluidas las de OTRO dispositivo:
          // el navegador no debe poder responder con una copia guardada. Se usa
          // un parámetro (no cabeceras no-cache) para no tocar el preflight CORS.
          params: { _: Date.now() },
        }
      )
      // Solo se aplica la respuesta más reciente: una petición lenta anterior no
      // puede revivir un stock ya superado.
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
      // La petición al servidor falló de verdad: recién AHORA el cache es la
      // mejor información disponible. Si ya hay productos en pantalla (frescos
      // de una carga anterior) no se toca nada: siguen siendo mejores.
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
