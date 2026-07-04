import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    return NextResponse.json({ ok: false, error: "Credenciales de Cloudflare no configuradas." }, { status: 500 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ ok: false, error: "No se recibió ningún archivo." }, { status: 400 });
  }

  const cfForm = new FormData();
  cfForm.append("file", file, file.name);

  const cfRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
    { method: "POST", headers: { Authorization: `Bearer ${apiToken}` }, body: cfForm }
  );

  const data = await cfRes.json();

  if (data.success) {
    return NextResponse.json({ ok: true, url: data.result.variants[0], imageId: data.result.id });
  }

  return NextResponse.json({ ok: false, error: JSON.stringify(data.errors) }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    return NextResponse.json({ ok: false, error: "Credenciales de Cloudflare no configuradas." }, { status: 500 });
  }

  const { imageId } = await req.json();
  if (!imageId) {
    return NextResponse.json({ ok: false, error: "imageId requerido." }, { status: 400 });
  }

  const cfRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${imageId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${apiToken}` } }
  );

  const data = await cfRes.json();
  if (data.success) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: JSON.stringify(data.errors) }, { status: 400 });
}
