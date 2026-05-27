"use client";

import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import axios from "axios";
import {
  FileSpreadsheet,
  RefreshCw,
  Send,
  Download,
  Upload,
  Calendar,
  Mail,
  Phone,
  Car,
  User,
  Building2,
  CalendarRange,
  Hash,
  Trash2,
  Receipt,
  Tag,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { Modal } from "@/app/components/ui/Modal";
import { useToast } from "@/app/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { useSucursal } from "@/app/factufly/operaciones/boleta/gestionBoletas/useSucursal";
import { useEmpresaEmisor } from "@/app/factufly/operaciones/boleta/gestionBoletas/useEmpresaEmisor";
import { numeroAlertas } from "@/app/components/ui/numeroAlertas";
import { consultaDni } from "@/app/components/apiConsultasJsonPe/consultaDni";
import { consultaRuc } from "@/app/components/apiConsultasJsonPe/consultaRuc";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type FilaCarga = {
  id: string;
  numdoc: string;
  razonSocial: string;
  periodo: string;
  concepto: string;
  importe: number;
  igv: number;          // % IGV: 0=exonerada, 18, 10.5
  moneda: string;       // PEN | USD
  correo: string;
  whatsapp: string;
  fechaini: string;
  fechafin: string;
  placa: string;
  tipoOverride?: "B" | "F"; // B=Boleta, F=Factura (sobreescribe la detección por numdoc)
};

// ─── Periodos config ──────────────────────────────────────────────────────────

const PERIODO_ORDER = ["quincenal", "mensual", "bimestral", "trimestral", "semestral", "anual", "dias"] as const;
type PeriodoKey = (typeof PERIODO_ORDER)[number] | "todos";

const PERIODO_CFG: Record<
  string,
  { label: string; activeClass: string; idleClass: string; badgeClass: string; dotClass: string; borderClass: string; bgCard: string }
> = {
  quincenal:  { label: "Quincenal",  activeClass: "bg-purple-600 text-white shadow-sm",  idleClass: "text-purple-700 hover:bg-purple-50",  badgeClass: "bg-purple-100 text-purple-700",  dotClass: "bg-purple-400",  borderClass: "border-purple-200",  bgCard: "bg-purple-50" },
  mensual:    { label: "Mensual",    activeClass: "bg-blue-600 text-white shadow-sm",    idleClass: "text-blue-700 hover:bg-blue-50",      badgeClass: "bg-blue-100 text-blue-700",      dotClass: "bg-blue-400",    borderClass: "border-blue-200",    bgCard: "bg-blue-50" },
  bimestral:  { label: "Bimestral",  activeClass: "bg-cyan-600 text-white shadow-sm",   idleClass: "text-cyan-700 hover:bg-cyan-50",      badgeClass: "bg-cyan-100 text-cyan-700",      dotClass: "bg-cyan-400",    borderClass: "border-cyan-200",    bgCard: "bg-cyan-50" },
  trimestral: { label: "Trimestral", activeClass: "bg-emerald-600 text-white shadow-sm",idleClass: "text-emerald-700 hover:bg-emerald-50",badgeClass: "bg-emerald-100 text-emerald-700",dotClass: "bg-emerald-400",borderClass: "border-emerald-200",bgCard: "bg-emerald-50" },
  semestral:  { label: "Semestral",  activeClass: "bg-amber-600 text-white shadow-sm",  idleClass: "text-amber-700 hover:bg-amber-50",    badgeClass: "bg-amber-100 text-amber-700",    dotClass: "bg-amber-400",   borderClass: "border-amber-200",   bgCard: "bg-amber-50" },
  anual:      { label: "Anual",      activeClass: "bg-rose-600 text-white shadow-sm",   idleClass: "text-rose-700 hover:bg-rose-50",      badgeClass: "bg-rose-100 text-rose-700",      dotClass: "bg-rose-400",    borderClass: "border-rose-200",    bgCard: "bg-rose-50" },
  dias:       { label: "Días",       activeClass: "bg-slate-700 text-white shadow-sm",  idleClass: "text-slate-700 hover:bg-slate-50",    badgeClass: "bg-slate-100 text-slate-700",    dotClass: "bg-slate-400",   borderClass: "border-slate-200",   bgCard: "bg-slate-50" },
};

// ─── Columnas ─────────────────────────────────────────────────────────────────

const STORAGE_FILAS_KEY = "factufly:carga-comprobantes:filas";

/** Columnas del Excel (razonSocial y concepto se auto-generan) */
const COLUMNAS_EXCEL: { key: keyof FilaCarga; label: string; type?: string }[] = [
  { key: "numdoc",    label: "numdoc" },
  { key: "periodo",   label: "periodo" },
  { key: "importe",   label: "importe",   type: "number" },
  { key: "igv",       label: "igv",       type: "number" },
  { key: "moneda",    label: "moneda" },
  { key: "fechaini",  label: "fechaini",  type: "date" },
  { key: "fechafin",  label: "fechafin",  type: "date" },
  { key: "placa",     label: "placa" },
  { key: "correo",    label: "correo" },
  { key: "whatsapp",  label: "whatsapp" },
];

type ColDef = { key: keyof FilaCarga; label: string; type?: string; px?: number; pct?: string };

const columnas: ColDef[] = [
  { key: "numdoc",      label: "NUMDOC",      px: 96 },
  { key: "razonSocial", label: "RAZÓN SOCIAL", pct: "18%" },
  { key: "periodo",     label: "PER.",          px: 54 },
  { key: "concepto",    label: "CONCEPTO",     pct: "22%" },
  { key: "importe",     label: "IMPORTE",      px: 78 },
  { key: "igv",         label: "IGV%",         px: 52 },
  { key: "moneda",      label: "MONEDA",       px: 62 },
  { key: "correo",      label: "CORREO",       pct: "10%" },
  { key: "whatsapp",    label: "WSP",          px: 90 },
  { key: "fechaini",    label: "F. INICIO",    px: 110, type: "date" },
  { key: "fechafin",    label: "F. FIN",       px: 110, type: "date" },
  { key: "placa",       label: "PLACA",        px: 76 },
];

// ─── Alias columnas Excel ─────────────────────────────────────────────────────

const normalizar = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

const alias: Record<keyof Omit<FilaCarga, "id">, string[]> = {
  numdoc:      ["numdoc", "documento", "dni", "ruc", "numerodocumento"],
  razonSocial: ["razonsocial", "cliente", "nombre", "nombrecliente"],
  periodo:     ["periodo", "meses", "dias", "periodonumeromeses"],
  concepto:    ["concepto", "descripcion", "detalle"],
  importe:     ["importe", "precio", "monto", "total"],
  igv:         ["igv", "igvpct", "porcentajeigv", "porcigv"],
  moneda:      ["moneda", "currency", "tipomoneda"],
  correo:      ["correo", "email", "correoelectronico", "mail"],
  whatsapp:    ["whatsapp", "celular", "telefono", "wsp", "ws"],
  fechaini:    ["fechaini", "fechainicio", "desde", "inicio"],
  fechafin:    ["fechafin", "fechafinal", "hasta", "fin"],
  placa:       ["placa", "unidad", "vehiculo"],
};

// ─── Helper tipo comprobante ──────────────────────────────────────────────────

/** Retorna "B" (Boleta) o "F" (Factura). El override manual tiene prioridad; si no,
 *  RUC de 11 dígitos → Factura, cualquier otro → Boleta. */
const getTipoDoc = (fila: FilaCarga): "B" | "F" => {
  if (fila.tipoOverride) return fila.tipoOverride;
  return fila.numdoc.trim().length === 11 ? "F" : "B";
};

// ─── Helpers fecha / periodo ──────────────────────────────────────────────────

const toIsoDate = (value: unknown): string => {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return "";
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const text = String(value ?? "").trim();
  if (!text) return "";
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const parts = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (parts) return `${parts[3]}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
  return text;
};

const parseIsoLocalDate = (value: string): Date | null => {
  const iso = toIsoDate(value);
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toLocalIso = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const mesesPorPeriodo = (periodo: string): number => {
  const limpio = periodo.trim().toLowerCase().replace(",", ".");
  if (limpio === "1/2" || limpio === "0.5") return 0.5;
  if (limpio.endsWith("d")) return 0;
  const valor = Number(limpio);
  if (valor >= 28 && valor <= 31) return 1;
  if (valor >= 89 && valor <= 92) return 3;
  if (valor >= 179 && valor <= 184) return 6;
  if (valor >= 364) return 12;
  if ([1, 2, 3, 6, 12].includes(valor)) return valor;
  return 1;
};

const sumarPeriodo = (fecha: string, periodo: string): string => {
  const date = parseIsoLocalDate(fecha);
  if (!date) return "";
  const limpio = periodo.trim().toLowerCase().replace(",", ".");
  if (limpio.endsWith("d")) {
    date.setDate(date.getDate() + Number(limpio.replace("d", "")));
    return toLocalIso(date);
  }
  const valor = Number(limpio);
  const meses = mesesPorPeriodo(periodo);
  if (meses === 0.5) date.setDate(date.getDate() + 15);
  else if (valor > 12) date.setDate(date.getDate() + valor);
  else date.setMonth(date.getMonth() + meses);
  return toLocalIso(date);
};

const finPeriodo = (fechaInicio: string, periodo: string): string => {
  const siguiente = sumarPeriodo(fechaInicio, periodo);
  const fin = parseIsoLocalDate(siguiente);
  if (!fin) return "";
  fin.setDate(fin.getDate() - 1);
  return toLocalIso(fin);
};

const periodoTexto = (periodo: string): string => {
  const limpio = periodo.trim().toLowerCase().replace(",", ".");
  const valor = Number(limpio);
  if (limpio.endsWith("d")) return "dias";
  if (valor > 12 && !(valor >= 28 && valor <= 31) && !(valor >= 89 && valor <= 92) && !(valor >= 179 && valor <= 184) && valor < 364) return "dias";
  const meses = mesesPorPeriodo(periodo);
  if (meses === 0.5) return "quincenal";
  if (meses === 2) return "bimestral";
  if (meses === 3) return "trimestral";
  if (meses === 6) return "semestral";
  if (meses === 12) return "anual";
  return "mensual";
};

const formatFechaEs = (iso: string): string => {
  const p = iso.split("-");
  if (p.length !== 3) return iso;
  return `${p[2]}/${p[1]}/${p[0]}`;
};

const periodoLabel = (periodo: string): string => {
  const limpio = periodo.trim().toLowerCase().replace(",", ".");
  if (limpio.endsWith("d")) {
    const n = Number(limpio.replace("d", ""));
    return `${n} día${n !== 1 ? "s" : ""}`;
  }
  const meses = mesesPorPeriodo(periodo);
  if (meses === 0.5) return "quincenal";
  if (meses === 2)   return "bimestral";
  if (meses === 3)   return "trimestral";
  if (meses === 6)   return "semestral";
  if (meses === 12)  return "anual";
  return "mensual";
};

const generarConcepto = (periodo: string, fechaini: string, fechafin: string, placa: string): string => {
  const tipo = `Servicio de monitoreo ${periodoLabel(periodo)}`;
  const fi = fechaini ? formatFechaEs(fechaini) : "";
  const ff = fechafin ? formatFechaEs(fechafin) : "";
  const pl = placa ? `, placa ${placa}` : "";
  if (fi && ff) return `${tipo}, del ${fi} al ${ff}${pl}`;
  return `${tipo}${pl}`;
};

// ─── Cálculo IGV por ítem (igual que carga masiva) ────────────────────────────
// importe = precio CON IGV incluido (o precio exonerado si igvPct=0), cantidad siempre 1

function calcItemVelsat(importe: number, igvPct: number) {
  if (igvPct === 0) {
    return {
      tipoAfectacionIGV: "20", // EXONERADA
      porcentajeIGV: 0,
      baseIgv: 0,
      montoIGV: 0,
      totalVentaItem: parseFloat(importe.toFixed(2)),
      valorVenta: parseFloat(importe.toFixed(2)),
      precioUnitario: parseFloat(importe.toFixed(6)),
      precioVenta: parseFloat(importe.toFixed(2)),
    };
  }
  const totalVentaItem = parseFloat(importe.toFixed(2));
  const montoIGV = parseFloat((totalVentaItem - totalVentaItem / (1 + igvPct / 100)).toFixed(2));
  const baseIgv = parseFloat((totalVentaItem - montoIGV).toFixed(2));
  return {
    tipoAfectacionIGV: "10", // GRAVADA
    porcentajeIGV: igvPct,
    baseIgv,
    montoIGV,
    totalVentaItem,
    valorVenta: baseIgv,
    precioUnitario: parseFloat((importe / (1 + igvPct / 100)).toFixed(6)),
    precioVenta: parseFloat(importe.toFixed(2)),
  };
}

function calcTotalesGrupo(items: FilaCarga[]) {
  let gravadas = 0, exoneradas = 0, igvTotal = 0;
  for (const item of items) {
    const igvPct = Number(item.igv) || 0;
    const calc = calcItemVelsat(Number(item.importe) || 0, igvPct);
    if (igvPct === 0) {
      exoneradas += calc.totalVentaItem;
    } else {
      gravadas += calc.baseIgv;
      igvTotal += calc.montoIGV;
    }
  }
  gravadas  = parseFloat(gravadas.toFixed(2));
  exoneradas = parseFloat(exoneradas.toFixed(2));
  igvTotal  = parseFloat(igvTotal.toFixed(2));
  const importeTotal = parseFloat((gravadas + exoneradas + igvTotal).toFixed(2));
  return { gravadas, exoneradas, igvTotal, importeTotal };
}

// ─── localStorage ─────────────────────────────────────────────────────────────

const leerFilasGuardadas = (): FilaCarga[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_FILAS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.map((f: any) => ({
      ...f,
      igv:          f.igv          ?? 0,
      moneda:       f.moneda       ?? "PEN",
      correo:       f.correo       ?? "",
      whatsapp:     f.whatsapp     ?? "",
      tipoOverride: f.tipoOverride ?? undefined,
      concepto:
        f.concepto && f.concepto.includes(" del ")
          ? f.concepto
          : generarConcepto(f.periodo, f.fechaini, f.fechafin, f.placa),
    }));
  } catch {
    return [];
  }
};

// ─── Componente ───────────────────────────────────────────────────────────────

export default function CargaComprobantesPage() {
  const { user, accessToken } = useAuth();
  const { showToast } = useToast();
  const { sucursal } = useSucursal();
  const { empresa } = useEmpresaEmisor();
  const inputRef = useRef<HTMLInputElement>(null);
  const [filas, setFilas] = useState<FilaCarga[]>(leerFilasGuardadas);
  const [emitiendo, setEmitiendo] = useState(false);
  const [modalPlantillaOpen, setModalPlantillaOpen] = useState(false);
  const [tabActiva, setTabActiva] = useState<PeriodoKey>("todos");
  const [fechaEmision, setFechaEmision] = useState<string>(toLocalIso(new Date()));
  const [periodosExpandidos, setPeriodosExpandidos] = useState<Set<string>>(
    () => new Set(PERIODO_ORDER),
  );
  const [loadingRazonSocialIds, setLoadingRazonSocialIds] = useState<Set<string>>(new Set());
  const togglePeriodo = (p: string) =>
    setPeriodosExpandidos((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });

  const esUsuarioVelsat =
    user?.username?.toLowerCase() === "velsat" || user?.ruc === "10073587382";

  const persistirFilas = (nuevasFilas: FilaCarga[]) => {
    setFilas(nuevasFilas);
    localStorage.setItem(STORAGE_FILAS_KEY, JSON.stringify(nuevasFilas));
  };

  // Razón social silenciosa desde API
  const resolverRazonSociales = async (rows: FilaCarga[]): Promise<FilaCarga[]> => {
    const pendientes = [
      ...new Set(
        rows
          .filter((r) => !r.razonSocial.trim() && (r.numdoc.length === 8 || r.numdoc.length === 11))
          .map((r) => r.numdoc),
      ),
    ];
    if (!pendientes.length) return rows;
    const mapa = new Map<string, string>();
    await Promise.allSettled(
      pendientes.map(async (numdoc) => {
        try {
          const nombre =
            numdoc.length === 11
              ? ((await consultaRuc(numdoc))?.razonSocial ?? "")
              : ((await consultaDni(numdoc))?.nombreCompleto ?? "");
          mapa.set(numdoc, nombre);
        } catch {
          mapa.set(numdoc, "");
        }
      }),
    );
    return rows.map((r) => ({
      ...r,
      razonSocial: !r.razonSocial.trim() && mapa.has(r.numdoc) ? (mapa.get(r.numdoc) ?? "") : r.razonSocial,
    }));
  };

  const limpiarCarga = () => {
    setFilas([]);
    setTabActiva("todos");
    localStorage.removeItem(STORAGE_FILAS_KEY);
    showToast("Carga limpiada. Vuelve a subir el Excel.", "success");
  };

  // Agrupación: numdoc + periodoTipo + moneda + tipoDoc → nunca mezcla períodos, monedas ni tipos
  const grupos = useMemo(() => {
    const map = new Map<string, FilaCarga[]>();
    filas.forEach((fila) => {
      const pt     = periodoTexto(fila.periodo);
      const moneda = (fila.moneda || "PEN").toUpperCase().trim();
      const tipo   = getTipoDoc(fila);
      const key    = `${fila.numdoc.trim()}||${pt}||${moneda}||${tipo}`;
      if (!fila.numdoc.trim()) return;
      map.set(key, [...(map.get(key) ?? []), fila]);
    });
    return Array.from(map.entries()).map(([key, items]) => {
      const [numdoc, periodoTipo, moneda, tipoDoc] = key.split("||");
      const totales = calcTotalesGrupo(items);
      return {
        key,
        numdoc,
        periodoTipo,
        moneda:      moneda || "PEN",
        tipoDoc:     (tipoDoc ?? "B") as "B" | "F",
        razonSocial: items[0]?.razonSocial ?? "",
        correo:      items[0]?.correo      ?? "",
        whatsapp:    items[0]?.whatsapp    ?? "",
        items,
        total:   totales.importeTotal,
        totales,
      };
    });
  }, [filas]);

  const periodosPresentes = useMemo(() => {
    const set = new Set(filas.map((f) => periodoTexto(f.periodo)));
    return PERIODO_ORDER.filter((p) => set.has(p));
  }, [filas]);

  const filasFiltradas = useMemo(
    () => (tabActiva === "todos" ? filas : filas.filter((f) => periodoTexto(f.periodo) === tabActiva)),
    [filas, tabActiva],
  );
  const gruposFiltrados = useMemo(
    () => (tabActiva === "todos" ? grupos : grupos.filter((g) => g.periodoTipo === tabActiva)),
    [grupos, tabActiva],
  );

  const stats = useMemo(
    () => ({
      filas: filasFiltradas.length,
      comprobantes: gruposFiltrados.length,
      total: gruposFiltrados.reduce((s, g) => s + g.total, 0),
    }),
    [filasFiltradas, gruposFiltrados],
  );

  const statsPorPeriodo = useMemo(() => {
    const result: Record<string, { filas: number; total: number; comprobantes: number }> = {};
    for (const p of PERIODO_ORDER) {
      const fs = filas.filter((f) => periodoTexto(f.periodo) === p);
      const gs = grupos.filter((g) => g.periodoTipo === p);
      result[p] = {
        filas: fs.length,
        total: gs.reduce((s, g) => s + g.total, 0),
        comprobantes: gs.length,
      };
    }
    return result;
  }, [filas, grupos]);

  // ─── Carga Excel ──────────────────────────────────────────────────────────────

  const cargarExcel = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });

    const headerIndex = raw.findIndex((row) => {
      const normalized = (row as unknown[]).map((cell) => normalizar(String(cell ?? "")));
      return normalized.includes("numdoc");
    });

    if (headerIndex === -1) {
      showToast("No se encontró la columna 'numdoc' en el Excel", "error");
      return;
    }

    const headers = (raw[headerIndex] as unknown[]).map((cell) => String(cell ?? ""));
    const rows = raw.slice(headerIndex + 1).map((row) =>
      headers.reduce<Record<string, unknown>>((acc, header, index) => {
        if (header.trim()) acc[header] = (row as unknown[])[index] ?? "";
        return acc;
      }, {}),
    );

    const parsed = rows
      .map((row, index) => {
        const normalizedEntries = Object.entries(row).map(([key, value]) => [normalizar(key), value]);
        const getValue = (field: keyof Omit<FilaCarga, "id">) => {
          const match = normalizedEntries.find(([key]) =>
            alias[field].map(normalizar).includes(key as string),
          );
          return match?.[1] ?? "";
        };
        const fechaini = toIsoDate(getValue("fechaini"));
        const periodo  = String(getValue("periodo") || "1");
        const placa    = String(getValue("placa")).trim();
        const fechafin = toIsoDate(getValue("fechafin")) || finPeriodo(fechaini, periodo);
        const conceptoExcel = String(getValue("concepto")).trim();
        const concepto = conceptoExcel || generarConcepto(periodo, fechaini, fechafin, placa);
        const igvRaw   = getValue("igv");
        const igv      = igvRaw !== "" ? Number(igvRaw) : 0;
        const monedaRaw = String(getValue("moneda")).trim().toUpperCase();
        const moneda   = monedaRaw === "USD" ? "USD" : "PEN";
        return {
          id: crypto.randomUUID?.() ?? `${Date.now()}-${index}`,
          numdoc:      String(getValue("numdoc")).trim(),
          razonSocial: String(getValue("razonSocial")).trim(),
          periodo,
          concepto,
          importe:  Number(getValue("importe")) || 0,
          igv,
          moneda,
          correo:   String(getValue("correo")).trim(),
          whatsapp: String(getValue("whatsapp")).trim(),
          fechaini,
          fechafin,
          placa,
        };
      })
      .filter((fila) => fila.numdoc || fila.importe || fila.fechaini || fila.placa);

    persistirFilas(parsed);
    setTabActiva("todos");
    setModalPlantillaOpen(false);
    showToast(`${parsed.length} fila(s) cargadas correctamente`, "success");

    const conNombres = await resolverRazonSociales(parsed);
    persistirFilas(conNombres);
  };

  // ─── Descarga plantilla Excel ─────────────────────────────────────────────────

  const descargarPlantilla = async () => {
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    wb.creator = "FactuFly";
    wb.created = new Date();

    const ws = wb.addWorksheet("Carga Velsat", {
      pageSetup: { paperSize: 9, orientation: "landscape" },
    });

    // 10 columnas: A=numdoc B=periodo C=importe D=igv E=moneda F=fechaini G=fechafin H=placa I=correo J=whatsapp
    ws.columns = [
      { key: "numdoc",   width: 14 },
      { key: "periodo",  width: 10 },
      { key: "importe",  width: 12 },
      { key: "igv",      width: 8  },
      { key: "moneda",   width: 8  },
      { key: "fechaini", width: 14 },
      { key: "fechafin", width: 14 },
      { key: "placa",    width: 12 },
      { key: "correo",   width: 28 },
      { key: "whatsapp", width: 14 },
    ];

    const AZUL   = "2563EB";
    const OSCURO = "1E3A5F";
    const BLANCO = "FFFFFF";
    const AMBER  = "FEF3C7";
    const VERDE  = "DCFCE7";
    const PALE   = "EFF6FF";

    // Fila 1 — Título
    ws.mergeCells("A1:J1");
    ws.getRow(1).height = 34;
    const title = ws.getCell("A1");
    title.value = "CARGA COMPROBANTES VELSAT — PLANTILLA";
    title.font = { name: "Calibri", bold: true, size: 14, color: { argb: `FF${BLANCO}` } };
    title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${OSCURO}` } };
    title.alignment = { horizontal: "center", vertical: "middle" };

    // Fila 2 — Instrucción
    ws.mergeCells("A2:J2");
    ws.getRow(2).height = 30;
    const instr = ws.getCell("A2");
    instr.value =
      "Una fila por placa. Mismo numdoc + mismo período = un solo comprobante. IGV=0 → exonerada, IGV=18 → gravada. Moneda: PEN o USD.";
    instr.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF92400E" } };
    instr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${AMBER}` } };
    instr.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

    // Fila 3 — Cabeceras
    const headers = ["numdoc", "periodo", "importe", "igv", "moneda", "fechaini", "fechafin", "placa", "correo", "whatsapp"];
    ws.getRow(3).height = 30;
    headers.forEach((header, index) => {
      const cell = ws.getCell(3, index + 1);
      cell.value = header;
      cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: `FF${BLANCO}` } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${AZUL}` } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top:    { style: "thin", color: { argb: "FFFFFFFF" } },
        bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
        left:   { style: "thin", color: { argb: "FFFFFFFF" } },
        right:  { style: "thin", color: { argb: "FFFFFFFF" } },
      };
    });

    // Filas de ejemplo: numdoc, periodo, importe, igv, moneda, fechaini, fechafin, placa, correo, whatsapp
    const ejemplos = [
      ["41431773",    1,     39,  0,  "PEN", new Date(2026, 4, 1), new Date(2026, 4, 31), "M3N-046", "cliente1@gmail.com", "987654321"],
      ["09647995",    1,     50,  0,  "PEN", new Date(2026, 4, 1), new Date(2026, 4, 31), "BHR-277", "cliente2@gmail.com", ""],
      ["09647995",    1,     50,  0,  "PEN", new Date(2026, 4, 1), new Date(2026, 4, 31), "ADE-442", "",                   ""],
      ["09647995",   "1/2",  25,  0,  "PEN", new Date(2026, 4, 16),new Date(2026, 4, 31), "ABC-123", "",                   ""],
      ["20601234567", 1,    295, 18,  "PEN", new Date(2026, 4, 1), new Date(2026, 4, 31), "XYZ-999", "empresa@ruc.com",    ""],
    ];

    ejemplos.forEach((row, rowIndex) => {
      const excelRow = ws.getRow(rowIndex + 4);
      excelRow.height = 23;
      row.forEach((value, colIdx) => {
        const cell = ws.getCell(rowIndex + 4, colIdx + 1);
        cell.value = value === "" ? null : value;
        cell.font = { name: "Calibri", size: 10, color: { argb: "FF1E293B" } };
        const isAmber = colIdx === 1 || colIdx === 2 || colIdx === 3 || colIdx === 4;
        cell.fill = {
          type: "pattern", pattern: "solid",
          fgColor: { argb: isAmber ? `FF${AMBER}` : rowIndex % 2 === 0 ? "FFF0F9FF" : "FFEFF6FF" },
        };
        cell.border = {
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right:  { style: "thin", color: { argb: "FFE2E8F0" } },
        };
        cell.alignment = { horizontal: isAmber ? "center" : "left", vertical: "middle" };
        if (colIdx === 2) { cell.numFmt = "#,##0.00"; cell.alignment = { horizontal: "right", vertical: "middle" }; }
        if (colIdx === 5 || colIdx === 6) { cell.numFmt = "dd/mm/yyyy"; cell.alignment = { horizontal: "center", vertical: "middle" }; }
      });
    });

    ws.views = [{ state: "frozen", ySplit: 3, topLeftCell: "A4" }];
    ws.autoFilter = "A3:J3";

    // Hoja instrucciones
    const wsI = wb.addWorksheet("Instrucciones");
    wsI.columns = [{ width: 100 }];
    const lines: [string, boolean, string, string?][] = [
      ["INSTRUCCIONES — CARGA COMPROBANTES VELSAT", true, `FF${BLANCO}`, `FF${OSCURO}`],
      ["", false, "FF1E293B"],
      ["COLUMNAS:", true, `FF${AZUL}`],
      ["numdoc: DNI (8 dígitos = Boleta) o RUC (11 dígitos = Factura) del cliente.", false, "FF1E293B"],
      ["periodo: 1/2=quincenal, 1=mensual, 2=bimestral, 3=trimestral, 6=semestral, 12=anual. Para días exactos use Nd (ej: 17d).", false, "FF1E293B"],
      ["importe: monto por placa CON IGV incluido (o monto exonerado si igv=0).", false, "FF1E293B"],
      ["igv: porcentaje de IGV. Use 0 para exonerado, 18 para gravado al 18%.", false, "FF1E293B"],
      ["moneda: PEN (soles) o USD (dólares).", false, "FF1E293B"],
      ["fechaini / fechafin: fechas del servicio. Formato DD/MM/YYYY.", false, "FF1E293B"],
      ["placa: placa de la unidad (requerido).", false, "FF1E293B"],
      ["correo: correo del cliente para envío de comprobante (opcional).", false, "FF1E293B"],
      ["whatsapp: número WhatsApp, 9 dígitos empezando con 9 (opcional).", false, "FF1E293B"],
      ["", false, "FF1E293B"],
      ["REGLAS:", true, `FF${AZUL}`],
      ["• Una fila = una placa.", false, "FF1E293B"],
      ["• Mismo numdoc + mismo período + misma moneda → un solo comprobante agrupado.", false, "FF1E293B"],
      ["• Correo y WhatsApp se leen de la primera fila del cliente.", false, "FF1E293B"],
      ["• Tras emitir, las fechas avanzan automáticamente al siguiente período.", false, "FF1E293B"],
      ["• Los comprobantes se crean como PENDIENTE, envíelos a SUNAT desde Comprobantes.", false, "FF1E293B"],
      ["", false, "FF1E293B"],
      ["IMPORTANTE:", true, "FFDC2626"],
      ["No agregue ni elimine columnas. Mantenga los nombres de cabecera tal como están.", false, "FF1E293B", `FF${VERDE}`],
    ];

    lines.forEach(([text, bold, color, fill], index) => {
      const row = wsI.getRow(index + 1);
      row.height = index === 0 ? 34 : 21;
      const cell = wsI.getCell(index + 1, 1);
      cell.value = text;
      cell.font = { name: "Calibri", size: index === 0 ? 13 : 11, bold, color: { argb: color } };
      cell.alignment = { wrapText: true, vertical: "middle" };
      if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Plantilla Carga Comprobantes Velsat.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Edición inline ───────────────────────────────────────────────────────────

  const actualizarFila = (id: string, campo: keyof FilaCarga, valor: string) => {
    const actualizadas = filas.map((fila) => {
      if (fila.id !== id) return fila;
      const next = { ...fila, [campo]: (campo === "importe" || campo === "igv") ? Number(valor) : valor };
      // Al cambiar numdoc: limpiar razonSocial y tipoOverride para que se re-detecten
      if (campo === "numdoc") {
        next.razonSocial  = "";
        next.tipoOverride = undefined;
      }
      if (campo === "fechaini" || campo === "periodo") {
        next.fechafin = finPeriodo(String(next.fechaini), String(next.periodo));
      }
      if (campo === "periodo" || campo === "fechaini" || campo === "fechafin" || campo === "placa") {
        next.concepto = generarConcepto(String(next.periodo), String(next.fechaini), String(next.fechafin), String(next.placa));
      }
      return next;
    });
    persistirFilas(actualizadas);

    // Auto-consulta razón social cuando numdoc alcanza 8 (DNI) u 11 (RUC) dígitos
    if (campo === "numdoc" && (valor.length === 8 || valor.length === 11)) {
      setLoadingRazonSocialIds((prev) => new Set(prev).add(id));
      (async () => {
        try {
          const nombre =
            valor.length === 11
              ? ((await consultaRuc(valor))?.razonSocial ?? "")
              : ((await consultaDni(valor))?.nombreCompleto ?? "");
          if (nombre) {
            setFilas((prev) => {
              const updated = prev.map((f) =>
                f.id === id ? { ...f, razonSocial: nombre } : f,
              );
              localStorage.setItem(STORAGE_FILAS_KEY, JSON.stringify(updated));
              return updated;
            });
          }
        } catch {
          // silencioso — el usuario puede ingresar el nombre manualmente
        } finally {
          setLoadingRazonSocialIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      })();
    }
  };

  // ─── Emitir → POST /api/Comprobantes/GenerarMasivo ───────────────────────────

  const emitir = async () => {
    if (!filasFiltradas.length || !gruposFiltrados.length) {
      showToast("Carga una plantilla antes de emitir", "error");
      return;
    }
    if (!sucursal || !empresa) {
      showToast("Esperando datos de sucursal y empresa, intenta en un momento", "error");
      return;
    }
    if (!fechaEmision) {
      showToast("Selecciona una fecha de emisión", "error");
      return;
    }

    setEmitiendo(true);

    try {
      // Obtener correlativo actualizado
      const resSucursal = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Sucursal/${sucursal.sucursalId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const sucursalActual = resSucursal.data;
      let correlativoBoleta: number = sucursalActual.correlativoBoleta;
      let correlativoFactura: number = sucursalActual.correlativoFactura;

      const fechaISO = `${fechaEmision}T00:00:00`;
      const gruposAEmitir = gruposFiltrados;
      const idsFilasEmitidas = new Set(gruposAEmitir.flatMap((g) => g.items.map((i) => i.id)));

      const payloads = gruposAEmitir.map((grupo) => {
        const esBoleta       = grupo.tipoDoc === "B";
        const tipoComp       = esBoleta ? "03" : "01";
        const tipoDoc        = esBoleta ? "01" : "06";  // igual que carga masiva
        const tipoDocCliente = esBoleta ? "01" : "6";   // cliente.tipoDocumento
        const serie          = esBoleta ? sucursalActual.serieBoleta : sucursalActual.serieFactura;
        const correlativo    = esBoleta ? correlativoBoleta++ : correlativoFactura++;
        const monedaLabel  = grupo.moneda === "USD" ? "DÓLARES" : "SOLES";
        const { gravadas, exoneradas, igvTotal, importeTotal } = grupo.totales;

        const details = grupo.items.map((item, idx) => {
          const igvPct = Number(item.igv) || 0;
          const calc   = calcItemVelsat(Number(item.importe) || 0, igvPct);
          return {
            item: idx + 1,
            productoId: null,
            codigo: null,
            descripcion: item.concepto,
            cantidad: 1,
            unidadMedida: "ZZ",
            precioUnitario: calc.precioUnitario,
            tipoAfectacionIGV: calc.tipoAfectacionIGV,
            porcentajeIGV: calc.porcentajeIGV,
            baseIgv: calc.baseIgv,
            montoIGV: calc.montoIGV,
            codigoTipoDescuento: "01",
            descuentoUnitario: 0,
            descuentoTotal: 0,
            valorVenta: calc.valorVenta,
            precioVenta: calc.precioVenta,
            totalVentaItem: calc.totalVentaItem,
            icbper: 0,
            factorIcbper: 0,
          };
        });

        return {
          ublVersion: "2.1",
          tipoOperacion: "0101",
          tipoComprobante: tipoComp,
          tipoMoneda: grupo.moneda,
          fechaEmision: fechaISO,
          horaEmision: fechaISO,
          fechaVencimiento: fechaEmision,
          tipoPago: "Contado",
          serie,
          correlativo: String(correlativo).padStart(8, "0"),
          company: {
            ...empresa,
            establecimientoAnexo:
              sucursalActual.codEstablecimiento ?? empresa.establecimientoAnexo ?? "0000",
          },
          cliente: {
            clienteId: null,
            tipoDocumento: tipoDocCliente,
            numeroDocumento: grupo.numdoc,
            razonSocial: grupo.razonSocial,
            ubigeo: null,
            direccionLineal: null,
            departamento: null,
            provincia: null,
            distrito: null,
            correo: grupo.correo || null,
            enviadoPorCorreo: false,
            whatsApp: grupo.whatsapp || null,
            enviadoPorWhatsApp: false,
          },
          details,
          pagos: [
            {
              medioPago: "Efectivo",
              monto: importeTotal,
              fechaPago: fechaISO,
              numeroOperacion: "",
              entidadFinanciera: "",
              observaciones: `Velsat ${grupo.periodoTipo}`,
            },
          ],
          cuotas: [],
          guias: [],
          totalOperacionesGravadas: gravadas,
          totalOperacionesExoneradas: exoneradas,
          totalOperacionesInafectas: 0,
          totalOperacionesGratuitas: 0,
          totalIgvGratuitas: 0,
          totalIGV: igvTotal,
          totalIcbper: 0,
          totalImpuestos: igvTotal,
          totalDescuentos: 0,
          totalOtrosCargos: 0,
          subTotal: parseFloat((gravadas + exoneradas + igvTotal).toFixed(2)),
          importeTotal,
          valorVenta: parseFloat((gravadas + exoneradas).toFixed(2)),
          montoCredito: 0,
          descuentoGlobal: 0,
          codigoTipoDescGlobal: "03",
          usuarioCreacion: user?.id ?? 0,
          enviadoEnResumen: esBoleta ? false : null,
          legends: [{ code: "1000", value: numeroAlertas(importeTotal, monedaLabel) }],
        };
      });

      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/GenerarMasivo`,
        payloads,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      // Avanzar fechas al siguiente ciclo
      const siguientePeriodo = filas.map((fila) => {
        if (!idsFilasEmitidas.has(fila.id)) return fila;
        const dFin = parseIsoLocalDate(fila.fechafin);
        let fechaini: string;
        if (dFin) {
          dFin.setDate(dFin.getDate() + 1);
          fechaini = toLocalIso(dFin);
        } else {
          fechaini = sumarPeriodo(fila.fechaini, fila.periodo);
        }
        const fechafin = finPeriodo(fechaini, fila.periodo);
        const concepto = generarConcepto(fila.periodo, fechaini, fechafin, fila.placa);
        return { ...fila, fechaini, fechafin, concepto };
      });
      persistirFilas(siguientePeriodo);

      const periodoEmitido =
        tabActiva === "todos" ? "todos los períodos" : PERIODO_CFG[tabActiva]?.label.toLowerCase();
      showToast(
        `${payloads.length} comprobante(s) generados (${periodoEmitido}) — revísalos en Comprobantes`,
        "success",
      );
    } catch (err: any) {
      const msg =
        err?.response?.data?.mensaje ??
        err?.response?.data?.message ??
        err?.message ??
        "Error al generar los comprobantes";
      showToast(msg, "error");
    } finally {
      setEmitiendo(false);
    }
  };

  // ─── Guard acceso ─────────────────────────────────────────────────────────────

  if (!esUsuarioVelsat) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
            <FileSpreadsheet className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700">Acceso restringido</p>
          <p className="text-xs text-gray-400">Esta sección está disponible solo para el usuario Velsat.</p>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">

      {/* ── Cabecera ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Carga Comprobantes</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Carga la plantilla Excel, revisa por período y emite todos los comprobantes agrupados.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Fecha de emisión */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs">
            <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="text-gray-500 font-medium whitespace-nowrap">Fecha emisión:</span>
            <input
              type="date"
              value={fechaEmision}
              onChange={(e) => setFechaEmision(e.target.value)}
              className="outline-none text-gray-800 font-semibold bg-transparent cursor-pointer"
            />
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) cargarExcel(file);
              e.currentTarget.value = "";
            }}
          />
          <Button variant="outline" onClick={() => setModalPlantillaOpen(true)}>
            <Upload className="w-4 h-4" />
            Cargar Excel
          </Button>
          {filas.length > 0 && (
            <Button variant="outline" onClick={limpiarCarga}>
              <Trash2 className="w-4 h-4" />
              Limpiar carga
            </Button>
          )}
          <Button
            onClick={emitir}
            disabled={emitiendo || gruposFiltrados.length === 0 || !sucursal || !empresa}
          >
            {emitiendo ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {emitiendo
              ? "Emitiendo..."
              : gruposFiltrados.length > 0
                ? `Emitir (${gruposFiltrados.length})`
                : "Emitir"}
          </Button>
        </div>
      </div>

      {/* ── Tabs de período ── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setTabActiva("todos")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            tabActiva === "todos" ? "bg-gray-800 text-white shadow-sm" : "text-gray-500 hover:bg-gray-100"
          }`}
        >
          Todos
          {filas.length > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tabActiva === "todos" ? "bg-white/20" : "bg-gray-100"}`}>
              {filas.length}
            </span>
          )}
        </button>

        {periodosPresentes.length > 0 && <span className="w-px h-5 bg-gray-200 mx-1" />}

        {periodosPresentes.map((p) => {
          const cfg = PERIODO_CFG[p];
          const s = statsPorPeriodo[p];
          const activo = tabActiva === p;
          return (
            <button
              key={p}
              onClick={() => setTabActiva(p)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activo ? cfg.activeClass : cfg.idleClass
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${activo ? "bg-white/70" : cfg.dotClass}`} />
              {cfg.label}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activo ? "bg-white/20 text-white" : cfg.badgeClass}`}>
                {s.filas}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Strip de stats ── */}
      {filas.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-2.5 bg-white rounded-xl border border-gray-100 text-xs flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-medium">Placas</span>
            <span className="font-bold text-gray-800">{stats.filas}</span>
          </div>
          <span className="w-px h-3.5 bg-gray-200" />
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-medium">Comprobantes a generar</span>
            <span className="font-bold text-gray-800">{stats.comprobantes}</span>
          </div>
          <span className="w-px h-3.5 bg-gray-200" />
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-medium">Total</span>
            <span className="font-bold text-gray-800">S/ {stats.total.toFixed(2)}</span>
          </div>
          {tabActiva !== "todos" && (
            <>
              <span className="w-px h-3.5 bg-gray-200" />
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${PERIODO_CFG[tabActiva]?.badgeClass}`}>
                Solo {PERIODO_CFG[tabActiva]?.label}
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Tabla editable ── */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-310px)]">
          <table className="w-full text-xs" style={{ tableLayout: "fixed", minWidth: 1080 }}>
            <colgroup>
              <col style={{ width: 28 }} />
              <col style={{ width: 26 }} />
              <col style={{ width: 80 }} />
              {columnas.map((col) => (
                <col key={col.key} style={{ width: col.px ?? col.pct ?? "auto" }} />
              ))}
            </colgroup>

            <thead className="sticky top-0 bg-gray-50 border-b border-gray-100 z-10">
              <tr>
                <th className="px-2 py-2.5 text-center font-bold text-gray-400 uppercase tracking-wide text-[10px]">#</th>
                <th className="px-1 py-2.5 text-center font-bold text-gray-400 uppercase tracking-wide text-[10px]">·</th>
                <th className="px-2 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wide text-[10px]">DOC</th>
                {columnas.map((col) => (
                  <th key={col.key} className="px-2 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wide text-[10px] truncate">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {filasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={columnas.length + 3} className="px-6 py-16 text-center">
                    <div className="space-y-2">
                      <FileSpreadsheet className="w-8 h-8 text-gray-300 mx-auto" />
                      <p className="text-gray-400 font-medium">
                        {filas.length === 0
                          ? "Carga una plantilla Excel para ver y editar los datos."
                          : `No hay filas ${PERIODO_CFG[tabActiva]?.label?.toLowerCase() ?? ""} en esta carga.`}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filasFiltradas.map((fila, idx) => {
                  const pt  = periodoTexto(fila.periodo);
                  const cfg = PERIODO_CFG[pt];
                  return (
                    <tr key={fila.id} className="hover:bg-blue-50/20">
                      <td className="py-1.5 text-gray-300 font-medium text-center text-[10px]">{idx + 1}</td>
                      {/* Columna · (color del período, sin texto) */}
                      <td className="py-1.5 text-center">
                        <span
                          title={cfg?.label ?? pt}
                          className={`inline-block w-2.5 h-2.5 rounded-full ${cfg?.dotClass ?? "bg-gray-300"}`}
                        />
                      </td>
                      {/* Columna DOC (Boleta / Factura — toggle) */}
                      <td className="px-1 py-1.5">
                        <button
                          title="Click para cambiar entre Boleta y Factura"
                          onClick={() => {
                            const current = getTipoDoc(fila);
                            actualizarFila(fila.id, "tipoOverride", current === "B" ? "F" : "B");
                          }}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap border transition-all cursor-pointer ${
                            getTipoDoc(fila) === "B"
                              ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          }`}
                        >
                          {getTipoDoc(fila) === "B"
                            ? <User className="w-2.5 h-2.5" />
                            : <Building2 className="w-2.5 h-2.5" />
                          }
                          {getTipoDoc(fila) === "B" ? "Boleta" : "Factura"}
                        </button>
                      </td>
                      {columnas.map((col) => {
                        const isRazonSocial = col.key === "razonSocial";
                        const consultando   = isRazonSocial && loadingRazonSocialIds.has(fila.id);
                        return (
                          <td key={col.key} className="px-1 py-1.5">
                            {consultando ? (
                              <div className="w-full px-2 py-1 bg-blue-50 border border-blue-200 rounded-md flex items-center gap-1.5 h-[26px]">
                                <RefreshCw className="w-3 h-3 text-blue-400 animate-spin shrink-0" />
                                <span className="text-[10px] text-blue-400 truncate">Buscando...</span>
                              </div>
                            ) : (
                              <input
                                type={col.type ?? "text"}
                                value={String(fila[col.key] ?? "")}
                                onChange={(e) => actualizarFila(fila.id, col.key, e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-gray-200 rounded-md outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all text-gray-800 text-xs"
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Preview comprobantes agrupados ── */}
      {gruposFiltrados.length > 0 && (
        <div className="space-y-2">
          {tabActiva === "todos"
            ? PERIODO_ORDER.filter((p) => periodosPresentes.includes(p)).map((p) => {
                const gs = gruposFiltrados.filter((g) => g.periodoTipo === p);
                if (!gs.length) return null;
                const cfg      = PERIODO_CFG[p];
                const totalPeriodo = gs.reduce((s, g) => s + g.total, 0);
                const expandido = periodosExpandidos.has(p);
                const boletas   = gs.filter((g) => g.tipoDoc === "B").length;
                const facturas  = gs.filter((g) => g.tipoDoc === "F").length;
                return (
                  <div key={p} className={`rounded-xl border ${cfg.borderClass} overflow-hidden`}>
                    {/* Cabecera acordeón */}
                    <button
                      onClick={() => togglePeriodo(p)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 ${cfg.bgCard} hover:brightness-[0.97] transition-all`}
                    >
                      <div className="flex items-center gap-3">
                        <ChevronDown
                          className={`w-4 h-4 transition-transform shrink-0 ${cfg.badgeClass.split(" ")[1]} ${expandido ? "" : "-rotate-90"}`}
                        />
                        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dotClass}`} />
                        <span className={`text-xs font-bold ${cfg.badgeClass.split(" ")[1]}`}>{cfg.label}</span>
                        <span className="text-[11px] text-gray-400">
                          {gs.length} comprobante{gs.length !== 1 ? "s" : ""}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {boletas > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <User className="w-2.5 h-2.5" /> {boletas} Boleta{boletas !== 1 ? "s" : ""}
                            </span>
                          )}
                          {facturas > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Building2 className="w-2.5 h-2.5" /> {facturas} Factura{facturas !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-black text-gray-700 tabular-nums">
                        S/&nbsp;{totalPeriodo.toFixed(2)}
                      </span>
                    </button>
                    {/* Grid de cards (colapsable) */}
                    {expandido && (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 p-3 bg-white border-t border-gray-100">
                        {gs.map((grupo) => <GrupoCard key={grupo.key} grupo={grupo} cfg={cfg} />)}
                      </div>
                    )}
                  </div>
                );
              })
            : (() => {
                const cfg = PERIODO_CFG[tabActiva] ?? PERIODO_CFG["mensual"];
                return (
                  <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 p-3 border ${cfg.borderClass} rounded-xl bg-white`}>
                    {gruposFiltrados.map((grupo) => <GrupoCard key={grupo.key} grupo={grupo} cfg={cfg} />)}
                  </div>
                );
              })()}
        </div>
      )}

      {/* ── Modal cargar plantilla ── */}
      <Modal isOpen={modalPlantillaOpen} onClose={() => setModalPlantillaOpen(false)} title="Cargar plantilla Excel">
        <div className="space-y-5">
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-blue-900">Usa la plantilla con el formato correcto</p>
                <p className="text-xs text-blue-700 mt-1">
                  Descarga el Excel, completa las filas y luego súbelo. El sistema agrupa automáticamente por cliente y período.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-black flex items-center justify-center">1</span>
                <p className="text-sm font-bold text-gray-800">Descarga el formato</p>
              </div>
              <p className="text-xs text-gray-500 min-h-10">Genera un Excel con cabecera, columnas ajustadas y filas de ejemplo.</p>
              <Button type="button" onClick={descargarPlantilla} className="w-full justify-center">
                <Download className="w-4 h-4" /> Descargar plantilla Excel
              </Button>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black flex items-center justify-center">2</span>
                <p className="text-sm font-bold text-gray-800">Sube el archivo listo</p>
              </div>
              <p className="text-xs text-gray-500 min-h-10">Revisarás y editarás cada fila antes de emitir. Los datos se guardan automáticamente.</p>
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} className="w-full justify-center">
                <Upload className="w-4 h-4" /> Seleccionar Excel completado
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
              <p className="text-xs font-bold text-gray-500 uppercase">Columnas del Excel</p>
            </div>
            <div className="flex flex-wrap gap-2 p-3">
              {COLUMNAS_EXCEL.map((col) => (
                <span key={col.key} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-mono font-medium">
                  {col.label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => setModalPlantillaOpen(false)}>Cerrar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Sub-componente card de grupo ─────────────────────────────────────────────

type GrupoData = {
  key: string;
  numdoc: string;
  periodoTipo: string;
  moneda: string;
  tipoDoc: "B" | "F";
  razonSocial: string;
  correo: string;
  whatsapp: string;
  items: FilaCarga[];
  total: number;
  totales: ReturnType<typeof calcTotalesGrupo>;
};

function GrupoCard({ grupo, cfg }: { grupo: GrupoData; cfg: (typeof PERIODO_CFG)[string] }) {
  const simbolo  = grupo.moneda === "USD" ? "$" : "S/";
  const esBoleta = grupo.tipoDoc === "B";
  const fechaIni = grupo.items[0]?.fechaini ?? "";
  const fechaFin = grupo.items[grupo.items.length - 1]?.fechafin ?? "";

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden hover:shadow-sm transition-all flex flex-col text-xs">

      {/* ── Cabecera ── */}
      <div className={`px-3 py-2 ${cfg.bgCard} border-b ${cfg.borderClass} flex items-center justify-between gap-2`}>
        {/* Boleta / Factura + Período */}
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${
            esBoleta
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}>
            {esBoleta ? <User className="w-2.5 h-2.5" /> : <Building2 className="w-2.5 h-2.5" />}
            {esBoleta ? "Boleta" : "Factura"}
          </span>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${cfg.badgeClass}`}>
            <Tag className="w-2 h-2" />{cfg.label}
          </span>
        </div>
        {/* Rango fechas */}
        {fechaIni && (
          <span className="inline-flex items-center gap-1 text-[9px] text-gray-400 tabular-nums shrink-0">
            <CalendarRange className="w-2.5 h-2.5" />
            {formatFechaEs(fechaIni)}<span className="text-gray-300 mx-0.5">→</span>{formatFechaEs(fechaFin)}
          </span>
        )}
      </div>

      {/* ── Cliente ── */}
      <div className="px-3 py-2 border-b border-gray-100">
        <p className="font-bold text-gray-900 leading-tight truncate">
          {grupo.razonSocial || <span className="italic text-gray-400">Sin nombre</span>}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          <Hash className="w-2.5 h-2.5 text-gray-300 shrink-0" />
          <span className="text-[10px] text-gray-400 font-mono">{grupo.numdoc}</span>
        </div>
        {(grupo.correo || grupo.whatsapp) && (
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {grupo.correo && (
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                <Mail className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                <span className="truncate max-w-[130px]">{grupo.correo}</span>
              </span>
            )}
            {grupo.whatsapp && (
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                <Phone className="w-2.5 h-2.5 text-green-400 shrink-0" />
                {grupo.whatsapp}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Placas ── */}
      <div className="px-3 py-2 flex-1">
        <div className="flex items-center gap-1 mb-1.5">
          <Car className="w-3 h-3 text-gray-300" />
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">
            {grupo.items.length} placa{grupo.items.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="space-y-1">
          {grupo.items.map((item) => {
            const conceptoCorto = item.concepto
              .replace(/^Servicio de monitoreo /i, "")
              .replace(/, placa [A-Z0-9-]+$/i, "");
            return (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-2 px-2 py-1 rounded-md ${cfg.bgCard} border ${cfg.borderClass}`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`px-1.5 py-px rounded text-[10px] font-black font-mono shrink-0 ${cfg.badgeClass}`}>
                    {item.placa || "—"}
                  </span>
                  <span className="text-[10px] text-gray-500 truncate" title={item.concepto}>
                    {conceptoCorto}
                  </span>
                </div>
                <span className="font-bold text-gray-800 shrink-0 tabular-nums">
                  {simbolo}&nbsp;{Number(item.importe).toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Footer total ── */}
      <div className={`px-3 py-2 ${cfg.bgCard} border-t ${cfg.borderClass} flex items-center justify-between gap-2`}>
        <div className="flex items-center gap-2 text-[10px] text-gray-400 flex-wrap">
          <span className="inline-flex items-center gap-1">
            <Receipt className="w-2.5 h-2.5" />
            {grupo.items.length} ítem{grupo.items.length !== 1 ? "s" : ""}
          </span>
          {grupo.totales.igvTotal > 0 && (
            <span className="text-amber-600 font-medium">
              IGV&nbsp;{simbolo}&nbsp;{grupo.totales.igvTotal.toFixed(2)}
            </span>
          )}
          {grupo.totales.exoneradas > 0 && grupo.totales.gravadas === 0 && (
            <span className="text-emerald-600 font-medium">Exonerado</span>
          )}
        </div>
        <span className="text-sm font-black text-gray-900 tabular-nums shrink-0">
          {simbolo}&nbsp;{grupo.total.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
