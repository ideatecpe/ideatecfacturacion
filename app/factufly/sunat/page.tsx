"use client";
import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Eye,
  EyeOff,
  ChevronDown,
  Info,
  AlertTriangle,
  Loader2,
  Lock,
} from "lucide-react";
import axios from "axios";
import { useToast } from "@/app/components/ui/Toast";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { cn } from "@/app/utils/cn";
import { CertificadoDigitalCard } from "@/app/components/sunartComponentes/Certificadodigitalcard";
import { useAuth } from "@/context/AuthContext";
import { EstadoConexionSunatCard } from "@/app/components/sunartComponentes/Estadoconexionsunatcard";
import { ApisSunat } from "@/app/utils/ApisSunat";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Config {
  solUser: string;
  solPassword: string;
  clientId: string;
  clientSecret: string;
  environment: "production" | "beta";
  saved: boolean;
}

export interface CompanyData {
  certificadoPem: string | null;
  certificadoPassword: string | null;
  environment: string;
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────
interface ConfirmModalProps {
  open: boolean;
  environment: "production" | "beta";
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({
  open,
  environment,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;
  const isProduccion = environment === "production";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
        <div
          className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4",
            isProduccion ? "bg-emerald-50" : "bg-amber-50",
          )}
        >
          <ShieldCheck
            className={cn(
              "w-6 h-6",
              isProduccion ? "text-emerald-600" : "text-amber-600",
            )}
          />
        </div>
        <h3 className="text-base font-bold text-gray-900 text-center mb-1">
          ¿Confirmar configuración de SUNAT?
        </h3>
        <p className="text-xs text-gray-500 text-center mb-5">
          Estás a punto de guardar las credenciales para el entorno de{" "}
          <span
            className={cn(
              "font-bold",
              isProduccion ? "text-emerald-600" : "text-amber-600",
            )}
          >
            {isProduccion ? "Producción" : "Beta / Homologación"}
          </span>
        </p>
        <div
          className={cn(
            "p-3 rounded-xl border flex gap-2 text-xs mb-5",
            isProduccion
              ? "bg-emerald-50 border-emerald-100 text-emerald-700"
              : "bg-amber-50 border-amber-100 text-amber-700",
          )}
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            {isProduccion
              ? "Estas credenciales se usarán para emitir comprobantes electrónicos reales ante SUNAT. Asegúrate de que los datos sean correctos."
              : "Estas credenciales corresponden al ambiente de pruebas. Los comprobantes emitidos no tendrán validez tributaria."}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-sm hover:shadow-md",
              isProduccion
                ? "bg-[#023e7d] hover:bg-[#012f5e]"
                : "bg-amber-500 hover:bg-amber-600",
            )}
          >
            Sí, guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SecretInput ──────────────────────────────────────────────────────────────
interface SecretInputProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  hint?: string;
  disabled?: boolean;
}

function SecretInput({
  label,
  placeholder,
  value,
  onChange,
  required,
  hint,
  disabled,
}: SecretInputProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          className={cn(
            "w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm pr-10 transition-colors",
            disabled
              ? "opacity-50 cursor-not-allowed"
              : "focus:border-brand-blue/50",
          )}
        />
        {!disabled && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {show ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        )}
        {disabled && (
          <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
        )}
      </div>
      {hint && <p className="text-[10px] text-gray-400 italic">{hint}</p>}
    </div>
  );
}

// ─── TextInput ────────────────────────────────────────────────────────────────
interface TextInputProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  hint?: string;
  disabled?: boolean;
}

function TextInput({
  label,
  placeholder,
  value,
  onChange,
  required,
  hint,
  disabled,
}: TextInputProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </label>
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          className={cn(
            "w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm transition-colors",
            disabled
              ? "opacity-50 cursor-not-allowed pr-10"
              : "focus:border-brand-blue/50",
          )}
        />
        {disabled && (
          <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
        )}
      </div>
      {hint && <p className="text-[10px] text-gray-400 italic">{hint}</p>}
    </div>
  );
}

