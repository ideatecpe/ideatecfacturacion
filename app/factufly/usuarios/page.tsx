"use client";
import React, { useEffect, useState } from "react";
import {
  Shield,
  ShieldCheck,
  Mail,
  Search,
  UserPlus,
  Trash2,
  Edit2,
  EyeOff,
  Eye,
  Crown,
  Briefcase,
  Clock,
  CheckCircle2,
  XCircle,
  Building2,
} from "lucide-react";
import { useToast } from "@/app/components/ui/Toast";
import { Button } from "@/app/components/ui/Button";
import { Modal } from "@/app/components/ui/Modal";
import { cn } from "@/app/utils/cn";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import { EditarUsuarioModal } from "@/app/components/modalUsuarios/EditarUsuarioModal";
import { EliminarUsuarioModal } from "@/app/components/modalUsuarios/EliminarUsuarioModal";

// ─── Rol config ───────────────────────────────────────────────────────────────
const ROL_CONFIG = {
  superadmin: {
    label: "Super Admin",
    description:
      "Acceso total al sistema. Gestiona empresas, sucursales y todos los usuarios.",
    icon: Crown,
    bg: "bg-red-50",
    border: "border-red-100",
    text: "text-red-700",
    iconBg: "bg-red-100",
    dot: "bg-red-500",
    badgeBg: "bg-red-50 border-red-200 text-red-700",
  },
  admin: {
    label: "Administrador",
    description:
      "Gestiona configuración SUNAT, certificados, sucursales y usuarios de su empresa.",
    icon: ShieldCheck,
    bg: "bg-blue-50",
    border: "border-blue-100",
    text: "text-blue-700",
    iconBg: "bg-blue-100",
    dot: "bg-blue-500",
    badgeBg: "bg-blue-50 border-blue-200 text-blue-700",
  },
  facturador: {
    label: "Facturador",
    description:
      "Emite y consulta comprobantes electrónicos. Sin acceso a configuración.",
    icon: Briefcase,
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    text: "text-emerald-700",
    iconBg: "bg-emerald-100",
    dot: "bg-emerald-500",
    badgeBg: "bg-emerald-50 border-emerald-200 text-emerald-700",
  },
} as const;

type Rol = keyof typeof ROL_CONFIG;

// ─── Role Badge ───────────────────────────────────────────────────────────────
function RoleBadge({ rol }: { rol: string }) {
  const cfg = ROL_CONFIG[rol as Rol] ?? ROL_CONFIG.facturador;
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
        cfg.badgeBg,
      )}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ─── Filter Pill ──────────────────────────────────────────────────────────────
function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-2.5 rounded-xl text-xs font-medium border transition-all",
        active
          ? "bg-brand-blue/95 text-white border-brand-blue/95 shadow-sm"
          : "bg-white text-gray-500 border-gray-200 hover:border-gray-300",
      )}
    >
      {children}
    </button>
  );
}

