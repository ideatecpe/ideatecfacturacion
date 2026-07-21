"use client";
import React, { useState, useRef, useEffect } from "react";
import {
  Building2,
  MapPin,
  Phone,
  Upload,
  X,
  ChevronDown,
  Loader2,
  Store,
  Hash,
  Lock,
  Settings,
  Printer,
  ReceiptText,
  Layers,
} from "lucide-react";
import axios from "axios";
import { useToast } from "@/app/components/ui/Toast";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { cn } from "@/app/utils/cn";
import { useAuth } from "@/context/AuthContext";
import { LogoCropper } from "@/app/components/ui/LogoCropper";
import { QRCodeSVG } from "qrcode.react";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

// ─── Types ────────────────────────────────────────────────────────────────────
interface EmpresaForm {
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  departamento: string;
  provincia: string;
  distrito: string;
  direccion: string;
  ubigeo: string;
  telefono: string;
  email: string;
}

interface Sucursal {
  sucursalId: number;
  empresaRuc: string;
  codEstablecimiento: string;
  nombre: string;
  direccion: string;
  serieFactura: string;
  correlativoFactura: number;
  serieBoleta: string;
  correlativoBoleta: number;
  serieNotaCreditoFactura: string;
  correlativoNotaCreditoFactura: number;
  serieNotaCreditoBoleta: string;
  correlativoNotaCreditoBoleta: number;
  serieNotaDebitoFactura: string;
  correlativoNotaDebitoFactura: number;
  serieNotaDebitoBoleta: string;
  correlativoNotaDebitoBoleta: number;
  serieGuiaRemision: string;
  correlativoGuiaRemision: number;
  serieGuiaTransportista: string;
  correlativoGuiaTransportista: number;
  serieNotaVenta?: string;
  correlativoNotaVenta?: number;
  estado: boolean;
}

interface Configuracion {
  isImprime:         boolean;
  tamañoImpresion:   string;
  igv:               string;
  isConsumo:         boolean;
  guiaRemision:      boolean;
  isCredito:         boolean;
  itemsDefecto:      boolean;
  isBoletaOrFactura: string;  // "b" | "f"
  isEnvioResumen:    boolean;
  isVale:            boolean;
  deudasCobrar:      boolean;
  trabajadores:      boolean;
  cargaComprobantes: boolean;
  afectacionIgv:     boolean;
  descUnitario:      boolean;
  isStock:           boolean;
  numeroStockBajo?:  string | null;
  umbralStockBajo?:  number | null;
  useNotaVenta:      boolean;
  isCajaAutopago:    boolean;
  usaSire:           boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDataUrl(base64: string): string {
  if (!base64) return "";
  if (base64.startsWith("data:")) return base64;
  return `data:image/jpeg;base64,${base64}`;
}

function stripDataUrlPrefix(dataUrl: string): string {
  if (!dataUrl) return "";
  const idx = dataUrl.indexOf(",");
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
      {children}
      {required && <span className="text-rose-500">*</span>}
    </label>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
  required?: boolean;
  hint?: string;
  hintClassName?: string;
}
function Input({
  label,
  required,
  hint,
  hintClassName,
  disabled,
  className,
  ...props
}: InputProps) {
  return (
    <div className="space-y-1.5 mx-3">
      <FieldLabel required={required}>{label}</FieldLabel>
      <input
        required={required}
        disabled={disabled}
        className={cn(
          "w-full px-4 py-2 border rounded-xl outline-none text-sm transition-colors",
          disabled
            ? "bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed select-none"
            : "bg-white border-gray-200 focus:border-brand-blue/50",
          className,
        )}
        {...props}
      />
      {hint && (
        <p className={cn(hintClassName ?? "text-[10px] text-gray-400 italic")}>
          {hint}
        </p>
      )}
    </div>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.004 2c-5.514 0-9.99 4.476-9.99 9.99 0 1.76.462 3.48 1.34 4.997L2 22l5.148-1.35a9.955 9.955 0 0 0 4.856 1.24h.004c5.514 0 9.99-4.476 9.99-9.99C21.998 6.476 17.522 2 12.004 2zm0 18.152h-.003a8.14 8.14 0 0 1-4.15-1.137l-.298-.177-3.055.801.815-2.978-.194-.306a8.128 8.128 0 0 1-1.244-4.365c0-4.494 3.657-8.15 8.153-8.15 2.177 0 4.223.849 5.762 2.39a8.093 8.093 0 0 1 2.386 5.763c0 4.495-3.657 8.152-8.152 8.152z" />
    </svg>
  );
}


function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3 ">
      <div className="p-2 rounded-lg bg-blue-50 border border-blue-100">
        <Icon className="w-4 h-4 text-brand-blue" />
      </div>
      <div>
        <p className="text-sm font-bold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none",
        checked ? "bg-brand-blue" : "bg-gray-200",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200",
          checked ? "translate-x-4.5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

// ─── Read-only Banner ─────────────────────────────────────────────────────────
function ReadOnlyBanner() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl mb-6">
      <Lock className="w-4 h-4 text-amber-500 shrink-0" />
      <p className="text-xs text-amber-700 font-medium">
        Estás en modo de solo lectura. Contacta a un administrador para
        modificar esta información.
      </p>
    </div>
  );
}

