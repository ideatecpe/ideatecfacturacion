import { LucideIcon } from 'lucide-react';

export type View = 'dashboard' | 'emision' | 'operaciones' | 'clientes' | 'trabajadores' | 'productos' | 'compras' | 'reportes' | 'sunat' | 'empresa' | 'sucursales' | 'usuarios' | 'comprobantes' | 'guiasremision' | 'cuentasporcobrar' | 'deudasporcobrar' | 'carga-comprobantes' | 'sire' | 'caja' | 'gastos' | 'herramientas';

export interface MenuItem {
  id: View;
  label: string;
  icon: LucideIcon;
  /** badge: número a la derecha del submenú (p. ej. ingresos por emitir). */
  children?: { id: string; label: string; badge?: number }[];
}

export interface SalesData {
  name: string;
  sales: number;
  docs: number;
}

export interface Document {
  id: string;
  client: string;
  total: string;
  status: string;
  date: string;
}
