"use client";
import React, { useState } from "react";
import { X, User, Mail, Shield, Loader2, Lock, Eye, EyeOff } from "lucide-react";

interface EditarUsuarioForm {
  usuarioID: number;
  username: string;
  email: string;
  rol: string;
  nuevaContrasena?: string;
}

interface Props {
  usuario: any;
  onClose: () => void;
  onSave: (data: EditarUsuarioForm) => Promise<void>;
  isSuperadmin: boolean;
}

export function EditarUsuarioModal({
  usuario,
  onClose,
  onSave,
  isSuperadmin,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [confirmarContrasena, setConfirmarContrasena] = useState("");
  const [errorContrasena, setErrorContrasena] = useState("");

  const [form, setForm] = useState<EditarUsuarioForm>({
    usuarioID: usuario.usuarioID,
    username: usuario.username,
    email: usuario.email,
    rol: usuario.rol,
    nuevaContrasena: "",
  });

  const puedeEditarContrasena = isSuperadmin || usuario.rol !== "superadmin";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorContrasena("");

    // Validar contraseña solo si se quiere cambiar
    if (form.nuevaContrasena) {
      if (form.nuevaContrasena.length < 6) {
        setErrorContrasena("La contraseña debe tener al menos 6 caracteres.");
        return;
      }
      if (form.nuevaContrasena !== confirmarContrasena) {
        setErrorContrasena("Las contraseñas no coinciden.");
        return;
      }
    }

    setSaving(true);
    try {
      // Si no se ingresó nueva contraseña, no la enviamos
      const payload: EditarUsuarioForm = {
        ...form,
        nuevaContrasena: form.nuevaContrasena || undefined,
      };
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50 border border-blue-100">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Editar Usuario</p>
              <p className="text-xs text-gray-500">{usuario.username}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase">
                Usuario
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  required
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none text-sm focus:border-brand-blue/50"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase">
                Correo
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none text-sm focus:border-brand-blue/50"
                />
              </div>
            </div>

            {/* Rol */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase">
                Rol
              </label>
              <div className="relative">
                <Shield className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={form.rol}
                  disabled={usuario.rol === "superadmin"}
                  onChange={(e) => setForm({ ...form, rol: e.target.value })}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none text-sm focus:border-brand-blue/50 bg-white disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  {usuario.rol === "superadmin" ? (
                    <option value="superadmin">Superadmin</option>
                  ) : (
                    <>
                      <option value="facturador">Facturador</option>
                      {(isSuperadmin || usuario.rol === "admin") && (
                        <option value="admin">Administrador</option>
                      )}
                    </>
                  )}
                </select>
              </div>
              {usuario.rol === "superadmin" && (
                <p className="text-xs text-gray-400">
                  El rol de superadmin no puede modificarse.
                </p>
              )}
            </div>

            {/* Cambiar Contraseña — solo admin/superadmin */}
            {puedeEditarContrasena && (
              <div className="pt-2 border-t border-gray-100 space-y-4">
                <p className="text-xs font-bold text-gray-400 uppercase">
                  Cambiar contraseña{" "}
                  <span className="font-normal normal-case">(opcional)</span>
                </p>

                {/* Nueva contraseña */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={mostrarContrasena ? "text" : "password"}
                      value={form.nuevaContrasena}
                      onChange={(e) =>
                        setForm({ ...form, nuevaContrasena: e.target.value })
                      }
                      placeholder="Dejar vacío para no cambiar"
                      className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl outline-none text-sm focus:border-brand-blue/50 placeholder:text-gray-300"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarContrasena(!mostrarContrasena)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {mostrarContrasena ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirmar contraseña */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={mostrarConfirmar ? "text" : "password"}
                      value={confirmarContrasena}
                      onChange={(e) => setConfirmarContrasena(e.target.value)}
                      placeholder="Repetir nueva contraseña"
                      className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl outline-none text-sm focus:border-brand-blue/50 placeholder:text-gray-300"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarConfirmar(!mostrarConfirmar)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {mostrarConfirmar ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Error de contraseña */}
                {errorContrasena && (
                  <p className="text-xs text-red-500 font-medium">
                    {errorContrasena}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end bg-gray-50 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-xl"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}