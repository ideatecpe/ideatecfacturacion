import axios from "axios";

export interface ItemActualizarStock {
  sucursalProductoId: number;
  cantidad: number;
}

// Descuenta del stock la cantidad vendida de cada sucursalProductoId.
export async function actualizarStock(
  items: ItemActualizarStock[],
  accessToken: string | null | undefined,
): Promise<void> {
  if (!items.length) return;

  await axios.put(
    `${process.env.NEXT_PUBLIC_API_URL}/api/productos/actualizarstock`,
    items,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
}
