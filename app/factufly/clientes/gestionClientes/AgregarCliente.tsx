"use client";

import React, { useEffect } from "react";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { InputBase } from "@/app/components/ui/InputBase";
import { useToast } from "@/app/components/ui/Toast";
import { Sucursal } from "../../operaciones/boleta/gestionBoletas/Boleta";
import { consultaDni } from "@/app/components/apiConsultasJsonPe/consultaDni";
import { consultaRuc } from "@/app/components/apiConsultasJsonPe/consultaRuc";
import { consultaCe } from "@/app/components/apiConsultasJsonPe/consultaCe";

interface AgregarClienteProps {
  isOpen: boolean;
  nuevoCliente: any;
  errors: Record<string, boolean>;
  lengthErrors: Record<string, string>;
  setNuevoCliente: React.Dispatch<React.SetStateAction<any>>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setLengthErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleNuevoSubmit: (e: React.FormEvent) => void;
  handleCancelarNuevo: () => void;
  isSubmitting: boolean;
  isSuperAdmin: boolean;
  sucursales: Sucursal[];
  sucursalSeleccionada: number;
  setSucursalSeleccionada: React.Dispatch<React.SetStateAction<number>>;
  errorSucursal: boolean;
}

export const AgregarCliente: React.FC<AgregarClienteProps> = ({
  isOpen,
  nuevoCliente,
  errors,
  lengthErrors,
  setNuevoCliente,
  setErrors,
  setLengthErrors,
  handleNuevoSubmit,
  handleCancelarNuevo,
  isSubmitting,
  isSuperAdmin,
  sucursales,
  sucursalSeleccionada,
  setSucursalSeleccionada,
  errorSucursal,
  }) => {

  const { showToast } = useToast();
  const [mostrarDireccion, setMostrarDireccion] = React.useState(false); 

  useEffect(() => {
    setNuevoCliente((prev: any) => ({ 
      ...prev, 
      razonSocialNombre: "",
      direccion: {
        ...prev.direccion,
        direccionLineal: "",
        departamento: "",
        provincia: "",
        distrito: "",
        ubigeo: "",
      }
    }));
  }, [nuevoCliente.numeroDocumento]);

  const buscarDni = async () => {
    if (nuevoCliente.numeroDocumento.length !== 8) {
      setLengthErrors(prev => ({ ...prev, numeroDocumento: "El DNI debe tener 8 dígitos" }));
      return;
    }
    setLengthErrors(prev => ({ ...prev, numeroDocumento: "" }));

    try {
      const result = await consultaDni(nuevoCliente.numeroDocumento);
      if (result) {
        setNuevoCliente((prev: any) => ({ ...prev, razonSocialNombre: result.nombreCompleto }));
      } else {
        showToast("No se encontró el DNI, verifica el número o llénalo manualmente.", "info");
      }
    } catch {
      showToast("Error al conectar con la API, llena los datos manualmente.", "error");
    }
  };

  const buscarRuc = async () => {
    if (nuevoCliente.numeroDocumento.length !== 11) {
      setLengthErrors(prev => ({ ...prev, numeroDocumento: "El RUC debe tener 11 dígitos" }));
      return;
    }
    setLengthErrors(prev => ({ ...prev, numeroDocumento: "" }));

    try {
      const result = await consultaRuc(nuevoCliente.numeroDocumento);
      if (result) {
        setNuevoCliente((prev: any) => ({
          ...prev,
          razonSocialNombre: result.razonSocial,
          direccion: {
            ...prev.direccion,
            direccionLineal: result.direccionLineal,
            departamento: result.departamento,
            provincia: result.provincia,
            distrito: result.distrito,
            ubigeo: result.ubigeo,
          },
        }));
      } else {
        showToast("No se encontró el RUC, verifica el número o llénalo manualmente.", "info");
      }
    } catch {
      showToast("Error al conectar con la API, llena los datos manualmente.", "error");
    }
  };

  const buscarCe = async () => {
    if (nuevoCliente.numeroDocumento.length !== 9) {
      setLengthErrors(prev => ({ ...prev, numeroDocumento: "El CE debe tener 9 dígitos" }));
      return;
    }
    setLengthErrors(prev => ({ ...prev, numeroDocumento: "" }));

    try {
      const result = await consultaCe(nuevoCliente.numeroDocumento);
      if (result) {
        setNuevoCliente((prev: any) => ({ ...prev, razonSocialNombre: result.nombreCompleto }));
      } else {
        showToast("No se encontró el CE, verifica el número o llénalo manualmente.", "info");
      }
    } catch {
      showToast("Error al conectar con la API, llena los datos manualmente.", "error");
    }
  };

  //Elegimos que funcion usar
  const buscarDocumento = () => {
    if (nuevoCliente.tipoDocumentoId === "01") buscarDni();
    if (nuevoCliente.tipoDocumentoId === "06") buscarRuc();
    if (nuevoCliente.tipoDocumentoId === "07") buscarCe();
  };

  return (
  <Modal
    isOpen={isOpen}
    onClose={handleCancelarNuevo}
    title="Registrar Nuevo Cliente"
  >
    <form className="space-y-4" onSubmit={handleNuevoSubmit}>

      {isSuperAdmin && (
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
            Sucursal <span className="text-rose-500">*</span>
          </label>
          <select
            value={sucursalSeleccionada}
            onChange={(e) => {
          setSucursalSeleccionada(Number(e.target.value));
            if (errors.sucursalId) setErrors((prev) => ({ ...prev, sucursalId: false }));
          }}
            className={`w-full px-4 py-2 bg-gray-50 border rounded-xl outline-none focus:border-brand-blue ${
              errorSucursal ? "border-rose-400" : "border-gray-200"
            }`}
          >
            <option value={0}>Seleccione una sucursal</option>
            {sucursales.map((s) => (
              <option key={s.sucursalId} value={s.sucursalId}>
                {s.nombre}
              </option>
            ))}
          </select>
          {errorSucursal && (
            <p className="text-xs text-rose-500 font-medium">Debe seleccionar una sucursal</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-500 uppercase">
            Tipo Documento
          </label>

          <select
            value={nuevoCliente.tipoDocumentoId}
            onChange={(e) => {
              setNuevoCliente((f: any) => ({ 
                ...f, 
                tipoDocumentoId: e.target.value,
                numeroDocumento: "",
                razonSocialNombre: "",
              }));
              setMostrarDireccion(false);
            }}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue"
          >
            <option value="01">DNI</option>
            <option value="06">RUC</option>
            <option value="07">CE</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <InputBase
                label="Número"
                value={nuevoCliente.numeroDocumento}
                onChange={(e) => {
                  const soloNumeros = e.target.value.replace(/\D/g, "");
                  const limite = nuevoCliente.tipoDocumentoId === "01" ? 8 : 11;

                  setNuevoCliente((f: any) => ({
                    ...f,
                    numeroDocumento: soloNumeros.slice(0, limite)
                  }));

                  if (errors.numeroDocumento) {
                    setErrors((prev) => ({ ...prev, numeroDocumento: false }));
                  }

                  if (lengthErrors.numeroDocumento) {
                    setLengthErrors((prev) => ({ ...prev, numeroDocumento: "" }));
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    buscarDocumento();
                  }
                }}
                placeholder="Ej:87654321"
                maxLength={nuevoCliente.tipoDocumentoId === "01" ? 8 : nuevoCliente.tipoDocumentoId === "07" ? 9 : 11}
                showError={!!errors.numeroDocumento || !!lengthErrors.numeroDocumento}
                errorMessage={
                  errors.numeroDocumento
                    ? "Campo obligatorio"
                    : lengthErrors.numeroDocumento
                }
              />
            </div>
              <button
                type="button"
                onClick={buscarDocumento}
                className="mt-6 h-10 px-3 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 shrink-0"
              >
                Buscar
              </button>
          </div>
        </div>
      </div>

      <InputBase
        label={
          nuevoCliente.tipoDocumentoId === "06"
            ? "Razón Social"
            : "Nombre Completo"
        }
        value={nuevoCliente.razonSocialNombre}
        onChange={(e) => {
          setNuevoCliente((f: any) => ({ ...f, razonSocialNombre: e.target.value}));
          if (errors.razonSocialNombre) {
            setErrors((prev) => ({ ...prev, razonSocialNombre: false}));
          }
        }}
        placeholder={
          nuevoCliente.tipoDocumentoId === "06"
            ? "Ej: Aceros S.A.C."
            : "Ej: Juan Perez Neira"
        }
        showError={!!errors.razonSocialNombre}
      />

      <InputBase
        label="Correo Electrónico"
        labelOptional="(opcional)"
        value={nuevoCliente.correo}
        onChange={(e) =>
          setNuevoCliente((f: any) => ({ ...f, correo: e.target.value}))
        }
        placeholder="cliente@ejemplo.com"
        showError={false}
      />

      <InputBase
        label="Teléfono"
        labelOptional="(opcional)"
        value={nuevoCliente.telefono}
        onChange={(e) =>
          setNuevoCliente((f: any) => ({ ...f, telefono: e.target.value}))
        }
        placeholder="Ej: 987654321"
        showError={false}
      />

      {nuevoCliente.tipoDocumentoId === "06" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputBase
            label="Ubigeo"
            labelOptional="(opcional)"
            value={nuevoCliente.direccion.ubigeo}
            onChange={(e) => {
              setNuevoCliente((f: any) => ({ ...f, direccion: { ...f.direccion, ubigeo: e.target.value} }));
            }}
            placeholder="Ubigeo"
            showError={false}
          />

          <InputBase
            label="Dirección"
            value={nuevoCliente.direccion.direccionLineal}
            onChange={(e) => {
              setNuevoCliente((f: any) => ({ ...f, direccion: {...f.direccion, direccionLineal: e.target.value} }));
              if (errors["direccion.direccionLineal"]) {
                setErrors((prev) => ({ ...prev, ["direccion.direccionLineal"]: false }));
              }
            }}
            placeholder="Ej: Av. Perú n° 123"
            showError={!!errors["direccion.direccionLineal"]}
          />

          <InputBase
            label="Distrito"
            labelOptional="(opcional)"
            value={nuevoCliente.direccion.distrito}
            onChange={(e) => {
              setNuevoCliente((f: any) => ({ ...f, direccion: { ...f.direccion, distrito: e.target.value } }));
            }}
            placeholder="Distrito"
            showError={false}
          />

          <InputBase
            label="Provincia"
            labelOptional="(opcional)"
            value={nuevoCliente.direccion.provincia}
            onChange={(e) => {
              setNuevoCliente((f: any) => ({  ...f, direccion: { ...f.direccion, provincia: e.target.value } }));
            }}
            placeholder="Provincia"
            showError={false}
          />

          <InputBase
            label="Departamento"
            labelOptional="(opcional)"
            value={nuevoCliente.direccion.departamento}
            onChange={(e) => {
              setNuevoCliente((f: any) => ({ ...f, direccion: { ...f.direccion, departamento: e.target.value } }));
            }}
            placeholder="Departamento"
            showError={false}
          />

          <InputBase
            label="Tipo Dirección"
            labelOptional="(opcional)"
            value={nuevoCliente.direccion.tipoDireccion}
            onChange={(e) =>
              setNuevoCliente((f: any) => ({ ...f, direccion: { ...f.direccion, tipoDireccion: e.target.value } }))
            }
            placeholder="Dirección fiscal"
            showError={false}
          />
        </div>
      ): (
        // DNI / CE → dirección opcional
        <div>
          <button
            type="button"
            onClick={() => setMostrarDireccion((prev) => !prev)}
            className="text-sm font-semibold text-brand-blue hover:underline flex items-center gap-1"
          >
            {mostrarDireccion ? "▲ Ocultar dirección" : "▼ Agregar dirección (opcional)"}
          </button>

          {mostrarDireccion && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <InputBase
                label="Dirección"
                labelOptional="(opcional)"
                value={nuevoCliente.direccion.direccionLineal}
                onChange={(e) =>
                  setNuevoCliente((f: any) => ({ ...f, direccion: { ...f.direccion, direccionLineal: e.target.value } }))
                }
                placeholder="Ej: Av. Perú n° 123 - Cajamarca"
                showError={false}
              />
              <InputBase
                label="Tipo Dirección"
                labelOptional="(opcional)"
                value={nuevoCliente.direccion.tipoDireccion}
                onChange={(e) =>
                  setNuevoCliente((f: any) => ({ ...f, direccion: { ...f.direccion, tipoDireccion: e.target.value } }))
                }
                placeholder="Dirección fiscal"
                showError={false}
              />
            </div>
          )}
        </div>
      )
    }

      <div className="pt-4 flex justify-end gap-3">
        <Button variant="outline" type="button" onClick={handleCancelarNuevo}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : "Guardar Cliente"}
        </Button>
      </div>
    </form>
  </Modal>
  );
  };
