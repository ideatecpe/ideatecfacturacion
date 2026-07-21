"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { X as XIcon, Search } from "lucide-react";

interface ItemCatalogo {
  item: number;
  codigo: string;
  descripcion: string;
  anexo: string;
  seccion: string;
}

const CATALOGO: ItemCatalogo[] = [
  // ── Catálogo 25.1 ──────────────────────────────────────────
  { item: 1,  codigo: "11101616", descripcion: "Mineral de oro",                                                                               anexo: "25.1", seccion: "Oro" },
  { item: 2,  codigo: "11101801", descripcion: "Oro",                                                                                          anexo: "25.1", seccion: "Oro" },
  { item: 3,  codigo: "12131500", descripcion: "Explosivos",                                                                                   anexo: "25.1", seccion: "Explosivos" },
  { item: 4,  codigo: "12131501", descripcion: "Dinamita",                                                                                     anexo: "25.1", seccion: "Explosivos" },
  { item: 5,  codigo: "12131502", descripcion: "Cartuchos explosivos",                                                                         anexo: "25.1", seccion: "Explosivos" },
  { item: 6,  codigo: "12131503", descripcion: "Explosivos propelentes",                                                                       anexo: "25.1", seccion: "Explosivos" },
  { item: 7,  codigo: "12131504", descripcion: "Cargas explosivas",                                                                            anexo: "25.1", seccion: "Explosivos" },
  { item: 8,  codigo: "12131505", descripcion: "Explosivos plásticos",                                                                         anexo: "25.1", seccion: "Explosivos" },
  { item: 9,  codigo: "12131506", descripcion: "Explosivos aluminizados",                                                                      anexo: "25.1", seccion: "Explosivos" },
  { item: 10, codigo: "12131508", descripcion: "Explosivos de polvo de nitroglicerina",                                                        anexo: "25.1", seccion: "Explosivos" },
  { item: 11, codigo: "12131509", descripcion: "Nitrato de amonio y fuel oil",                                                                 anexo: "25.1", seccion: "Explosivos" },
  { item: 12, codigo: "12131507", descripcion: "Explosivos de nitrato de amonio",                                                              anexo: "25.1", seccion: "Explosivos" },
  { item: 13, codigo: "12141726", descripcion: "Mercurio Hg",                                                                                  anexo: "25.1", seccion: "Insumos químicos" },
  { item: 14, codigo: "12352117", descripcion: "Cianuros o isocianuros",                                                                       anexo: "25.1", seccion: "Insumos químicos" },
  { item: 15, codigo: "15100000", descripcion: "Otros combustibles",                                                                           anexo: "25.1", seccion: "Combustible" },
  { item: 16, codigo: "15101505", descripcion: "Combustible diésel",                                                                           anexo: "25.1", seccion: "Combustible" },
  { item: 17, codigo: "15101506", descripcion: "Gasolina",                                                                                     anexo: "25.1", seccion: "Combustible" },
  { item: 18, codigo: "20101504", descripcion: "Cortadores de roca",                                                                           anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 19, codigo: "20101600", descripcion: "Cribas y equipos de alimentación",                                                             anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 20, codigo: "20111601", descripcion: "Maquinaria de sondeo o de perforación",                                                        anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 21, codigo: "20111607", descripcion: "Maquinaria para hacer túneles",                                                                anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 22, codigo: "22101501", descripcion: "Cargadores frontales",                                                                         anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 23, codigo: "22101502", descripcion: "Niveladoras",                                                                                  anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 24, codigo: "22101505", descripcion: "Aplanadoras",                                                                                  anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 25, codigo: "22101509", descripcion: "Retroexcavadoras",                                                                             anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 26, codigo: "22101511", descripcion: "Compactadores",                                                                                anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 27, codigo: "22101513", descripcion: "Dragalíneas",                                                                                  anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 28, codigo: "22101514", descripcion: "Dragas",                                                                                       anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 29, codigo: "22101516", descripcion: "Excavadoras de fosos",                                                                         anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 30, codigo: "22101518", descripcion: "Raspadores elevadores",                                                                        anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 31, codigo: "22101519", descripcion: "Máquina giratoria con cazoleta de rastrillos abiertas",                                        anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 32, codigo: "22101520", descripcion: "Máquina giratoria con rastrillos elevadores",                                                  anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 33, codigo: "22101521", descripcion: "Rastrilladora arrastrada",                                                                     anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 34, codigo: "22101522", descripcion: "Buldóceres de orugas",                                                                         anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 35, codigo: "22101523", descripcion: "Buldóceres de ruedas",                                                                         anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 36, codigo: "22101524", descripcion: "Excavadoras móviles",                                                                          anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 37, codigo: "22101525", descripcion: "Excavadoras de ruedas",                                                                        anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 38, codigo: "22101526", descripcion: "Excavadoras de orugas",                                                                        anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 39, codigo: "22101528", descripcion: "Cargadores de ruedas",                                                                         anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 40, codigo: "22101529", descripcion: "Cargadores sobre patines con dirección",                                                       anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 41, codigo: "22101530", descripcion: "Raspadores abiertos",                                                                          anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 42, codigo: "22101532", descripcion: "Cargadores de orugas",                                                                         anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 43, codigo: "22101534", descripcion: "Excavadoras de campaña",                                                                       anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 44, codigo: "22101602", descripcion: "Equipo de apisonamiento",                                                                      anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 45, codigo: "22101701", descripcion: "Palas excavadoras",                                                                            anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 46, codigo: "22101702", descripcion: "Palas mecánicas para el movimiento de tierra o sus piezas o accesorios",                       anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 47, codigo: "22101713", descripcion: "Brazo de retroexcavadora o secciones del brazo",                                              anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 48, codigo: "22101714", descripcion: "Kits de reparación o piezas de apisonadora",                                                   anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 49, codigo: "25181709", descripcion: "Pala cargadora",                                                                               anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 50, codigo: "26111600", descripcion: "Generadores de potencia",                                                                      anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 51, codigo: "26111603", descripcion: "Generadores eólicos",                                                                          anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 52, codigo: "39121013", descripcion: "Convertidores rotativos eléctricos",                                                           anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 53, codigo: "40151530", descripcion: "Bombas de dragado",                                                                            anexo: "25.1", seccion: "Maquinarias y equipos" },
  { item: 54, codigo: "12352104", descripcion: "Alcoholes o sus sustitutos",                                                                   anexo: "25.1", seccion: "Otros bienes" },
  { item: 55, codigo: "50161509", descripcion: "Azúcares naturales o productos endulzantes",                                                   anexo: "25.1", seccion: "Otros bienes" },
  { item: 56, codigo: "50221101", descripcion: "Grano de cereal",                                                                              anexo: "25.1", seccion: "Otros bienes" },
  { item: 57, codigo: "71101710", descripcion: "Servicio de alquiler o leasing de maquinaria y equipo para minería",                           anexo: "25.1", seccion: "Servicios" },
  { item: 58, codigo: "72141701", descripcion: "Servicio de alquiler o leasing de maquinaria para construcción",                               anexo: "25.1", seccion: "Servicios" },
  { item: 59, codigo: "72141702", descripcion: "Servicio de alquiler o leasing de equipo para construcción",                                   anexo: "25.1", seccion: "Servicios" },
  { item: 60, codigo: "73121509", descripcion: "Servicios de purificación de metales",                                                         anexo: "25.1", seccion: "Servicios" },
  { item: 61, codigo: "73121613", descripcion: "Servicios de fundición de metales",                                                            anexo: "25.1", seccion: "Servicios" },
  { item: 62, codigo: "73121500", descripcion: "Procesos de fundición y refinación y formado de metales",                                      anexo: "25.1", seccion: "Servicios" },

  // ── Catálogo 25.2 ──────────────────────────────────────────
  { item: 1,  codigo: "10171503", descripcion: "Harina, polvo y pellets de pescado, crustáceos, moluscos y demás invertebrados acuáticos",     anexo: "25.2", seccion: "Recursos hidrobiológicos" },
  { item: 2,  codigo: "11101600", descripcion: "Minerales metálicos no auríferos",                                                             anexo: "25.2", seccion: "Minerales" },
  { item: 3,  codigo: "11101714", descripcion: "Plomo",                                                                                        anexo: "25.2", seccion: "Minerales" },
  { item: 4,  codigo: "11111600", descripcion: "Piedra",                                                                                       anexo: "25.2", seccion: "Minerales" },
  { item: 5,  codigo: "11111700", descripcion: "Arena",                                                                                        anexo: "25.2", seccion: "Minerales" },
  { item: 6,  codigo: "11121600", descripcion: "Madera",                                                                                       anexo: "25.2", seccion: "Forestal" },
  { item: 7,  codigo: "11140000", descripcion: "Chatarra y materiales de desecho",                                                             anexo: "25.2", seccion: "Chatarra" },
  { item: 8,  codigo: "50111500", descripcion: "Carnes y despojos comestibles",                                                                anexo: "25.2", seccion: "Carnes" },
  { item: 9,  codigo: "50120000", descripcion: "Recursos hidrobiológicos",                                                                     anexo: "25.2", seccion: "Recursos hidrobiológicos" },
  { item: 10, codigo: "50151600", descripcion: "Aceite de pescado",                                                                            anexo: "25.2", seccion: "Recursos hidrobiológicos" },
  { item: 11, codigo: "50161509", descripcion: "Caña de azúcar",                                                                               anexo: "25.2", seccion: "Agroindustriales" },
  { item: 12, codigo: "50171500", descripcion: "Páprika",                                                                                      anexo: "25.2", seccion: "Agroindustriales" },
  { item: 13, codigo: "50203205", descripcion: "Leche cruda entera",                                                                           anexo: "25.2", seccion: "Agroindustriales" },
  { item: 14, codigo: "50403200", descripcion: "Maíz amarillo",                                                                                anexo: "25.2", seccion: "Agroindustriales" },
  { item: 15, codigo: "11111111", descripcion: "Bienes gravados con el IGV por renuncia a la exoneración",                                     anexo: "25.2", seccion: "Otros" },

  // ── Catálogo 25.3 ──────────────────────────────────────────
  { item: 1,  codigo: "12142104", descripcion: "Dióxido de carbono",                                                                           anexo: "25.3", seccion: "Químicos" },
  { item: 2,  codigo: "13111039", descripcion: "Poli (tereftalato de etileno) sin adición de dióxido de titanio, en formas primarias",         anexo: "25.3", seccion: "Plásticos" },
  { item: 3,  codigo: "13102020", descripcion: "Envases o preformas, de poli (tereftalato de etileno) (PET)",                                  anexo: "25.3", seccion: "Plásticos" },
  { item: 4,  codigo: "15101502", descripcion: "Kerosene",                                                                                     anexo: "25.3", seccion: "Combustibles" },
  { item: 5,  codigo: "15101504", descripcion: "Combustible para aviación",                                                                    anexo: "25.3", seccion: "Combustibles" },
  { item: 6,  codigo: "15101509", descripcion: "Combustible de uso marino (bunker)",                                                           anexo: "25.3", seccion: "Combustibles" },
  { item: 7,  codigo: "15111510", descripcion: "Gas licuado de petróleo",                                                                      anexo: "25.3", seccion: "Combustibles" },
  { item: 8,  codigo: "24122000", descripcion: "Bombonas, botellas, frascos, bocales, tarros, envases tubulares y demás recipientes de vidrio", anexo: "25.3", seccion: "Envases" },
  { item: 9,  codigo: "24122004", descripcion: "Tapones, tapas, cápsulas y demás dispositivos de cierre",                                      anexo: "25.3", seccion: "Envases" },
  { item: 10, codigo: "24122004", descripcion: "Tapones y tapas, cápsulas para botellas, tapones roscados y accesorios para envases de metal",  anexo: "25.3", seccion: "Envases" },
  { item: 11, codigo: "50202201", descripcion: "Cerveza de malta",                                                                             anexo: "25.3", seccion: "Bebidas" },
  { item: 12, codigo: "50202300", descripcion: "Agua, incluida el agua mineral, natural o artificial y demás bebidas no alcohólicas",           anexo: "25.3", seccion: "Bebidas" },
  { item: 13, codigo: "50221002", descripcion: "Harina de trigo o de morcajo (tranquillón)",                                                   anexo: "25.3", seccion: "Cereales" },
  { item: 14, codigo: "50221110", descripcion: "Trigo y morcajo (tranquillón)",                                                                anexo: "25.3", seccion: "Cereales" },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSeleccionar: (codigo: string, descripcion: string) => void;
  codigoActual?: string;
}

