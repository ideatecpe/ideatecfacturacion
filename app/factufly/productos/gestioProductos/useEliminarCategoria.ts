import { useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";

export function useEliminarCategoria() {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const [loadingEliminar, setLoadingEliminar] = useState(false);

  const eliminarCategoria = async (categoriaId: number) => {
    setLoadingEliminar(true);
    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Categorias/${categoriaId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      showToast("Categoría eliminada correctamente.", "success");
      return true;
    } catch (err: any) {
      const mensaje = err?.response?.data?.message ?? "Error al eliminar la categoría.";
      showToast(mensaje, "error");
      return false;
    } finally {
      setLoadingEliminar(false);
    }
  };

  return { eliminarCategoria, loadingEliminar };
}
