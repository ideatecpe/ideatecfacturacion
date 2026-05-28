"use client";
import React, { useState, useMemo,  } from 'react';
import axios from 'axios';
import {
  Search, Plus, Send, Edit2, Trash2, X,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { cn } from '@/app/utils/cn';
import { ModalEliminar } from '@/app/components/ui/ModalEliminar';
import { AgregarCliente } from './gestionClientes/AgregarCliente';
import { EditarClienteModal } from './gestionClientes/EditarCliente';
import { EnviarCorreoCliente } from './gestionClientes/EnviarCorreoCliente';
import { Direccion, Cliente } from './gestionClientes/typesCliente';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/app/components/ui/Toast';
import { DropdownFiltro } from '@/app/components/ui/DropdownFiltro';
import { useClientesRuc } from './gestionClientes/useClientesRuc';
import { useClientesSucursal } from './gestionClientes/useClientesSucursal';
import { useSucursalRuc } from '../operaciones/boleta/gestionBoletas/useSucursalRuc';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const formatDireccion = (direcciones: Direccion[], tipoDocumentoId: string): string => {
  if (!direcciones || direcciones.length === 0) return 'Sin dirección';
  const d = direcciones[0];

  if (tipoDocumentoId === "06") {
    return d.direccionLineal || 'Sin dirección';
  }

  const partes = [d.direccionLineal, d.distrito, d.provincia, d.departamento].filter(Boolean);
  return partes.length > 0 ? partes.join('  ') : 'Sin dirección';
};

const formatFecha = (fecha: string | null): string => {
  if (!fecha) return '-';
  try {
    return new Date(fecha).toLocaleDateString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  } catch {
    return '-';
  }
};

// ─── Page Principal ────────────────────────────────────────────────────────────
export default function ClientesPage() {
  const { showToast } = useToast();
  const { accessToken, user } = useAuth();
  const isSuperAdmin = user?.rol === "superadmin";
  const isBeta = user?.environment === "beta";

  // Hook correcto según rol
  const { clientes: clientesEmpresa, setClientes: setClientesEmpresa, loadingClientes: loadingEmpresa } = useClientesRuc(isSuperAdmin);
  const { clientes: clientesSucursal, setClientes: setClientesSucursal, loadingClientes: loadingSucursal } = useClientesSucursal(undefined, !isSuperAdmin);

  const clientes = isSuperAdmin ? clientesEmpresa : clientesSucursal;
  const loadingClientes = isSuperAdmin ? loadingEmpresa : loadingSucursal;
  const setClientes = isSuperAdmin ? setClientesEmpresa : setClientesSucursal;

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'Todos' | 'Activo' | 'Inactivo'>('Todos');
  const [filterTipo, setFilterTipo] = useState<'Todos' | 'RUC' | 'DNI' | 'CE'>('Todos');

  const [isNuevoOpen, setIsNuevoOpen] = useState(false);
  const [clienteCorreo, setClienteCorreo] = useState<Cliente | null>(null);
  const [clienteEditar, setClienteEditar] = useState<Cliente | null>(null);  
  const [eliminarCliente, setEliminarCliente] = useState<Cliente | null>(null);

  //sucursal para superadmin
  const { sucursales } = useSucursalRuc(isSuperAdmin);
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState<number>(0);

  //filtro por sucursales
  const [filtroSucursal, setFiltroSucursal] = useState<number>(0);

  const sucursalIdEfectivo = isSuperAdmin
    ? sucursalSeleccionada
    : parseInt(user?.sucursalID ?? "0");

  // ── Nuevo cliente form ──
  const nuevoClienteInicial = {
    sucursalID: sucursalIdEfectivo ,
    tipoDocumentoId: '01',
    numeroDocumento: '',
    razonSocialNombre: '',
    correo: '',
    telefono: '',
    direccion: {
      ubigeo: '',
      direccionLineal: '',
      departamento: '',
      provincia: '',
      distrito: '',
      tipoDireccion: ''
    }
  };
  const [nuevoCliente, setNuevoCliente] = useState(nuevoClienteInicial);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [lengthErrors, setLengthErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requiredFields = useMemo(() => {
    if (nuevoCliente.tipoDocumentoId === "01") {
      return [
        { key: "numeroDocumento", label: "Número de Documento", minLength: 8 },
        { key: "razonSocialNombre", label: "Nombre Completo" }
      ];
    } else if (nuevoCliente.tipoDocumentoId === "06") {
      return [
        { key: "numeroDocumento", label: "Número de Documento", minLength: 11 },
        { key: "razonSocialNombre", label: "Razón Social" },
        { key: "direccion.direccionLineal", label: "Dirección" },
      ];
    }
    return [];
  }, [nuevoCliente.tipoDocumentoId]);

  const validateAll = (): boolean => {
    const newErrors: Record<string, boolean> = {};
    const newLengthErrors: Record<string, string> = {};

    if (isSuperAdmin && sucursalIdEfectivo === 0) {
      newErrors.sucursalId = true;
    }

    requiredFields.forEach(field => {
      const value = field.key.includes('.')
        ? field.key.split('.').reduce((o: any, k) => o?.[k], nuevoCliente)
        : (nuevoCliente as any)[field.key];

      if (!value || value.trim() === '') {
        newErrors[field.key] = true;
        return;
      }

      // validar longitud solo si ya tiene contenido
      if (field.key === "numeroDocumento") {
        if (nuevoCliente.tipoDocumentoId === "01" && value.length !== 8) {
          newLengthErrors.numeroDocumento = "El DNI debe tener 8 dígitos";
        }

        if (nuevoCliente.tipoDocumentoId === "06" && value.length !== 11) {
          newLengthErrors.numeroDocumento = "El RUC debe tener 11 dígitos";
        }
      }
    });

    setErrors(newErrors);
    setLengthErrors(newLengthErrors);

    return Object.keys(newErrors).length === 0 && Object.keys(newLengthErrors).length === 0;
  };

  //N Crear Nuevo Cliente
  const handleNuevoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Si hay algún campo obligatorio vacío, no continuar
    if (!validateAll() || isSubmitting) return; 
    setIsSubmitting(true);

    try {
      let payload: any = {
        numeroDocumento: nuevoCliente.numeroDocumento,
        razonSocialNombre: nuevoCliente.razonSocialNombre,
        tipoDocumentoId: nuevoCliente.tipoDocumentoId,
        sucursalID: sucursalIdEfectivo
      };

      // ── DNI ──
      const emptyToNull = (val: string) => val.trim() === '' ? null : val;
      if (nuevoCliente.tipoDocumentoId === "01") {
        if (nuevoCliente.correo) payload.correo = nuevoCliente.correo;
        if (nuevoCliente.telefono) payload.telefono = nuevoCliente.telefono;
        const d = nuevoCliente.direccion;
        const tieneDireccion = d.direccionLineal || d.tipoDireccion;
        if (tieneDireccion) {
          payload.direccion = {
            ubigeo: null,
            direccionLineal: emptyToNull(d.direccionLineal),
            departamento: null,
            provincia: null,
            distrito: null,
            tipoDireccion: emptyToNull(d.tipoDireccion)
          };
        }
      }

      // ── RUC ──
      if (nuevoCliente.tipoDocumentoId === "06") {
        payload = {
          ...payload,
          telefono: nuevoCliente.telefono,
          correo: nuevoCliente.correo,
          direccion: {
            ubigeo: nuevoCliente.direccion.ubigeo,
            direccionLineal: nuevoCliente.direccion.direccionLineal,
            departamento: nuevoCliente.direccion.departamento,
            provincia: nuevoCliente.direccion.provincia,
            distrito: nuevoCliente.direccion.distrito,
            tipoDireccion: nuevoCliente.direccion.tipoDireccion
          }
        };
      }

      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/Cliente`, payload,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      showToast('Cliente guardado exitosamente', 'success');
      setClientes(prev => [response.data, ...prev]);
      setNuevoCliente(nuevoClienteInicial);
      setErrors({});
      setIsNuevoOpen(false);
    } catch (error) {
      if (axios.isAxiosError(error)) {
      const status = error.response?.status;

      if (status === 409) {
        showToast(error.response?.data?.mensaje, "info"); // este sí es útil para el usuario
      } else if (status === 400) {
        showToast("Los datos ingresados no son válidos.", "error");
      } else {
        showToast("No se pudo registrar el cliente. Intenta nuevamente.", "error");
      }
      } else {
        showToast("Error inesperado. Intenta nuevamente.", "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelarNuevo = () => {
    setNuevoCliente(nuevoClienteInicial);
    setErrors({});
    setLengthErrors({});
    setSucursalSeleccionada(0);
    setIsNuevoOpen(false);
  };

  const handleEliminar = async (clienteId: number) => {
      try {
        await axios.delete(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Cliente/${clienteId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        showToast("Cliente eliminado correctamente.", "success");
        setClientes(prev => prev.filter(c => c.clienteId !== clienteId));
      } catch (error) {
        console.error("Error al eliminar cliente:", error);

        if (axios.isAxiosError(error)) {
          if (!error.response) {
            showToast("Sin conexión. Verifica tu internet e intenta nuevamente.", "error");
          } else {
            const status = error.response.status;
            if (status === 404) {
              showToast("No se encontró el cliente a eliminar.", "error");
            } else if (status === 403) {
              showToast("No tienes permisos para eliminar este cliente.", "error");
            } else {
              showToast("No se pudo eliminar el cliente. Intenta nuevamente.", "error");
            }
          }
        } else {
          showToast("Error inesperado. Intenta nuevamente.", "error");
        }
      }
    };

  // ── Filtros ──
  const filtered = useMemo(() => clientes.filter(c => {
    const matchSearch =
      (c.razonSocialNombre ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.numeroDocumento ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.correo ?? "").includes(search);
    const estadoStr = c.estado ? 'Activo' : 'Inactivo';
    const matchStatus = filterStatus === 'Todos' || estadoStr === filterStatus;
    const matchTipo = filterTipo === 'Todos' || c.tipoDocumento.tipoDocumentoNombre === filterTipo;
    const matchSucursal = !filtroSucursal || c.sucursalID === filtroSucursal;
    return matchSearch && matchStatus && matchTipo && matchSucursal;
  }), [clientes, search, filterStatus, filterTipo, filtroSucursal]);

  const activeFilters = (filterStatus !== 'Todos' ? 1 : 0) + (filterTipo !== 'Todos' ? 1 : 0);
  const totalWidth = isSuperAdmin ? 1400 : 1270; 

  return (
  <div className="space-y-3 animate-in fade-in duration-500">

    {/* ── Modales ────────────────────────────────────────────────────────── */}
    {clienteCorreo && (
      <EnviarCorreoCliente
        cliente={clienteCorreo}
        onClose={() => setClienteCorreo(null)}
      />
    )}
    {clienteEditar && (
      <EditarClienteModal
        cliente={clienteEditar}
        onClose={() => setClienteEditar(null)}
        onSave={(clienteActualizado) => {
          setClientes(prev =>
            prev.map(c =>
              c.clienteId === clienteActualizado.clienteId
                ? clienteActualizado
                : c
            )
          );
        }}
      />
    )}
    {eliminarCliente && (
      <ModalEliminar
        isOpen={true}
        mensaje="Eliminarás permanentemente al cliente"
        nombre={eliminarCliente.razonSocialNombre}
        documento={eliminarCliente.numeroDocumento}
        onClose={() => setEliminarCliente(null)}
        onConfirm={() => handleEliminar(eliminarCliente.clienteId)}
      />
    )}

    {/* ── Barra de búsqueda y filtros ──────────────────────────────────── */}
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="relative flex-1 max-w-md">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por RUC, DNI o Nombre..."
          className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all shadow-sm text-xs"
        />
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        {isSuperAdmin && (
          <DropdownFiltro
            label="Sucursal: Todas"
            value={filtroSucursal ? (sucursales.find(s => s.sucursalId === filtroSucursal)?.nombre ?? "Todos") : "Todos"}
            options={["Todos", ...sucursales.map(s => s.nombre)]}
            onChange={(v) => {
              if (v === "Todos") setFiltroSucursal(0);
              else {
                const found = sucursales.find(s => s.nombre === v);
                setFiltroSucursal(found ? found.sucursalId : 0);
              }
            }}
          />
        )}
        <DropdownFiltro
          label="Tipo Doc: Todos"
          value={filterTipo}
          options={["Todos", "RUC", "DNI", "CE"]}
          onChange={(v) => setFilterTipo(v as any)}
        />
        <Button onClick={() => setIsNuevoOpen(true)} className="py-2.5 px-3 text-xs rounded-md h-auto">
          <Plus className="w-3.5 h-3.5" /> Nuevo Cliente
        </Button>
      </div>
    </div>

    {/* ── Contador ── */}
    <div className="flex items-center justify-between">
      <p className="text-sm text-gray-500">
        Mostrando <span className="font-semibold text-gray-900">{filtered.length}</span> de <span className="font-semibold text-gray-900">{clientes.length}</span> clientes
      </p>
    </div>

    {/* ── Estilos tabla ── */}
<style>{`
  .clientes-table tbody {
    display: block;
    overflow-y: auto;
    max-height: calc(100vh - ${isBeta ? 280 : 220}px);
    scrollbar-width: thin;
    scrollbar-color: #CBD5E1 transparent;
  }
  .clientes-table thead tr,
  .clientes-table tbody tr {
    display: table;
    width: 100%;
    table-layout: fixed;
  }
  .clientes-table thead {
    width: 100%;
  }
`}</style>

<Card className="p-0 overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full text-left border-collapse clientes-table" style={{minWidth: 900}}>
      <thead>
        <tr className="bg-gray-100" style={{borderTopLeftRadius: '12px', borderTopRightRadius: '12px', overflow: 'hidden'}}>
          <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">DOCUMENTO</th>
          <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">RAZÓN SOCIAL</th>
          <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">DIRECCIÓN</th>
          {isSuperAdmin && (<th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">SUCURSAL</th>)}
          <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-44 whitespace-normal wrap-break-word">CORREO</th>
          <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">TELÉFONO</th>
          <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">FECHA</th>
          <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">ESTADO</th>
          <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-36">ACCIONES</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {loadingClientes ? (
          <tr>
            <td colSpan={isSuperAdmin ? 10 : 9} className="px-6 py-16 text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-brand-blue rounded-full animate-spin" />
                Cargando clientes...
              </div>
            </td>
          </tr>
        ) : filtered.length === 0 ? (
          <tr>
            <td colSpan={isSuperAdmin ? 10 : 9} className="px-6 py-16 text-center text-sm text-gray-400">
              No se encontraron clientes con ese criterio.
            </td>
          </tr>
        ) : filtered.map((client) => (
          <tr key={client.clienteId} className="hover:bg-gray-50/50 transition-colors">
            <td className="px-5 py-2 w-24">
              <p className="text-xs font-bold text-gray-400 uppercase">{client.tipoDocumento.tipoDocumentoNombre}</p>
              <p className="text-sm font-mono text-gray-700">{client.numeroDocumento}</p>
            </td>
            <td className="text-[12px] px-5 py-2 text-sm font-semibold text-gray-900 w-40">{client.razonSocialNombre}</td>
            <td className="px-5 py-2 text-sm text-gray-600 w-40">
              {formatDireccion(client.direccion, client.tipoDocumento.tipoDocumentoId)}
            </td>
            {isSuperAdmin && (
              <td className="px-5 py-2 text-sm text-gray-600 w-24">
                {sucursales.find(s => s.sucursalId === client.sucursalID)?.nombre ?? "-"}
              </td>
            )}
            <td className="px-5 py-2 text-sm text-gray-600 w-44 whitespace-normal wrap-break-word">{client.correo ?? '-'}</td>
            <td className="px-5 py-2 text-sm text-gray-600 w-20">{client.telefono ?? '-'}</td>
            <td className="px-5 py-2 text-sm text-gray-500 w-24">{formatFecha(client.fechaCreacion)}</td>
            <td className="px-5 py-2 w-16">
              <Badge variant={client.estado ? 'success' : 'default'}>
                {client.estado ? 'Activo' : 'Inactivo'}
              </Badge>
            </td>
            <td className="px-5 py-2 w-36">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setClienteCorreo(client)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Send size={12} /> Correo
                </button>
                <button
                  onClick={() => setClienteEditar(client)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <Edit2 size={12} />
                </button>
                <button
                  onClick={() => setEliminarCliente(client)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</Card>

    {/* ── Modal: Nuevo Cliente ──────────────────────────────────────────── */}
    <AgregarCliente
      isOpen={isNuevoOpen}
      nuevoCliente={nuevoCliente}
      errors={errors}
      lengthErrors={lengthErrors}
      isSubmitting={isSubmitting}
      setNuevoCliente={setNuevoCliente}
      setErrors={setErrors}
      setLengthErrors={setLengthErrors}
      handleNuevoSubmit={handleNuevoSubmit}
      handleCancelarNuevo={handleCancelarNuevo}
      isSuperAdmin={isSuperAdmin}
      sucursales={sucursales}
      sucursalSeleccionada={sucursalSeleccionada}
      setSucursalSeleccionada={setSucursalSeleccionada}
      errorSucursal={!!errors.sucursalId}
    />
  </div>
  );
}


