"use client";

import { useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useClientesRuc } from "./useClientesRuc";

// ── Misma función que tu EditarCliente ──
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type LogEntry = {
  ruc: string;
  nombre: string;
  status: "ok" | "sin_datos" | "error" | "ya_tiene";
  detalle?: string;
};

export default function RellenoMasivoRuc() {
  const { accessToken } = useAuth();
  const { clientes, loadingClientes } = useClientesRuc(true); // true = superadmin para traer todos
  const [corriendo, setCorriendo] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [progreso, setProgreso] = useState(0);
  const [total, setTotal] = useState(0);

  // Clientes RUC sin dirección
  const sinDireccion = clientes.filter(
    (c) =>
      c.tipoDocumento.tipoDocumentoId === "06" &&
      (!c.direccion || c.direccion.length === 0 || !c.direccion[0]?.direccionLineal)
  );

  const addLog = (entry: LogEntry) =>
    setLog((prev) => [entry, ...prev]); // más reciente arriba

  const handleEjecutar = async () => {
    if (corriendo) return;
    setCorriendo(true);
    setLog([]);
    setProgreso(0);
    setTotal(sinDireccion.length);

    for (let i = 0; i < sinDireccion.length; i++) {
      const cliente = sinDireccion[i];
      setProgreso(i + 1);

      try {
        const resultado = await consultaRuc(cliente.numeroDocumento);

        if (!resultado || !resultado.direccionLineal) {
          addLog({ ruc: cliente.numeroDocumento, nombre: cliente.razonSocialNombre, status: "sin_datos" });
          await sleep(300);
          continue;
        }

        // PUT cliente (igual que tu EditarCliente)
        await axios.put(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Cliente/${cliente.clienteId}`,
          {
            clienteId: cliente.clienteId,
            razonSocialNombre: resultado.razonSocial || cliente.razonSocialNombre,
            numeroDocumento: cliente.numeroDocumento,
            telefono: cliente.telefono,
            correo: cliente.correo,
          },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        // POST o PUT dirección (igual que tu EditarCliente)
        const payloadDireccion = {
          direccionLineal: resultado.direccionLineal,
          ubigeo: resultado.ubigeo,
          departamento: resultado.departamento,
          provincia: resultado.provincia,
          distrito: resultado.distrito,
          tipoDireccion: null,
        };

        const direccionExistente = cliente.direccion?.[0];
        if (direccionExistente?.direccionId && direccionExistente.direccionId > 0) {
          await axios.put(
            `${process.env.NEXT_PUBLIC_API_URL}/api/Direccion/${direccionExistente.direccionId}`,
            { ...payloadDireccion, direccionId: direccionExistente.direccionId },
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
        } else {
          await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/api/Direccion/direccion`,
            { ...payloadDireccion, clienteId: cliente.clienteId },
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
        }

        addLog({ ruc: cliente.numeroDocumento, nombre: resultado.razonSocial || cliente.razonSocialNombre, status: "ok" });
      } catch (err) {
        addLog({
          ruc: cliente.numeroDocumento,
          nombre: cliente.razonSocialNombre,
          status: "error",
          detalle: axios.isAxiosError(err) ? `HTTP ${err.response?.status}` : "Error desconocido",
        });
      }

      // 400ms entre requests para no martillar la API
      await sleep(400);
    }

    setCorriendo(false);
  };

  const resumen = {
    ok: log.filter((l) => l.status === "ok").length,
    sin_datos: log.filter((l) => l.status === "sin_datos").length,
    error: log.filter((l) => l.status === "error").length,
  };

  if (loadingClientes) {
    return <p className="text-sm text-gray-500 p-6">Cargando clientes...</p>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-sm text-amber-800 font-medium">
        ⚠️ Herramienta temporal — eliminar este componente después de usarlo.
      </div>

      {/* Info */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-1">
        <p className="text-sm text-gray-600">
          Clientes RUC <strong>sin dirección</strong>:{" "}
          <span className="text-lg font-bold text-gray-900">{sinDireccion.length}</span>
        </p>
        <p className="text-xs text-gray-400">
          Se consultará SUNAT por cada RUC y se guardará dirección + razón social. Se saltarán los que SUNAT no devuelva datos.
        </p>
      </div>

      {/* Botón */}
      <button
        onClick={handleEjecutar}
        disabled={corriendo || sinDireccion.length === 0}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
      >
        {corriendo ? `Procesando ${progreso} / ${total}...` : `Ejecutar (${sinDireccion.length} clientes)`}
      </button>

      {/* Barra progreso */}
      {corriendo && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${total > 0 ? (progreso / total) * 100 : 0}%` }}
          />
        </div>
      )}

      {/* Resumen */}
      {log.length > 0 && (
        <div className="flex gap-4 text-sm font-semibold">
          <span className="text-green-600">✓ Ok: {resumen.ok}</span>
          <span className="text-gray-400">— Sin datos SUNAT: {resumen.sin_datos}</span>
          <span className="text-red-500">✗ Error: {resumen.error}</span>
        </div>
      )}

      {/* Log */}
      {log.length > 0 && (
        <div className="bg-gray-950 rounded-xl p-4 max-h-96 overflow-y-auto space-y-1 font-mono text-xs">
          {log.map((entry, i) => (
            <div key={i} className="flex gap-3">
              <span
                className={
                  entry.status === "ok"
                    ? "text-green-400"
                    : entry.status === "sin_datos"
                    ? "text-yellow-400"
                    : "text-red-400"
                }
              >
                {entry.status === "ok" ? "✓ OK      " : entry.status === "sin_datos" ? "~ SIN_DAT " : "✗ ERROR   "}
              </span>
              <span className="text-gray-400">{entry.ruc}</span>
              <span className="text-gray-200 truncate">{entry.nombre}</span>
              {entry.detalle && <span className="text-red-300">{entry.detalle}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}