// ─── Logo Uploader ────────────────────────────────────────────────────────────
interface LogoUploaderProps {
  logoDataUrl: string;
  uploading: boolean;
  canEdit: boolean;
  onFileSelected: (file: File, previewDataUrl: string) => void;
  onLogoRemove: () => void;
  onError: (msg: string) => void;
}
function LogoUploader({
  logoDataUrl,
  uploading,
  canEdit,
  onFileSelected,
  onLogoRemove,
  onError,
}: LogoUploaderProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number>(1);

  useEffect(() => {
    if (!logoDataUrl) {
      setAspectRatio(1);
      return;
    }
    const img = new Image();
    img.onload = () => {
      setAspectRatio(img.width / img.height);
    };
    img.src = logoDataUrl;
  }, [logoDataUrl]);

  const handle = (file: File | undefined) => {
    if (!file || !canEdit) return;
    if (
      !["image/jpeg", "image/png", "image/svg+xml", "image/webp"].includes(
        file.type,
      )
    )
      return;
    if (file.size > 2 * 1024 * 1024) {
      onError("La imagen pesa más de 2MB. Carga una imagen de máximo 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onFileSelected(file, reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="md:col-span-2 flex items-center gap-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
      <div
        className={cn(
          "h-24 bg-white rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-all duration-300",
          canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-70",
          dragging && canEdit
            ? "border-brand-blue bg-blue-50"
            : "border-gray-200 hover:border-gray-300",
        )}
        style={{
          aspectRatio: logoDataUrl ? aspectRatio : 1,
          width: logoDataUrl ? "auto" : "6rem",
          minWidth: "6rem",
        }}
        onDragOver={(e) => {
          if (!canEdit) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handle(e.dataTransfer.files[0]);
        }}
        onClick={() => canEdit && !uploading && ref.current?.click()}
      >
        {uploading ? (
          <Loader2 className="w-6 h-6 text-brand-blue animate-spin" />
        ) : logoDataUrl ? (
          <img
            src={logoDataUrl}
            alt="Logo"
            className="w-full h-full object-contain p-1 rounded-lg"
          />
        ) : (
          <Upload className="w-6 h-6 text-gray-300" />
        )}
        <input
          ref={ref}
          type="file"
          accept="image/jpeg,image/png,image/svg+xml,image/webp"
          className="hidden"
          onChange={(e) => handle(e.target.files?.[0])}
          disabled={!canEdit}
        />
      </div>
      <div className="space-y-2">
        {canEdit ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-9 text-xs"
              type="button"
              disabled={uploading}
              onClick={() => ref.current?.click()}
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading ? "Subiendo..." : "Subir Logo"}
            </Button>
            {logoDataUrl && !uploading && (
              <Button
                variant="outline"
                className="h-9 text-xs"
                type="button"
                onClick={onLogoRemove}
              >
                <X className="w-3.5 h-3.5" /> Quitar
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Lock className="w-3.5 h-3.5" />
            <span>Solo lectura</span>
          </div>
        )}
        <p className="text-[10px] text-gray-400">
          JPG, PNG, SVG o WEBP. Máximo 2MB.
          <br />
          Se mostrará en tus comprobantes electrónicos.
        </p>
      </div>
    </div>
  );
}

// ─── Sucursal Series Row ──────────────────────────────────────────────────────
function SucursalSerieRow({
  label,
  serie,
  correlativo,
  onSerieChange,
  onCorrelativoChange,
  prefix,
  hint,
  readOnly,
}: {
  label: string;
  serie: string;
  correlativo: number;
  onSerieChange: (val: string) => void;
  onCorrelativoChange: (val: number) => void;
  prefix: string;
  hint: string;
  readOnly?: boolean;
}) {
  return (
    <div className="flex gap-3 items-start">
      <div className="flex-1 space-y-1.5">
        <FieldLabel>{label} — Serie</FieldLabel>
        <input
          className={cn(
            "w-full px-4 py-2 border border-gray-200 rounded-xl outline-none text-sm transition-colors",
            readOnly
              ? "bg-gray-100 text-gray-500 cursor-not-allowed"
              : "focus:border-brand-blue/50 bg-white",
          )}
          value={serie}
          onChange={(e) => !readOnly && onSerieChange(e.target.value)}
          placeholder={hint}
          maxLength={4}
          readOnly={readOnly}
        />
        <p className="text-[10px] text-gray-400 font-medium">
          Inicia con "{prefix}"
        </p>
      </div>
      <div className="w-56 space-y-1.5">
        <FieldLabel>Correlativo inicial</FieldLabel>
        <input
          type="number"
          min={1}
          className={cn(
            "w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none text-sm transition-colors",
            readOnly
              ? "bg-gray-100 text-gray-500 cursor-not-allowed"
              : "focus:border-brand-blue/50 bg-white",
          )}
          value={correlativo}
          onChange={(e) =>
            !readOnly &&
            onCorrelativoChange(Math.max(1, parseInt(e.target.value) || 1))
          }
          readOnly={readOnly}
        />
        <p className="text-[10px] text-gray-400 font-medium">Num. inicial</p>
      </div>
    </div>
  );
}

// ─── Sucursal Card ────────────────────────────────────────────────────────────
function SucursalCard({
  sucursal,
  onChange,
  onSave,
  saving,
  readOnly,
  defaultExpanded = false,
}: {
  sucursal: Sucursal;
  onChange: (updated: Sucursal) => void;
  onSave: (s: Sucursal) => void;
  saving: boolean;
  readOnly?: boolean;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const upd = (field: keyof Sucursal) => (val: string | number) =>
    onChange({ ...sucursal, [field]: val });

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden transition-all duration-300">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3.5 bg-gray-50 border-b border-gray-100 cursor-pointer hover:bg-gray-100/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-blue-50 border border-blue-100">
            <Store className="w-4 h-4 text-brand-blue" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{sucursal.nombre}</p>
            <p className="text-xs text-gray-500">{sucursal.direccion}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-500 uppercase tracking-wide">
              Cod. {sucursal.codEstablecimiento}
            </span>
            <span
              className={cn(
                "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide",
                sucursal.estado
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                  : "bg-rose-50 text-rose-500 border border-rose-100",
              )}
            >
              {sucursal.estado ? "Activo" : "Inactivo"}
            </span>
            {readOnly && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100 uppercase tracking-wide flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Solo lectura
              </span>
            )}
          </div>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-gray-400 transition-transform duration-200",
              expanded && "rotate-180",
            )}
          />
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="animate-in slide-in-from-top-2 duration-300">
          <div className="p-5 space-y-2">
            <SucursalSerieRow
              label="Factura"
              serie={sucursal.serieFactura}
              correlativo={sucursal.correlativoFactura}
              onSerieChange={(v) => upd("serieFactura")(v)}
              onCorrelativoChange={(v) => upd("correlativoFactura")(v)}
              prefix="F"
              hint="F001"
              readOnly={readOnly}
            />
            <SucursalSerieRow
              label="Boleta"
              serie={sucursal.serieBoleta}
              correlativo={sucursal.correlativoBoleta}
              onSerieChange={(v) => upd("serieBoleta")(v)}
              onCorrelativoChange={(v) => upd("correlativoBoleta")(v)}
              prefix="B"
              hint="B001"
              readOnly={readOnly}
            />
            <SucursalSerieRow
              label="Nota de Crédito (Factura)"
              serie={sucursal.serieNotaCreditoFactura}
              correlativo={sucursal.correlativoNotaCreditoFactura}
              onSerieChange={(v) => upd("serieNotaCreditoFactura")(v)}
              onCorrelativoChange={(v) =>
                upd("correlativoNotaCreditoFactura")(v)
              }
              prefix="F"
              hint="FC01"
              readOnly={readOnly}
            />
            <SucursalSerieRow
              label="Nota de Crédito (Boleta)"
              serie={sucursal.serieNotaCreditoBoleta}
              correlativo={sucursal.correlativoNotaCreditoBoleta}
              onSerieChange={(v) => upd("serieNotaCreditoBoleta")(v)}
              onCorrelativoChange={(v) =>
                upd("correlativoNotaCreditoBoleta")(v)
              }
              prefix="B"
              hint="BC01"
              readOnly={readOnly}
            />
            <SucursalSerieRow
              label="Nota de Débito (Factura)"
              serie={sucursal.serieNotaDebitoFactura}
              correlativo={sucursal.correlativoNotaDebitoFactura}
              onSerieChange={(v) => upd("serieNotaDebitoFactura")(v)}
              onCorrelativoChange={(v) =>
                upd("correlativoNotaDebitoFactura")(v)
              }
              prefix="F"
              hint="FD01"
              readOnly={readOnly}
            />
            <SucursalSerieRow
              label="Nota de Débito (Boleta)"
              serie={sucursal.serieNotaDebitoBoleta}
              correlativo={sucursal.correlativoNotaDebitoBoleta}
              onSerieChange={(v) => upd("serieNotaDebitoBoleta")(v)}
              onCorrelativoChange={(v) => upd("correlativoNotaDebitoBoleta")(v)}
              prefix="B"
              hint="BD01"
              readOnly={readOnly}
            />
            <SucursalSerieRow
              label="Guía de Remisión"
              serie={sucursal.serieGuiaRemision}
              correlativo={sucursal.correlativoGuiaRemision}
              onSerieChange={(v) => upd("serieGuiaRemision")(v)}
              onCorrelativoChange={(v) => upd("correlativoGuiaRemision")(v)}
              prefix="T"
              hint="T001"
              readOnly={readOnly}
            />
            <SucursalSerieRow
              label="Guía Transportista"
              serie={sucursal.serieGuiaTransportista}
              correlativo={sucursal.correlativoGuiaTransportista}
              onSerieChange={(v) => upd("serieGuiaTransportista")(v)}
              onCorrelativoChange={(v) =>
                upd("correlativoGuiaTransportista")(v)
              }
              prefix="V"
              hint="V001"
              readOnly={readOnly}
            />
            {/* ── Nota de Venta (control interno, sin envío SUNAT) ── */}
            <div className="pt-2 mt-2 border-t border-amber-100">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-2">
                Control Interno <span className="normal-case font-normal">(sin validez tributaria)</span>
              </p>
              <SucursalSerieRow
                label="Nota de Venta"
                serie={sucursal.serieNotaVenta ?? ""}
                correlativo={sucursal.correlativoNotaVenta ?? 1}
                onSerieChange={(v) => upd("serieNotaVenta")(v.toUpperCase())}
                onCorrelativoChange={(v) => upd("correlativoNotaVenta")(v)}
                prefix="NV"
                hint="NV01"
                readOnly={readOnly}
              />
            </div>
          </div>

          {/* Footer — solo visible si puede editar */}
          {!readOnly && (
            <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex justify-end">
              <Button
                type="button"
                className="h-9 text-xs"
                disabled={saving}
                onClick={() => onSave(sucursal)}
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Hash className="w-3.5 h-3.5" />
                )}
                {saving ? "Guardando..." : "Guardar Series"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ConfiguracionPage() {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loadingEmpresa, setLoadingEmpresa] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [loadingSucursales, setLoadingSucursales] = useState(false);
  const [savingSucursalId, setSavingSucursalId] = useState<number | null>(null);

  const [config,        setConfig]        = useState<Configuracion | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig,  setSavingConfig]  = useState(false);

  const [configExpandida,  setConfigExpandida]  = useState(false);
  const [seriesExpandidas, setSeriesExpandidas] = useState(false);

  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [logoBase64Pure, setLogoBase64Pure] = useState<string | null>(null);

  // Cropper state
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  const { accessToken, user, refreshLogo } = useAuth();


  // ── Permisos por rol ───────────────────────────────────────────────────────
  const isSuperAdmin = user?.rol === "superadmin";
  const canEdit = user?.rol === "admin" || isSuperAdmin;
  const isFacturador = user?.rol === "facturador";

  const [form, setForm] = useState<EmpresaForm>({
    ruc: "",
    razonSocial: "",
    nombreComercial: "",
    departamento: "",
    provincia: "",
    distrito: "",
    direccion: "",
    ubigeo: "",
    telefono: "",
    email: "",
  });

  // ── GET empresa ───────────────────────────────────────────────────────────
  useEffect(() => {
    const ruc = user?.ruc;
    if (!ruc) {
      if (user) setLoadingEmpresa(false);
      return;
    }

    setLoadingEmpresa(true);
    axios
      .get(`${BASE_URL}/api/companies/${ruc}?t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      })
      .then((res) => {
        let d = res.data;
        if (Array.isArray(d)) {
          d = d[0];
        }
        if (!d) return;
        setForm({
          ruc: d.ruc ?? "",
          razonSocial: d.razonSocial ?? "",
          nombreComercial: d.nombreComercial ?? "",
          departamento: (d.departamento ?? "").toUpperCase(),
          provincia: d.provincia ?? "",
          distrito: d.distrito ?? "",
          direccion: d.direccion ?? "",
          ubigeo: d.ubigeo ?? "",
          telefono: d.telefono ?? "",
          email: d.email ?? "",
        });
      })
      .catch(() => {
        showToast("No se pudo cargar los datos de la empresa", "error");
        setLoadingEmpresa(false);
      })
      .finally(() => setLoadingEmpresa(false));

    // Cargar logo desde nueva API
    axios
      .get(`${BASE_URL}/api/companies/logo?ruc=${ruc}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then((res) => {
        const data = res.data;
        if (data.success && data.logoBase64) {
          setLogoBase64Pure(data.logoBase64);
          setLogoDataUrl(toDataUrl(data.logoBase64));
        } else {
          setLogoBase64Pure(null);
          setLogoDataUrl("");
        }
      })
      .catch(() => {
        setLogoBase64Pure(null);
        setLogoDataUrl("");
      });
  }, [user?.ruc, accessToken]);

  // ── GET sucursales ────────────────────────────────────────────────────────
  useEffect(() => {
    const ruc = user?.ruc;
    if (!ruc) return;

    setLoadingSucursales(true);

    if (isSuperAdmin) {
      axios
        .get(`${BASE_URL}/api/Sucursal?ruc=${ruc}&t=${Date.now()}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        })
        .then((res) => setSucursales(res.data ?? []))
        .catch(() => showToast("No se pudieron cargar las sucursales", "error"))
        .finally(() => setLoadingSucursales(false));
    } else {
      const sucursalId = user?.sucursalID;
      if (!sucursalId) {
        setLoadingSucursales(false);
        return;
      }
      axios
        .get(`${BASE_URL}/api/Sucursal/${sucursalId}?t=${Date.now()}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        })
        .then((res) => setSucursales([res.data]))
        .catch(() => showToast("No se pudo cargar la sucursal", "error"))
        .finally(() => setLoadingSucursales(false));
    }
  }, [user?.ruc, user?.sucursalID, isSuperAdmin, accessToken]);

  // ── Subir logo ────────────────────────────────────────────────────────────
  const handleFileSelected = (file: File, previewDataUrl: string) => {
    if (!canEdit) return;
    setImageToCrop(previewDataUrl);
  };

  const handleCropComplete = async (
    croppedDataUrl: string,
    croppedFile: File,
  ) => {
    setImageToCrop(null);
    setLogoDataUrl(croppedDataUrl);
    setLogoBase64Pure(stripDataUrlPrefix(croppedDataUrl));
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("File", croppedFile);
      await axios.post(`${BASE_URL}/api/companies/file/base64`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${accessToken}`,
        },
      });
      showToast("Logo subido y procesado correctamente", "success");
    } catch {
      setLogoDataUrl("");
      setLogoBase64Pure(null);
      showToast("Error al subir el logo. Inténtalo de nuevo.", "error");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoRemove = () => {
    if (!canEdit) return;
    setLogoDataUrl("");
    setLogoBase64Pure(null);
  };

  const upd =
    (key: keyof EmpresaForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      if (!canEdit) return;
      let value = e.target.value;

      // Validación específica para teléfono (Perú: 9 dígitos, empieza con 9)
      if (key === "telefono") {
        value = value.replace(/[^0-9\s\-]/g, "").slice(0, 25);
      }

      setForm((f) => ({ ...f, [key]: value }));
    };

  // ── GET configuración ────────────────────────────────────────────────────
  useEffect(() => {
    const ruc = user?.ruc;
    if (!ruc || !accessToken) return;
    setLoadingConfig(true);
    axios
      .get(`${BASE_URL}/api/Configuracion/${ruc}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then((res) => setConfig(res.data))
      .catch(() => showToast("No se pudo cargar la configuración", "error"))
      .finally(() => setLoadingConfig(false));
  }, [user?.ruc, accessToken]);

  // ── PUT configuración ─────────────────────────────────────────────────────
  const handleSaveConfig = async () => {
    if (!config || !canEdit) return;
    setSavingConfig(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { ...body } = config;
      await axios.put(`${BASE_URL}/api/Configuracion/${user?.ruc}`, body, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
      showToast("Configuración guardada correctamente", "success");
    } catch {
      showToast("Error al guardar la configuración", "error");
    } finally {
      setSavingConfig(false);
    }
  };

  const updConfig =
    (key: keyof Configuracion) =>
    (val: boolean | string | number) => {
      if (!canEdit) return;
      setConfig((prev) => {
        if (!prev) return prev;
        // Caja Autopago depende de Stock / Proveedores: al desactivar este último,
        // se apaga también para no dejar guardado un estado inconsistente.
        if (key === "isStock" && val === false && prev.isCajaAutopago) {
          return { ...prev, isStock: false, isCajaAutopago: false };
        }
        return { ...prev, [key]: val };
      });
    };

  // ── PUT empresa ───────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!form.ruc || !form.email) {
      showToast("Completa los campos obligatorios", "error");
      return;
    }

    // Se hace obligatorio porque la API no permite borrarlo una vez establecido
    if (!form.telefono) {
      showToast(
        "El teléfono no puede quedar vacío. Si deseas cambiarlo, ingresa el nuevo número.",
        "error",
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        razonSocial: form.razonSocial,
        nombreComercial: form.nombreComercial || null,
        direccion: form.direccion,
        ubigeo: form.ubigeo || null,
        provincia: form.provincia,
        departamento: form.departamento,
        distrito: form.distrito,
        telefono: form.telefono || null,
        email: form.email,
        logoBase64: logoBase64Pure,
      };
      await axios.put(`${BASE_URL}/api/companies/${form.ruc}`, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
      await refreshLogo();
      showToast("Datos de empresa actualizados correctamente", "success");
    } catch {
      showToast("Error al guardar los datos. Verifica tu conexión.", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── PUT sucursal ──────────────────────────────────────────────────────────
  const handleSaveSucursal = async (sucursal: Sucursal) => {
    if (!canEdit) return;
    setSavingSucursalId(sucursal.sucursalId);
    try {
      const payload = {
        sucursalId: sucursal.sucursalId,
        nombre: sucursal.nombre,
        direccion: sucursal.direccion,
        serieFactura: sucursal.serieFactura,
        correlativoFactura: sucursal.correlativoFactura,
        serieBoleta: sucursal.serieBoleta,
        correlativoBoleta: sucursal.correlativoBoleta,
        serieNotaCreditoFactura: sucursal.serieNotaCreditoFactura,
        correlativoNotaCreditoFactura: sucursal.correlativoNotaCreditoFactura,
        serieNotaCreditoBoleta: sucursal.serieNotaCreditoBoleta,
        correlativoNotaCreditoBoleta: sucursal.correlativoNotaCreditoBoleta,
        serieNotaDebitoFactura: sucursal.serieNotaDebitoFactura,
        correlativoNotaDebitoFactura: sucursal.correlativoNotaDebitoFactura,
        serieNotaDebitoBoleta: sucursal.serieNotaDebitoBoleta,
        correlativoNotaDebitoBoleta: sucursal.correlativoNotaDebitoBoleta,
        serieGuiaRemision: sucursal.serieGuiaRemision,
        correlativoGuiaRemision: sucursal.correlativoGuiaRemision,
        serieGuiaTransportista: sucursal.serieGuiaTransportista,
        correlativoGuiaTransportista: sucursal.correlativoGuiaTransportista,
        serieNotaVenta: sucursal.serieNotaVenta,
        correlativoNotaVenta: sucursal.correlativoNotaVenta,
      };
      await axios.put(
        `${BASE_URL}/api/Sucursal/${sucursal.sucursalId}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        },
      );
      showToast(
        `Series de "${sucursal.nombre}" guardadas correctamente`,
        "success",
      );
    } catch {
      showToast(`Error al guardar la sucursal "${sucursal.nombre}"`, "error");
    } finally {
      setSavingSucursalId(null);
    }
  };

  const handleSucursalChange = (updated: Sucursal) => {
    if (!canEdit) return;
    setSucursales((prev) =>
      prev.map((s) => (s.sucursalId === updated.sucursalId ? updated : s)),
    );
  };

  return (
    <>
      <form
        onSubmit={handleSave}
        className="mx-auto space-y-6 animate-in fade-in duration-500"
      >
        {/* ── Datos de la Empresa ── */}
        <Card
          title="Datos de la Empresa"
          subtitle="Información que aparecerá en tus comprobantes electrónicos"
        >
          {loadingEmpresa ? (
            <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Cargando datos de la empresa...</span>
            </div>
          ) : (
            <>
              {isFacturador && <ReadOnlyBanner />}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <LogoUploader
                  logoDataUrl={logoDataUrl}
                  uploading={uploadingLogo}
                  canEdit={canEdit}
                  onFileSelected={handleFileSelected}
                  onLogoRemove={handleLogoRemove}
                  onError={(msg) => showToast(msg, "error")}
                />

                <div className="md:col-span-2 mt-3 mx-3">
                  <SectionHeader
                    icon={Building2}
                    title="Identificación Tributaria"
                    subtitle="Datos registrados en SUNAT"
                  />
                </div>

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input
                    label="RUC"
                    value={form.ruc}
                    disabled
                    hint="El RUC no puede modificarse"
                  />
                  <Input
                    label="Razón Social"
                    value={form.razonSocial}
                    disabled
                    hint="Se obtiene automáticamente de SUNAT"
                  />
                  <Input
                    label="Nombre Comercial"
                    value={form.nombreComercial}
                    onChange={upd("nombreComercial")}
                    placeholder="Nombre con el que opera (opcional)"
                    disabled={!canEdit}
                  />
                </div>

                <div className="md:col-span-2 mt-3 mx-3">
                  <SectionHeader
                    icon={MapPin}
                    title="Ubicación y Domicilio Fiscal"
                    subtitle="Dirección registrada en SUNAT para tus comprobantes"
                  />
                </div>

                {/* Fila de 4: Departamento · Provincia · Distrito · Ubigeo */}
                <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Input
                    label="Departamento"
                    value={form.departamento}
                    disabled
                    hint="Se obtiene automáticamente de SUNAT"
                  />
                  <Input
                    label="Provincia"
                    value={form.provincia}
                    disabled
                    hint="Se obtiene automáticamente de SUNAT"
                  />
                  <Input
                    label="Distrito"
                    value={form.distrito}
                    disabled
                    hint="Se obtiene automáticamente de SUNAT"
                  />
                  <Input
                    label="Ubigeo"
                    value={form.ubigeo}
                    disabled
                    hint="Se obtiene automáticamente de SUNAT"
                  />
                </div>

                {/* Dirección Fiscal — ancho completo */}
                <div className="md:col-span-2">
                  <Input
                    label="Dirección Fiscal"
                    value={form.direccion}
                    disabled
                    hint="Se obtiene automáticamente de SUNAT"
                  />
                </div>

                <div className="md:col-span-2 mt-3 mx-3">
                  <SectionHeader
                    icon={Phone}
                    title="Datos de Contacto"
                    subtitle="Información de comunicación de la empresa"
                  />
                </div>

                <Input
                  label="Teléfono"
                  value={form.telefono}
                  onChange={upd("telefono")}
                  required
                  placeholder="999 123 456"
                  type="text"
                  disabled={!canEdit}
                  maxLength={25}
                  hint="Formato Perú: 9 dígitos, empieza con 9"
                />

                <Input
                  label="Email"
                  value={form.email}
                  onChange={upd("email")}
                  required
                  placeholder="contacto@empresa.pe"
                  type="email"
                  disabled={!canEdit}
                  hint="Se usará para notificaciones y envío de comprobantes"
                />

              </div>

              {/* Botón guardar datos de empresa */}
              {canEdit && (
                <div className="flex justify-end pt-2 pb-2">
                  <Button
                    type="submit"
                    className="h-9 text-xs"
                    disabled={saving || uploadingLogo}
                  >
                    {saving ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</>
                    ) : (
                      <><Building2 className="w-3.5 h-3.5" /> Guardar datos de empresa</>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>

        {/* ── Configuración ── */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {/* Cabecera acordeón */}
          <div
            className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50/60 transition-colors"
            onClick={() => setConfigExpandida(!configExpandida)}
          >
            <div>
              <p className="text-base font-semibold text-gray-900">Configuración</p>
              <p className="text-xs text-gray-400 mt-0.5">Parámetros del sistema para esta empresa</p>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform duration-200", configExpandida && "rotate-180")} />
          </div>

          {configExpandida && (
            <div className="border-t border-gray-100 p-5">
          {loadingConfig ? (
            <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Cargando configuración...</span>
            </div>
          ) : !config ? (
            <div className="py-10 text-center text-sm text-gray-400">
              No se pudo cargar la configuración.
            </div>
          ) : (
            <div className="space-y-6">
              {isFacturador && <ReadOnlyBanner />}

              {/* ── Impresión ── */}
              <div>
                <div className="mx-3 mb-3">
                  <SectionHeader
                    icon={Printer}
                    title="Impresión"
                    subtitle="Configuración de impresión de comprobantes"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-100 rounded-xl overflow-hidden border border-gray-100">
                  {[
                    { key: "isImprime" as const, label: "Impresión automática", desc: "Imprimir el comprobante al emitir" },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between gap-4 px-4 py-3 bg-white">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                      </div>
                      <Toggle checked={!!config[key]} onChange={updConfig(key)} disabled={!canEdit} />
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-4 px-4 py-3 bg-white">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Tamaño de papel</p>
                      <p className="text-xs text-gray-400 mt-0.5">Formato para impresión de comprobantes</p>
                    </div>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
                      {(["58", "80", "A4"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          disabled={!canEdit}
                          onClick={() => updConfig("tamañoImpresion")(t)}
                          className={cn(
                            "px-3 py-1.5 transition-colors",
                            config.tamañoImpresion === t
                              ? "bg-brand-blue text-white"
                              : "bg-white text-gray-500 hover:bg-gray-50",
                            !canEdit && "cursor-not-allowed opacity-60",
                          )}
                        >
                          {t === "A4" ? "A4" : `${t}mm`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Comprobantes ── */}
              <div>
                <div className="mx-3 mb-3">
                  <SectionHeader
                    icon={ReceiptText}
                    title="Comprobantes"
                    subtitle="Opciones de emisión y cálculo"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-100 rounded-xl overflow-hidden border border-gray-100">
                  {/* IGV */}
                  <div className="flex items-center justify-between gap-4 px-4 py-3 bg-white">
                    <div>
                      <p className="text-sm font-medium text-gray-800">IGV (%)</p>
                      <p className="text-xs text-gray-400 mt-0.5">Porcentaje de IGV aplicado</p>
                    </div>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
                      {(["18", "10.5"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          disabled={!canEdit}
                          onClick={() => updConfig("igv")(t)}
                          className={cn(
                            "px-3 py-1.5 transition-colors",
                            config.igv === t
                              ? "bg-brand-blue text-white"
                              : "bg-white text-gray-500 hover:bg-gray-50",
                            !canEdit && "cursor-not-allowed opacity-60",
                          )}
                        >
                          {t}%
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Tipo por defecto */}
                  <div className="flex items-center justify-between gap-4 px-4 py-3 bg-white">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Tipo por defecto</p>
                      <p className="text-xs text-gray-400 mt-0.5">Comprobante predeterminado al emitir</p>
                    </div>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
                      {(["b", "f", "n"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          disabled={!canEdit}
                          onClick={() => updConfig("isBoletaOrFactura")(t)}
                          className={cn(
                            "px-3 py-1.5 transition-colors",
                            config.isBoletaOrFactura === t
                              ? "bg-brand-blue text-white"
                              : "bg-white text-gray-500 hover:bg-gray-50",
                            !canEdit && "cursor-not-allowed opacity-60",
                          )}
                        >
                          {t === "b" ? "Boleta" : t === "f" ? "Factura" : "Nota de Venta"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Toggles de comprobantes */}
                  {([
                    { key: "afectacionIgv"   as const, label: "Afectación IGV",       desc: "Permitir configurar la afectación al IGV" },
                    { key: "descUnitario"    as const, label: "Descuento unitario",    desc: "Habilitar descuento por ítem" },
                    { key: "itemsDefecto"    as const, label: "Ítems por defecto",     desc: "Cargar ítems predeterminados al emitir" },
                    { key: "isCredito"       as const, label: "Ventas al crédito",     desc: "Permitir comprobantes a crédito" },
                    { key: "isEnvioResumen"  as const, label: "Envío de resumen",      desc: "Enviar resumen diario a SUNAT" },
                  ] as { key: keyof Configuracion; label: string; desc: string }[]).map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between gap-4 px-4 py-3 bg-white">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                      </div>
                      <Toggle checked={!!config[key]} onChange={updConfig(key)} disabled={!canEdit} />
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Módulos ── */}
              <div>
                <div className="mx-3 mb-3">
                  <SectionHeader
                    icon={Layers}
                    title="Módulos habilitados"
                    subtitle="Activa o desactiva funcionalidades del sistema"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-100 rounded-xl overflow-hidden border border-gray-100">
                  {([
                    { key: "isConsumo"          as const, label: "Consumo interno",         desc: "Módulo de consumo interno" },
                    { key: "guiaRemision"        as const, label: "Guías de remisión",      desc: "Módulo de guías de remisión" },
                    { key: "isVale"              as const, label: "Vales",                  desc: "Emisión de vales" },
                    { key: "deudasCobrar"        as const, label: "Deudas por cobrar",      desc: "Módulo de gestión de deudas" },
                    { key: "trabajadores"        as const, label: "Trabajadores",           desc: "Módulo de gestión de personal" },
                    { key: "cargaComprobantes"   as const, label: "Carga comprobantes",     desc: "Módulo de carga masiva de comprobantes" },
                    { key: "isStock"             as const, label: "Stock / Proveedores",    desc: "Módulo de gestión de inventario" },
                    { key: "useNotaVenta"        as const, label: "Nota de Venta",          desc: "Habilitar emisión de notas de venta" },
                    { key: "usaSire"             as const, label: "SIRE (Registro de Ventas)", desc: "Módulo de cierre mensual del RVIE ante SUNAT" },
                  ] as { key: keyof Configuracion; label: string; desc: string }[]).map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between gap-4 px-4 py-3 bg-white">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                      </div>
                      <Toggle checked={!!config[key]} onChange={updConfig(key)} disabled={!canEdit} />
                    </div>
                  ))}
                </div>
                {config.isStock && (
                  <div className="mt-3 rounded-xl border border-gray-100 overflow-hidden bg-gray-100 space-y-px">
                    <div className="flex items-center gap-4 px-4 py-3 bg-white">
                      <Toggle
                        checked={!!config.isCajaAutopago}
                        onChange={updConfig("isCajaAutopago")}
                        disabled={!canEdit}
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-800">Caja Autopago</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Módulo de autoservicio de pago (requiere Stock / Proveedores activo)
                        </p>
                      </div>
                    </div>
                    <div className="px-4 py-3 bg-white flex flex-col sm:flex-row gap-3 items-start">
                      <Input
                        label={
                          <span className="flex items-center gap-1">
                            <WhatsAppIcon className="w-3.5 h-3.5 text-green-500 shrink-0" />
                            Número de WhatsApp para aviso de stock bajo
                          </span>
                        }
                        hint={`Se notificará a este único número cuando un producto quede con ${config.umbralStockBajo ?? 10} unidades o menos`}
                        hintClassName="text-xs text-gray-400"
                        value={config.numeroStockBajo ?? ""}
                        onChange={(e) =>
                          updConfig("numeroStockBajo")(
                            e.target.value.replace(/\D/g, "").slice(0, 9),
                          )
                        }
                        disabled={!canEdit}
                        placeholder="987654321"
                        className="w-full sm:w-72"
                      />
                      <Input
                        label="Umbral de unidades"
                        value={String(config.umbralStockBajo ?? 10)}
                        onChange={(e) => {
                          const n = e.target.value.replace(/\D/g, "").slice(0, 5);
                          updConfig("umbralStockBajo")(n === "" ? 10 : parseInt(n, 10));
                        }}
                        disabled={!canEdit}
                        placeholder="10"
                        className="sm:w-32"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Botón guardar */}
              {canEdit && (
                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    className="h-9 text-xs"
                    disabled={savingConfig}
                    onClick={handleSaveConfig}
                  >
                    {savingConfig ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</>
                    ) : (
                      <><Settings className="w-3.5 h-3.5" /> Guardar Configuración</>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
            </div>
          )}
        </div>

        {/* ── Series de Comprobantes ── */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {/* Cabecera acordeón */}
          <div
            className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50/60 transition-colors"
            onClick={() => setSeriesExpandidas(!seriesExpandidas)}
          >
            <div>
              <p className="text-base font-semibold text-gray-900">Series de Comprobantes</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {canEdit
                  ? isSuperAdmin
                    ? "Configura las series y correlativos de cada sucursal"
                    : "Configura las series y correlativos de tu sucursal"
                  : "Consulta las series y correlativos de tu sucursal"}
              </p>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform duration-200", seriesExpandidas && "rotate-180")} />
          </div>

          {seriesExpandidas && (
            <div className="border-t border-gray-100 p-5">
              {loadingSucursales ? (
                <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Cargando sucursales...</span>
                </div>
              ) : sucursales.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                  <Store className="w-8 h-8 text-gray-300" />
                  <p className="text-sm">No se encontraron sucursales</p>
                </div>
              ) : (
                <>
                  {isFacturador && <ReadOnlyBanner />}
                  <div className="space-y-5 mx-3">
                    {sucursales.map((sucursal) => (
                      <SucursalCard
                        key={sucursal.sucursalId}
                        sucursal={sucursal}
                        onChange={handleSucursalChange}
                        onSave={handleSaveSucursal}
                        saving={savingSucursalId === sucursal.sucursalId}
                        readOnly={!canEdit}
                        defaultExpanded={false}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

      </form>
      {imageToCrop && (
        <LogoCropper
          image={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={() => setImageToCrop(null)}
        />
      )}
    </>
  );
}
