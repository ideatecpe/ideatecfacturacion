import { useState } from "react";
import axios from "axios";
import { Button } from "@/app/components/ui/Button";
import { InputBase } from "@/app/components/ui/InputBase";
import { Modal } from "@/app/components/ui/Modal";
import { Cliente, Direccion } from "./typesCliente";
import { useToast } from "@/app/components/ui/Toast";
import { ChevronDown, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface Props {
  cliente: Cliente;
  onClose: () => void;
  onSave: (c: Cliente) => void;
}

const consultaRuc = async (ruc: string) => {
  const res = await fetch("https://api.json.pe/api/ruc", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_JSONPE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ruc }),
  });

  const data = await res.json();
  if (!data.success || !data.data) return null;

  const d = data.data;
  return {
    razonSocial: d.nombre_o_razon_social || "",
    direccionLineal: d.direccion || "",
    departamento: d.departamento || "",
    provincia: d.provincia || "",
    distrito: d.distrito || "",
    ubigeo: d.ubigeo_sunat || "",
  };
};

export const EditarClienteModal: React.FC<Props> = ({
  cliente,
  onClose,
  onSave,
}) => {
  const { showToast } = useToast();
  const { accessToken } = useAuth();
  const [form, setForm] = useState<Cliente>({ ...cliente });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRellenando, setIsRellenando] = useState(false);
  const [mostrarDireccion, setMostrarDireccion] = useState(
    !!(cliente.direccion && cliente.direccion.length > 0),
  );

  const updateForm = (campo: keyof Cliente, valor: any) => {
    setForm((f) => ({ ...f, [campo]: valor }));
  };

  const updateDireccion = (campo: keyof Direccion, valor: string) => {
    setForm((f) => {
      const direccionBase =
        f.direccion && f.direccion.length > 0
          ? f.direccion[0]
          : {
              direccionId: 0,
              ubigeo: "",
              direccionLineal: "",
              departamento: "",
              provincia: "",
              distrito: "",
              tipoDireccion: "",
            };
      return {
        ...f,
        direccion: [{ ...direccionBase, [campo]: valor }],
      };
    });
  };

  // ─── Botón Rellenar ───
  const handleRellenar = async () => {
    if (isRellenando) return;
    setIsRellenando(true);
    try {
      const resultado = await consultaRuc(form.numeroDocumento);
      if (!resultado) {
        showToast("No se encontraron datos para este RUC.", "info");
        return;
      }

      setForm((f) => {
        const direccionActual =
          f.direccion && f.direccion.length > 0
            ? f.direccion[0]
            : { direccionId: 0, tipoDireccion: "" };

        return {
          ...f,
          razonSocialNombre: resultado.razonSocial || f.razonSocialNombre,
          direccion: [
            {
              ...direccionActual,
              direccionLineal: resultado.direccionLineal,
              departamento: resultado.departamento,
              provincia: resultado.provincia,
              distrito: resultado.distrito,
              ubigeo: resultado.ubigeo,
            },
          ],
        };
      });

      showToast("Datos rellenados desde SUNAT.", "success");
    } catch {
      showToast("Error al consultar el RUC. Intenta nuevamente.", "error");
    } finally {
      setIsRellenando(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!form.razonSocialNombre || form.razonSocialNombre.trim() === "") {
      showToast(
        form.tipoDocumento.tipoDocumentoId === "06"
          ? "La razón social es obligatoria."
          : "El nombre completo es obligatorio.",
        "info",
      );
      return;
    }

    setIsSubmitting(true);

    const emptyToNull = (val: string | null | undefined) =>
      !val || val.trim() === "" ? null : val;

    try {
      const payloadCliente = {
        clienteId: form.clienteId,
        razonSocialNombre: form.razonSocialNombre,
        numeroDocumento: form.numeroDocumento,
        telefono: form.telefono,
        correo: form.correo,
      };

      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Cliente/${form.clienteId}`,
        payloadCliente,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (form.direccion && form.direccion.length > 0) {
        const d = form.direccion[0];
        const tieneDatos = esDni
          ? d.direccionLineal || d.tipoDireccion
          : d.direccionLineal

        if (tieneDatos) {
          const payloadDireccion = esDni
            ? {
                direccionLineal: emptyToNull(d.direccionLineal),
                ubigeo: null,
                departamento: null,
                provincia: null,
                distrito: null,
                tipoDireccion: emptyToNull(d.tipoDireccion),
              }
            : {
                direccionLineal: d.direccionLineal,
                ubigeo: d.ubigeo,
                departamento: d.departamento,
                provincia: d.provincia,
                distrito: d.distrito,
                tipoDireccion: d.tipoDireccion,
              };

          if (d.direccionId && d.direccionId > 0) {
            await axios.put(
              `${process.env.NEXT_PUBLIC_API_URL}/api/Direccion/${d.direccionId}`,
              { ...payloadDireccion, direccionId: d.direccionId },
              { headers: { Authorization: `Bearer ${accessToken}` } },
            );
          } else {
            await axios.post(
              `${process.env.NEXT_PUBLIC_API_URL}/api/Direccion/direccion`,
              { ...payloadDireccion, clienteId: form.clienteId },
              { headers: { Authorization: `Bearer ${accessToken}` } },
            );
          }
        }
      }

      showToast("Cliente actualizado correctamente.", "success");
      onSave(form);
      onClose();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 400)
          showToast("Los datos ingresados no son válidos.", "error");
        else if (status === 404)
          showToast("No se encontró el cliente a actualizar.", "error");
        else
          showToast(
            "No se pudo actualizar el cliente. Intenta nuevamente.",
            "error",
          );
      } else {
        showToast("Error inesperado. Intenta nuevamente.", "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const esDni = form.tipoDocumento.tipoDocumentoId !== "06";

  return (
    <Modal isOpen onClose={onClose} title="Editar Cliente" className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-500 uppercase block">
              Tipo Documento
            </label>
            <select
              value={form.tipoDocumento.tipoDocumentoId}
              disabled
              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none text-gray-700 font-medium"
            >
              <option value="01">DNI</option>
              <option value="06">RUC</option>
              <option value="07">CE</option>
            </select>
          </div>

          {/* Número + botón Rellenar solo para RUC */}
          <div className="space-y-1">
            <InputBase
              label="Número"
              value={form.numeroDocumento}
              disabled
              showError={false}
              compact
            />
            {!esDni && (
              <button
                type="button"
                onClick={handleRellenar}
                disabled={isRellenando}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-blue hover:text-brand-blue/80 disabled:opacity-50 transition-colors pt-0.5"
              >
                <RefreshCw
                  className={`w-3 h-3 ${isRellenando ? "animate-spin" : ""}`}
                />
                {isRellenando ? "Consultando..." : "Rellenar desde SUNAT"}
              </button>
            )}
          </div>
        </div>

        <InputBase
          label={
            form.tipoDocumento.tipoDocumentoId === "06"
              ? "Razón Social"
              : "Nombre Completo"
          }
          value={form.razonSocialNombre}
          onChange={(e) => updateForm("razonSocialNombre", e.target.value)}
          showError={false}
          compact
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InputBase
            label="Correo Electrónico"
            labelOptional="(opcional)"
            value={form.correo ?? ""}
            onChange={(e) => updateForm("correo", e.target.value || null)}
            showError={false}
            compact
          />

          <InputBase
            label="Teléfono"
            labelOptional="(opcional)"
            value={form.telefono ?? ""}
            onChange={(e) => updateForm("telefono", e.target.value || null)}
            showError={false}
            compact
          />
        </div>

        {/* ───────── Dirección RUC — siempre visible ───────── */}
        {!esDni && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-gray-50/60 p-3 rounded-xl border border-gray-200">
            <InputBase
              label="Ubigeo"
              labelOptional="(opcional)"
              value={form.direccion?.[0]?.ubigeo ?? ""}
              onChange={(e) => updateDireccion("ubigeo", e.target.value)}
              showError={false}
              compact
            />
            <InputBase
              label="Dirección"
              value={form.direccion?.[0]?.direccionLineal ?? ""}
              onChange={(e) =>
                updateDireccion("direccionLineal", e.target.value)
              }
              showError={false}
              compact
            />
            <InputBase
              label="Distrito"
              labelOptional="(opcional)"
              value={form.direccion?.[0]?.distrito ?? ""}
              onChange={(e) => updateDireccion("distrito", e.target.value)}
              showError={false}
              compact
            />
            <InputBase
              label="Provincia"
              labelOptional="(opcional)"
              value={form.direccion?.[0]?.provincia ?? ""}
              onChange={(e) => updateDireccion("provincia", e.target.value)}
              showError={false}
              compact
            />
            <InputBase
              label="Departamento"
              labelOptional="(opcional)"
              value={form.direccion?.[0]?.departamento ?? ""}
              onChange={(e) => updateDireccion("departamento", e.target.value)}
              showError={false}
              compact
            />
            <InputBase
              label="Tipo Dirección"
              labelOptional="(opcional)"
              value={form.direccion?.[0]?.tipoDireccion ?? ""}
              onChange={(e) => updateDireccion("tipoDireccion", e.target.value)}
              showError={false}
              compact
            />
          </div>
        )}

        {/* ───────── Dirección DNI/CE — opcional con toggle ───────── */}
        {esDni && (
          <div
            className={`border rounded-xl transition-colors ${mostrarDireccion ? "border-brand-blue/40 bg-gray-50/30" : "border-gray-200"}`}
          >
            <button
              type="button"
              onClick={() => setMostrarDireccion((prev) => !prev)}
              className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-gray-600 hover:text-brand-blue transition-colors cursor-pointer"
            >
              <span>Dirección (opcional)</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${mostrarDireccion ? "rotate-180" : ""}`}
              />
            </button>

            {mostrarDireccion && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 px-3.5 pb-3">
                <InputBase
                  label="Dirección"
                  labelOptional="(opcional)"
                  value={form.direccion?.[0]?.direccionLineal ?? ""}
                  onChange={(e) =>
                    updateDireccion("direccionLineal", e.target.value)
                  }
                  showError={false}
                  compact
                />
                <InputBase
                  label="Tipo Dirección"
                  labelOptional="(opcional)"
                  value={form.direccion?.[0]?.tipoDireccion ?? ""}
                  onChange={(e) =>
                    updateDireccion("tipoDireccion", e.target.value)
                  }
                  showError={false}
                  compact
                />
              </div>
            )}
          </div>
        )}

        <div className="pt-2 flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={onClose} className="px-3.5 py-1.5 text-xs">
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting} className="px-4 py-1.5 text-xs">
            {isSubmitting ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
