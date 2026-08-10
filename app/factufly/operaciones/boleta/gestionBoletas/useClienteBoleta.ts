import { useState } from 'react'
import { BoletaCliente } from './Boleta'
import { consultaDni } from '@/app/components/apiConsultasJsonPe/consultaDni'
import { consultaRuc } from '@/app/components/apiConsultasJsonPe/consultaRuc'
import { consultaCe } from '@/app/components/apiConsultasJsonPe/consultaCe'
import { cacheCliente, getClienteCache } from '@/lib/offline/offlineDb'

export function useClienteBoleta() {
  const [cliente, setCliente] = useState<Partial<BoletaCliente> | null>(null)
  const [loadingCliente, setLoadingCliente] = useState(false)
  const [errorCliente, setErrorCliente] = useState<string | null>(null)

  const buscarCliente = async (tipoDoc: string, numeroDoc: string) => {
    if (!numeroDoc) return
    setLoadingCliente(true)
    setErrorCliente(null)

    try {
      if (tipoDoc === '01') {
        const result = await consultaDni(numeroDoc)
        if (result) {
          const clienteEncontrado: Partial<BoletaCliente> = {
            clienteId: null,
            tipoDocumento: tipoDoc,
            numeroDocumento: numeroDoc,
            razonSocial: result.nombreCompleto,
            ubigeo: '',
            direccionLineal: '',
            departamento: '',
            provincia: '',
            distrito: '',
          }
          setCliente(clienteEncontrado)
          cacheCliente(tipoDoc, numeroDoc, clienteEncontrado).catch(() => {})
        } else {
          setErrorCliente('No se encontró el DNI.')
        }
      } else if (tipoDoc === '06') {
        const result = await consultaRuc(numeroDoc)
        if (result) {
          const clienteEncontrado: Partial<BoletaCliente> = {
            clienteId: null,
            tipoDocumento: tipoDoc,
            numeroDocumento: numeroDoc,
            razonSocial: result.razonSocial,
            ubigeo: result.ubigeo,
            direccionLineal: result.direccionLineal,
            departamento: result.departamento,
            provincia: result.provincia,
            distrito: result.distrito,
          }
          setCliente(clienteEncontrado)
          cacheCliente(tipoDoc, numeroDoc, clienteEncontrado).catch(() => {})
        } else {
          setErrorCliente('RUC no encontrado')
        }
      } else if (tipoDoc === '04') {
        const result = await consultaCe(numeroDoc)
        if (result) {
          const clienteEncontrado: Partial<BoletaCliente> = {
            clienteId: null,
            tipoDocumento: tipoDoc,
            numeroDocumento: numeroDoc,
            razonSocial: result.nombreCompleto,
            ubigeo: '',
            direccionLineal: '',
            departamento: '',
            provincia: '',
            distrito: '',
          }
          setCliente(clienteEncontrado)
          cacheCliente(tipoDoc, numeroDoc, clienteEncontrado).catch(() => {})
        } else {
          setErrorCliente('No se encontró el Carnet de Extranjería.')
        }
      }
    } catch {
      // Sin conexión con el servicio de consulta: usar la última respuesta
      // conocida para ese mismo documento, si existe.
      const cache = await getClienteCache(tipoDoc, numeroDoc).catch(() => null)
      if (cache) {
        setCliente(cache.cliente)
        setErrorCliente(null)
      } else {
        setErrorCliente(
          'Sin conexión: no se pudo consultar el documento. Ingresa los datos manualmente.',
        )
      }
    } finally {
      setLoadingCliente(false)
    }
  }

  return { cliente, loadingCliente, errorCliente, buscarCliente }
}
