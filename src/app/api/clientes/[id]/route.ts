import { NextResponse } from "next/server";

// Exclusão server-side com a SECRET key (RLS não permite DELETE anônimo).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: "id inválido." }, { status: 400 });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[clientes delete] SUPABASE_URL / SUPABASE_SECRET_KEY não configurados.");
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 500 });
  }

  try {
    const res = await fetch(`${url}/rest/v1/Clientes?id=eq.${id}`, {
      method: "DELETE",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "return=minimal",
      },
    });
    if (!res.ok) {
      const detalhe = await res.text();
      console.error("[clientes delete] falhou:", res.status, detalhe);
      return NextResponse.json({ error: "Não foi possível excluir." }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[clientes delete] erro inesperado:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
