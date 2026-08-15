// useClientesSucursal.ts
import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/app/components/ui/Toast';
import { Cliente } from './typesCliente';
import { esFalloDeRed } from '@/lib/offline/senalRed';

export function useClientesSucursal(sucursalId?: number, enabled: boolean = true) {
  const { showToast } = useToast();
  const { accessToken, user } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loadingClientes, setLoadingClientes] = useState(false)

  const idToUse = sucursalId ?? parseInt(user?.sucursalID ?? "0");

  const fetchClientes = async () => {
    if (!idToUse) return;
    setLoadingClientes(true)
    try {
      const res = await axios.get<Cliente[]>(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Cliente/sucursal/${idToUse}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )
      setClientes(res.data)
      return res.data
    } catch (err) {
      if (!esFalloDeRed(err)) {
        showToast("Error al cargar clientes", "error");
      }
    } finally {
      setLoadingClientes(false)
    }
  }

  useEffect(() => {
    if (accessToken && enabled) fetchClientes()
  }, [accessToken, idToUse, enabled])

  return { clientes, loadingClientes, setClientes, fetchClientes }
}