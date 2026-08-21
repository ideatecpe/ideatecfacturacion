import { useState, useCallback } from 'react'
import axios from 'axios'
import { Categoria } from './Producto'
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/app/components/ui/Toast';
import { esFalloDeRed } from '@/lib/offline/senalRed';

export function useCategoriasLista() {
  const { showToast } = useToast();
  const { accessToken } = useAuth();
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loadingCategorias, setLoadingCategorias] = useState(false)

  const fetchCategorias = useCallback(async (ruc: string) => {
    if (!ruc) return []
    setLoadingCategorias(true)
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Categorias/empresa/${ruc}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
          params: { _: Date.now() },
        }
      )
      const data: Categoria[] = res.data.map((c: any) => ({
        categoriaId: c.categoriaId,
        empresaRuc: c.empresaRuc,
        categoriaNombre: c.categoriaNombre,
        descripcion: c.descripcion ?? undefined,
      }))
      setCategorias(data)
      return data
    } catch (err) {
      if (!esFalloDeRed(err)) {
        showToast("Error al cargar categorías", "error");
      }
      return []
    } finally {
      setLoadingCategorias(false)
    }
  }, [accessToken, showToast])

  return { categorias, setCategorias, loadingCategorias, fetchCategorias }  // ← sin useEffect interno
}