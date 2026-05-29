import type { FilaCarga, ColDef } from "./types";

// ─── Storage ──────────────────────────────────────────────────────────────────

export const STORAGE_FILAS_KEY    = "factufly:carga-comprobantes:filas";
export const STORAGE_HISTORIAL_KEY = "factufly:carga-comprobantes:historial";

// ─── Períodos ─────────────────────────────────────────────────────────────────

export const PERIODO_ORDER = [
  "quincenal",
  "mensual",
  "bimestral",
  "trimestral",
  "cuatrimestral",
  "quinquemestral",
  "semestral",
  "7meses",
  "8meses",
  "9meses",
  "10meses",
  "11meses",
  "anual",
  "dias",
] as const;

export const PERIODO_CFG: Record<
  string,
  {
    label: string;
    activeClass: string;
    idleClass: string;
    badgeClass: string;
    dotClass: string;
    borderClass: string;
    bgCard: string;
  }
> = {
  quincenal:      { label: "Quincenal",      activeClass: "bg-purple-600 text-white shadow-sm",  idleClass: "text-purple-700 hover:bg-purple-50",   badgeClass: "bg-purple-100 text-purple-700",   dotClass: "bg-purple-400",  borderClass: "border-purple-200",  bgCard: "bg-purple-50"  },
  mensual:        { label: "Mensual",        activeClass: "bg-blue-600 text-white shadow-sm",    idleClass: "text-blue-700 hover:bg-blue-50",       badgeClass: "bg-blue-100 text-blue-700",       dotClass: "bg-blue-400",    borderClass: "border-blue-200",    bgCard: "bg-blue-50"    },
  bimestral:      { label: "Bimestral",      activeClass: "bg-cyan-600 text-white shadow-sm",   idleClass: "text-cyan-700 hover:bg-cyan-50",       badgeClass: "bg-cyan-100 text-cyan-700",       dotClass: "bg-cyan-400",    borderClass: "border-cyan-200",    bgCard: "bg-cyan-50"    },
  trimestral:     { label: "Trimestral",     activeClass: "bg-emerald-600 text-white shadow-sm",idleClass: "text-emerald-700 hover:bg-emerald-50", badgeClass: "bg-emerald-100 text-emerald-700", dotClass: "bg-emerald-400", borderClass: "border-emerald-200", bgCard: "bg-emerald-50" },
  cuatrimestral:  { label: "Cuatrimestral",  activeClass: "bg-indigo-600 text-white shadow-sm", idleClass: "text-indigo-700 hover:bg-indigo-50",   badgeClass: "bg-indigo-100 text-indigo-700",   dotClass: "bg-indigo-400",  borderClass: "border-indigo-200",  bgCard: "bg-indigo-50"  },
  quinquemestral: { label: "Quinquemestral", activeClass: "bg-violet-600 text-white shadow-sm", idleClass: "text-violet-700 hover:bg-violet-50",   badgeClass: "bg-violet-100 text-violet-700",   dotClass: "bg-violet-400",  borderClass: "border-violet-200",  bgCard: "bg-violet-50"  },
  semestral:      { label: "Semestral",      activeClass: "bg-amber-600 text-white shadow-sm",  idleClass: "text-amber-700 hover:bg-amber-50",     badgeClass: "bg-amber-100 text-amber-700",     dotClass: "bg-amber-400",   borderClass: "border-amber-200",   bgCard: "bg-amber-50"   },
  "7meses":       { label: "Septemestral",   activeClass: "bg-fuchsia-600 text-white shadow-sm",idleClass: "text-fuchsia-700 hover:bg-fuchsia-50", badgeClass: "bg-fuchsia-100 text-fuchsia-700", dotClass: "bg-fuchsia-400", borderClass: "border-fuchsia-200", bgCard: "bg-fuchsia-50" },
  "8meses":       { label: "Octamestral",    activeClass: "bg-pink-600 text-white shadow-sm",   idleClass: "text-pink-700 hover:bg-pink-50",       badgeClass: "bg-pink-100 text-pink-700",       dotClass: "bg-pink-400",    borderClass: "border-pink-200",    bgCard: "bg-pink-50"    },
  "9meses":       { label: "Novenestral",    activeClass: "bg-orange-600 text-white shadow-sm", idleClass: "text-orange-700 hover:bg-orange-50",   badgeClass: "bg-orange-100 text-orange-700",   dotClass: "bg-orange-400",  borderClass: "border-orange-200",  bgCard: "bg-orange-50"  },
  "10meses":      { label: "Decamestral",    activeClass: "bg-teal-600 text-white shadow-sm",   idleClass: "text-teal-700 hover:bg-teal-50",       badgeClass: "bg-teal-100 text-teal-700",       dotClass: "bg-teal-400",    borderClass: "border-teal-200",    bgCard: "bg-teal-50"    },
  "11meses":      { label: "Undecamestral",  activeClass: "bg-lime-600 text-white shadow-sm",   idleClass: "text-lime-700 hover:bg-lime-50",       badgeClass: "bg-lime-100 text-lime-700",       dotClass: "bg-lime-400",    borderClass: "border-lime-200",    bgCard: "bg-lime-50"    },
  anual:          { label: "Anual",          activeClass: "bg-rose-600 text-white shadow-sm",   idleClass: "text-rose-700 hover:bg-rose-50",       badgeClass: "bg-rose-100 text-rose-700",       dotClass: "bg-rose-400",    borderClass: "border-rose-200",    bgCard: "bg-rose-50"    },
  dias:           { label: "Días",           activeClass: "bg-slate-700 text-white shadow-sm",  idleClass: "text-slate-700 hover:bg-slate-50",     badgeClass: "bg-slate-100 text-slate-700",     dotClass: "bg-slate-400",   borderClass: "border-slate-200",   bgCard: "bg-slate-50"   },
};

// ─── Columnas del Excel (razonSocial y concepto se auto-generan) ──────────────

export const COLUMNAS_EXCEL: { key: keyof FilaCarga; label: string; type?: string }[] = [
  { key: "numdoc",   label: "numdoc" },
  { key: "periodo",  label: "periodo" },
  { key: "importe",  label: "importe",  type: "number" },
  { key: "igv",      label: "igv",      type: "number" },
  { key: "moneda",   label: "moneda" },
  { key: "fechaini", label: "fechaini", type: "date" },
  { key: "fechafin", label: "fechafin", type: "date" },
  { key: "placa",    label: "placa" },
  { key: "correo",   label: "correo" },
  { key: "whatsapp", label: "whatsapp" },
];

// ─── Columnas de la tabla editable ────────────────────────────────────────────

// igv, moneda y tipoDoc ya no son columnas del loop — van en la columna OPCIONES
export const columnas: ColDef[] = [
  { key: "numdoc",      label: "NUMDOC",      px: 96 },
  { key: "razonSocial", label: "RAZÓN SOCIAL", pct: "18%" },
  { key: "periodo",     label: "PER.",          px: 54 },
  { key: "concepto",    label: "CONCEPTO",     pct: "22%" },
  { key: "importe",     label: "IMPORTE",      px: 78 },
  { key: "correo",      label: "CORREO",       pct: "10%" },
  { key: "whatsapp",    label: "WSP",          px: 90 },
  { key: "fechaini",    label: "F. INICIO",    px: 110, type: "date" },
  { key: "fechafin",    label: "F. FIN",       px: 110, type: "date" },
  { key: "placa",       label: "PLACA",        px: 76 },
];
