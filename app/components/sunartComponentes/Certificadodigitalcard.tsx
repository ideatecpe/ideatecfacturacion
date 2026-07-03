"use client";
import React, { useState, useRef, useEffect } from "react";
import {
  Upload, CheckCircle2, FileJson, ShieldCheck,
  Loader2, AlertTriangle, Eye, EyeOff, Lock,
} from "lucide-react";
import axios from "axios";
import { Button }   from "@/app/components/ui/Button";
import { Card }     from "@/app/components/ui/Card";
import { Modal }    from "@/app/components/ui/Modal";
import { cn }       from "@/app/utils/cn";
import { useToast } from "@/app/components/ui/Toast";
import { useAuth }  from "@/context/AuthContext";
import { ApisSunat } from "@/app/utils/ApisSunat";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CompanyData {
  certificadoPem: string | null;
  certificadoPassword: string | null;
  environment: string;
}

interface CertificadoDigitalCardProps {
  ruc: string;
  initialData?: CompanyData | null;
  loadingInitial?: boolean;
  logoBase64?: string | null; 
}

// ─── Parse cert expiry from PEM base64 ───────────────────────────────────────
function parseCertExpiry(pemBase64: string): { notBefore: Date | null; notAfter: Date | null } {
  try {
    const clean  = pemBase64.replace(/\s/g, "");
    const binary = atob(clean);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const pemText = new TextDecoder("utf-8").decode(bytes);

    const certMatch = pemText.match(/-----BEGIN CERTIFICATE-----([\s\S]+?)-----END CERTIFICATE-----/);
    if (!certMatch) return { notBefore: null, notAfter: null };

    const derB64 = certMatch[1].replace(/\s/g, "");
    const derBin = atob(derB64);
    const der    = new Uint8Array(derBin.length);
    for (let i = 0; i < derBin.length; i++) der[i] = derBin.charCodeAt(i);

    const parseDerDate = (bytes: Uint8Array, offset: number): Date | null => {
      const tag = bytes[offset];
      const len = bytes[offset + 1];
      const str = String.fromCharCode(...bytes.slice(offset + 2, offset + 2 + len));
      if (tag === 0x17) {
        const yy   = parseInt(str.slice(0, 2));
        const year = yy >= 50 ? 1900 + yy : 2000 + yy;
        return new Date(`${year}-${str.slice(2,4)}-${str.slice(4,6)}T${str.slice(6,8)}:${str.slice(8,10)}:${str.slice(10,12)}Z`);
      } else if (tag === 0x18) {
        return new Date(`${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}T${str.slice(8,10)}:${str.slice(10,12)}:${str.slice(12,14)}Z`);
      }
      return null;
    };

    let i = 0;
    const dates: Date[] = [];
    while (i < der.length - 2 && dates.length < 2) {
      const tag = der[i];
      if (tag === 0x17 || tag === 0x18) {
        const d = parseDerDate(der, i);
        if (d) dates.push(d);
        i += 2 + der[i + 1];
      } else if (tag === 0x30 || tag === 0xa0 || tag === 0xa3) {
        const lenByte = der[i + 1];
        if (lenByte & 0x80) { const n = lenByte & 0x7f; i += 2 + n; }
        else                 { i += 2; }
      } else {
        const lenByte = der[i + 1];
        if (lenByte & 0x80) {
          const n = lenByte & 0x7f;
          let len = 0;
          for (let b = 0; b < n; b++) len = (len << 8) | der[i + 2 + b];
          i += 2 + n + len;
        } else {
          i += 2 + lenByte;
        }
      }
    }
    return { notBefore: dates[0] ?? null, notAfter: dates[1] ?? null };
  } catch {
    return { notBefore: null, notAfter: null };
  }
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(d: Date | null): number | null {
  if (!d) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

// ─── FileDrop ─────────────────────────────────────────────────────────────────
function FileDrop({ onFile, accept }: { onFile: (file: File) => void; accept: string }) {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const handle = (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    onFile(file);
  };

  return (
    <div
      className={cn(
        "p-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center space-y-3 cursor-pointer transition-colors bg-gray-50/50",
        dragging ? "border-brand-blue bg-blue-50/50" : "border-gray-200 hover:border-brand-blue",
      )}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e)    => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]); }}
      onClick={() => ref.current?.click()}
    >
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
      />
      {fileName ? (
        <>
          <div className="p-3 bg-emerald-50 rounded-xl shadow-sm">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-700">{fileName}</p>
            <p className="text-xs text-gray-500 mt-1">Clic para cambiar archivo</p>
          </div>
        </>
      ) : (
        <>
          <div className="p-3 bg-white rounded-xl shadow-sm">
            <FileJson className="w-8 h-8 text-brand-blue" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Selecciona tu archivo .pfx o .p12</p>
            <p className="text-xs text-gray-500 mt-1">O arrastra y suelta el archivo aquí</p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── PEM Display ──────────────────────────────────────────────────────────────
function PemDisplay({ pem }: { pem: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-gray-500 uppercase">Certificado PEM generado</label>
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
          <CheckCircle2 className="w-3 h-3" /> Válido
        </span>
      </div>
      <textarea
        readOnly
        value={pem}
        rows={6}
        className="w-full px-3 py-2.5 bg-gray-900 text-emerald-400 font-mono text-[10px] border border-gray-700 rounded-xl outline-none resize-none leading-relaxed"
      />
      <p className="text-[10px] text-gray-400 italic">
        Este PEM se guardará junto con tu certificado para firmar comprobantes.
      </p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export function CertificadoDigitalCard({
  ruc,
  initialData,
  loadingInitial,
  logoBase64, 
}: CertificadoDigitalCardProps) {
  const { showToast } = useToast();
  const { accessToken, user } = useAuth();

  // ── Permisos: solo superadmin y admin pueden editar ──────────────────────
  const canEdit = user?.rol === "superadmin" || user?.rol === "admin";

  const [company, setCompany]               = useState<CompanyData | null>(initialData ?? null);
  const [loadingCompany, setLoadingCompany] = useState(
    initialData !== undefined ? (loadingInitial ?? false) : true,
  );

  const [isModalOpen, setIsModalOpen]             = useState(false);
  const [certFile, setCertFile]                   = useState<File | null>(null);
  const [certPasswordInput, setCertPasswordInput] = useState("");
  const [showPassword, setShowPassword]           = useState(false);
  const [saving, setSaving]                       = useState(false);

  type Step = "idle" | "uploading" | "converting" | "saving" | "done" | "error";
  const [step, setStep]           = useState<Step>("idle");
  const [pemResult, setPemResult] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  // ── Sincronizar cuando el padre actualiza ────────────────────────────────
  useEffect(() => {
    if (initialData !== undefined) {
      setCompany(initialData);
      setLoadingCompany(loadingInitial ?? false);
    }
  }, [initialData, loadingInitial]);

  // ── Fetch propio — solo si no vienen datos del padre ────────────────────
  useEffect(() => {
    if (initialData !== undefined) return;
    if (!ruc) return;

    const fetchCompany = async () => {
      setLoadingCompany(true);
      try {
        const res = await axios.get(`${ApisSunat.getCompany(ruc)}?t=${Date.now()}`, {
          headers: { 
            Authorization: `Bearer ${accessToken}`,
            "Cache-Control": "no-cache",
            "Pragma": "no-cache"
          },
        });
        let data = res.data;
        if (Array.isArray(data)) {
          data = data[0];
        }
        setCompany(data);
      } catch {
        showToast("Error al cargar datos del certificado", "error");
      } finally {
        setLoadingCompany(false);
      }
    };
    fetchCompany();
  }, [ruc]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ──────────────────────────────────────────────────────────────
  const hasCert        = !!(company?.certificadoPem && company?.certificadoPassword);
  const certExpiry     = hasCert ? parseCertExpiry(company!.certificadoPem!) : { notBefore: null, notAfter: null };
  const daysLeft       = daysUntil(certExpiry.notAfter);
  const isExpiringSoon = daysLeft !== null && daysLeft <= 30 && daysLeft > 0;
  const isExpired      = daysLeft !== null && daysLeft <= 0;

  const totalDays   = certExpiry.notBefore && certExpiry.notAfter
    ? Math.ceil((certExpiry.notAfter.getTime() - certExpiry.notBefore.getTime()) / 86400000)
    : 0;
  const elapsedDays = certExpiry.notBefore && daysLeft !== null ? totalDays - daysLeft : 0;
  const barPct      = totalDays > 0 ? Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100)) : 0;
  const barColor    = isExpired ? "bg-rose-500" : isExpiringSoon ? "bg-amber-400" : barPct > 75 ? "bg-orange-400" : "bg-emerald-500";

  const statusLabel = !hasCert
    ? "Sin certificado"
    : isExpired
    ? "Vencido"
    : isExpiringSoon
    ? `Vence en ${daysLeft} días`
    : `${daysLeft} días restantes`;

  const statusColor = !hasCert
    ? "text-gray-400"
    : isExpired
    ? "text-rose-600"
    : isExpiringSoon
    ? "text-amber-600"
    : "text-emerald-600";

  const details = [
    ["RUC",     ruc],
    ["Tipo",    hasCert ? "PFX / P12" : "—"],
    ["Archivo", hasCert ? "Cargado"   : "No cargado"],
  ];

  // ── Cerrar modal ─────────────────────────────────────────────────────────
  const closeModal = () => {
    setIsModalOpen(false);
    setCertFile(null);
    setCertPasswordInput("");
    setShowPassword(false);
    setStep("idle");
    setPemResult(null);
    setStepError(null);
  };

  // ── Paso 1: archivo → base64 ─────────────────────────────────────────────
  const uploadToBase64 = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await axios.post<{ base64: string }>(
      ApisSunat.uploadCertificateBase64,
      formData,
      { headers: { "Content-Type": "multipart/form-data", Authorization: `Bearer ${accessToken}` } },
    );
    return res.data.base64;
  };

  // ── Paso 2: base64 + contraseña → PEM ───────────────────────────────────
  const convertToPem = async (certBase64: string, password: string): Promise<string> => {
    const res = await axios.post<{ pem: string; cer: string }>(
      ApisSunat.convertCertificate,
      { cert: certBase64, certPass: password },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return res.data.pem;
  };

  // ── Submit del modal ─────────────────────────────────────────────────────
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit)          return;
    if (!certFile)         { showToast("Selecciona un archivo .pfx o .p12", "error"); return; }
    if (!certPasswordInput){ showToast("Ingresa la contraseña del certificado", "error"); return; }

    setSaving(true);
    setStepError(null);
    setPemResult(null);

    try {
      setStep("uploading");
      const base64 = await uploadToBase64(certFile);
      if (!base64) throw new Error("No se pudo obtener el base64 del archivo");

      setStep("converting");
      const pem = await convertToPem(base64, certPasswordInput);
      if (!pem) throw new Error("No se pudo obtener el PEM del certificado");

      setStep("saving");
      await axios.put(
        ApisSunat.updateCompany(ruc),
        { certificadoPem: pem, certificadoPassword: certPasswordInput, logoBase64: logoBase64 ?? null,  },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      setCompany((prev) =>
        prev
          ? { ...prev, certificadoPem: pem, certificadoPassword: certPasswordInput }
          : { certificadoPem: pem, certificadoPassword: certPasswordInput, environment: "production" },
      );

      setPemResult(pem);
      setStep("done");
      showToast(hasCert ? "Certificado actualizado correctamente" : "Certificado cargado correctamente", "success");
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? err.response?.data ?? err.message)
        : (err instanceof Error ? err.message : "Error desconocido");
      setStepError(typeof msg === "string" ? msg : JSON.stringify(msg));
      setStep("error");
      showToast("Error al procesar el certificado", "error");
    } finally {
      setSaving(false);
    }
  };

  const submitLabel = () => {
    if (step === "uploading")  return "Subiendo archivo...";
    if (step === "converting") return "Convirtiendo a PEM...";
    if (step === "saving")     return "Guardando certificado...";
    return hasCert ? "Actualizar Certificado" : "Cargar Certificado";
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <Card title="Certificado Digital (.pfx o .p12)" subtitle="Validación y vigencia">
        <div className="space-y-2">
          {loadingCompany ? (
            <div className="space-y-4 animate-pulse">
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 space-y-3">
                <div className="flex justify-between">
                  <div className="h-3 w-16 bg-gray-200 rounded" />
                  <div className="h-3 w-24 bg-gray-200 rounded" />
                </div>
                <div className="h-2 w-full bg-gray-200 rounded-full" />
                <div className="h-3 w-40 bg-gray-100 rounded" />
              </div>
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-3 w-12 bg-gray-100 rounded" />
                    <div className="h-3 w-20 bg-gray-100 rounded" />
                  </div>
                ))}
              </div>
              <div className="h-9 bg-gray-100 rounded-xl" />
            </div>
          ) : (
            <>
              {/* Barra de vigencia */}
              <div className="p-3 rounded-xl border border-gray-100 bg-gray-50/60 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Vigencia</span>
                  <span className={cn("text-xs font-semibold", statusColor)}>{statusLabel}</span>
                </div>
                <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", hasCert ? barColor : "bg-gray-200")}
                    style={{ width: hasCert ? `${barPct}%` : "0%" }}
                  />
                </div>
                <p className="text-[11px] text-gray-400">
                  {hasCert && certExpiry.notBefore && certExpiry.notAfter
                    ? `${formatDate(certExpiry.notBefore)} → ${formatDate(certExpiry.notAfter)}`
                    : "Cargue un certificado para determinar la cantidad de días."}
                </p>
                {isExpired && (
                  <div className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Este certificado ha vencido. Renuévalo para seguir emitiendo comprobantes.
                  </div>
                )}
                {isExpiringSoon && !isExpired && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Renueva tu certificado pronto para evitar interrupciones.
                  </div>
                )}
              </div>

              {/* Detalles */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Detalles del Certificado</p>
                <div className="space-y-1.5">
                  {details.map(([k, v]) => (
                    <div key={String(k)} className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">{k}:</span>
                      <span className={cn("font-medium", v === "No cargado" ? "text-rose-500" : "text-gray-900")}>
                        {v ?? "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Aviso de solo lectura para roles sin permiso */}
              {!canEdit && (
                <div className="flex items-center gap-2 p-3 rounded-xl border border-gray-100 bg-gray-50 text-xs text-gray-500">
                  <Lock className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  Solo los administradores pueden modificar el certificado digital.
                </div>
              )}

              {/* Botón — deshabilitado si no tiene permiso */}
              <Button
                type="button"
                className="w-full"
                disabled={!canEdit}
                onClick={() => canEdit && setIsModalOpen(true)}
                title={!canEdit ? "No tienes permisos para modificar el certificado" : undefined}
              >
                {canEdit
                  ? <Upload className="w-4 h-4" />
                  : <Lock className="w-4 h-4" />
                }
                {hasCert ? "Actualizar Certificado" : "Subir Certificado"}
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* Modal — solo se abre si canEdit */}
      <Modal
        isOpen={isModalOpen && canEdit}
        onClose={closeModal}
        title={hasCert ? "Actualizar Certificado Digital" : "Cargar Certificado Digital"}
      >
        <form className="space-y-4" onSubmit={handleUpload}>
          <div className="p-3 rounded-xl border border-amber-100 bg-amber-50 flex gap-2 text-xs text-amber-700">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              El certificado digital firma electrónicamente todos tus comprobantes. Asegúrate de que
              sea válido y emitido por una entidad certificadora autorizada por SUNAT.
            </p>
          </div>

          <FileDrop accept=".pfx,.p12" onFile={setCertFile} />

          {/* Contraseña */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase">Contraseña del Certificado</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Ingresa la clave del certificado"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50 text-sm pr-20"
                value={certPasswordInput}
                onChange={(e) => setCertPasswordInput(e.target.value)}
                required
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <ShieldCheck className="w-4 h-4 text-gray-400" />
              </div>
            </div>
            <p className="text-[10px] text-gray-400 italic">
              Esta contraseña es necesaria para firmar digitalmente tus comprobantes.
            </p>
          </div>

          {/* Indicador de pasos */}
          {(step === "uploading" || step === "converting" || step === "saving") && (
            <div className="p-3 rounded-xl border border-blue-100 bg-blue-50/60 flex items-center gap-3 text-xs text-blue-700">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <div>
                <p className="font-semibold">
                  {step === "uploading"  ? "Paso 1/3 — Subiendo archivo..."    :
                   step === "converting" ? "Paso 2/3 — Convirtiendo a PEM..."  :
                                          "Paso 3/3 — Guardando certificado..."}
                </p>
                <p className="text-blue-500 mt-0.5">
                  {step === "uploading"  ? "Enviando el archivo .pfx al servidor."   :
                   step === "converting" ? "Extrayendo certificado en formato PEM."  :
                                          "Guardando el certificado en tu empresa."}
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {step === "error" && stepError && (
            <div className="p-3 rounded-xl border border-rose-100 bg-rose-50 flex gap-2 text-xs text-rose-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Error al procesar el certificado</p>
                <p className="mt-0.5 break-all">{stepError}</p>
              </div>
            </div>
          )}

          {/* PEM resultado */}
          {step === "done" && pemResult && <PemDisplay pem={pemResult} />}

          <div className="pt-4 flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || step === "done"}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {submitLabel()}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}