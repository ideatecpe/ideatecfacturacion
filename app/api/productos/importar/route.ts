import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { normalizarTexto } from "@/app/utils/normalizarTexto";

export interface FilaProducto {
  fila: number;
  nomProducto: string;
  precioUnitario: number | null;
  precioCompra: number | null;
  stock: number | null;
  tipoProducto: string;
  tipoAfectacionIGV: string;
  incluirIGV: boolean;
  unidadMedida: string;
  categoria: string;
  codigo: string;
  codigoBarras: string;
  urlImagenProducto: string;
  errorValidacion?: string; // si hay error de validación de datos
}

type Campo =
  | "nomProducto"
  | "precioUnitario"
  | "precioCompra"
  | "stock"
  | "tipoProducto"
  | "tipoAfectacionIGV"
  | "incluirIGV"
  | "unidadMedida"
  | "categoria"
  | "codigo"
  | "codigoBarras"
  | "urlImagenProducto";

// Las columnas se detectan por el NOMBRE del encabezado, no por su posición.
// Así el mismo endpoint acepta la plantilla en blanco y el "Reporte de Productos"
// descargado desde la lista, que trae otras columnas y en otro orden.
const ENCABEZADOS: Record<string, Campo> = {
  "nombre producto": "nomProducto",
  "nombre del producto": "nomProducto",
  producto: "nomProducto",
  nombre: "nomProducto",

  "precio venta": "precioUnitario",
  "precio de venta": "precioUnitario",
  "precio unitario": "precioUnitario",
  "precio unit": "precioUnitario",
  precio: "precioUnitario",

  "precio compra": "precioCompra",
  "precio de compra": "precioCompra",
  "costo unitario": "precioCompra",
  costo: "precioCompra",

  stock: "stock",

  "tipo producto": "tipoProducto",
  "tipo de producto": "tipoProducto",
  tipo: "tipoProducto",

  "tipo afectacion igv": "tipoAfectacionIGV",
  "afectacion igv": "tipoAfectacionIGV",
  "tipo igv": "tipoAfectacionIGV",
  igv: "tipoAfectacionIGV",

  "precio incluye igv": "incluirIGV",
  "incluye igv": "incluirIGV",
  "incluir igv": "incluirIGV",
  "inc igv": "incluirIGV",

  "unidad de medida": "unidadMedida",
  "unidad medida": "unidadMedida",
  "unid medida": "unidadMedida",
  unidad: "unidadMedida",

  categoria: "categoria",

  "codigo interno": "codigo",
  codigo: "codigo",

  "codigo de barras": "codigoBarras",
  "codigo barras": "codigoBarras",
  "cod barras": "codigoBarras",
  barras: "codigoBarras",

  // "Imagen (URL)" queda como "imagen" al normalizar (se quitan los paréntesis).
  imagen: "urlImagenProducto",
  "url imagen": "urlImagenProducto",
  "url de imagen": "urlImagenProducto",
  "imagen producto": "urlImagenProducto",
  "imagen del producto": "urlImagenProducto",
  url: "urlImagenProducto",
};

const UNIDADES_VALIDAS = [
  "NIU", "BX", "KGM", "GRM", "TNE", "LTR", "MLT", "MTR", "MTK", "MTQ", "ZZ",
  "GLI", "DZN", "SET", "PAQ", "CEN", "MIL",
];

// "Precio Venta (S/)" → "precio venta" ; "Nombre Producto\n(OBLIGATORIO)" → "nombre producto"
const normalizarEncabezado = (valor: string): string =>
  normalizarTexto(valor)             // minúsculas y sin tildes
    .replace(/\([^)]*\)/g, " ")      // "(S/)", "(OPCIONAL)", "(OBLIGATORIO)"
    .replace(/[^a-z0-9]+/g, " ")     // puntos, saltos de línea, guiones
    .trim();

