import { LucideIcon } from 'lucide-react';

export type View = 'dashboard' | 'emision' | 'operaciones' | 'clientes' | 'trabajadores' | 'productos' | 'reportes' | 'sunat' | 'empresa' | 'sucursales' | 'usuarios' | 'comprobantes' | 'guiasremision' | 'cuentasporcobrar' | 'deudasporcobrar' | 'carga-comprobantes';

export interface MenuItem {
  id: View;
  label: string;
  icon: LucideIcon;
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
