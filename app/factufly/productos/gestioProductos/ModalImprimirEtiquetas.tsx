"use client";
import { Printer } from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { ProductoSucursal } from "./Producto";

type TamañoEtiqueta = "A4" | "58mm";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  productos: ProductoSucursal[];
  onError: (msg: string) => void;
}

const CSS_A4 = `
  @page { size: A4; margin: 12mm; }
  body { margin: 0; background: white; font-family: Arial, sans-serif; }
  .contenedor { display: flex; flex-wrap: wrap; gap: 10px; }
  .etiqueta { width: 240px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 8px; text-align: center; page-break-inside: avoid; box-sizing: border-box; }
  .nombre { font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #1e293b; margin-bottom: 4px; line-height: 1.3; }
  .etiqueta svg { display: block; margin: 0 auto; height: auto; }
  .precios { margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap; }
  .normal { font-size: 13px; font-weight: 900; color: #1d4ed8; }
  .tachado { font-size: 10px; color: #94a3b8; text-decoration: line-through; }
  .promo { font-size: 13px; font-weight: 900; color: #ea6c00; }
  .badge { font-size: 8px; font-weight: 700; color: #fff; background: #ea6c00; border-radius: 3px; padding: 1px 3px; }
`;

const CSS_58MM = `
  @page { size: 58mm auto; margin: 2mm; }
  body { margin: 0; padding: 2mm; background: white; width: 54mm; font-family: Arial, sans-serif; }
  .contenedor { display: flex; flex-direction: column; gap: 3mm; }
  .etiqueta { width: 100%; text-align: center; page-break-inside: avoid; border-bottom: 1px dashed #ccc; padding-bottom: 3mm; box-sizing: border-box; }
  .nombre { font-size: 8pt; font-weight: 700; text-transform: uppercase; color: #000; margin-bottom: 2mm; line-height: 1.3; }
  .etiqueta svg { display: block; margin: 0 auto; height: auto; }
  .precios { margin-top: 2mm; display: flex; align-items: center; justify-content: center; gap: 3mm; flex-wrap: wrap; }
  .normal { font-size: 12pt; font-weight: 900; color: #000; }
  .tachado { font-size: 8pt; color: #888; text-decoration: line-through; }
  .promo { font-size: 12pt; font-weight: 900; color: #ea6c00; }
  .badge { font-size: 7pt; font-weight: 700; color: #fff; background: #ea6c00; border-radius: 2px; padding: 0 2px; }
`;

export async function imprimirEtiquetas(
  productos: ProductoSucursal[],
  tamaño: TamañoEtiqueta,
  onError: (msg: string) => void,
) {
  const JsBarcode = (await import("jsbarcode")).default;

  const generarSvg = (codigo: string): string => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const format = /^\d{13}$/.test(codigo) ? "EAN13" : /^\d{12}$/.test(codigo) ? "UPC" : "CODE128";
    JsBarcode(svg, codigo, {
      format,
      // Ancho de módulo generoso para que las barras sean nítidas al imprimir.
      // El SVG NO se reescala en el CSS, así los anchos de barra se respetan exactamente.
      width: tamaño === "58mm" ? 1.8 : 2,
      height: tamaño === "58mm" ? 60 : 55,
      displayValue: true,
      fontSize: tamaño === "58mm" ? 13 : 12,
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
    <style>${tamaño === "58mm" ? CSS_58MM : CSS_A4}</style></head>
    <body><div class="contenedor">${etiquetasHtml}</div></body></html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) { onError("Bloqueador de popups activo. Permítelo e intenta de nuevo."); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 600);
}

export default function ModalImprimirEtiquetas({ isOpen, onClose, productos, onError }: Props) {
  const handleImprimir = async (tamaño: TamañoEtiqueta) => {
    onClose();
    await imprimirEtiquetas(productos, tamaño, onError);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Imprimir códigos" className="max-w-sm">
      <div className="flex gap-3 pt-1">
        <button
          onClick={() => handleImprimir("A4")}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-brand-blue hover:bg-blue-700 active:scale-95 text-white font-semibold text-sm transition-all"
        >
          <Printer className="w-4 h-4" />
          A4
        </button>
        <button
          onClick={() => handleImprimir("58mm")}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-violet-500 hover:bg-violet-600 active:scale-95 text-white font-semibold text-sm transition-all"
        >
          <Printer className="w-4 h-4" />
          58 mm
        </button>
      </div>
    </Modal>
  );
}