const textoCelda = (row: ExcelJS.Row, col: number): string => {
  const v = row.getCell(col).value as unknown;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.richText))
      return (o.richText as { text: string }[]).map((t) => t.text).join("").trim();
    if ("result" in o) return o.result == null ? "" : String(o.result).trim();
    if ("text" in o) return String(o.text).trim();
    return "";
  }
  return String(v).trim();
};

const numeroCelda = (row: ExcelJS.Row, col: number): number | null => {
  const v = row.getCell(col).value as unknown;
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "result" in v) {
    const r = (v as { result: unknown }).result;
    if (typeof r === "number") return r;
  }

  const raw = textoCelda(row, col);
  if (raw === "" || raw === "-") return null; // "-" = servicios en el reporte

  const limpio = raw.replace(/[^\d,.-]/g, "");
  // "12,50" → coma decimal ; "1,234.50" → coma de millar
  const normalizado =
    /,\d{1,2}$/.test(limpio) && !limpio.includes(".")
      ? limpio.replace(",", ".")
      : limpio.replace(/,/g, "");

  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
};

/**
 * Busca la fila de encabezados dentro de las primeras filas de la hoja.
 * El reporte descargado trae título y subtítulo antes de los encabezados,
 * y la plantilla trae una línea de instrucciones, por eso no se puede asumir
 * que los encabezados estén siempre en la misma fila.
 */
