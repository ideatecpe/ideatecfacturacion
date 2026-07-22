export interface Sucursal {
  id: string;
  codigo: string;
  nombre: string;
  direccion: string;
  numeroStockBajo?: string | null;
  habilitado: boolean;
  usuario: string;
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
}

export interface NuevaSucursalForm {
  nombre: string;
  direccion: string;
  usuario: string;
  password: string;
  confirmPassword: string;
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
}

export interface EditSucursalForm {
  nombre: string;
  direccion: string;
  numeroStockBajo: string;
}