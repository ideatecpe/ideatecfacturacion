export const consultaRuc = async (ruc: string) => {
  const res = await fetch("https://api.json.pe/api/ruc", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.NEXT_PUBLIC_JSONPE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ruc }),
  });

  if (!res.ok) return null;

  const data = await res.json();

  if (!data.success || !data.data) return null;

  const d = data.data;
  return {
    razonSocial: d.nombre_o_razon_social || "",
    direccionLineal: d.direccion || "",
    departamento: d.departamento || "",
    provincia: d.provincia || "",
    distrito: d.distrito || "",
    ubigeo: d.ubigeo_sunat || "",
  };
};