"use client";
import { useState } from "react";
import { Printer, ArrowLeft, LayoutGrid, Minus, Plus } from "lucide-react";
import Barcode from "react-barcode";
import { Modal } from "@/app/components/ui/Modal";
import { ProductoSucursal } from "./Producto";
import { formatoBarcodeSeguro } from "./barcodeFormato";

type TamañoEtiqueta = "A4" | "58mm" | "80mm";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  productos: ProductoSucursal[];
  onError: (msg: string) => void;
}

// Ancho de página real de cada formato (mm). A4 no usa columnas de ancho fijo:
// se reparten proporcionalmente con CSS grid.
const ANCHO_PAGINA_MM: Record<Exclude<TamañoEtiqueta, "A4">, number> = {
  "58mm": 58,
  "80mm": 80,
};

// Rango de columnas permitido por formato, para no dejar que el usuario pida
// columnas más angostas de lo que un código de barras puede leerse impreso.
const COLUMNAS_MIN = 1;
const COLUMNAS_MAX: Record<TamañoEtiqueta, number> = {
  A4: 6,
  "58mm": 2,
  "80mm": 3,
};
const COLUMNAS_DEFAULT: Record<TamañoEtiqueta, number> = {
  A4: 3,
  "58mm": 1,
  "80mm": 2,
};

function buildCss(tamaño: TamañoEtiqueta, columnas: number): string {
  if (tamaño === "A4") {
    return `
      @page { size: A4; margin: 12mm; }
      body { margin: 0; background: white; font-family: Arial, sans-serif; }
      .contenedor { display: grid; grid-template-columns: repeat(${columnas}, 1fr); gap: 10px; }
      .etiqueta { border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 8px; text-align: center; page-break-inside: avoid; box-sizing: border-box; }
      .nombre { font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #1e293b; margin-bottom: 4px; line-height: 1.3; }
      .etiqueta svg { display: block; margin: 0 auto; height: auto; max-width: 100%; }
      .precios { margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap; }
      .normal { font-size: 13px; font-weight: 900; color: #1d4ed8; }
      .tachado { font-size: 10px; color: #94a3b8; text-decoration: line-through; }
      .promo { font-size: 13px; font-weight: 900; color: #ea6c00; }
      .badge { font-size: 8px; font-weight: 700; color: #fff; background: #ea6c00; border-radius: 3px; padding: 1px 3px; }
    `;
  }

  const anchoPagina = ANCHO_PAGINA_MM[tamaño];
  return `
    @page { size: ${anchoPagina}mm auto; margin: 2mm; }
    body { margin: 0; padding: 2mm; background: white; width: ${anchoPagina - 4}mm; font-family: Arial, sans-serif; }
    .contenedor { display: grid; grid-template-columns: repeat(${columnas}, 1fr); gap: 3mm; }
    .etiqueta { text-align: center; page-break-inside: avoid; border-bottom: 1px dashed #ccc; padding-bottom: 3mm; box-sizing: border-box; }
    .nombre { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; color: #000; margin-bottom: 2mm; line-height: 1.3; }
    .etiqueta svg { display: block; margin: 0 auto; height: auto; max-width: 100%; }
    .precios { margin-top: 2mm; display: flex; align-items: center; justify-content: center; gap: 3mm; flex-wrap: wrap; }
    .normal { font-size: 11pt; font-weight: 900; color: #000; }
    .tachado { font-size: 7.5pt; color: #888; text-decoration: line-through; }
    .promo { font-size: 11pt; font-weight: 900; color: #ea6c00; }
    .badge { font-size: 6.5pt; font-weight: 700; color: #fff; background: #ea6c00; border-radius: 2px; padding: 0 2px; }
  `;
}

export async function imprimirEtiquetas(
  productos: ProductoSucursal[],
  tamaño: TamañoEtiqueta,
  columnas: number,
  onError: (msg: string) => void,
) {
  const JsBarcode = (await import("jsbarcode")).default;

  const generarSvg = (codigo: string): string => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const format = formatoBarcodeSeguro(codigo);
    JsBarcode(svg, codigo, {
      format,
      // Ancho de módulo generoso para que las barras sean nítidas al imprimir.
      // El SVG NO se reescala en el CSS, así los anchos de barra se respetan exactamente.
      width: tamaño === "A4" ? 2 : 1.8,
      height: tamaño === "A4" ? 55 : 60,
      displayValue: true,
      fontSize: tamaño === "A4" ? 12 : 13,
      // Zona de silencio (quiet zone) amplia a cada lado; imprescindible para el lector.
      margin: 12,
      background: "#ffffff",
      lineColor: "#000000",
    });
    return new XMLSerializer().serializeToString(svg);
  };

  const etiquetasHtml = productos
    .map((p) => {
      const svgStr = generarSvg(p.codigoBarras!);
      const precio = p.sucursalProducto.precioUnitario;
      const enPromo = p.sucursalProducto.enPromocion && p.sucursalProducto.porcentajeDescuento;
      const pct = p.sucursalProducto.porcentajeDescuento ?? 0;
      const precioPromo = enPromo ? precio * (1 - pct / 100) : null;
      const preciosHtml = enPromo
        ? `<div class="precios"><span class="tachado">S/ ${precio.toFixed(2)}</span><span class="promo">S/ ${precioPromo!.toFixed(2)}</span><span class="badge">-${pct}%</span></div>`
        : `<div class="precios"><span class="normal">S/ ${precio.toFixed(2)}</span></div>`;
      return `<div class="etiqueta"><div class="nombre">${p.nomProducto}</div>${svgStr}${preciosHtml}</div>`;
    })
    .join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Etiquetas</title>
    <style>${buildCss(tamaño, columnas)}</style></head>
    <body><div class="contenedor">${etiquetasHtml}</div></body></html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) { onError("Bloqueador de popups activo. Permítelo e intenta de nuevo."); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 600);
}