// ─── ReadOnly Banner ──────────────────────────────────────────────────────────
function ReadOnlyBanner() {
  return (
    <div className="flex items-center gap-2 p-3 rounded-xl border border-gray-100 bg-gray-50 text-xs text-gray-500">
      <Lock className="w-3.5 h-3.5 shrink-0 text-gray-400" />
      Solo los administradores pueden modificar estas credenciales.
    </div>
  );
}

// ─── Collapsible Section ──────────────────────────────────────────────────────
interface CollapsibleProps {
  title: string;
  subtitle: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: React.ReactNode;
}

function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
  badge,
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors text-left"
        onClick={() => setOpen(!open)}
      >
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-gray-900">{title}</p>
            {badge}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-gray-400 transition-transform shrink-0 ml-4",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="px-6 pb-6 border-t border-gray-100 pt-5">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── InfoBanner ───────────────────────────────────────────────────────────────
function InfoBanner({
  children,
  variant = "info",
}: {
  children: React.ReactNode;
  variant?: "info" | "warning";
}) {
  const styles = {
    info: "bg-blue-50 border-blue-100 text-blue-700",
    warning: "bg-amber-50 border-amber-100 text-amber-700",
  };
  const Icon = variant === "warning" ? AlertTriangle : Info;
  return (
    <div
      className={cn(
        "p-3 rounded-xl border flex gap-2 text-xs",
        styles[variant],
      )}
    >
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <p>{children}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SunatPage() {
  const { showToast } = useToast();
  const { user, setEnvironment, accessToken } = useAuth();



  // ── Permisos ──────────────────────────────────────────────────────────────
  const canEditCredentials =
    user?.rol === "superadmin" || user?.rol === "admin";

  const [config, setConfig] = useState<Config>({
    solUser: "",
    solPassword: "",
    clientId: "",
    clientSecret: "",
    environment: "production",
    saved: false,
  });

  const [envLoaded, setEnvLoaded] = useState(false);
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [igv, setIgv] = useState<"18" | "10.5">("18");

  const upd = (key: keyof Config) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setConfig((c) => ({ ...c, [key]: e.target.value, saved: false }));

  // ── Fetch inicial ─────────────────────────────────────────────────────────
  useEffect(() => {
    const ruc = user?.ruc;
    if (!ruc) {
      if (user) setLoadingCompany(false);
      return;
    }

    const fetchCompany = async () => {
      setLoadingCompany(true);
      try {
        const res = await axios.get(`${ApisSunat.getCompany(user.ruc)}?t=${Date.now()}`, {
          headers: { 
            Authorization: `Bearer ${accessToken}`,
            "Cache-Control": "no-cache",
            "Pragma": "no-cache"
          },
        });
        let data = res.data;
        // Si el backend devuelve un array, tomamos el primer elemento
        if (Array.isArray(data)) {
          data = data[0];
        }

        if (!data) {
          setLoadingCompany(false);
          return;
        }

        setCompanyData({
          certificadoPem: data.certificadoPem ?? null,
          certificadoPassword: data.certificadoPassword ?? null,
          environment: data.environment ?? "production",
        });

        setConfig({
          solUser: data.solUsuario ?? "",
          solPassword: data.solClave ?? "",
          clientId: data.clientId ?? "",
          clientSecret: data.clientSecret ?? "",
          environment: data.environment === "beta" ? "beta" : "production",
          saved: !!(data.solUsuario && data.solClave),
        });

        setIgv((String(data.igv ?? "18") as "18" | "10.5"));

        setEnvLoaded(true);
      } catch {
        showToast("Error al cargar la configuración de SUNAT", "error");
        setEnvLoaded(true);
      } finally {
        setLoadingCompany(false);
      }
    };

    fetchCompany();
  }, [user?.ruc]);

  // ── Submit → abre modal de confirmación ──────────────────────────────────
  const handleSubmitIntent = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  // ── Confirmado → guarda ───────────────────────────────────────────────────
  const handleConfirmSave = async () => {
    setShowConfirm(false);
    setSavingConfig(true);
    try {
      // Si no puede editar credenciales, solo guarda el entorno
      const body = canEditCredentials
        ? {
            solUsuario: config.solUser || null,
            solClave: config.solPassword || null,
            environment: config.environment,
            clientId: config.clientId || null,
            clientSecret: config.clientSecret || null,
            logoBase64: user?.logoBase64 ?? null,
            igv: igv,
          }
        : {
            environment: config.environment,
            logoBase64: user?.logoBase64 ?? null,
            igv: igv,
          };

      await axios.put(ApisSunat.updateCompany(user!.ruc), body, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setEnvironment(config.environment);
      setConfig((c) => ({ ...c, saved: true }));
      showToast("Configuración guardada correctamente", "success");
    } catch {
      showToast("Error al guardar la configuración", "error");
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <>
      <ConfirmModal
        open={showConfirm}
        environment={config.environment}
        onConfirm={handleConfirmSave}
        onCancel={() => setShowConfirm(false)}
      />

      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <EstadoConexionSunatCard className="lg:col-span-2" />
          <CertificadoDigitalCard
            ruc={user?.ruc ?? ""}
            initialData={companyData}
            loadingInitial={loadingCompany}
            logoBase64={user?.logoBase64 ?? null}
          />
        </div>

        <form onSubmit={handleSubmitIntent} className="space-y-4">
          {/* ── Entorno — cualquier usuario puede cambiar ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <p className="text-sm font-bold text-gray-900 mb-1">
              Entorno de Operación
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Define si trabajas en producción real o en pruebas con SUNAT
            </p>

            {!envLoaded ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-pulse">
                <div className="h-20 bg-gray-100 rounded-xl" />
                <div className="h-20 bg-gray-100 rounded-xl" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(
                  [
                    {
                      key: "production",
                      label: "Producción",
                      desc: "Comprobantes reales enviados a SUNAT",
                      accent: "emerald",
                    },
                    {
                      key: "beta",
                      label: "Beta / Homologación",
                      desc: "Ambiente de pruebas de SUNAT",
                      accent: "amber",
                    },
                  ] as const
                ).map((env) => (
                  <label
                    key={env.key}
                    className={cn(
                      "flex items-start gap-3 p-4 rounded-xl border cursor-default transition-all",
                      config.environment === env.key
                        ? env.accent === "emerald"
                          ? "border-emerald-300 bg-emerald-50/60"
                          : "border-amber-300 bg-amber-50/60"
                        : "border-gray-200 bg-gray-50/30",
                    )}
                  >
                    <input
                      type="radio"
                      name="environment"
                      value={env.key}
                      checked={config.environment === env.key}
                      onChange={() => {}}
                      className="mt-0.5 accent-brand-blue pointer-events-none"
                    />
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        {env.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{env.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* ── Credenciales SOL — solo admin/superadmin ── */}
          <CollapsibleSection
            defaultOpen
            title="Credenciales SOL"
            subtitle="Usuario y Clave SOL de SUNAT — requeridas para todos los comprobantes electrónicos"
            badge={
              config.solUser && config.solPassword ? (
                <Badge variant="success">Configurado</Badge>
              ) : (
                <Badge variant="error">Requerido</Badge>
              )
            }
          >
            <div className="space-y-2">
              {loadingCompany ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-10 bg-gray-100 rounded-xl" />
                  <div className="h-10 bg-gray-100 rounded-xl" />
                </div>
              ) : (
                <>
                  <InfoBanner variant="info">
                    Las credenciales SOL son necesarias para autenticarse con
                    SUNAT y enviar Facturas, Boletas y Notas de Crédito/Débito.
                    Obtenlas en{" "}
                    <strong>sunat.gob.pe → Operaciones en Línea (SOL)</strong>.
                  </InfoBanner>

                  {/* Aviso si no tiene permiso */}
                  {!canEditCredentials && <ReadOnlyBanner />}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextInput
                      label="Usuario SOL"
                      placeholder="Ej: 20601234567ADMIN"
                      value={config.solUser}
                      onChange={upd("solUser")}
                      disabled={!canEditCredentials}
                      hint="Formato: RUC + nombre de usuario SOL registrado en SUNAT"
                    />
                    <SecretInput
                      label="Clave SOL"
                      placeholder="••••••••"
                      value={config.solPassword}
                      onChange={upd("solPassword")}
                      disabled={!canEditCredentials}
                      hint="Clave de acceso a los servicios en línea de SUNAT"
                    />
                  </div>
                </>
              )}
            </div>
          </CollapsibleSection>

          {/* ── Guía de Remisión — solo admin/superadmin ── */}
          <CollapsibleSection
            title="Guía de Remisión Electrónica"
            subtitle="Client ID y Client Secret requeridos solo para emitir Guías de Remisión Electrónicas"
            badge={
              config.clientId && config.clientSecret ? (
                <Badge variant="success">Configurado</Badge>
              ) : (
                <Badge variant="info">Opcional</Badge>
              )
            }
          >
            <div className="space-y-4">
              {loadingCompany ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-10 bg-gray-100 rounded-xl" />
                  <div className="h-10 bg-gray-100 rounded-xl" />
                </div>
              ) : (
                <>
                  <InfoBanner variant="info">
                    Las Guías de Remisión Electrónicas requieren credenciales
                    adicionales proporcionadas por SUNAT. No se requieren para
                    Facturas ni Boletas.
                  </InfoBanner>

                  {/* Aviso si no tiene permiso */}
                  {!canEditCredentials && <ReadOnlyBanner />}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextInput
                      label="Client ID"
                      placeholder="Tu Client ID de SUNAT"
                      value={config.clientId}
                      onChange={upd("clientId")}
                      disabled={!canEditCredentials}
                      hint="ID de cliente proporcionado por SUNAT para guías de remisión"
                    />
                    <SecretInput
                      label="Client Secret"
                      placeholder="••••••••••••••••"
                      value={config.clientSecret}
                      onChange={upd("clientSecret")}
                      disabled={!canEditCredentials}
                      hint="Secreto de cliente proporcionado por SUNAT para guías de remisión"
                    />
                  </div>
                </>
              )}
            </div>
          </CollapsibleSection>

          {/* ── Tipo de IGV Aplicado ── */}
          <CollapsibleSection
            title="Tipo de IGV Aplicado"
            subtitle="Tasa de IGV predeterminada en tus comprobantes"
            badge={<Badge variant="info">Estático</Badge>}
          >
            <div className="space-y-4">
              <InfoBanner variant="info">
                La tasa seleccionada se aplicará por defecto al crear cualquier
                comprobante electrónico. Podrás modificarla individualmente en
                cada comprobante si el caso lo requiere.
              </InfoBanner>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(
                  [
                    { key: "18", label: "18%", desc: "Tasa general del IGV" },
                    {
                      key: "10.5",
                      label: "10.5%",
                      desc: "Tasa reducida aplicable a ciertos sectores",
                    },
                  ] as const
                ).map((tasa) => (
                  <label
                    key={tasa.key}
                    className={cn(
                      "flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                      igv === tasa.key
                        ? "border-[#023e7d] bg-blue-50/60"
                        : "border-gray-200 hover:border-gray-300 bg-gray-50/30",
                    )}
                  >
                    <input
                      type="radio"
                      name="igv"
                      value={tasa.key}
                      checked={igv === tasa.key}
                      onChange={() => setIgv(tasa.key)}
                      className="mt-0.5 accent-brand-blue"
                    />
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        {tasa.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {tasa.desc}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </CollapsibleSection>

      {/* Botón guardar GLOBAL — más prominente y consistente con Empresa */}
      {canEditCredentials && !loadingCompany && (
        <div className="sticky bottom-6 flex justify-end z-20">
          <Button
            type="submit"
            className="h-11 px-8 rounded-xl  hover:shadow-blue-500"
            disabled={savingConfig || loadingCompany}
          >
            {savingConfig ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Guardando cambios...
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5 mr-2" />
                Guardar Configuración SUNAT
              </>
            )}
          </Button>
        </div>
      )}
        </form>
      </div>
    </>
  );
}
