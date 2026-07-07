import { useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";

export interface Vale {
  idVale: number;
  nombre: string;
  descripcion: string;
  fechaEmision: string;
  duracion: string;
  estado: boolean;
}

export type ValeForm = {
  nombre: string;
  descripcion: string;
  duracion: string;
  estado: boolean;
};

const VALE_EMPTY: ValeForm = {
  nombre: "",
  descripcion: "",
  duracion: "",
  estado: true,
};

// Gestión de Vales (listar / crear / editar / eliminar) para la página de productos.
export function useVales() {
  const { accessToken } = useAuth();
  const { showToast } = useToast();

  const [showModalVales, setShowModalVales] = useState(false);
  const [vales, setVales] = useState<Vale[]>([]);
  const [loadingVales, setLoadingVales] = useState(false);
  const [valeForm, setValeForm] = useState<ValeForm>(VALE_EMPTY);
  const [editingVale, setEditingVale] = useState<Vale | null>(null);
  const [showFormVale, setShowFormVale] = useState(false);
  const [savingVale, setSavingVale] = useState(false);
  const [deletingValeId, setDeletingValeId] = useState<number | null>(null);

  const fetchVales = async () => {
    setLoadingVales(true);
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Vales`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      setVales(res.data);
    } catch {
      showToast("Error al cargar los vales", "error");
    } finally {
      setLoadingVales(false);
    }
  };

  const abrirModalVales = () => {
    setShowModalVales(true);
    setShowFormVale(false);
    setEditingVale(null);
    setValeForm(VALE_EMPTY);
    fetchVales();
  };

  const abrirFormNuevoVale = () => {
    setEditingVale(null);
    setValeForm(VALE_EMPTY);
    setShowFormVale(true);
  };

  const abrirFormEditarVale = (vale: Vale) => {
    setEditingVale(vale);
    setValeForm({
      nombre: vale.nombre,
      descripcion: vale.descripcion,
      duracion: vale.duracion,
      estado: vale.estado,
    });
    setShowFormVale(true);
  };

  const guardarVale = async () => {
    if (!valeForm.nombre.trim() || !valeForm.duracion.trim()) {
      showToast("Nombre y duración son obligatorios", "error");
      return;
    }
    setSavingVale(true);
    try {
      if (editingVale) {
        await axios.put(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Vales/${editingVale.idVale}`,
          {
            nombre: valeForm.nombre,
            descripcion: valeForm.descripcion,
            fechaEmision: editingVale.fechaEmision,
            duracion: valeForm.duracion,
            estado: valeForm.estado,
          },
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        showToast("Vale actualizado correctamente", "success");
      } else {
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Vales`,
          {
            nombre: valeForm.nombre,
            descripcion: valeForm.descripcion,
            duracion: valeForm.duracion,
          },
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        showToast("Vale creado correctamente", "success");
      }
      setShowFormVale(false);
      setEditingVale(null);
      setValeForm(VALE_EMPTY);
      fetchVales();
    } catch {
      showToast("Error al guardar el vale", "error");
    } finally {
      setSavingVale(false);
    }
  };

  const eliminarVale = async (id: number) => {
    setDeletingValeId(id);
    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Vales/${id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      showToast("Vale eliminado", "success");
      setVales((prev) => prev.filter((v) => v.idVale !== id));
    } catch {
      showToast("Error al eliminar el vale", "error");
    } finally {
      setDeletingValeId(null);
    }
  };

  return {
    // estado
    showModalVales,
    setShowModalVales,
    vales,
    loadingVales,
    valeForm,
    setValeForm,
    editingVale,
    setEditingVale,
    showFormVale,
    setShowFormVale,
    savingVale,
    deletingValeId,
    // acciones
    abrirModalVales,
    abrirFormNuevoVale,
    abrirFormEditarVale,
    guardarVale,
    eliminarVale,
  };
}
