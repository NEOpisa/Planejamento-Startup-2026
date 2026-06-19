import { NextResponse } from "next/server";

// Exclui um cliente usando a secret key do Supabase (server-side, nunca exposta
// ao navegador). Assim não é preciso liberar DELETE para o papel anon.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SECRET_KEY =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SECRET_KEY) {
    console.error("[clientes/delete] SUPABASE_URL / SUPABASE_SECRET_KEY não configurados.");
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 500 });
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/Clientes?id=eq.${id}`, {
      method: "DELETE",
      headers: {
        apikey: SECRET_KEY,
        Authorization: `Bearer ${SECRET_KEY}`,
        Prefer: "return=minimal",
      },
    });
    if (!res.ok) {
      const detalhe = await res.text();
      console.error("[clientes/delete] Supabase falhou:", res.status, detalhe);
      return NextResponse.json({ error: "Não foi possível excluir." }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[clientes/delete] erro inesperado:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
