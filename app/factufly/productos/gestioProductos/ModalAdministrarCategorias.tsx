"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Tag, Trash2, X } from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { InputBase } from "@/app/components/ui/InputBase";
import { ModalEliminar } from "@/app/components/ui/ModalEliminar";
import { coincideBusqueda } from "@/app/utils/normalizarTexto";
import { Categoria } from "./Producto";
import { useRegistrarCategoria } from "./useRegistrarCategoria";
import { useEditarCategoria } from "./useEditarCategoria";
import { useEliminarCategoria } from "./useEliminarCategoria";
import { useToast } from "@/app/components/ui/Toast";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  categorias: Categoria[];
  loadingCategorias: boolean;
  onRefresh: () => void;
  categoriasEnUso: Set<number>;
}

type Vista = "lista" | "agregar" | "editar";

export default function ModalAdministrarCategorias({
  isOpen,
  onClose,
  categorias,
  loadingCategorias,
  onRefresh,
  categoriasEnUso,
}: Props) {
  const [vista, setVista] = useState<Vista>("lista");
  const [busqueda, setBusqueda] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<Categoria | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Form state (agregar / editar)
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [errorNombre, setErrorNombre] = useState(false);

  const { showToast } = useToast();
  const { registrarCategoria, loadingRegistrar } = useRegistrarCategoria();
  const { editarCategoria, loadingEditar } = useEditarCategoria();
  const { eliminarCategoria } = useEliminarCategoria();

  useEffect(() => {
    if (!isOpen) {
      setBusqueda("");
      setVista("lista");
      setCategoriaSeleccionada(null);
    }
  }, [isOpen]);

  const abrirAgregar = () => {
    setNombre("");
    setDescripcion("");
    setErrorNombre(false);
    setVista("agregar");
  };

  const abrirEditar = (cat: Categoria) => {
    setCategoriaSeleccionada(cat);
    setNombre(cat.categoriaNombre);
    setDescripcion(cat.descripcion ?? "");
    setErrorNombre(false);
    setVista("editar");
  };

  const volverLista = () => {
    setVista("lista");
    setCategoriaSeleccionada(null);
  };

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      setErrorNombre(true);
      return;
    }
    if (vista === "agregar") {
      const ok = await registrarCategoria({
        categoriaNombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
      });
      if (ok) {
        onRefresh();
        volverLista();
      }
    } else if (vista === "editar" && categoriaSeleccionada) {
      const ok = await editarCategoria({
        categoriaId: categoriaSeleccionada.categoriaId,
        categoriaNombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
      });
      if (ok) {
        onRefresh();
        volverLista();
      }
    }
  };

  const handleEliminarConfirm = async () => {
    if (!categoriaSeleccionada) return;
    const ok = await eliminarCategoria(categoriaSeleccionada.categoriaId);
    if (ok) onRefresh();
  };

  const categoriasFiltradas = useMemo(() => {
    const q = busqueda.trim();
    if (!q) return categorias;
    return categorias.filter((c) =>
      coincideBusqueda(q, c.categoriaNombre, c.descripcion ?? "")
    );
  }, [categorias, busqueda]);

  const titulo =
    vista === "agregar"
      ? "Nueva Categoría"
      : vista === "editar"
      ? "Editar Categoría"
      : "Administrar Categorías";

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={titulo} className="max-w-xl">
        {/* Vista lista */}
        {vista === "lista" && (
          <div className="space-y-3">
            {/* Barra superior */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar categoría..."
                  className="w-full h-9 text-xs pl-8 pr-8 rounded-lg border border-gray-200 bg-white outline-none focus:ring-1 focus:ring-brand-blue/30 focus:border-brand-blue/30 shadow-sm text-gray-800 placeholder:text-gray-400 font-medium"
                />
                {busqueda && (
                  <button
                    type="button"
                    onClick={() => setBusqueda("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={abrirAgregar}
                className="flex items-center gap-1.5 h-9 px-3 text-xs font-bold text-white bg-brand-blue hover:bg-brand-blue/90 rounded-lg shadow-sm transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Nueva
              </button>
            </div>

            {/* Tabla */}
            <div
              className="overflow-y-auto rounded-xl border border-gray-200 bg-white"
              style={{ maxHeight: "380px", scrollbarWidth: "thin", scrollbarColor: "#CBD5E1 transparent" }}
            >
              <table className="w-full text-xs tabular-nums">
                <thead className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 z-10">
                  <tr>
                    <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5 w-8">#</th>
                    <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Nombre</th>
                    <th className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5">Descripción</th>
                    <th className="text-center font-bold text-gray-500 uppercase tracking-wide px-3 py-2.5 w-20">Acc.</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingCategorias &&
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-gray-100 animate-pulse">
                        <td className="px-3 py-3" colSpan={4}>
                          <div className="h-3 bg-gray-200 rounded w-full" />
                        </td>
                      </tr>
                    ))}

                  {!loadingCategorias && categoriasFiltradas.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center">
                        <div className="flex flex-col items-center">
                          <div className="bg-gray-100 rounded-full p-3 mb-2">
                            <Tag className="w-8 h-8 text-gray-300" />
                          </div>
                          <p className="text-gray-500 font-semibold text-sm">
                            {busqueda ? "Sin coincidencias" : "Sin categorías registradas"}
                          </p>
                          <p className="text-gray-400 text-xs mt-0.5">
                            {busqueda
                              ? `No se encontró "${busqueda}"`
                              : 'Agrega tu primera con el botón "Nueva"'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loadingCategorias &&
                    categoriasFiltradas.map((cat, idx) => (
                      <tr
                        key={cat.categoriaId}
                        className={`border-b border-gray-100 transition-colors hover:bg-blue-50/30 ${
                          idx % 2 === 1 ? "bg-gray-50/50" : "bg-white"
                        }`}
                      >
                        <td className="px-3 py-2 text-gray-400 font-medium">{idx + 1}</td>
                        <td className="px-3 py-2 font-semibold text-gray-800">{cat.categoriaNombre}</td>
                        <td className="px-3 py-2 text-gray-500">
                          {cat.descripcion ? cat.descripcion : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              title="Editar"
                              onClick={() => abrirEditar(cat)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-brand-blue hover:bg-blue-50 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title={
                                categoriasEnUso.has(cat.categoriaId)
                                  ? "Tiene productos asignados"
                                  : "Eliminar"
                              }
                              onClick={() => {
                                if (categoriasEnUso.has(cat.categoriaId)) {
                                  showToast(
                                    `No se puede eliminar "${cat.categoriaNombre}": hay productos asignados a esta categoría.`,
                                    "error"
                                  );
                                  return;
                                }
                                setCategoriaSeleccionada(cat);
                                setIsDeleteOpen(true);
                              }}
                              className={`p-1.5 rounded-lg transition-colors ${
                                categoriasEnUso.has(cat.categoriaId)
                                  ? "text-gray-300 cursor-not-allowed"
                                  : "text-gray-400 hover:text-rose-600 hover:bg-rose-50"
                              }`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Vista agregar / editar */}
        {(vista === "agregar" || vista === "editar") && (
          <div className="space-y-4">
            <InputBase
              label="Nombre"
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                if (errorNombre) setErrorNombre(false);
              }}
              placeholder="Ej: Bebidas, Electrónica..."
              showError={errorNombre}
              errorMessage="El nombre es obligatorio"
            />
            <InputBase
              label="Descripción"
              labelOptional="(opcional)"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción de la categoría"
              showError={false}
            />
            <div className="pt-2 flex justify-end gap-3">
              <Button variant="outline" type="button" onClick={volverLista}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={loadingRegistrar || loadingEditar}
                onClick={handleGuardar}
              >
                {loadingRegistrar || loadingEditar ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ModalEliminar
        isOpen={isDeleteOpen}
        mensaje="Estás a punto de eliminar la categoría"
        nombre={categoriaSeleccionada?.categoriaNombre ?? ""}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleEliminarConfirm}
      />
    </>
  );
}
