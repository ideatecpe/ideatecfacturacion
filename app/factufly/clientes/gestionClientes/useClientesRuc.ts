// useClientesRuc.ts
import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/app/components/ui/Toast';
import { Cliente } from './typesCliente';

export function useClientesRuc(enabled: boolean = true) {
  const { showToast } = useToast();
  const { accessToken, user } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loadingClientes, setLoadingClientes] = useState(false)

  const fetchClientes = async () => {
    setLoadingClientes(true)
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Cliente/ruc/${user?.ruc}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )
      setClientes(res.data)
      return res.data
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        showToast("Error al cargar clientes", "error");
      }
    } finally {
      setLoadingClientes(false)
    }
  }

  useEffect(() => {
    if (accessToken && enabled) fetchClientes()
  }, [accessToken, enabled])

  return { clientes, loadingClientes, setClientes, fetchClientes }
}