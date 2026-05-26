type JsonPeTipoCambioResponse = {
  success?: boolean;
  data?: {
    venta?: number;
    sale?: number;
    fecha_sunat?: string;
    date?: string;
  };
};

export async function obtenerTipoCambioVenta(fecha: string): Promise<number> {
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

  if (!response.ok) {
    throw new Error("No se pudo consultar el tipo de cambio");
  }

  const result = (await response.json()) as JsonPeTipoCambioResponse;
  const venta = result.data?.venta ?? result.data?.sale;

  if (!result.success || typeof venta !== "number" || venta <= 0) {
    throw new Error("Tipo de cambio invalido");
  }

  return venta;
}
