import { LucideIcon } from 'lucide-react';

export type View = 'dashboard' | 'emision' | 'operaciones' | 'clientes' | 'trabajadores' | 'productos' | 'compras' | 'reportes' | 'sunat' | 'empresa' | 'sucursales' | 'usuarios' | 'comprobantes' | 'guiasremision' | 'cuentasporcobrar' | 'deudasporcobrar' | 'carga-comprobantes' | 'sire' | 'caja';

export interface MenuItem {
  id: View;
  label: string;
  icon: LucideIcon;
  children?: { id: string; label: string }[];
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
