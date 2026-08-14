import { useState, useEffect } from 'react'
import axios from 'axios'
import { Sucursal } from './Boleta'
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/app/components/ui/Toast';
import { esFalloDeRed } from '@/lib/offline/senalRed';

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))

export function useSucursalRuc(enabled: boolean = true) {
  const { showToast } = useToast();
  const { accessToken, user } = useAuth();
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [loadingSucursales, setLoadingSucursales] = useState(false)

  const fetchSucursales = async (intentos = 3) => {
    setLoadingSucursales(true)
    for (let i = 0; i < intentos; i++) {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Sucursal`,
          {
            params: { ruc: user?.ruc },
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        )
        setSucursales(res.data)
        setLoadingSucursales(false)
        return // ✅ éxito, salimos
      } catch (err) {
        if (i < intentos - 1) {
          await sleep(1000 * (i + 1)) // espera 1s, 2s antes de reintentar
        } else {
          // último intento fallido → muestra error, salvo que sea por falta de
          // internet: eso ya lo comunica la franja de "Sin conexión".
          if (!esFalloDeRed(err)) {
            showToast("Error al obtener las sucursales", "error")
          }
          setLoadingSucursales(false)
        }
      }
    }
  }

  useEffect(() => {
    if (accessToken && enabled) fetchSucursales()
  }, [accessToken, enabled])

  return { sucursales, loadingSucursales, fetchSucursales }
}