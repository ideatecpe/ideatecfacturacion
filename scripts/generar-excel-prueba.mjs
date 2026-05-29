import ExcelJS from "exceljs";
import path from "path";

async function generateSampleExcel() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Productos");

  // Definir columnas según la plantilla actualizada
  sheet.columns = [
    { header: "Nombre Producto (OBLIGATORIO)", key: "nomProducto", width: 30 },
    { header: "Precio Unitario (OBLIGATORIO)", key: "precioUnitario", width: 16 },
    { header: "Tipo Producto (OPCIONAL)", key: "tipoProducto", width: 14 },
    { header: "Tipo Afectación IGV (OPCIONAL)", key: "tipoAfectacionIGV", width: 20 },
    { header: "Precio Incluye IGV (OPCIONAL)", key: "incluirIGV", width: 16 },
    { header: "Unidad de Medida (OPCIONAL)", key: "unidadMedida", width: 16 },
    { header: "Categoría (OBLIGATORIO)", key: "categoria", width: 18 },
    { header: "Stock Inicial (OPCIONAL)", key: "stock", width: 12 },
    { header: "Código SUNAT (OPCIONAL)", key: "codigoSunat", width: 18 },
    { header: "Código Interno (OPCIONAL)", key: "codigo", width: 18 },
  ];

  // Datos de prueba (10 productos)
  const data = [
    ["Coca Cola 500ml", 3.50, "BIEN", "10", "TRUE", "NIU", "Bebidas", 50, "50202306", "BEB-001"],
    ["Inca Kola 1.5L", 6.50, "BIEN", "10", "TRUE", "NIU", "Bebidas", 30, "50202306", "BEB-002"],
    ["Arroz Costeño 5kg", 18.50, "BIEN", "10", "TRUE", "KGM", "Abarrotes", 20, "50221101", "ABA-001"],
    ["Aceite Primor 1L", 11.20, "BIEN", "10", "TRUE", "LTR", "Abarrotes", 15, "50151513", "ABA-002"],
    ["Leche Gloria Azul 400g", 4.20, "BIEN", "10", "TRUE", "NIU", "Lácteos", 48, "50131702", "LAC-001"],
    ["Yogurt Gloria Fresa 1L", 7.50, "BIEN", "10", "TRUE", "LTR", "Lácteos", 12, "50131702", "LAC-002"],
    ["Detergente Bolívar 1kg", 9.80, "BIEN", "10", "TRUE", "KGM", "Limpieza", 25, "47131811", "LIM-001"],
    ["Jabón Rexona 3 unidades", 8.50, "BIEN", "10", "TRUE", "NIU", "Limpieza", 40, "53131608", "LIM-002"],
    ["Panetón D'Onofrio Caja", 28.00, "BIEN", "10", "TRUE", "NIU", "Panadería", 10, "50181901", "PAN-001"],
    ["Servicio de Delivery", 10.00, "SERVICIO", "10", "TRUE", "NIU", "Servicios", null, "", "DEL-001"],
  ];

  data.forEach(row => {
    sheet.addRow(row);
  });

  // Estilo para cabecera
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFDDEBF7' }
  };

  const filePath = path.join(process.cwd(), "productos_prueba_10.xlsx");
  await workbook.xlsx.writeFile(filePath);
}

generateSampleExcel();
