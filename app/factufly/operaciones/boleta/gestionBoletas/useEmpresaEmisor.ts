import { useState, useEffect } from 'react'
import axios from 'axios'
import { BoletaCompany } from './Boleta'
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/app/components/ui/Toast';
import { cacheEmpresa, getEmpresaCache } from '@/lib/offline/offlineDb';

export function useEmpresaEmisor() {
  const { showToast } = useToast();
  const { accessToken, user } = useAuth();
  const [empresa, setEmpresa] = useState<BoletaCompany | null>(null)
  const [loadingEmpresa, setLoadingEmpresa] = useState(false)

  const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))

  const fetchEmpresa = async () => {
    if (!user?.ruc) return
    const ruc = user.ruc
    setLoadingEmpresa(true)

    // En paralelo al reintento por red: si hay una copia guardada del
    // dispositivo, se muestra de una vez (útil sin conexión).
    getEmpresaCache(ruc)
      .then((entry) => {
        if (entry) setEmpresa((prev) => prev ?? entry.empresa)
      })
      .catch(() => {})

    for (let i = 0; i < 3; i++) {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/api/companies/${user.ruc}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        const data = res.data
        const empresaResuelta: BoletaCompany = {
          empresaId: data.id,
          numeroDocumento: data.ruc,
          razonSocial: data.razonSocial,
          nombreComercial: data.nombreComercial,
          direccionLineal: data.direccion,
          ubigeo: data.ubigeo,
          provincia: data.provincia,
          departamento: data.departamento,
          distrito: data.distrito,
          establecimientoAnexo: "0000"
        }
        setEmpresa(empresaResuelta)
        cacheEmpresa(ruc, empresaResuelta).catch(() => {})
        setLoadingEmpresa(false)
        return
      } catch {
        if (i < 2) {
          await sleep(1000 * (i + 1))
        } else {
          const cache = await getEmpresaCache(ruc).catch(() => null)
          if (!cache) showToast("Error al obtener los datos de la empresa", "error")
          setLoadingEmpresa(false)
        }
      }
    }
  }

  useEffect(() => {
    if (accessToken) fetchEmpresa()
  }, [accessToken])

  return { empresa, loadingEmpresa }
}