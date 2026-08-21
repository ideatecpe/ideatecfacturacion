import { useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";

export function useEditarCategoria() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const [loadingEditar, setLoadingEditar] = useState(false);

  const editarCategoria = async (dto: {
    categoriaId: number;
    categoriaNombre: string;
    descripcion?: string;
  }) => {
    setLoadingEditar(true);
    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Categorias/${dto.categoriaId}`,
        {
          categoriaId: dto.categoriaId,
          empresaRuc: user?.ruc,
          categoriaNombre: dto.categoriaNombre,
          descripcion: dto.descripcion,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      showToast("Categoría actualizada correctamente.", "success");
      return true;
    } catch {
      showToast("Error al actualizar la categoría.", "error");
      return false;
    } finally {
      setLoadingEditar(false);
    }
  };

  return { editarCategoria, loadingEditar };
}
