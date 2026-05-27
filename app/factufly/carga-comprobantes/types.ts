// ─── Tipos de la página Carga Comprobantes ────────────────────────────────────

export type FilaCarga = {
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

export type PeriodoKey =
  | "quincenal"
  | "mensual"
  | "bimestral"
  | "trimestral"
  | "cuatrimestral"
  | "quinquemestral"
  | "semestral"
  | "7meses"
  | "8meses"
  | "9meses"
  | "10meses"
  | "11meses"
  | "anual"
  | "dias"
  | "todos";

export type ColDef = {
  key: keyof FilaCarga;
  label: string;
  type?: string;
  px?: number;
  pct?: string;
};

export type GrupoTotales = {
  gravadas: number;
  exoneradas: number;
  igvTotal: number;
  importeTotal: number;
};

export type GrupoData = {
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
  totales: GrupoTotales;
};

/** Mapa campo → mensaje de error para una fila */
export type FilaErrores = Partial<Record<keyof FilaCarga, string>>;
