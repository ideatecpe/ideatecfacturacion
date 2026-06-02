import { useState } from 'react'
import { BoletaCliente } from './Boleta'
import { consultaDni } from '@/app/components/apiConsultasJsonPe/consultaDni'
import { consultaRuc } from '@/app/components/apiConsultasJsonPe/consultaRuc'
import { consultaCe } from '@/app/components/apiConsultasJsonPe/consultaCe'

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
          setCliente({
            clienteId: null,
            tipoDocumento: tipoDoc,
            numeroDocumento: numeroDoc,
            razonSocial: result.nombreCompleto,
            ubigeo: '',
            direccionLineal: '',
            departamento: '',
            provincia: '',
            distrito: '',
          })
        } else {
          setErrorCliente('No se encontró el DNI.')
        }
      } else if (tipoDoc === '06') {
        const result = await consultaRuc(numeroDoc)
        if (result) {
          setCliente({
            clienteId: null,
            tipoDocumento: tipoDoc,
            numeroDocumento: numeroDoc,
            razonSocial: result.razonSocial,
            ubigeo: result.ubigeo,
            direccionLineal: result.direccionLineal,
            departamento: result.departamento,
            provincia: result.provincia,
            distrito: result.distrito,
          })
        } else {
          setErrorCliente('RUC no encontrado')
        }
      } else if (tipoDoc === '04') {
        const result = await consultaCe(numeroDoc)
        if (result) {
          setCliente({
            clienteId: null,
            tipoDocumento: tipoDoc,
            numeroDocumento: numeroDoc,
            razonSocial: result.nombreCompleto,
            ubigeo: '',
            direccionLineal: '',
            departamento: '',
            provincia: '',
            distrito: '',
          })
        } else {
          setErrorCliente('No se encontró el Carnet de Extranjería.')
        }
      }
    } catch {
      setErrorCliente('No se pudo encontrar el cliente')
    } finally {
      setLoadingCliente(false)
    }
  }

  return { cliente, loadingCliente, errorCliente, buscarCliente }
}