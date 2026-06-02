export const consultaCe = async (ce: string) => {
  const res = await fetch("https://api.json.pe/api/ce", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.NEXT_PUBLIC_JSONPE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ce }),
  });

  if (!res.ok) return null;

  const data = await res.json();

  if (!data.success || !data.data) return null;

  const { nombres, apellido_paterno, apellido_materno } = data.data;
  return {
    nombreCompleto: `${nombres} ${apellido_paterno} ${apellido_materno}`,
  };
};
