// ─── Fila cruda del Excel ────────────────────────────────────────────────────
export interface FilaExcel {
  rucDni: string;
  detalle: string;
  cantidad: number;
  precioUnitario: number;
  igv: number;
  unidadMedida: string;
  moneda: string;
  correo: string | null;
  whatsapp: string | null;
}

// ─── Item de detalle agrupado ─────────────────────────────────────────────────
export interface ItemAgrupado {
  descripcion: string;
  cantidad: number;
  precioUnitario: number; // con IGV incluido
  igvPct: number;
  unidadMedida: string;
}

// ─── Comprobante agrupado (cabecera + detalles) ───────────────────────────────
export interface ComprobanteAgrupado {
  id: string; // uuid local para key
  rucDni: string;
  razonSocial: string;
  tipoDoc: "01" | "06"; // 01=DNI, 06=RUC
  tipoComprobante: "03" | "01"; // 03=Boleta, 01=Factura
  moneda: string;
  correo: string | null;
  whatsapp: string | null;
  items: ItemAgrupado[];

  // Estado de consulta API
  consultandoApi: boolean;
  apiEncontrado: boolean | null; // null = aún no consultado
  apiError: string | null;
  tieneAdvertencia?: boolean; // DNI no encontrado — puede guardar pero con alerta

  // Datos traídos de la API
  ubigeo: string;
  direccionLineal: string;
  departamento: string;
  provincia: string;
  distrito: string;

  // Errores de validación
  errores: string[];
}

// ─── Estado global del modal ──────────────────────────────────────────────────
export interface CargaMasivaState {
  fechaEmision: string; // YYYY-MM-DD
  comprobantes: ComprobanteAgrupado[];
  erroresGlobales: string[]; // errores de parseo del Excel
  cargando: boolean;
  guardando: boolean;
  progreso: number; // 0-100
  resultado: ResultadoCargaMasiva | null;
}

// ─── Resultado final ──────────────────────────────────────────────────────────
export interface ResultadoCargaMasiva {
  total: number;
  exitosos: number;
  fallidos: number;
  resultados: {
    numeroCompleto?: string;
    exitoso: boolean;
    mensaje?: string;
    comprobanteId?: number;
  }[];
}

// ─── Props del modal ──────────────────────────────────────────────────────────
export interface ModalCargaMasivaProps {
  onClose: () => void;
  onCargaExitosa: () => void;
  isSuperAdmin: boolean;
  sucursales?: any[];
  sucursalUsuario?: any;
  empresa: any;
  accessToken: string;
  user: any;
}