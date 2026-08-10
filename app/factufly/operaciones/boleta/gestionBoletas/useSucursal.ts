import { useState, useEffect } from 'react'
import axios from 'axios'
import { Sucursal } from './Boleta'
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/app/components/ui/Toast';
import { cacheSucursal, getSucursalCache } from '@/lib/offline/offlineDb';

export function useSucursal() {
  const { showToast } = useToast();
  const { accessToken, user } = useAuth();
  const [sucursal, setSucursal] = useState<Sucursal | null>(null)
  const [loadingSucursal, setLoadingSucursal] = useState(false)

  const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))

  const fetchSucursal = async () => {
    if (!user?.sucursalID || user?.rol === 'superadmin') return
    const sucursalId = Number(user.sucursalID)

    setLoadingSucursal(true)

    // En paralelo al reintento por red: si hay una copia guardada del
    // dispositivo, se muestra de una vez en vez de dejar la pantalla en
    // blanco mientras se agotan los 3 reintentos (útil sin conexión).
    getSucursalCache(sucursalId)
      .then((entry) => {
        if (entry) setSucursal((prev) => prev ?? entry.sucursal)
      })
      .catch(() => {})

    for (let i = 0; i < 3; i++) {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Sucursal/${user.sucursalID}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        setSucursal(res.data)
        cacheSucursal(sucursalId, res.data).catch(() => {})
        setLoadingSucursal(false)
        return
      } catch {
        if (i < 2) {
          await sleep(1000 * (i + 1))
        } else {
          const cache = await getSucursalCache(sucursalId).catch(() => null)
          if (!cache) showToast("Error al obtener la sucursal", "error")
          setLoadingSucursal(false)
        }
      }
    }
  }

  useEffect(() => {
    if (accessToken) fetchSucursal()
  }, [accessToken])

  return { sucursal, loadingSucursal, fetchSucursal }
}