export default function ModalCatalogoSunat({ isOpen, onClose, onSeleccionar, codigoActual }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const filaActualRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (isOpen) {
      setBusqueda("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && codigoActual && filaActualRef.current) {
      filaActualRef.current.scrollIntoView({ block: "center" });
    }
  }, [isOpen, codigoActual]);

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return CATALOGO;
    return CATALOGO.filter(
      (i) =>
        i.codigo.includes(q) ||
        i.descripcion.toLowerCase().includes(q) ||
        i.seccion.toLowerCase().includes(q) ||
        i.anexo.includes(q),
    );
  }, [busqueda]);

  const hayBusqueda = busqueda.trim().length > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-sm font-bold text-gray-800">Catálogo N° 25 — Códigos de Producto SUNAT</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Haz clic en una fila para seleccionar el código</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Buscador */}
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por código o descripción..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50"
              autoFocus
            />
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase w-12">N°</th>
                <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase w-36">Código SUNAT</th>
                <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase">Descripción</th>
              </tr>
            </thead>
            <tbody>
              {resultados.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">
                    No se encontraron resultados
                  </td>
                </tr>
              ) : (
                resultados.map((it, idx) => {
                  const seccionAnterior = idx > 0 ? `${resultados[idx - 1].anexo}|${resultados[idx - 1].seccion}` : null;
                  const seccionActual = `${it.anexo}|${it.seccion}`;
                  const esPrimeraDeSeccion = !hayBusqueda && seccionAnterior !== seccionActual;

                  return (
                    <React.Fragment key={`${it.anexo}-${it.item}`}>
                      {esPrimeraDeSeccion && (
                        <tr>
                          <td colSpan={3} className="px-4 pt-3 pb-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                              {it.seccion}
                            </span>
                          </td>
                        </tr>
                      )}
                      <tr
                        ref={it.codigo === codigoActual ? filaActualRef : null}
                        onClick={() => { onSeleccionar(it.codigo, it.descripcion); onClose(); }}
                        className={`cursor-pointer border-b border-gray-50 hover:bg-blue-50 hover:text-brand-blue transition-colors ${
                          it.codigo === codigoActual
                            ? "bg-blue-100 text-brand-blue font-medium"
                            : idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                        }`}
                      >
                        <td className="px-4 py-2.5 text-gray-400 text-xs">{it.item}</td>
                        <td className="px-4 py-2.5 font-mono font-semibold text-gray-800">{it.codigo}</td>
                        <td className="px-4 py-2.5 text-gray-700">{it.descripcion}</td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <p className="text-[11px] text-gray-400">
            {resultados.length} de {CATALOGO.length} códigos
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-gray-500 hover:text-gray-700"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