function detectarEncabezados(sheet: ExcelJS.Worksheet): {
  filaEncabezado: number;
  columnas: Partial<Record<Campo, number>>;
} | null {
  const ultimaFilaAExplorar = Math.min(sheet.rowCount, 25);
  const ultimaColumna = Math.max(sheet.columnCount, 1);

  for (let r = 1; r <= ultimaFilaAExplorar; r++) {
    const row = sheet.getRow(r);
    const columnas: Partial<Record<Campo, number>> = {};

    for (let c = 1; c <= ultimaColumna; c++) {
      const campo = ENCABEZADOS[normalizarEncabezado(textoCelda(row, c))];
      // Si el mismo campo aparece dos veces, gana la primera columna.
      if (campo && columnas[campo] === undefined) columnas[campo] = c;
    }

    if (columnas.nomProducto && Object.keys(columnas).length >= 2)
      return { filaEncabezado: r, columnas };
  }

  return null;
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

    const sheet =
      workbook.getWorksheet("Productos") ??
      workbook.getWorksheet("Reporte Productos") ??
      workbook.worksheets[0];

    if (!sheet) {
      return NextResponse.json({ error: "El archivo no contiene ninguna hoja." }, { status: 400 });
    }

    const encabezados = detectarEncabezados(sheet);
    if (!encabezados) {
      return NextResponse.json(
        {
          error:
            "No se encontró la fila de encabezados. Usa la plantilla o el Reporte de Productos descargado, " +
            "y asegúrate de que exista una columna llamada 'Nombre Producto'.",
        },
        { status: 400 },
      );
    }

    const { filaEncabezado, columnas } = encabezados;

    const str = (row: ExcelJS.Row, campo: Campo): string =>
      columnas[campo] ? textoCelda(row, columnas[campo]!) : "";

    const num = (row: ExcelJS.Row, campo: Campo): number | null =>
      columnas[campo] ? numeroCelda(row, columnas[campo]!) : null;

    const filas: FilaProducto[] = [];

    // Duplicados DENTRO del archivo. Si no se detectan aquí, la primera fila se crea
    // y la segunda la rechaza el backend con "ya está asignado a otro producto",
    // mensaje confuso porque ese "otro producto" es una fila del mismo Excel.
    const codigosVistos = new Map<string, number>();
    const barrasVistos = new Map<string, number>();

    sheet.eachRow((row, rowNum) => {
      if (rowNum <= filaEncabezado) return;

      // Fila "TOTAL: N producto(s)" del reporte (celdas combinadas desde la columna A).
      if (textoCelda(row, 1).toLowerCase().startsWith("total")) return;

      const nomProducto = str(row, "nomProducto");
      if (!nomProducto) return; // fila vacía

      const tipoProductoRaw = str(row, "tipoProducto").toUpperCase();
      const afectacionRaw   = str(row, "tipoAfectacionIGV").toUpperCase();
      const incluirIGVRaw   = str(row, "incluirIGV").toUpperCase();
      const unidadRaw       = str(row, "unidadMedida").toUpperCase();
      const categoriaRaw    = str(row, "categoria");

      const tipoProducto = ["BIEN", "SERVICIO"].includes(tipoProductoRaw)
        ? tipoProductoRaw
        : "BIEN";

      // Acepta el código SUNAT (10/20/30) y también la etiqueta del reporte.
      const tipoAfectacionIGV = ["10", "20", "30"].includes(afectacionRaw)
        ? afectacionRaw
        : afectacionRaw.startsWith("EXONERADO")
          ? "20"
          : afectacionRaw.startsWith("INAFECTO")
            ? "30"
            : "10";

      const incluirIGV =
        incluirIGVRaw === ""
          ? true
          : ["TRUE", "1", "SI", "SÍ", "S"].includes(incluirIGVRaw);

      const unidadMedida = UNIDADES_VALIDAS.includes(unidadRaw)
        ? unidadRaw
        : tipoProducto === "SERVICIO"
          ? "ZZ"
          : "NIU";

      // El reporte escribe "Sin categoría" cuando el producto no tiene ninguna:
      // no debe crearse una categoría con ese nombre.
      const categoria =
        normalizarTexto(categoriaRaw) === "sin categoria" ? "" : categoriaRaw;

      // Solo se acepta una URL http(s); cualquier otra cosa se ignora para no
      // guardar basura en el campo de imagen del producto.
      const urlImagenRaw = str(row, "urlImagenProducto");
      const urlImagenProducto = /^https?:\/\/\S+$/i.test(urlImagenRaw)
        ? urlImagenRaw
        : "";

      const precioUnitario = num(row, "precioUnitario");
      const precioCompra   = tipoProducto === "SERVICIO" ? null : num(row, "precioCompra");
      const stock          = tipoProducto === "SERVICIO" ? null : num(row, "stock");

      const codigo = str(row, "codigo");
      const codigoBarras = str(row, "codigoBarras");

      // Validaciones básicas
      let errorValidacion: string | undefined;
      if (precioUnitario === null || precioUnitario <= 0) {
        errorValidacion = "Precio de venta debe ser mayor a 0";
      } else if (stock !== null && stock > 0 && (precioCompra === null || precioCompra <= 0)) {
        // El backend exige el costo para poder abrir el lote PEPS del stock inicial.
        errorValidacion = "Falta 'Precio Compra' para poder registrar el stock inicial";
      } else if (codigo && codigosVistos.has(codigo.toLowerCase())) {
        errorValidacion = `El código '${codigo}' está repetido en el archivo (ya aparece en la fila ${codigosVistos.get(codigo.toLowerCase())})`;
      } else if (codigoBarras && barrasVistos.has(codigoBarras)) {
        errorValidacion = `El código de barras '${codigoBarras}' está repetido en el archivo (ya aparece en la fila ${barrasVistos.get(codigoBarras)})`;
      }

      // Solo se registran como "vistos" las filas que sí se van a enviar.
      if (!errorValidacion) {
        if (codigo) codigosVistos.set(codigo.toLowerCase(), rowNum);
        if (codigoBarras) barrasVistos.set(codigoBarras, rowNum);
      }

      filas.push({
        fila: rowNum,
        nomProducto,
        precioUnitario,
        precioCompra,
        stock,
        tipoProducto,
        tipoAfectacionIGV,
        incluirIGV,
        unidadMedida,
        categoria,
        codigo,
        codigoBarras,
        urlImagenProducto,
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
