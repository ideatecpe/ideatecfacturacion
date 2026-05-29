import ExcelJS from "exceljs";
import path from "path";

async function generatePerfectSampleExcel() {
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
    { key: "stock",             width: 12 },
    { key: "codigoSunat",       width: 18 },
    { key: "codigo",            width: 18 },
  ];

  // ── Fila 1: instrucción general ───────────────────────────────────────────
  const instrRow = sheet.getRow(1);
  instrRow.getCell(1).value =
    "📋  Completa solo las columnas que necesites. Las marcadas como OPCIONAL pueden dejarse en blanco.";
  instrRow.getCell(1).font = { italic: true, color: { argb: "FF555555" }, size: 10 };
  sheet.mergeCells("A1:J1");
  instrRow.height = 18;

  // ── Fila 2: cabeceras ─────────────────────────────────────────────────────
  const headers = [
    { label: "Nombre Producto",       optional: false, comment: "Nombre completo del producto o servicio." },
    { label: "Precio Unitario",       optional: false, comment: "Precio en soles (S/). Ej: 25.50" },
    { label: "Tipo Producto",         optional: true,  comment: "BIEN  o  SERVICIO\n(por defecto: BIEN)" },
    { label: "Tipo Afectación IGV",   optional: true,  comment: "10 = Gravado\n20 = Exonerado\n30 = Inafecto\n(por defecto: 10)" },
    { label: "Precio Incluye IGV",    optional: true,  comment: "TRUE o FALSE\nSolo aplica si Afectación=10\n(por defecto: TRUE)" },
    { label: "Unidad de Medida",      optional: true,  comment: "NIU = Unidad\nKGM = Kilogramo\nLTR = Litro\n(por defecto: NIU)" },
    { label: "Categoría",            optional: false, comment: "Nombre de la categoría. Ej: Bebidas, Ferretería, etc." },
    { label: "Stock Inicial",         optional: true,  comment: "Cantidad inicial en inventario.\nDejar vacío si es SERVICIO.\n(por defecto: 0)" },
    { label: "Código SUNAT",          optional: true,  comment: "Código de producto SUNAT (catálogo). Ej: 43211503" },
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

    cell.note = {
      texts: [{ text: h.comment, font: { size: 9 } }],
      editAs: "oneCells",
    };
  });

  // ── Datos de prueba (Fila 3 en adelante) ──────────────────────────────────
  const testData = [
    ["Coca Cola 500ml", 3.50, "BIEN", "10", "TRUE", "NIU", "Bebidas", 50, "50202306", "BEB-001"],
    ["Inca Kola 1.5L", 6.50, "BIEN", "10", "TRUE", "NIU", "Bebidas", 30, "50202306", "BEB-002"],
    ["Arroz Costeño 5kg", 18.50, "BIEN", "10", "TRUE", "KGM", "Abarrotes", 20, "50221101", "ABA-001"],
    ["Aceite Primor 1L", 11.20, "BIEN", "10", "TRUE", "LTR", "Abarrotes", 15, "50151513", "ABA-002"],
    ["Leche Gloria Azul 400g", 4.20, "BIEN", "10", "TRUE", "NIU", "Lácteos", 48, "50131702", "LAC-001"],
    ["Yogurt Gloria Fresa 1L", 7.50, "BIEN", "10", "TRUE", "LTR", "Lácteos", 12, "50131702", "LAC-002"],
    ["Detergente Bolívar 1kg", 9.80, "BIEN", "10", "TRUE", "KGM", "Limpieza", 25, "47131811", "LIM-001"],
    ["Jabón Rexona 3 unidades", 8.50, "BIEN", "10", "TRUE", "NIU", "Limpieza", 40, "53131608", "LIM-002"],
    ["Panetón D'Onofrio Caja", 28.00, "BIEN", "10", "TRUE", "NIU", "Panadería", 10, "50181901", "PAN-001"],
    ["Servicio de Delivery", 10.00, "SERVICIO", "10", "TRUE", "NIU", "Servicios", "", "", "DEL-001"],
  ];

  testData.forEach((row, ri) => {
    const dataRow = sheet.getRow(ri + 3);
    dataRow.height = 20;
    row.forEach((val, ci) => {
      const cell = dataRow.getCell(ci + 1);
      cell.value = val;
      cell.alignment = { vertical: "middle", horizontal: "left" };
      cell.font = { size: 10 };
      cell.border = {
        top:    { style: "thin", color: { argb: "FFDDDDDD" } },
        left:   { style: "thin", color: { argb: "FFDDDDDD" } },
        bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
        right:  { style: "thin", color: { argb: "FFDDDDDD" } },
      };
    });
  });

  // Estilo para el resto de las filas vacías
  for (let r = 13; r <= 50; r++) {
    const emptyRow = sheet.getRow(r);
    for (let c = 1; c <= 10; c++) {
      const cell = emptyRow.getCell(c);
      cell.border = {
        top:    { style: "hair", color: { argb: "FFCCCCCC" } },
        left:   { style: "hair", color: { argb: "FFCCCCCC" } },
        bottom: { style: "hair", color: { argb: "FFCCCCCC" } },
        right:  { style: "hair", color: { argb: "FFCCCCCC" } },
      };
    }
  }

  const filePath = path.join(process.cwd(), "productos_prueba_final.xlsx");
  await workbook.xlsx.writeFile(filePath);
}

generatePerfectSampleExcel();