export default function ModalImprimirEtiquetas({ isOpen, onClose, productos, onError }: Props) {
  const [tamaño, setTamaño] = useState<TamañoEtiqueta | null>(null);
  const [columnas, setColumnas] = useState(3);

  const reset = () => {
    setTamaño(null);
    setColumnas(3);
  };

  const handleClose = () => {
    onClose();
    reset();
  };

  const handleElegirTamaño = (t: TamañoEtiqueta) => {
    setTamaño(t);
    setColumnas(COLUMNAS_DEFAULT[t]);
  };

  const ajustarColumnas = (delta: number) => {
    if (!tamaño) return;
    setColumnas((prev) =>
      Math.min(COLUMNAS_MAX[tamaño], Math.max(COLUMNAS_MIN, prev + delta)),
    );
  };

  const handleImprimir = async () => {
    if (!tamaño) return;
    const t = tamaño;
    const c = columnas;
    handleClose();
    await imprimirEtiquetas(productos, t, c, onError);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={tamaño ? "Personalizar impresión" : "Imprimir códigos"}
      className={tamaño ? "max-w-2xl" : "max-w-sm"}
    >
      {!tamaño ? (
        <div className="flex gap-3 pt-1">
          <button
            onClick={() => handleElegirTamaño("A4")}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-brand-blue hover:bg-blue-700 active:scale-95 text-white font-semibold text-sm transition-all"
          >
            <Printer className="w-4 h-4" />
            A4
          </button>
          <button
            onClick={() => handleElegirTamaño("58mm")}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-brand-blue hover:bg-blue-700 active:scale-95 text-white font-semibold text-sm transition-all"
          >
            <Printer className="w-4 h-4" />
            58 mm
          </button>
          <button
            onClick={() => handleElegirTamaño("80mm")}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-brand-blue hover:bg-blue-700 active:scale-95 text-white font-semibold text-sm transition-all"
          >
            <Printer className="w-4 h-4" />
            80 mm
          </button>
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          {/* Selector de columnas */}
          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 text-gray-700">
              <LayoutGrid className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-semibold">Códigos por fila</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => ajustarColumnas(-1)}
                disabled={columnas <= COLUMNAS_MIN}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-gray-300 text-gray-600 hover:border-brand-blue hover:text-brand-blue disabled:opacity-40 disabled:hover:border-gray-300 disabled:hover:text-gray-600 transition-colors"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-6 text-center text-sm font-bold text-gray-900">{columnas}</span>
              <button
                type="button"
                onClick={() => ajustarColumnas(1)}
                disabled={columnas >= COLUMNAS_MAX[tamaño]}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-gray-300 text-gray-600 hover:border-brand-blue hover:text-brand-blue disabled:opacity-40 disabled:hover:border-gray-300 disabled:hover:text-gray-600 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Vista previa */}
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">
              Vista previa · {productos.length} etiqueta(s)
            </p>
            <div className="max-h-72 overflow-y-auto custom-scrollbar bg-gray-100 rounded-xl p-3">
              <div
                className="grid gap-2 mx-auto"
                style={{
                  gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))`,
                  maxWidth: tamaño === "A4" ? "100%" : `${columnas * 140}px`,
                }}
              >
                {productos.map((p) => (
                  <div
                    key={p.sucursalProducto.sucursalProductoId}
                    className="bg-white border border-gray-200 rounded-lg p-2 flex flex-col items-center"
                  >
                    <p className="text-[8px] font-bold text-gray-700 uppercase text-center line-clamp-2 mb-1">
                      {p.nomProducto}
                    </p>
                    <Barcode
                      value={p.codigoBarras!}
                      format={formatoBarcodeSeguro(p.codigoBarras!)}
                      width={1}
                      height={28}
                      fontSize={8}
                      margin={2}
                      background="transparent"
                      lineColor="#1e293b"
                    />
                    <p className="text-[9px] font-black text-brand-blue mt-0.5">
                      S/ {p.sucursalProducto.precioUnitario.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setTamaño(null)}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-600 font-semibold text-sm transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Atrás
            </button>
            <button
              onClick={handleImprimir}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-brand-blue hover:bg-blue-700 active:scale-95 text-white font-semibold text-sm transition-all"
            >
              <Printer className="w-4 h-4" />
              Imprimir {tamaño}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
