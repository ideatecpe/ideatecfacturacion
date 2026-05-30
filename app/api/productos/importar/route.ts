import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

export interface FilaProducto {
  fila: number;
  nomProducto: string;
  precioUnitario: number | null;
  tipoProducto: string;
  tipoAfectacionIGV: string;
  incluirIGV: boolean;
  unidadMedida: string;
  categoria: string;
  codigo: string;
  errorValidacion?: string; // si hay error de validación de datos
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const sheet = workbook.getWorksheet("Productos") ?? workbook.worksheets[0];
    if (!sheet) {
      return NextResponse.json({ error: "No se encontró la hoja 'Productos'." }, { status: 400 });
    }

    const filas: FilaProducto[] = [];

    sheet.eachRow((row, rowNum) => {
      const cell1 = row.getCell(1).value?.toString().trim() ?? "";

      // Saltar filas vacías o de encabezado/instrucción
      if (
        cell1 === "" ||
        cell1.toLowerCase().includes("nombre producto") ||
        cell1.toLowerCase().includes("obligatorio") ||
        cell1.toLowerCase().includes("opcional") ||
        cell1.toLowerCase().includes("completa solo") ||
        cell1.toLowerCase().startsWith("📋")
      ) return;

      const getStr = (col: number) =>
        row.getCell(col).value?.toString().trim() ?? "";

      const getNum = (col: number): number | null => {
        const v = row.getCell(col).value;
        if (v === null || v === undefined || v === "") return null;
        const n = Number(v);
        return isNaN(n) ? null : n;
      };

      const nomProducto      = getStr(1);
      const precioUnitario   = getNum(2);
      const tipoProductoRaw  = getStr(3).toUpperCase();
      const afectacionRaw    = getStr(4);
      const incluirIGVRaw    = getStr(5).toUpperCase();
      const unidadRaw        = getStr(6).toUpperCase();
      const categoria        = getStr(7);
      const codigo           = getStr(8);

      const tipoProducto     = ["BIEN", "SERVICIO"].includes(tipoProductoRaw) ? tipoProductoRaw : "BIEN";
      const tipoAfectacionIGV = ["10", "20", "30"].includes(afectacionRaw) ? afectacionRaw : "10";
      const incluirIGV       = incluirIGVRaw === "" ? true : ["TRUE", "1", "SI", "SÍ", "S"].includes(incluirIGVRaw);
      const unidadMedida     = tipoProducto === "SERVICIO"
        ? (["ZZ", "NIU", "KGM", "LTR"].includes(unidadRaw) ? unidadRaw : "ZZ")
        : (["NIU", "KGM", "LTR"].includes(unidadRaw) ? unidadRaw : "NIU");

      // Validaciones básicas
      let errorValidacion: string | undefined;
      if (!nomProducto) errorValidacion = "Nombre del producto vacío";
      else if (precioUnitario === null || precioUnitario <= 0) errorValidacion = "Precio debe ser mayor a 0";

      filas.push({
        fila: rowNum,
        nomProducto,
        precioUnitario,
        tipoProducto,
        tipoAfectacionIGV,
        incluirIGV,
        unidadMedida,
        categoria,
        codigo,
        errorValidacion,
      });
    });

    if (filas.length === 0) {
      return NextResponse.json({ error: "El archivo no contiene filas de productos." }, { status: 400 });
    }

    return NextResponse.json({ filas });
  } catch (err) {
    console.error("Error parseando Excel:", err);
    return NextResponse.json({ error: "No se pudo leer el archivo. Asegúrate de usar la plantilla .xlsx correcta." }, { status: 500 });
  }
}