// ─── Usuario Card ─────────────────────────────────────────────────────────────
function UsuarioCard({
  u,
  canEdit,
  onEdit,
  onDelete,
  canDelete,
}: {
  u: any;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const cfg = ROL_CONFIG[u.rol as Rol] ?? ROL_CONFIG.facturador;
  const Icon = cfg.icon;
  const initials = u.username.slice(0, 2).toUpperCase();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:border-gray-200 transition-colors group">
      {/* Header */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0",
                cfg.iconBg,
                cfg.text,
              )}
            >
              {initials}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-tight">
                {u.username}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {u.rol === "superadmin"
                  ? "Acceso global"
                  : `Sucursal: ${u.nombreSucursal ?? "Sin asignar"}`}
              </p>
            </div>
          </div>

          {canEdit && (
            <div className="flex gap-1">
              <button
                onClick={onEdit}
                className="p-1.5 rounded-lg text-blue-500 bg-blue-50 hover:text-blue-700 hover:bg-blue-100 transition-all"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              {canDelete && (
                <button
                  onClick={onDelete}
                  className="p-1.5 rounded-lg text-rose-500 bg-rose-50 hover:text-rose-700 hover:bg-rose-100 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mt-3">
          <RoleBadge rol={u.rol} />
        </div>
      </div>

      {/* Descripción del rol */}
      <div className="px-3 py-0 border-t border-b border-gray-50">
        <div className={cn("flex items-start gap-2 p-2.5 rounded-xl")}>
          <Icon className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", cfg.text)} />
          <p className={cn("text-[11px] leading-relaxed")}>{cfg.description}</p>
        </div>
      </div>

      {/* Info */}
      <div className="px-5 py-3 space-y-2">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Mail className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <span className="truncate text-gray-400">
            {u.email || "Sin correo"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Clock className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <span>
            {u.fechaUltimoAcceso
              ? new Date(u.fechaUltimoAcceso).toLocaleDateString("es-PE", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "Sin accesos registrados"}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between">
        {u.estado ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" /> Activo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
            <XCircle className="w-3.5 h-3.5" /> Inactivo
          </span>
        )}
        <span className="text-[10px] text-gray-300 font-mono">
          ID #{u.usuarioID}
        </span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UsuariosPage() {
  const { showToast } = useToast();
  const { user, accessToken } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [rolFilter, setRolFilter] = useState<string>("todos");
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [modalEditar, setModalEditar] = useState<any | null>(null);
  const [modalEliminar, setModalEliminar] = useState<any | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Superadmin: RUC y sucursales
  const [rucEmpresa, setRucEmpresa] = useState("");
  const [rucHint, setRucHint] = useState<{ text: string; color: string }>({
    text: "",
    color: "",
  });
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [loadingSucursales, setLoadingSucursales] = useState(false);

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    rol: "facturador",
    password: "",
    sucursalID: "",
  });

  const isSuperadmin = user?.rol === "superadmin";
  const canManage = user?.rol !== "facturador";

  // ── Fetch usuarios ─────────────────────────────────────────────────────────
  const fetchUsuarios = async () => {
    setLoadingUsuarios(true);
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Usuario?incluirInactivos=false`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      setUsuarios(res.data.data);
    } catch {
      showToast("Error al cargar usuarios", "error");
    } finally {
      setLoadingUsuarios(false);
    }
  };

  useEffect(() => {
    if (accessToken) fetchUsuarios();
  }, [accessToken]);

  // ── Fetch sucursales por RUC (solo superadmin) ─────────────────────────────
  const fetchSucursales = async (ruc: string) => {
    setLoadingSucursales(true);
    setSucursales([]);
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Sucursal?ruc=${ruc}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      setSucursales(res.data);
    } catch {
      showToast("Error al cargar sucursales", "error");
    } finally {
      setLoadingSucursales(false);
    }
  };

  useEffect(() => {
    if (isModalOpen && isSuperadmin && user?.ruc) {
      fetchSucursales(user.ruc);
    }
  }, [isModalOpen]);

  // ── Reset modal ────────────────────────────────────────────────────────────
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({
      username: "",
      email: "",
      rol: "facturador",
      password: "",
      sucursalID: "",
    });
    setRucEmpresa("");
    setRucHint({ text: "", color: "" });
    setSucursales([]);
    setShowPassword(false);
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleEditar = async (data: any) => {
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Usuario/${data.usuarioID}`,
        data,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      setModalEditar(null);
      showToast("Usuario actualizado correctamente", "success");
      fetchUsuarios();
    } catch (error: any) {
      showToast(
        error.response?.data?.message || "Error al actualizar",
        "error",
      );
    }
  };

  const handleEliminar = async (id: number) => {
    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Usuario/${id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      setModalEliminar(null);
      showToast("Usuario eliminado correctamente", "success");
      fetchUsuarios();
    } catch (error: any) {
      showToast(error.response?.data?.message || "Error al eliminar", "error");
    }
  };

  const handleCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password.length < 8) {
      showToast("La contraseña debe tener mínimo 8 caracteres", "error");
      return;
    }

    // Validar que el superadmin haya seleccionado sucursal
    if (isSuperadmin) {
      if (!formData.sucursalID) {
        showToast("Selecciona una sucursal", "error");
        return;
      }
    }

    setLoadingCreate(true);
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Usuario/register`,
        {
          username: formData.username,
          email: formData.rol === "facturador" ? user?.email : formData.email,
          password: formData.password,
          rol: formData.rol,
          ruc: user?.ruc,
          sucursalID: isSuperadmin ? formData.sucursalID : user?.sucursalID,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      showToast("Usuario creado correctamente", "success");
      handleCloseModal();
      fetchUsuarios();
    } catch (error: any) {
      const msg = error.response?.data?.message || "Error al crear usuario";
      const lower = msg.toLowerCase();
      if (lower.includes("username") || lower.includes("usuario")) {
        showToast("El nombre de usuario ya existe en esta empresa", "error");
      } else {
        showToast(msg, "error");
      }
    } finally {
      setLoadingCreate(false);
    }
  };

  // ── Filtrado ───────────────────────────────────────────────────────────────
  const filtered = usuarios
    .filter((u) => {
      const matchSearch =
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchRol = rolFilter === "todos" || u.rol === rolFilter;
      return matchSearch && matchRol;
    })
    .sort((a, b) => {
      if (a.rol === "superadmin" && b.rol !== "superadmin") return -1;
      if (a.rol !== "superadmin" && b.rol === "superadmin") return 1;
      return 0;
    });

  const counts = {
    todos: usuarios.length,
    superadmin: usuarios.filter((u) => u.rol === "superadmin").length,
    admin: usuarios.filter((u) => u.rol === "admin").length,
    facturador: usuarios.filter((u) => u.rol === "facturador").length,
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-2 flex-1">
          <div className="relative min-w-48 w-full sm:max-w-xs">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o correo..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue/50 outline-none transition-all shadow-sm text-xs"
            />
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <FilterPill
              active={rolFilter === "todos"}
              onClick={() => setRolFilter("todos")}
            >
              Todos ({counts.todos})
            </FilterPill>
            <FilterPill
              active={rolFilter === "superadmin"}
              onClick={() => setRolFilter("superadmin")}
            >
              Super Admin ({counts.superadmin})
            </FilterPill>
            <FilterPill
              active={rolFilter === "admin"}
              onClick={() => setRolFilter("admin")}
            >
              Admin ({counts.admin})
            </FilterPill>
            <FilterPill
              active={rolFilter === "facturador"}
              onClick={() => setRolFilter("facturador")}
            >
              Facturador ({counts.facturador})
            </FilterPill>
          </div>
        </div>
        {canManage && (
          <Button onClick={() => setIsModalOpen(true)}>
            <UserPlus className="w-4 h-4" />
            Nuevo usuario
          </Button>
        )}
      </div>

      {/* Grid */}
      {loadingUsuarios ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse"
            >
              <div className="p-5 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gray-100 shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                  <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
              <div className="mx-5 mb-4 h-12 bg-gray-50 rounded-xl" />
              <div className="px-5 pb-4 space-y-2">
                <div className="h-2.5 bg-gray-100 rounded w-3/4" />
                <div className="h-2.5 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
          <Shield className="w-8 h-8 text-gray-200" />
          <p className="text-sm">No se encontraron usuarios</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((u) => (
            <UsuarioCard
              key={u.usuarioID}
              u={u}
              canEdit={canManage}
              canDelete={canManage && !(isSuperadmin && u.rol === "superadmin")}
              onEdit={() => setModalEditar(u)}
              onDelete={() => setModalEliminar(u)}
            />
          ))}
        </div>
      )}

      {/* Footer count */}
      {!loadingUsuarios && filtered.length > 0 && (
        <p className="text-xs text-gray-400 text-right">
          Mostrando{" "}
          <span className="font-medium text-gray-600">{filtered.length}</span>{" "}
          de{" "}
          <span className="font-medium text-gray-600">{usuarios.length}</span>{" "}
          usuarios
        </p>
      )}

      {/* Modal crear usuario */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Registrar nuevo usuario"
      >
        <form className="space-y-4" onSubmit={handleCrearUsuario}>
          {/* Leyenda roles */}
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            {(["admin", "facturador"] as Rol[]).map((r) => {
              const cfg = ROL_CONFIG[r];
              const Icon = cfg.icon;
              return (
                <div
                  key={r}
                  className={cn(
                    "flex items-start gap-2.5 px-3 py-2.5 border-b border-gray-50 last:border-0",
                    cfg.bg,
                  )}
                >
                  <Icon
                    className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", cfg.text)}
                  />
                  <div>
                    <p className={cn("text-[11px] font-semibold", cfg.text)}>
                      {cfg.label}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {cfg.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          {/* ── Campos solo para superadmin: RUC + Sucursal ── */}
          {isSuperadmin && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 space-y-3">
              <p className="text-[11px] font-semibold text-blue-700 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Sucursal destino
              </p>
              {loadingSucursales ? (
                <p className="text-[11px] text-gray-400 animate-pulse">
                  Cargando sucursales...
                </p>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">
                    Sucursal
                  </label>
                  <select
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50 text-sm transition-colors"
                    required
                    value={formData.sucursalID}
                    onChange={(e) =>
                      setFormData({ ...formData, sucursalID: e.target.value })
                    }
                  >
                    <option value="">Selecciona una sucursal</option>
                    {sucursales.map((s) => (
                      <option key={s.sucursalId} value={s.sucursalId}>
                        {s.nombre} {/* ← era s.nombreSucursal */}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          {/* Usuario */}
         
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase">
              Usuario
            </label>
            <input
              type="text"
              placeholder="Ej: juan.perez"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50 text-sm transition-colors"
              required
              minLength={4}
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
            />
            {formData.username.length > 0 && formData.username.length < 4 && (
              <p className="text-[10px] text-rose-500 italic px-1">
                El usuario debe tener al menos 4 caracteres
              </p>
            )}
          </div>
          {/* Rol / Perfil */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase">
              Rol / Perfil
            </label>
            <select
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50 text-sm transition-colors"
              value={formData.rol}
              onChange={(e) => {
                const nuevoRol = e.target.value;
                setFormData({
                  ...formData,
                  rol: nuevoRol,
                  // Al cambiar a admin, precarga el email del contexto
                  email: nuevoRol === "admin" ? (user?.email ?? "") : "",
                });
              }}
            >
              <option value="facturador">Facturador</option>
              {(isSuperadmin || user?.rol === "admin") && (
                <option value="admin">Administrador</option>
              )}
            </select>
            {formData.rol && (
              <p
                className={cn(
                  "text-[10px] italic px-2 py-1 rounded-lg",
                  ROL_CONFIG[formData.rol as Rol]?.bg,
                  ROL_CONFIG[formData.rol as Rol]?.text,
                )}
              >
                {ROL_CONFIG[formData.rol as Rol]?.description}
              </p>
            )}
          </div>
          {/* Email — solo visible si el rol es admin */}
          {formData.rol !== "facturador" && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase">
                Correo electrónico
              </label>
              <input
                type="email"
                placeholder="juan.p@empresa.com"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50 text-sm transition-colors"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
              {formData.email === user?.email && (
                <p className="text-[10px] text-blue-500 italic px-1">
                  Correo sugerido
                </p>
              )}
            </div>
          )}
          {/* Contraseña */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="Mín. 8 caracteres"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50 text-sm pr-10 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 italic">
              Mínimo 8 caracteres.
            </p>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loadingCreate}>
              {loadingCreate ? "Creando..." : "Crear usuario"}
            </Button>
          </div>
        </form>
      </Modal>

      {modalEditar && (
        <EditarUsuarioModal
          usuario={modalEditar}
          onClose={() => setModalEditar(null)}
          onSave={handleEditar}
          isSuperadmin={isSuperadmin}
        />
      )}
      {modalEliminar && (
        <EliminarUsuarioModal
          usuario={modalEliminar}
          onClose={() => setModalEliminar(null)}
          onConfirm={handleEliminar}
        />
      )}
    </div>
  );
}
