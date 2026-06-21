type JsonPeTipoCambioResponse = {
  success?: boolean;
  data?: {
    compra?: number;
    buy?:   number;
    venta?: number;
    sale?:  number;
    fecha_sunat?: string;
    date?: string;
  };
};

export async function obtenerTipoCambioVenta(fecha: string): Promise<number> {
  const { venta } = await obtenerTipoCambio(fecha);
  return venta;
}

export async function obtenerTipoCambio(
  fecha: string,
): Promise<{ compra: number; venta: number }> {
  const token = process.env.NEXT_PUBLIC_JSONPE_TOKEN;
  if (!token) throw new Error("Falta NEXT_PUBLIC_JSONPE_TOKEN");

  const response = await fetch("https://api.json.pe/api/tipo_de_cambio", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fecha }),
  });

  if (!response.ok) throw new Error("No se pudo consultar el tipo de cambio");

  const result = (await response.json()) as JsonPeTipoCambioResponse;
  const venta  = result.data?.venta ?? result.data?.sale;
  const compra = result.data?.compra ?? result.data?.buy;

  if (!result.success || typeof venta !== "number" || venta <= 0) {
    throw new Error("Tipo de cambio invalido");
  }

  return {
    compra: typeof compra === "number" && compra > 0 ? compra : venta - 0.01,
    venta,
  };
}
