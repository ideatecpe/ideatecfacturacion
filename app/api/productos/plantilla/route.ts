import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export async function GET() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FactuFly";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Productos", {
    pageSetup: { fitToPage: true, fitToWidth: 1 },
  });

  // ── Columnas ──────────────────────────────────────────────────────────────
  sheet.columns = [
    { key: "nomProducto",       width: 30 },
    { key: "precioUnitario",    width: 16 },
    { key: "tipoProducto",      width: 14 },
    { key: "tipoAfectacionIGV", width: 20 },
    { key: "incluirIGV",        width: 16 },
    { key: "unidadMedida",      width: 16 },
    { key: "categoria",         width: 18 },
    { key: "codigo",            width: 18 },
  ];

  // ── Fila 1: instrucción general ───────────────────────────────────────────
  const instrRow = sheet.getRow(1);
  instrRow.getCell(1).value =
    "📋  Completa solo las columnas que necesites. Las marcadas como OPCIONAL pueden dejarse en blanco.";
  instrRow.getCell(1).font = { italic: true, color: { argb: "FF555555" }, size: 10 };
  sheet.mergeCells("A1:I1");
  instrRow.height = 18;

  // ── Fila 2: cabeceras ─────────────────────────────────────────────────────
  const headers: { label: string; optional: boolean; comment: string }[] = [
    { label: "Nombre Producto",       optional: false, comment: "Nombre completo del producto o servicio." },
    { label: "Precio Unitario",       optional: false, comment: "Precio en soles (S/). Ej: 25.50" },
    { label: "Tipo Producto",         optional: true,  comment: "BIEN  o  SERVICIO\n(por defecto: BIEN)" },
    { label: "Tipo Afectación IGV",   optional: true,  comment: "10 = Gravado\n20 = Exonerado\n30 = Inafecto\n(por defecto: 10)" },
    { label: "Precio Incluye IGV",    optional: true,  comment: "TRUE o FALSE\nSolo aplica si Afectación=10\n(por defecto: TRUE)" },
    { label: "Unidad de Medida",      optional: true,  comment: "NIU = Unidad\nKGM = Kilogramo\nLTR = Litro\nZZ = Servicio\n(por defecto: NIU; SERVICIO usa ZZ)" },
    { label: "Categoría",            optional: false, comment: "Nombre de la categoría. Ej: Bebidas, Ferretería, etc." },
    { label: "Código Interno",        optional: true,  comment: "Código interno del producto.\nSi se deja vacío se genera automáticamente." },
  ];

  const headerRow = sheet.getRow(2);
  headerRow.height = 32;

  headers.forEach((h, idx) => {
    const col = idx + 1;
    const cell = headerRow.getCell(col);

    cell.value = h.optional ? `${h.label}\n(OPCIONAL)` : `${h.label}\n(OBLIGATORIO)`;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.font = { bold: true, size: 10, color: { argb: h.optional ? "FF444444" : "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: h.optional ? "FFDDEBF7" : "FF1F5EBF" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFAAAAAA" } },
      left: { style: "thin", color: { argb: "FFAAAAAA" } },
      bottom: { style: "thin", color: { argb: "FFAAAAAA" } },
      right: { style: "thin", color: { argb: "FFAAAAAA" } },
    };

    // Comentario explicativo
    cell.note = {
      texts: [{ text: h.comment, font: { size: 9 } }],
      editAs: "oneCells",
    };
  });

  // ── Filas de ejemplo (3 y 4) ──────────────────────────────────────────────
  const examples = [
    ["Arroz Premium 5kg", 12.5,  "BIEN",     "10", "TRUE",  "KGM", "Abarrotes", ""],
    ["Servicio de Instalación", 150, "SERVICIO", "10", "TRUE", "ZZ", "Servicios", "SVC-001"],
  ];

  examples.forEach((row, ri) => {
    const exRow = sheet.getRow(ri + 3);
    exRow.height = 20;
    row.forEach((val, ci) => {
      const cell = exRow.getCell(ci + 1);
      cell.value = val as ExcelJS.CellValue;
      cell.alignment = { vertical: "middle", horizontal: "left" };
      cell.font = { size: 10, italic: true, color: { argb: "FF888888" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF9FAFB" },
      };
      cell.border = {
        top:    { style: "thin", color: { argb: "FFDDDDDD" } },
        left:   { style: "thin", color: { argb: "FFDDDDDD" } },
        bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
        right:  { style: "thin", color: { argb: "FFDDDDDD" } },
      };
    });
  });

  // ── Fila 5 en adelante: zona editable vacía (estilo limpio) ──────────────
  for (let r = 5; r <= 54; r++) {
    const dataRow = sheet.getRow(r);
    dataRow.height = 18;
    for (let c = 1; c <= 9; c++) {
      const cell = dataRow.getCell(c);
      cell.border = {
        top:    { style: "hair", color: { argb: "FFCCCCCC" } },
        left:   { style: "hair", color: { argb: "FFCCCCCC" } },
        bottom: { style: "hair", color: { argb: "FFCCCCCC" } },
        right:  { style: "hair", color: { argb: "FFCCCCCC" } },
      };
    }
  }

  // ── Hoja de referencia ────────────────────────────────────────────────────
  const refSheet = workbook.addWorksheet("📖 Referencia");
  refSheet.columns = [
    { key: "campo",   width: 26 },
    { key: "valores", width: 40 },
    { key: "defecto", width: 20 },
  ];

  const refHeader = refSheet.getRow(1);
  ["Campo", "Valores válidos", "Valor por defecto"].forEach((txt, i) => {
    const c = refHeader.getCell(i + 1);
    c.value = txt;
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F5EBF" } };
    c.alignment = { vertical: "middle", horizontal: "center" };
    c.border = { bottom: { style: "medium", color: { argb: "FF0000AA" } } };
  });
  refHeader.height = 24;

  const refs = [
    ["Tipo Producto",       "BIEN | SERVICIO",                             "BIEN"],
    ["Tipo Afectación IGV", "10 (Gravado) | 20 (Exonerado) | 30 (Inafecto)", "10"],
    ["Precio Incluye IGV",  "TRUE | FALSE  (solo si IGV=10)",               "TRUE"],
    ["Unidad de Medida",    "NIU (Unidad) | KGM (Kg) | LTR (Litro) | ZZ (Servicio)",  "NIU / ZZ si SERVICIO"],
    ["Código Interno",      "Texto libre. Vacío = se genera automático.",   "(auto)"],
  ];

  refs.forEach(([campo, valores, defecto], ri) => {
    const rRow = refSheet.getRow(ri + 2);
    rRow.height = 20;
    [campo, valores, defecto].forEach((v, ci) => {
      const c = rRow.getCell(ci + 1);
      c.value = v;
      c.font = { size: 10 };
      c.alignment = { vertical: "middle", wrapText: true };
      c.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: ri % 2 === 0 ? "FFFFFFFF" : "FFF3F7FF" },
      };
      c.border = {
        top:    { style: "hair", color: { argb: "FFCCCCCC" } },
        bottom: { style: "hair", color: { argb: "FFCCCCCC" } },
        left:   { style: "hair", color: { argb: "FFCCCCCC" } },
        right:  { style: "hair", color: { argb: "FFCCCCCC" } },
      };
    });
  });

  // ── Exportar ──────────────────────────────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="plantilla_productos_FactuFly.xlsx"',
    },
  });
}

