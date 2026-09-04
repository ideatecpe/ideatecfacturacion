// Utilidades compartidas para elegir un formato de código de barras seguro.
// react-barcode / JsBarcode VALIDAN el dígito verificador de EAN13 y UPC y
// lanzan una excepción si no coincide (aunque el código tenga el largo correcto).
// Por eso nunca hay que decidir el formato solo por cantidad de dígitos: hay
// que validar el checksum antes de usar EAN13/UPC, y si no es válido, caer a
// CODE128 (que acepta cualquier valor sin lanzar error).

// Dígito verificador EAN-13 para los primeros 12 dígitos.
export function digitoVerificadorEAN13(base12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(base12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

// Dígito verificador UPC-A para los primeros 11 dígitos.
export function digitoVerificadorUPCA(base11: string): number {
  let sum = 0;
  for (let i = 0; i < 11; i++) sum += parseInt(base11[i]) * (i % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10;
}

// Genera un EAN-13 interno válido (prefijo 200, reservado para uso interno de tiendas).
export function generarEAN13Interno(): string {
  const base12 = "200" + Date.now().toString().slice(-9);
  return base12 + digitoVerificadorEAN13(base12);
}

// Formato seguro para react-barcode/JsBarcode: solo usa EAN13/UPC si el
// dígito verificador es válido; en cualquier otro caso (código escaneado o
// escrito a mano con checksum inválido/inexistente) cae a CODE128.
export function formatoBarcodeSeguro(codigo: string): "EAN13" | "UPC" | "CODE128" {
  if (/^\d{13}$/.test(codigo) && digitoVerificadorEAN13(codigo.slice(0, 12)) === Number(codigo[12]))
    return "EAN13";
  if (/^\d{12}$/.test(codigo) && digitoVerificadorUPCA(codigo.slice(0, 11)) === Number(codigo[11]))
    return "UPC";
  return "CODE128";
}

// Detecta si un código de barras fue autogenerado por el sistema (botón "Generar")
// en vez de ingresado/escaneado: `generarEAN13Interno` siempre produce un EAN-13 con
// prefijo "200" (rango GS1 reservado para uso interno de tiendas) y checksum válido.
// Un código real de fábrica prácticamente nunca cae en ese prefijo, así que sirve
// como heurística para distinguir "generado" de "ingresado" sin guardar un flag aparte.
export function esCodigoBarrasGenerado(codigo: string): boolean {
  if (!/^200\d{10}$/.test(codigo)) return false;
  return digitoVerificadorEAN13(codigo.slice(0, 12)) === Number(codigo[12]);
}
