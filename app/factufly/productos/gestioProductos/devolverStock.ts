import axios from "axios";

export interface ItemDevolverStock {
  productoId: number;
  sucursalId: number;
  cantidad: number;
  referenciaTipo?: string;
  referenciaId?: number;
}

// Suma al stock la cantidad devuelta de cada productoId/sucursalId.
export async function devolverStock(
  items: ItemDevolverStock[],
  accessToken: string | null | undefined,
): Promise<void> {
  if (!items.length) return;

  await axios.put(
    `${process.env.NEXT_PUBLIC_API_URL}/api/productos/devolverstock`,
    items,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
}
